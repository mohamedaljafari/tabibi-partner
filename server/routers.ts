import { COOKIE_NAME } from "../shared/const.js";
import type { Express } from "express";
import { storageServe } from "./storage";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { tabibiRouter } from "./tabibi/tabibi-router";
import { publicProcedure, router } from "./_core/trpc";

export const appRouter = router({
  // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  tabibi: tabibiRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  // TODO: add feature routers here, e.g.
  // todo: router({
  //   list: protectedProcedure.query(({ ctx }) =>
  //     db.getUserTodos(ctx.user.id)
  //   ),
  // }),
});

export type AppRouter = typeof appRouter;

/**
 * Serve uploaded files from S3/MinIO with internally signed requests
 * (storage credentials never leave the server). Express 4 catch-all:
 * :key params don't match slashes, so the key is extracted from the URL.
 */
export function registerUploadsHandler(app: Express) {
  app.get("/uploads/*", async (req, res) => {
    const key = decodeURIComponent((req.url.split("?")[0] ?? "").replace(/^\/uploads\//, ""));
    if (key.includes("..")) {
      res.status(400).json({ error: "invalid_key" });
      return;
    }
    try {
      await storageServe(key, res);
    } catch (error) {
      const status =
        error && typeof error === "object" && "status" in error
          ? (error as { status: number }).status
          : 502;
      res.status(status).json({ error: status === 404 ? "not_found" : "storage_error" });
    }
  });
}
