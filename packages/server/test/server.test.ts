import { describe, it, expect, beforeAll, afterAll } from "vitest";
import http from "node:http";
import { AddressInfo } from "node:net";
import { createApp } from "../src/app.js";

describe("Server API Integration", () => {
  let server: http.Server;
  let baseUrl: string;

  beforeAll(async () => {
    const app = createApp();
    server = app.listen(0);
    const port = (server.address() as AddressInfo).port;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it("GET /health returns 200 and status ok", async () => {
    const res = await fetch(`${baseUrl}/health`);
    expect(res.status).toBe(200);

    const body = (await res.json()) as any;
    expect(body.status).toBe("ok");
    expect(body.uptime).toBeDefined();
  });

  it("POST /api/auth/register rejects invalid email or short password", async () => {
    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "invalid-email", password: "123" }),
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as any;
    expect(body.error?.code).toBe("INVALID_INPUT");
  });

  it("Protected routes reject unauthorized requests with 401", async () => {
    const res = await fetch(`${baseUrl}/api/kits`);
    expect(res.status).toBe(401);

    const body = (await res.json()) as any;
    expect(body.error?.code).toBe("UNAUTHORIZED");
  });

  it("POST /api/kits rejects invalid input for authenticated user without valid token", async () => {
    const res = await fetch(`${baseUrl}/api/kits`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jd: "", company_url: "" }),
    });

    expect(res.status).toBe(401);
  });
});
