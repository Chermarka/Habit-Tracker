import express from "express";
import cors from "cors";
import { v4 as uuid } from "uuid";
import { logger } from "./logger";
import { habitsRouter } from "./routes/habits";
import { authRouter } from "./routes/auth";
import { errorHandler } from "./middleware/errorHandler";

const app = express();
const port = Number(process.env.PORT) || 4000;

app.use(cors());

app.use((req, res, next) => {
  const id = (req.headers["x-request-id"] as string) || uuid();
  (req as any).id = id;
  res.setHeader("x-request-id", id);
  const start = process.hrtime.bigint();
  // req.originalUrl, captured up front: sub-routers (habitsRouter, authRouter) strip their
  // mount prefix from req.url/req.path while dispatching and only restore it if the handler
  // calls next() — ours respond directly, so by the time res.on("finish") fires, req.path
  // would still be the router-relative remainder (e.g. "/" for GET /api/habits). originalUrl
  // is never touched by that mechanism.
  const path = req.originalUrl.split("?")[0];

  res.on("finish", () => {
    const responseDuration = Math.round(Number(process.hrtime.bigint() - start) / 1e5) / 10; // ms, 0.1 precision
    const level = res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info";
    logger[level](
      {
        uuid: id,
        requestMethod: req.method,
        requestPath: path,
        requestHeaders: JSON.stringify(req.headers),
        responseStatus: res.statusCode,
        responseDuration,
      },
      `${req.method} ${path} ${res.statusCode}`
    );
  });

  next();
});

app.use(express.json());

app.get("/health", (_req, res) => res.json({ status: "ok" }));
app.use("/api/auth", authRouter);
app.use("/api/habits", habitsRouter);

app.use(errorHandler);

app.listen(port, () => {
  logger.info({ port }, `Habit tracker API listening on :${port}`);
});
