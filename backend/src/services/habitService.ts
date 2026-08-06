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

export async function createHabit(input: CreateHabitInput): Promise<Habit> {
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
      name,
      type: input.type as HabitType,
      targetValue: input.type === "NUMERIC" ? input.targetValue : null,
      unit: input.type === "NUMERIC" ? input.unit!.trim() : null,
    },
  });

  logger.info({ habitId: habit.id, name: habit.name, type: habit.type }, "Habit created");
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

export async function getDashboard(dateStr: string) {
  if (!isValidDateStr(dateStr)) {
    throw new ValidationError(`Невалідна дата: ${dateStr}`);
  }
  const habits = await prisma.habit.findMany({
    where: { archived: false },
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

export async function checkIn(habitId: string, input: CheckInInput) {
  const habit = await prisma.habit.findUnique({ where: { id: habitId } });
  if (!habit) {
    throw new EntityNotFoundError("Habit", habitId);
  }
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
    if (typeof input.value !== "number" || !Number.isFinite(input.value) || input.value < 0) {
      throw new ValidationError("Поле value має бути невід'ємним числом для числової звички");
    }
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
    { habitId, date: input.date, completed: log.completed, value: log.value, streak },
    "Habit check-in recorded"
  );
  return { log, streak };
}

export async function getWeeklyMatrix(anyDateInWeek: string) {
  if (!isValidDateStr(anyDateInWeek)) {
    throw new ValidationError(`Невалідна дата: ${anyDateInWeek}`);
  }
  const weekStart = startOfWeek(anyDateInWeek);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const today = todayStr();

  const habits = await prisma.habit.findMany({
    where: { archived: false },
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

export async function archiveHabit(habitId: string) {
  const habit = await prisma.habit.findUnique({ where: { id: habitId } });
  if (!habit) {
    throw new EntityNotFoundError("Habit", habitId);
  }
  if (habit.archived) {
    throw new ConflictError("Звичка вже заархівована");
  }
  const updated = await prisma.habit.update({
    where: { id: habitId },
    data: { archived: true, archivedAt: new Date() },
  });
  logger.info({ habitId }, "Habit archived");
  return updated;
}

export async function getArchivedHabits() {
  return prisma.habit.findMany({ where: { archived: true }, orderBy: { archivedAt: "desc" } });
}

export async function getHabitById(habitId: string) {
  const habit = await prisma.habit.findUnique({ where: { id: habitId } });
  if (!habit) {
    throw new EntityNotFoundError("Habit", habitId);
  }
  return habit;
}

/**
 * Per-habit heatmap: daily completion % for one habit (AC 4.1 reading).
 * BINARY day is 0% or 100%; NUMERIC day is min(100, value/target*100).
 */
export async function getHabitHeatmap(habitId: string, year: number, month?: number) {
  const habit = await getHabitById(habitId);
  const from = month != null ? `${year}-${String(month).padStart(2, "0")}-01` : `${year}-01-01`;
  const to = month != null ? addDays(nextMonthFirstDay(year, month), -1) : `${year}-12-31`;

  const logs = await prisma.habitLog.findMany({
    where: { habitId, date: { gte: parseDateStr(from), lte: parseDateStr(to) } },
  });

  return logs.map((l) => {
    const dateStr = l.date.toISOString().slice(0, 10);
    const pct =
      habit.type === "BINARY"
        ? l.completed
          ? 100
          : 0
        : habit.targetValue
          ? Math.min(100, Math.round(((l.value ?? 0) / habit.targetValue) * 100))
          : 0;
    return { date: dateStr, percentage: pct };
  });
}

/**
 * Aggregate heatmap across all habits that existed on a given day (AC 4.2 tooltip
 * reads as "4/5 звичок" — an all-habits daily summary, not a single-habit view).
 * NOTE: this differs from the AC 4.1 wording ("обирає конкретну звичку"); the two
 * ACs describe different things and the spec doesn't reconcile them — see README.
 */
export async function getAggregateHeatmap(year: number, month?: number) {
  const from = month != null ? `${year}-${String(month).padStart(2, "0")}-01` : `${year}-01-01`;
  const to = month != null ? addDays(nextMonthFirstDay(year, month), -1) : `${year}-12-31`;

  const habits = await prisma.habit.findMany();
  const logs = await prisma.habitLog.findMany({
    where: { date: { gte: parseDateStr(from), lte: parseDateStr(to) } },
  });

  const habitById = new Map(habits.map((h) => [h.id, h]));
  const byDate = new Map<string, { done: number; total: number }>();

  for (const habit of habits) {
    if (habit.createdAt.toISOString().slice(0, 10) > to) continue;
    let cursor = compareDateStr(from, habit.createdAt.toISOString().slice(0, 10)) > 0
      ? from
      : habit.createdAt.toISOString().slice(0, 10);
    while (compareDateStr(cursor, to) <= 0) {
      const bucket = byDate.get(cursor) ?? { done: 0, total: 0 };
      bucket.total += 1;
      byDate.set(cursor, bucket);
      cursor = addDays(cursor, 1);
    }
  }
  for (const log of logs) {
    const habit = habitById.get(log.habitId);
    if (!habit) continue;
    const dateStr = log.date.toISOString().slice(0, 10);
    if (isDone(habit, log)) {
      const bucket = byDate.get(dateStr);
      if (bucket) bucket.done += 1;
    }
  }

  return Array.from(byDate.entries())
    .sort(([a], [b]) => compareDateStr(a, b))
    .map(([date, { done, total }]) => ({
      date,
      done,
      total,
      percentage: total > 0 ? Math.round((done / total) * 100) : 0,
    }));
}

function nextMonthFirstDay(year: number, month: number): string {
  const m = month === 12 ? 1 : month + 1;
  const y = month === 12 ? year + 1 : year;
  return `${y}-${String(m).padStart(2, "0")}-01`;
}
