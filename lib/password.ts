/**
 * دوال تجزئة كلمات المرور — PBKDF2-SHA256 مع salt عشوائي 16 بايت و100,000 تكرار.
 * وحدة مستقلة بلا أي استيراد داخلي (لكسر دورة الاستيراد).
 *
 * الشكل: "pbkdf2:{salt-hex}:{hex-digest}"
 * يدعم الترحيل التدريجي: عند التحقق من هاش قديم (sha256 أو djb2) يُعاد
 * تشفير كلمة المرور بالشكل الجديد ويُعاد الهاش الجديد عبر needRehash.
 */

import { Platform } from "react-native";
import * as ExpoCrypto from "expo-crypto";

export const PBKDF2_ITERATIONS = 100_000;
const PBKDF2_KEY_LENGTH = 32; // 256-bit

export type PasswordHashResult = {
  hash: string;
  needRehash?: boolean;
};

function randomSaltHex(): string {
  if (Platform.OS === "web") {
    const buf = new Uint8Array(16);
    // crypto.getRandomValues متوفر في جميع المتصفحات الحديثة
    (globalThis.crypto as Crypto).getRandomValues(buf);
    return Array.from(buf)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  const bytes = ExpoCrypto.getRandomBytesAsync ? ExpoCrypto.getRandomBytesAsync(16) : new Uint8Array(16);
  return Array.from(bytes as unknown as number[])
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** PBKDF2-SHA256 عبر expo-crypto (native) أو SubtleCrypto (web) */
async function pbkdf2Sha256Hex(password: string, saltHex: string): Promise<string> {
  if (Platform.OS === "web") {
    // SubtleCrypto متوفر في جميع المتصفحات الحديثة
    const encoder = new TextEncoder();
    const keyMaterial = await globalThis.crypto.subtle.importKey(
      "raw",
      encoder.encode(password),
      { name: "PBKDF2" },
      false,
      ["deriveBits"],
    );
    const bits = await globalThis.crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        salt: hexToBytes(saltHex) as unknown as BufferSource,
        iterations: PBKDF2_ITERATIONS,
        hash: "SHA-256",
      },
      keyMaterial,
      PBKDF2_KEY_LENGTH * 8,
    );
    return Array.from(new Uint8Array(bits))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  const pbkdf2Async = (ExpoCrypto as unknown as {
    pbkdf2Async: (
      input: string,
      salt: string,
      iterations: number,
      keyLength: number,
      algorithm: string | number,
      options: { encoding: string | number },
    ) => Promise<string>;
  }).pbkdf2Async;
  return await pbkdf2Async(
    password,
    saltHex,
    PBKDF2_ITERATIONS,
    PBKDF2_KEY_LENGTH,
    "SHA256",
    { encoding: "HEX" },
  );
}

/**
 * تجزئة كلمة المرور: PBKDF2-SHA256 × 100,000.
 */
export async function hashPasswordStrong(password: string, salt?: string): Promise<string> {
  const saltHexStr = salt ?? randomSaltHex();
  const digestHex = await pbkdf2Sha256Hex(password, saltHexStr);
  return `pbkdf2:${saltHexStr}:${digestHex}`;
}

export function isStrongProviderHash(value: unknown): value is string {
  return (
    typeof value === "string" &&
    (/^pbkdf2:[0-9a-f]{32}:/.test(value) || /^sha256:[0-9a-f]{32}:/.test(value))
  );
}

/**
 * التحقق من كلمة المرور: يقبل PBKDF2 الحديث وSHA-256 القديم والترحيل من djb2.
 * عند نجاح التحقق من هاش قديم يُعاد الهاش المرقّي عبر needRehash ليُخزَّن مجددًا.
 * يعيد null عند فشل التحقق.
 */
export async function verifyProviderPasswordStrong(
  stored: unknown,
  password: string,
  oldHashFn?: (password: string) => number,
): Promise<PasswordHashResult | null> {
  if (typeof stored === "string" && /^pbkdf2:[0-9a-f]{32}:/.test(stored)) {
    const [, saltHexStr] = stored.split(":");
    const recomputed = await pbkdf2Sha256Hex(password, saltHexStr);
    if (`pbkdf2:${saltHexStr}:${recomputed}` === stored) {
      return { hash: stored };
    }
    return null;
  }
  if (typeof stored === "string" && /^sha256:[0-9a-f]{32}:/.test(stored)) {
    const [, saltHexStr] = stored.split(":");
    const { digestStringAsync, CryptoDigestAlgorithm, CryptoEncoding } = ExpoCrypto;
    const digestHex = await digestStringAsync(
      CryptoDigestAlgorithm.SHA256,
      `${saltHexStr}:${password}`,
      { encoding: CryptoEncoding.HEX },
    );
    if (`sha256:${saltHexStr}:${digestHex}` === stored) {
      const upgraded = await hashPasswordStrong(password, saltHexStr);
      return { hash: upgraded, needRehash: true };
    }
    return null;
  }
  if (typeof oldHashFn === "function" && typeof stored === "number" && stored === oldHashFn(password)) {
    const upgraded = await hashPasswordStrong(password);
    return { hash: upgraded, needRehash: true };
  }
  return null;
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

/**
 * تجزئة قديمة (djb2-style) لا تزال موجودة في قواعد بيانات الحسابات القديمة.
 * تُستخدم فقط للترحيل التدريجي — لا تُنشئ بها هاشات جديدة.
 */
export function hashPassword(password: string): number {
  let hash = 5381;
  for (let i = 0; i < password.length; i++) {
    hash = (hash * 33 + password.charCodeAt(i)) >>> 0;
  }
  return hash;
}
