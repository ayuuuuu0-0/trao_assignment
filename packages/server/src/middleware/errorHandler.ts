import { Request, Response, NextFunction } from "express";

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const statusCode = err.status || err.statusCode || 500;
  const code = err.code || "INTERNAL_SERVER_ERROR";
  const message = err.message || "An unexpected server error occurred.";

  if (statusCode >= 500) {
    console.error(`[error] ${req.method} ${req.path}:`, err);
  }

  res.status(statusCode).json({
    error: {
      code,
      message,
      details: err.details ?? null,
    },
  });
}
