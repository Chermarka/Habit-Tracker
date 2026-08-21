import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const USERS = [
  { id: "00000000-0000-0000-0000-000000000001", nickname: "anna" },
  { id: "00000000-0000-0000-0000-000000000002", nickname: "dmytro" },
];

const HABITS = [
  {
    id: "00000000-0000-0000-0000-000000000101",
    userId: USERS[0].id,
    name: "Пити воду",
    type: "NUMERIC" as const,
    targetValue: 8,
    unit: "склянок",
  },
  {
    id: "00000000-0000-0000-0000-000000000102",
    userId: USERS[0].id,
    name: "Читати",
    type: "BINARY" as const,
    targetValue: null,
    unit: null,
  },
  {
    id: "00000000-0000-0000-0000-000000000103",
    userId: USERS[1].id,
    name: "Тренування",
    type: "NUMERIC" as const,
    targetValue: 30,
    unit: "хвилин",
  },
];

const LOGS = [
  { habitId: HABITS[0].id, date: "2026-08-17", completed: true, value: 8 },
  { habitId: HABITS[0].id, date: "2026-08-18", completed: false, value: 5 },
  { habitId: HABITS[0].id, date: "2026-08-19", completed: true, value: 9 },
  { habitId: HABITS[1].id, date: "2026-08-17", completed: true, value: null },
  { habitId: HABITS[1].id, date: "2026-08-18", completed: false, value: null },
  { habitId: HABITS[2].id, date: "2026-08-17", completed: false, value: 20 },
  { habitId: HABITS[2].id, date: "2026-08-18", completed: true, value: 35 },
];

async function main() {
  for (const user of USERS) {
    await prisma.user.upsert({
      where: { id: user.id },
      create: user,
      update: { nickname: user.nickname },
    });
  }

  for (const habit of HABITS) {
    await prisma.habit.upsert({
      where: { id: habit.id },
      create: habit,
      update: habit,
    });
  }

  for (const log of LOGS) {
    await prisma.habitLog.upsert({
      where: { habitId_date: { habitId: log.habitId, date: new Date(log.date) } },
      create: { ...log, date: new Date(log.date) },
      update: { completed: log.completed, value: log.value },
    });
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
