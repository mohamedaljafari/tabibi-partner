import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { COOKIE_NAME } from "../../shared/const.js";
import { verifySessionToken } from "./localAuth";
import { getUserByOpenId } from "../db";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;
  try {
    const authorization = opts.req.headers.authorization;
    const cookieToken =
      typeof opts.req.cookies === "object" && opts.req.cookies !== null
        ? (opts.req.cookies as Record<string, unknown>)[COOKIE_NAME]
        : undefined;
    const token =
      typeof cookieToken === "string" && cookieToken.length > 0
        ? cookieToken
        : typeof authorization === "string" && authorization.startsWith("Bearer ")
          ? authorization.slice(7)
          : "";
    if (token) {
      const session = await verifySessionToken(token);
      if (session) {
        const candidate = await getUserByOpenId(session.openId);
        if (candidate) user = candidate;
      }
    }
  } catch {
    // Authentication is optional for public procedures.
    user = null;
  }
  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
