import express from "express";
import cors from "cors";
import { v4 as uuid } from "uuid";
import { logger } from "./logger";
import { habitsRouter } from "./routes/habits";
import { errorHandler } from "./middleware/errorHandler";

const app = express();
const port = Number(process.env.PORT) || 4000;

app.use(cors());

app.use((req, res, next) => {
  const id = (req.headers["x-request-id"] as string) || uuid();
  (req as any).id = id;
  res.setHeader("x-request-id", id);
  const start = process.hrtime.bigint();

  res.on("finish", () => {
    const responseDuration = Math.round(Number(process.hrtime.bigint() - start) / 1e5) / 10; // ms, 0.1 precision
    const level = res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info";
    logger[level](
      {
        uuid: id,
        requestMethod: req.method,
        requestPath: req.path,
        requestHeaders: JSON.stringify(req.headers),
        responseStatus: res.statusCode,
        responseDuration,
      },
      `${req.method} ${req.path} ${res.statusCode}`
    );
  });

  next();
});

app.use(express.json());

app.get("/health", (_req, res) => res.json({ status: "ok" }));
app.use("/api/habits", habitsRouter);

app.use(errorHandler);

app.listen(port, () => {
  logger.info({ port }, `Habit tracker API listening on :${port}`);
});
