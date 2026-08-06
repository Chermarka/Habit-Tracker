import { PrismaClient } from "@prisma/client";
import { logger } from "./logger";

export const prisma = new PrismaClient({
  log: [
    { emit: "event", level: "query" },
    { emit: "event", level: "error" },
    { emit: "event", level: "warn" },
  ],
});

prisma.$on("query" as never, (e: any) => {
  logger.debug({ sql: e.query, params: e.params, durationMs: e.duration }, "Prisma query");
});
prisma.$on("error" as never, (e: any) => {
  logger.error({ err: e }, "Prisma error");
});
