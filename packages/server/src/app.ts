import express, { Express } from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { config } from "./config.js";
import { authRouter } from "./routes/authRoutes.js";
import { kitRouter } from "./routes/kitRoutes.js";
import { jobRouter } from "./routes/jobRoutes.js";
import { practiceRouter } from "./routes/practiceRoutes.js";
import { errorHandler } from "./middleware/errorHandler.js";

export function createApp(): Express {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: config.clientOrigin,
      credentials: true,
    })
  );
  app.use(cookieParser());
  app.use(express.json({ limit: "5mb" }));
  app.use(express.urlencoded({ extended: true }));

  // Health check endpoint
  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  });

  // Mount API routers
  app.use("/api/auth", authRouter);
  app.use("/api/kits", kitRouter);
  app.use("/api/jobs", jobRouter);
  app.use("/api/kits", practiceRouter);

  // Global structured error handler
  app.use(errorHandler);

  return app;
}
