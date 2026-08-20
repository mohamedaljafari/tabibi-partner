// موك CJS لـ expo-secure-store لبيئة اختبار Vitest (node).
const storage = new Map();
module.exports = {
  getItemAsync: async (key) => storage.get(key) ?? null,
  setItemAsync: async (key, value) => { storage.set(key, value); },
  deleteItemAsync: async (key) => { storage.delete(key); },
  isAvailableAsync: async () => true,
};
