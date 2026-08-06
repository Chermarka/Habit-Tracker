import path from "path";
import fs from "fs";

const logDir = path.join(__dirname, "..", "logs");
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

const stream = fs.createWriteStream(path.join(logDir, "app.log"), { flags: "a" });

type Level = "debug" | "info" | "warn" | "error";
type Extra = Record<string, unknown>;

function write(level: Level, extra: Extra, message: string) {
  const { uuid, ...rest } = extra;
  const record = {
    log: {
      level,
      message,
      time: new Date().toISOString(),
      uuid: uuid ?? null,
      ...rest,
    },
  };
  stream.write(JSON.stringify(record) + "\n");

  const consoleFn = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
  consoleFn(`[${level.toUpperCase()}] ${message}`);
}

export const logger = {
  debug: (extra: Extra, message: string) => write("debug", extra, message),
  info: (extra: Extra, message: string) => write("info", extra, message),
  warn: (extra: Extra, message: string) => write("warn", extra, message),
  error: (extra: Extra, message: string) => write("error", extra, message),
};
