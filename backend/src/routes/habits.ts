import { Router } from "express";
import * as habitService from "../services/habitService";
import { requireAuth } from "../middleware/requireAuth";
import { todayStr } from "../dateUtils";

export const habitsRouter = Router();

habitsRouter.use(requireAuth);

habitsRouter.post("/", async (req, res, next) => {
  try {
    const habit = await habitService.createHabit(req.userId!, req.body);
    res.status(201).json(habit);
  } catch (err) {
    next(err);
  }
});

habitsRouter.get("/", async (req, res, next) => {
  try {
    const date = (req.query.date as string) ?? todayStr();
    const habits = await habitService.getDashboard(req.userId!, date);
    res.json(habits);
  } catch (err) {
    next(err);
  }
});

habitsRouter.get("/week", async (req, res, next) => {
  try {
    const anchor = (req.query.start as string) ?? todayStr();
    const week = await habitService.getWeeklyMatrix(req.userId!, anchor);
    res.json(week);
  } catch (err) {
    next(err);
  }
});

habitsRouter.get("/archived", async (req, res, next) => {
  try {
    const habits = await habitService.getArchivedHabits(req.userId!);
    res.json(habits);
  } catch (err) {
    next(err);
  }
});

habitsRouter.get("/:id", async (req, res, next) => {
  try {
    const habit = await habitService.getHabitById(req.userId!, req.params.id);
    res.json(habit);
  } catch (err) {
    next(err);
  }
});

habitsRouter.patch("/:id/checkin", async (req, res, next) => {
  try {
    const result = await habitService.checkIn(req.userId!, req.params.id, req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

habitsRouter.post("/:id/archive", async (req, res, next) => {
  try {
    const habit = await habitService.archiveHabit(req.userId!, req.params.id);
    res.json(habit);
  } catch (err) {
    next(err);
  }
});
