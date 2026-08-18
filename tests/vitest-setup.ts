// محاكاة خفيفة لبيئة المتصفح: اختبارات Vitest تعمل في بيئة node،
// لكن كود auth-supabase يستخدم window.localStorage عند Platform.OS === "web".
const storage = new Map<string, string>();
(globalThis as unknown as { window: Window }).window = {
  localStorage: {
    getItem: (k: string) => storage.get(k) ?? null,
    setItem: (k: string, v: string) => storage.set(k, v),
    removeItem: (k: string) => storage.delete(k),
    clear: () => storage.clear(),
  },
} as unknown as Window;
