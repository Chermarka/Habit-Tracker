import { Router } from "express";
import * as habitService from "../services/habitService";
import { todayStr } from "../dateUtils";

export const habitsRouter = Router();

habitsRouter.post("/", async (req, res, next) => {
  try {
    const habit = await habitService.createHabit(req.body);
    res.status(201).json(habit);
  } catch (err) {
    next(err);
  }
});

habitsRouter.get("/", async (req, res, next) => {
  try {
    const date = (req.query.date as string) ?? todayStr();
    const habits = await habitService.getDashboard(date);
    res.json(habits);
  } catch (err) {
    next(err);
  }
});

habitsRouter.get("/week", async (req, res, next) => {
  try {
    const anchor = (req.query.start as string) ?? todayStr();
    const week = await habitService.getWeeklyMatrix(anchor);
    res.json(week);
  } catch (err) {
    next(err);
  }
});

habitsRouter.get("/archived", async (_req, res, next) => {
  try {
    const habits = await habitService.getArchivedHabits();
    res.json(habits);
  } catch (err) {
    next(err);
  }
});

habitsRouter.get("/heatmap", async (req, res, next) => {
  try {
    const year = Number(req.query.year) || new Date().getFullYear();
    const month = req.query.month != null ? Number(req.query.month) : undefined;
    const heatmap = await habitService.getAggregateHeatmap(year, month);
    res.json(heatmap);
  } catch (err) {
    next(err);
  }
});

habitsRouter.get("/:id", async (req, res, next) => {
  try {
    const habit = await habitService.getHabitById(req.params.id);
    res.json(habit);
  } catch (err) {
    next(err);
  }
});

habitsRouter.get("/:id/heatmap", async (req, res, next) => {
  try {
    const year = Number(req.query.year) || new Date().getFullYear();
    const month = req.query.month != null ? Number(req.query.month) : undefined;
    const heatmap = await habitService.getHabitHeatmap(req.params.id, year, month);
    res.json(heatmap);
  } catch (err) {
    next(err);
  }
});

habitsRouter.patch("/:id/checkin", async (req, res, next) => {
  try {
    const result = await habitService.checkIn(req.params.id, req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

habitsRouter.post("/:id/archive", async (req, res, next) => {
  try {
    const habit = await habitService.archiveHabit(req.params.id);
    res.json(habit);
  } catch (err) {
    next(err);
  }
});
