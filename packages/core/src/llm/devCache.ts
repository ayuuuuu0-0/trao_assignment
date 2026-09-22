import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export interface CacheKey {
  provider: string;
  model: string;
  system: string;
  user: string;
}

export class DevCache {
  private cacheDir: string;
  private enabled: boolean;

  constructor(customCacheDir?: string) {
    this.enabled =
      process.env["LLM_DEV_CACHE"] === "true" || process.env["LLM_DEV_CACHE"] === "1";
    this.cacheDir = customCacheDir ?? path.resolve(process.cwd(), ".cache", "llm");
  }

  private computeHash(key: CacheKey): string {
    const serialized = `${key.provider}:${key.model}:${key.system}:${key.user}`;
    return crypto.createHash("sha256").update(serialized).digest("hex");
  }

  public get<T>(key: CacheKey): T | null {
    if (!this.enabled) return null;

    try {
      const filePath = path.join(this.cacheDir, `${this.computeHash(key)}.json`);
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, "utf-8");
        return JSON.parse(raw) as T;
      }
    } catch {
      // Ignore cache read errors
    }
    return null;
  }

  public set<T>(key: CacheKey, data: T): void {
    if (!this.enabled) return;

    try {
      if (!fs.existsSync(this.cacheDir)) {
        fs.mkdirSync(this.cacheDir, { recursive: true });
      }
      const filePath = path.join(this.cacheDir, `${this.computeHash(key)}.json`);
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
    } catch {
      // Ignore cache write errors
    }
  }
}
