import dotenv from "dotenv";
import path from "node:path";
import process from "node:process";

// Load root .env if present
dotenv.config({ path: path.resolve(process.cwd(), ".env") });
dotenv.config({ path: path.resolve(process.cwd(), "../../.env") });
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || "4000", 10),
  nodeEnv: process.env.NODE_ENV || "development",
  mongoUri: process.env.MONGODB_URI || "mongodb://localhost:27017/ai_prep_kit",
  jwtSecret: process.env.SESSION_SECRET || "development_session_secret_change_in_production",
  clientOrigin: process.env.CLIENT_ORIGIN || "http://localhost:3000",
  crawlMaxPages: parseInt(process.env.CRAWL_MAX_PAGES || "10", 10),
  allowPrivateHosts: process.env.ALLOW_PRIVATE_HOSTS === "true",
  isProduction: process.env.NODE_ENV === "production",
};
