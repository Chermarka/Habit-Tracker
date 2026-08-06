import { Request, Response, NextFunction } from "express";
import { UnauthorizedError } from "../errors";
import * as authService from "../services/authService";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const userId = req.header("x-user-id");
    if (!userId) {
      throw new UnauthorizedError("Потрібна автентифікація — заголовок x-user-id відсутній");
    }
    const user = await authService.getUserById(userId);
    if (!user) {
      throw new UnauthorizedError("Обліковий запис не знайдено — увійдіть заново");
    }
    req.userId = user.id;
    next();
  } catch (err) {
    next(err);
  }
}
