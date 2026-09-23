import { config } from "./config.js";
import { connectDb, disconnectDb } from "./db.js";
import { createApp } from "./app.js";

async function startServer() {
  await connectDb();

  const app = createApp();
  const server = app.listen(config.port, () => {
    console.log(`[server] PrepMe backend running at http://localhost:${config.port} (env: ${config.nodeEnv})`);
  });

  const shutdown = async () => {
    console.log("[server] Shutting down gracefully...");
    server.close(async () => {
      await disconnectDb();
      process.exit(0);
    });
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

startServer().catch((err) => {
  console.error("[server] Failed to start server:", err);
  process.exit(1);
});
