import { Router, Request, Response } from "express";
import bcrypt from "bcrypt";
import { UserModel } from "../models/User.js";
import { signToken, setAuthCookie, clearAuthCookie, requireAuth } from "../middleware/auth.js";

export const authRouter = Router();

// POST /api/auth/register
authRouter.post("/register", async (req: Request, res: Response): Promise<void> => {
  const { email, password, name } = req.body || {};

  const cleanEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
  const cleanPassword = typeof password === "string" ? password : "";
  const cleanName = typeof name === "string" ? name.trim() : "Candidate";

  if (!cleanEmail || !cleanEmail.includes("@")) {
    res.status(400).json({
      error: { code: "INVALID_INPUT", message: "A valid email address is required." },
    });
    return;
  }

  if (!cleanPassword || cleanPassword.length < 6) {
    res.status(400).json({
      error: { code: "INVALID_INPUT", message: "Password must be at least 6 characters." },
    });
    return;
  }

  try {
    const existing = await UserModel.findOne({ email: cleanEmail });
    if (existing) {
      res.status(400).json({
        error: { code: "EMAIL_EXISTS", message: "An account with this email already exists." },
      });
      return;
    }

    const passwordHash = await bcrypt.hash(cleanPassword, 10);
    const user = await UserModel.create({
      email: cleanEmail,
      passwordHash,
      name: cleanName,
    });

    const token = signToken({ userId: user._id.toString(), email: user.email });
    setAuthCookie(res, token);

    res.status(201).json({
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
      },
    });
  } catch (err: any) {
    res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: err.message },
    });
  }
});

// POST /api/auth/login
authRouter.post("/login", async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body || {};

  const cleanEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
  const cleanPassword = typeof password === "string" ? password : "";

  if (!cleanEmail || !cleanPassword) {
    res.status(400).json({
      error: { code: "INVALID_INPUT", message: "Email and password are required." },
    });
    return;
  }

  try {
    const user = await UserModel.findOne({ email: cleanEmail });
    if (!user) {
      res.status(401).json({
        error: { code: "INVALID_CREDENTIALS", message: "Invalid email or password." },
      });
      return;
    }

    const matches = await bcrypt.compare(cleanPassword, user.passwordHash);
    if (!matches) {
      res.status(401).json({
        error: { code: "INVALID_CREDENTIALS", message: "Invalid email or password." },
      });
      return;
    }

    const token = signToken({ userId: user._id.toString(), email: user.email });
    setAuthCookie(res, token);

    res.json({
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
      },
    });
  } catch (err: any) {
    res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: err.message },
    });
  }
});

// POST /api/auth/logout
authRouter.post("/logout", (_req: Request, res: Response): void => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

// GET /api/auth/me
authRouter.get("/me", requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await UserModel.findById(req.user!.userId).select("-passwordHash");
    if (!user) {
      clearAuthCookie(res);
      res.status(401).json({
        error: { code: "USER_NOT_FOUND", message: "Session user no longer exists." },
      });
      return;
    }

    res.json({
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
      },
    });
  } catch (err: any) {
    res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: err.message },
    });
  }
});
