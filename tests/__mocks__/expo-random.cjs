// موك CJS لـ expo-random لبيئة اختبار Vitest (node).
const { randomBytes } = require("crypto");
module.exports = {
  getRandomBytes: (byteCount) => randomBytes(byteCount),
  getRandomBytesAsync: async (byteCount) => randomBytes(byteCount),
};
