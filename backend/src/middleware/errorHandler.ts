import { Request, Response, NextFunction } from "express";
import { logger } from "../logger";

export function errorHandler(err: any, req: Request, res: Response, _next: NextFunction) {
  const status = err.status ?? 500;
  const uuid = (req as any).id;

  logger.error(
    {
      uuid,
      requestMethod: req.method,
      requestPath: req.path,
      requestHeaders: JSON.stringify(req.headers),
      responseStatus: status,
      requestBody: JSON.stringify(req.body),
      stackTrace: err.stack,
    },
    `${err.name ?? "Error"}: ${err.message}`
  );

  res.status(status).json({
    error: err.name ?? "InternalServerError",
    message: err.message ?? "Unexpected error",
    requestId: uuid,
  });
}
