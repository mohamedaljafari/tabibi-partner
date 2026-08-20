// محاكاة خفيفة لبيئة المتصفح: اختبارات Vitest تعمل في بيئة node,
// لكن كود auth-supabase يستخدم window.localStorage عند Platform.OS === "web".

// توجيه اختبارات e2e إلى خادم التطوير المحلي بدلًا من الإنتاج المنشور،
// لأن الإنتاج لا يحتوي بعد على كل نقاط النهاية (deleteAccount وغيرها)
// ولا يمكن تنظيف الحسابات القديمة منه عبر API.
const apiBase = "http://127.0.0.1:3000";
if (!process.env.EXPO_PUBLIC_TABIBI_API_BASE_URL) {
  process.env.EXPO_PUBLIC_TABIBI_API_BASE_URL = apiBase;
}
const storage = new Map<string, string>();
(globalThis as unknown as { window: Window }).window = {
  localStorage: {
    getItem: (k: string) => storage.get(k) ?? null,
    setItem: (k: string, v: string) => storage.set(k, v),
    removeItem: (k: string) => storage.delete(k),
    clear: () => storage.clear(),
  },
} as unknown as Window;

