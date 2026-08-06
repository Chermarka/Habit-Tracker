import { prisma } from "../db";
import { logger } from "../logger";
import { ValidationError, ConflictError, EntityNotFoundError } from "../errors";
import { User } from "@prisma/client";

function validateNickname(nickname: string): string {
  const trimmed = (nickname ?? "").trim();
  if (!trimmed) {
    throw new ValidationError("Нікнейм є обов'язковим");
  }
  if (trimmed.length > 32) {
    throw new ValidationError("Нікнейм не може бути довшим за 32 символи");
  }
  return trimmed;
}

export async function register(nickname: string): Promise<User> {
  const trimmed = validateNickname(nickname);

  const existing = await prisma.user.findUnique({ where: { nickname: trimmed } });
  if (existing) {
    throw new ConflictError("Цей нікнейм вже зайнятий");
  }

  const user = await prisma.user.create({ data: { nickname: trimmed } });
  logger.info({ userId: user.id, nickname: user.nickname }, "User registered");
  return user;
}

export async function login(nickname: string): Promise<User> {
  const trimmed = validateNickname(nickname);

  const user = await prisma.user.findUnique({ where: { nickname: trimmed } });
  if (!user) {
    throw new EntityNotFoundError("User", trimmed);
  }

  logger.info({ userId: user.id, nickname: user.nickname }, "User logged in");
  return user;
}

export async function getUserById(userId: string): Promise<User | null> {
  return prisma.user.findUnique({ where: { id: userId } });
}
