import { prisma } from "../db";
import { logger } from "../logger";
import { ValidationError, EntityNotFoundError, ConflictError } from "../errors";
import {
  isValidDateStr,
  parseDateStr,
  todayStr,
  addDays,
  compareDateStr,
  startOfWeek,
} from "../dateUtils";
import { Habit, HabitLog, HabitType } from "@prisma/client";

export interface CreateHabitInput {
  name: string;
  type: "BINARY" | "NUMERIC";
  targetValue?: number;
  unit?: string;
}

function isDone(habit: Habit, log: HabitLog | undefined): boolean {
  if (!log) return false;
  if (habit.type === "BINARY") return log.completed === true;
  if (habit.type === "NUMERIC" && habit.targetValue != null) {
    return (log.value ?? 0) >= habit.targetValue;
  }
  return false;
}

export async function createHabit(userId: string, input: CreateHabitInput): Promise<Habit> {
  const name = (input.name ?? "").trim();
  if (!name) {
    throw new ValidationError("Назва є обов'язковою");
  }
  if (input.type !== "BINARY" && input.type !== "NUMERIC") {
    throw new ValidationError("Тип звички має бути BINARY або NUMERIC");
  }

  if (input.type === "NUMERIC") {
    if (input.targetValue == null || !Number.isInteger(input.targetValue) || input.targetValue <= 0) {
      throw new ValidationError("Цільове значення обов'язкове та має бути додатним цілим числом");
    }
    if (!input.unit || !input.unit.trim()) {
      throw new ValidationError("Одиниця виміру є обов'язковою для числової звички");
    }
  }

  const habit = await prisma.habit.create({
    data: {
      userId,
      name,
      type: input.type as HabitType,
      targetValue: input.type === "NUMERIC" ? input.targetValue : null,
      unit: input.type === "NUMERIC" ? input.unit!.trim() : null,
    },
  });

  logger.info({ userId, habitId: habit.id, name: habit.name, type: habit.type }, "Habit created");
  return habit;
}

async function calcStreak(habit: Habit, asOfDateStr: string): Promise<number> {
  // Pull every log up to asOfDate; small dataset per habit so an in-memory walk is fine.
  const logs = await prisma.habitLog.findMany({
    where: { habitId: habit.id, date: { lte: parseDateStr(asOfDateStr) } },
  });
  const doneDates = new Set(
    logs.filter((l) => isDone(habit, l)).map((l) => l.date.toISOString().slice(0, 10))
  );

  let cursor = asOfDateStr;
  let streak = 0;
  if (doneDates.has(cursor)) {
    streak = 1;
    cursor = addDays(cursor, -1);
  } else {
    // today (or asOfDate) not yet marked doesn't break a streak built on prior days
    cursor = addDays(cursor, -1);
  }
  while (doneDates.has(cursor)) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

export async function getDashboard(userId: string, dateStr: string) {
  if (!isValidDateStr(dateStr)) {
    throw new ValidationError(`Невалідна дата: ${dateStr}`);
  }
  const habits = await prisma.habit.findMany({
    where: { userId, archived: false },
    orderBy: { createdAt: "asc" },
  });

  const result = [];
  for (const habit of habits) {
    const log = await prisma.habitLog.findUnique({
      where: { habitId_date: { habitId: habit.id, date: parseDateStr(dateStr) } },
    });
    const streak = await calcStreak(habit, dateStr);
    result.push({
      id: habit.id,
      name: habit.name,
      type: habit.type,
      targetValue: habit.targetValue,
      unit: habit.unit,
      completed: habit.type === "BINARY" ? (log?.completed ?? false) : undefined,
      value: habit.type === "NUMERIC" ? (log?.value ?? 0) : undefined,
      status:
        habit.type === "NUMERIC"
          ? (log?.value ?? 0) <= 0
            ? "NOT_STARTED"
            : (log?.value ?? 0) >= (habit.targetValue ?? Infinity)
              ? "COMPLETED"
              : "IN_PROGRESS"
          : undefined,
      streak,
    });
  }
  return result;
}

export interface CheckInInput {
  date: string;
  completed?: boolean;
  value?: number;
}

async function getOwnedHabit(userId: string, habitId: string): Promise<Habit> {
  const habit = await prisma.habit.findUnique({ where: { id: habitId } });
  // Not found and "belongs to someone else" return the same error — don't leak existence.
  if (!habit || habit.userId !== userId) {
    throw new EntityNotFoundError("Habit", habitId);
  }
  return habit;
}

export async function checkIn(userId: string, habitId: string, input: CheckInInput) {
  const habit = await getOwnedHabit(userId, habitId);
  if (habit.archived) {
    throw new ConflictError("Не можна відмічати заархівовану звичку");
  }
  if (!isValidDateStr(input.date)) {
    throw new ValidationError(`Невалідна дата: ${input.date}`);
  }
  if (compareDateStr(input.date, todayStr()) > 0) {
    throw new ValidationError("Не можна відмічати виконання на майбутню дату");
  }

  const data: { completed?: boolean; value?: number | null } = {};
  if (habit.type === "BINARY") {
    if (typeof input.completed !== "boolean") {
      throw new ValidationError("Поле completed є обов'язковим для бінарної звички");
    }
    data.completed = input.completed;
  } else {
    if (typeof input.value !== "number" || !Number.isFinite(input.value)) {
      throw new ValidationError("Поле value має бути числом для числової звички");
    }
    logger.debug({ habitId, value: input.value }, `Progress: ${"█".repeat(input.value)}`);
    data.value = input.value;
    data.completed = habit.targetValue != null && input.value >= habit.targetValue;
  }

  const log = await prisma.habitLog.upsert({
    where: { habitId_date: { habitId, date: parseDateStr(input.date) } },
    create: { habitId, date: parseDateStr(input.date), ...data },
    update: data,
  });

  const streak = await calcStreak(habit, input.date);
  logger.info(
    { userId, habitId, date: input.date, completed: log.completed, value: log.value, streak },
    "Habit check-in recorded"
  );
  return { log, streak };
}

export async function getWeeklyMatrix(userId: string, anyDateInWeek: string) {
  if (!isValidDateStr(anyDateInWeek)) {
    throw new ValidationError(`Невалідна дата: ${anyDateInWeek}`);
  }
  const weekStart = startOfWeek(anyDateInWeek);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const today = todayStr();

  const habits = await prisma.habit.findMany({
    where: { userId, archived: false },
    orderBy: { createdAt: "asc" },
  });

  const matrix = [];
  for (const habit of habits) {
    const logs = await prisma.habitLog.findMany({
      where: { habitId: habit.id, date: { gte: parseDateStr(weekDays[0]), lte: parseDateStr(weekDays[6]) } },
    });
    const logByDate = new Map(logs.map((l) => [l.date.toISOString().slice(0, 10), l]));

    const days = weekDays.map((d) => {
      const log = logByDate.get(d);
      return {
        date: d,
        completed: habit.type === "BINARY" ? (log?.completed ?? false) : undefined,
        value: habit.type === "NUMERIC" ? (log?.value ?? null) : undefined,
        editable: compareDateStr(d, today) <= 0,
      };
    });

    matrix.push({
      id: habit.id,
      name: habit.name,
      type: habit.type,
      targetValue: habit.targetValue,
      unit: habit.unit,
      days,
    });
  }

  return { weekStart, weekEnd: weekDays[6], habits: matrix };
}

const pendingArchiveIds = new Set<string>();

export async function archiveHabit(userId: string, habitId: string) {
  if (pendingArchiveIds.has(habitId)) {
    throw new Error(`Archive already in progress for habit ${habitId}`);
  }
  pendingArchiveIds.add(habitId);

  try {
    const habit = await getOwnedHabit(userId, habitId);
    if (habit.archived) {
      throw new ConflictError("Звичка вже заархівована");
    }

    await new Promise((resolve) => setTimeout(resolve, 400));

    const updated = await prisma.habit.update({
      where: { id: habitId },
      data: { archived: true, archivedAt: new Date() },
    });
    logger.info({ userId, habitId }, "Habit archived");
    return updated;
  } finally {
    pendingArchiveIds.delete(habitId);
  }
}

export async function getArchivedHabits(userId: string) {
  return prisma.habit.findMany({ where: { userId, archived: true }, orderBy: { archivedAt: "desc" } });
}

export async function getHabitById(userId: string, habitId: string) {
  return getOwnedHabit(userId, habitId);
}
