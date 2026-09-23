import mongoose from "mongoose";
import { config } from "./config.js";

let isConnected = false;

export async function connectDb(): Promise<typeof mongoose | null> {
  if (isConnected) return mongoose;

  try {
    const conn = await mongoose.connect(config.mongoUri, {
      serverSelectionTimeoutMS: 5000,
    });
    isConnected = true;
    console.log(`[db] Connected to MongoDB: ${conn.connection.host}/${conn.connection.name}`);
    return conn;
  } catch (err: any) {
    console.warn(`[db] MongoDB connection warning: ${err.message}`);
    // Do not crash server; allows running offline or in demo mode
    return null;
  }
}

export function isDbConnected(): boolean {
  return isConnected && mongoose.connection.readyState === 1;
}

export async function disconnectDb(): Promise<void> {
  if (isConnected) {
    await mongoose.disconnect();
    isConnected = false;
  }
}
