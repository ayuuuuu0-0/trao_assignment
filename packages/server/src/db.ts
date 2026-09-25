import mongoose from "mongoose";
import { config } from "./config.js";

let isConnected = false;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let memoryServer: any = null;

export async function connectDb(): Promise<typeof mongoose | null> {
  if (isConnected) return mongoose;

  // First try the configured URI
  try {
    const conn = await mongoose.connect(config.mongoUri, {
      serverSelectionTimeoutMS: 5000,
    });
    isConnected = true;
    console.log(`[db] Connected to MongoDB: ${conn.connection.host}/${conn.connection.name}`);
    return conn;
  } catch (err: any) {
    console.warn(`[db] Primary MongoDB failed: ${err.message}`);
    console.log("[db] Falling back to in-memory MongoDB (mongodb-memory-server)...");
  }

  // Fallback: spin up in-memory MongoDB
  try {
    const { MongoMemoryServer } = await import("mongodb-memory-server");
    memoryServer = await MongoMemoryServer.create();
    const uri = memoryServer.getUri();
    const conn = await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
    isConnected = true;
    console.log("[db] ✅ In-memory MongoDB running (data resets on restart — dev only)");
    return conn;
  } catch (fallbackErr: any) {
    console.error(`[db] In-memory MongoDB also failed: ${fallbackErr.message}`);
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
  if (memoryServer) {
    await memoryServer.stop();
    memoryServer = null;
  }
}
