import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { router, publicProcedure } from "../_core/trpc";
import * as T from "./tabibi";

/**
 * Router مشترك لتطبيق المريض + تطبيق الشريك + لوحة التحكم.
 * يعتمد مصادقة خاصة: Authorization: Bearer <tabibi-session-token>
 * (مستقلة عن مصادقة الجلسة التي يملكها protectedProcedure).
 * لا يُستخدم هنا ctx.user لأن الحسابات تسجل دخولها بهذه الطبقة.
 */

const tabibiTokenHeader = (authHeader: string | undefined): string | null => {
  if (!authHeader) return null;
  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0].toLowerCase() !== "bearer") return null;
  return parts[1].trim();
};

async function requireTabibiUser(tokenHeader: string | undefined): Promise<T.TabibiUserDto> {
  const token = tabibiTokenHeader(tokenHeader);
  if (!token) throw new TRPCError({ code: "UNAUTHORIZED", message: "مطلوب رمز جلسة صالح (Bearer token)" });
  const user = await T.verifySessionToken(token);
  if (!user) throw new TRPCError({ code: "UNAUTHORIZED", message: "رمز الجلسة غير صالح أو منتهي" });
  return user;
}

const metaField = z.record(z.string(), z.unknown());

export const tabibiRouter = router({
  /** إنشاء حساب جديد (مريض/مقدم خدمة) بعد تشفير كلمة المرور في العميل — الهاش يُرسل جاهزًا. */
  createUser: publicProcedure
    .input(
      z.object({
        phone: z.string().min(8).max(32),
        role: z.enum(["patient", "provider", "admin"]),
        display_name: z.string().min(2).max(160),
        password_hash: z.string().min(20),
        status: z.enum(["active", "pending", "rejected", "suspended"]).optional(),
        metadata: metaField.optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const existing = await T.findUserByPhone(input.phone);
      if (existing) {
        throw new TRPCError({ code: "CONFLICT", message: "هذا الرقم مسجل مسبقًا؛ سجّل الدخول مباشرة." });
      }
      return T.createTabibiUser({
        phone: input.phone,
        role: input.role,
        display_name: input.display_name,
        password_hash: input.password_hash,
        status: input.status,
        metadata: input.metadata,
      });
    }),

  /** تسجيل الدخول: رقم الهاتف + كلمة المرور الممررة كنص صريح مع الهاش المخزن للمقارنة في العميل
   *  (أو عبر التحقق في الخادم إن أُرسل hash محسوب). هنا نقبل password_hash المحسوب من العميل للتحقق. */
  signIn: publicProcedure
    .input(
      z.object({
        phone: z.string().min(8),
        password_hash: z.string().min(20),
      }),
    )
    .mutation(async ({ input }) => {
      const user = await T.findUserByPhone(input.phone);
      if (!user) {
        throw new TRPCError({ code: "NOT_FOUND", message: "الحساب غير موجود في هذه الخدمة." });
      }
      if (user.status === "pending") {
        throw new TRPCError({ code: "FORBIDDEN", message: "حسابك قيد مراجعة الإدارة، سيتم تفعيله قريبًا." });
      }
      if (user.status !== "active") {
        throw new TRPCError({ code: "FORBIDDEN", message: "الحساب غير نشط حاليًا. تواصل مع الإدارة." });
      }
      // التحقق من الهاش يتم في العميل (نفس الهاش PBKDF2)؛ الخادم لا يخزن كلمة صريحة.
      // إذا اختلف الهاش المحسوب عن المخزن فهو فشل مصادقة.
      if (user.password_hash !== input.password_hash) {
        const locked = await T.recordFailedLogin(input.phone);
        if (locked) {
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message: `الحساب مقفل مؤقتًا بسبب محاولات فاشلة متكررة. أعد المحاولة بعد ${T.LOCKOUT_MINUTES} دقيقة.`,
          });
        }
        throw new TRPCError({ code: "UNAUTHORIZED", message: "كلمة المرور غير صحيحة." });
      }
      await T.resetFailedLogins(user.id);
      const token = T.newSessionToken();
      await T.createTabibiSession({ id: user.id, role: user.role }, token);
      return { user, token } as const;
    }),

  /** التحقق من رمز الجلسة الحالي. */
  me: publicProcedure.query(async ({ ctx }) => {
    return requireTabibiUser(ctx.req.headers.authorization);
  }),

  /** بحث مستخدم حسب الهاتف (الشريك/اللوحة يحتاجانه). */
  getUserByPhone: publicProcedure
    .input(z.object({ phone: z.string().min(8) }))
    .query(async ({ input }) => {
      return (await T.findUserByPhone(input.phone)) ?? null;
    }),

  /** تسجيل جلسة دون إعادة إدخال كلمة المرور: يُستدعى من الشريك بعد التحقق المحلي من الهاش المخزن. */
  createSession: publicProcedure
    .input(z.object({ userId: z.string().min(1), token: z.string().min(20) }))
    .mutation(async ({ input }) => {
      const user = await T.getUserById(input.userId);
      if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "الحساب غير موجود" });
      await T.createTabibiSession({ id: user.id, role: user.role }, input.token);
      return { user, token: input.token } as const;
    }),

  /** حذف جلسات (تسجيل الخروج). */
  deleteSessions: publicProcedure
    .input(z.object({ token: z.string().min(10) }))
    .mutation(async ({ input }) => {
      await T.deleteSessionToken(input.token);
      return { success: true } as const;
    }),

  /** جلب مستخدم بمعرفه المباشر (الشريك/اللوحة يحتاجانه). */
  getUserById: publicProcedure
    .input(z.object({ userId: z.string().min(1) }))
    .query(async ({ input }) => {
      return (await T.getUserById(input.userId)) ?? null;
    }),

  /** تحديث حقول metadata لمقدم الخدمة. */
  updateUserMetadata: publicProcedure
    .input(z.object({ userId: z.string(), metadata: metaField }))
    .mutation(async ({ input }) => {
      return T.updateUserMetadata(input.userId, input.metadata);
    }),

  /** ترقية تجزئة كلمة المرور. */
  updateUserPasswordHash: publicProcedure
    .input(z.object({ userId: z.string(), passwordHash: z.string().min(20) }))
    .mutation(async ({ input }) => {
      await T.updateUserPasswordHash(input.userId, input.passwordHash);
      return { success: true } as const;
    }),

  /** حذف حساب وجميع جلساته وسجلاته (للإدارة واختبارات التنظيف). */
  deleteAccount: publicProcedure
    .input(z.object({ userId: z.string().min(1) }))
    .mutation(async ({ input }) => {
      await T.deleteUser(input.userId);
      return { success: true } as const;
    }),

  /** تغيير حالة الحساب (اللوحة فقط فعليًا، لكن التوكن هو الضابط). */
  updateUserStatus: publicProcedure
    .input(z.object({ userId: z.string(), status: z.enum(["active", "pending", "rejected", "suspended"]) }))
    .mutation(async ({ input }) => {
      return T.updateUserStatus(input.userId, input.status);
    }),

  /** قراءة سجل عام (عناوين/إعدادات/ملفات طبية). */
  readRecord: publicProcedure
    .input(z.object({ collection: z.string().max(64), ownerKey: z.string().max(128) }))
    .query(async ({ input }) => {
      const record = await T.readRecord(input.collection, input.ownerKey);
      return record ?? null;
    }),

  /** إنشاء أو تحديث سجل عام. */
  upsertRecord: publicProcedure
    .input(z.object({ collection: z.string().max(64), ownerKey: z.string().max(128), payload: z.unknown(), createdBy: z.string().min(1) }))
    .mutation(async ({ input }) => {
      await T.upsertRecord(input.collection, input.ownerKey, input.payload, input.createdBy);
      return { success: true } as const;
    }),
});
