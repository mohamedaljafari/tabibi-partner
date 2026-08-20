import type { Express, Request, Response } from "express";
import { COOKIE_NAME } from "../../shared/const.js";
import { loginUser, registerUser, createSessionToken, revokeSessionToken } from "./localAuth";

const AUTH_COOKIE_NAME = COOKIE_NAME;

const cookieConfig = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  maxAge: 1000 * 60 * 60 * 24 * 365, // 1 year
  path: "/",
};

interface LoginBody {
  email?: unknown;
  password?: unknown;
  name?: unknown;
  action?: unknown;
}

function readBody(req: Request): LoginBody {
  return (req.body && typeof req.body === "object" ? req.body : {}) as LoginBody;
}

function sendAuthCookie(res: Response, token: string): void {
  res.cookie(AUTH_COOKIE_NAME, token, cookieConfig);
}

function clearAuthCookie(res: Response): void {
  res.clearCookie(AUTH_COOKIE_NAME, { path: "/" });
}

function safeString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function registerAuthRoutes(app: Express): void {
  app.post("/api/auth/login", async (req, res) => {
    try {
      const body = readBody(req);
      const email = safeString(body.email);
      const password = safeString(body.password);
      if (!email || !password) {
        return res.status(400).json({ error: "INVALID_INPUT" });
      }
      const user = await loginUser({ email, password });
      const token = await createSessionToken(user.openId, { name: user.name ?? undefined });
      sendAuthCookie(res, token);
      return res.json({
        ok: true,
        token,
        user: { id: user.id, openId: user.openId, name: user.name, email: user.email, role: user.role },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return res.status(401).json({ error: message });
    }
  });

  app.post("/api/auth/register", async (req, res) => {
    try {
      const body = readBody(req);
      const name = safeString(body.name);
      const email = safeString(body.email);
      const password = safeString(body.password);
      if (!name || !email || !password) {
        return res.status(400).json({ error: "INVALID_INPUT" });
      }
      if (password.length < 8) {
        return res.status(400).json({ error: "PASSWORD_TOO_SHORT" });
      }
      const user = await registerUser({ name, email, password });
      const token = await createSessionToken(user.openId, { name: user.name ?? undefined });
      sendAuthCookie(res, token);
      return res.json({
        ok: true,
        token,
        user: { id: user.id, openId: user.openId, name: user.name, email: user.email, role: user.role },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return res.status(409).json({ error: message });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    const token =
      (typeof req.cookies?.[AUTH_COOKIE_NAME] === "string"
        ? (req.cookies[AUTH_COOKIE_NAME] as string)
        : "") ||
      (typeof req.headers.authorization === "string" &&
      req.headers.authorization.startsWith("Bearer ")
        ? req.headers.authorization.slice(7)
        : "");
    if (token) revokeSessionToken(token);
    clearAuthCookie(res);
    return res.json({ ok: true });
  });

  app.get("/api/auth/me", async (req, res) => {
    try {
      const token = req.cookies?.[AUTH_COOKIE_NAME] ?? (typeof req.headers.authorization === "string" && req.headers.authorization.startsWith("Bearer ") ? req.headers.authorization.slice(7) : "");
      if (!token) return res.json({ ok: false, user: null });
      const { verifySessionToken } = await import("./localAuth");
      const session = await verifySessionToken(token as string);
      if (!session) {
        clearAuthCookie(res);
        return res.json({ ok: false, user: null });
      }
      const { getUserByOpenId } = await import("../db");
      const user = await getUserByOpenId(session.openId);
      if (!user) {
        clearAuthCookie(res);
        return res.json({ ok: false, user: null });
      }
      return res.json({
        ok: true,
        user: { id: user.id, openId: user.openId, name: user.name, email: user.email, role: user.role },
      });
    } catch {
      return res.json({ ok: false, user: null });
    }
  });
}
