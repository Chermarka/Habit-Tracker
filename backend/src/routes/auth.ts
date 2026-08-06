import { Router } from "express";
import * as authService from "../services/authService";

export const authRouter = Router();

authRouter.post("/register", async (req, res, next) => {
  try {
    const user = await authService.register(req.body?.nickname);
    res.status(201).json({ id: user.id, nickname: user.nickname });
  } catch (err) {
    next(err);
  }
});

authRouter.post("/login", async (req, res, next) => {
  try {
    const user = await authService.login(req.body?.nickname);
    res.json({ id: user.id, nickname: user.nickname });
  } catch (err) {
    next(err);
  }
});
