/**
 * دوال تجزئة كلمات المرور (SHA-256 مع salt عشوائي) في وحدة مستقلة
 * بلا أي استيراد داخلي، لكسر دورة الاستيراد مع auth-supabase.
 *
 * الشكل: "sha256:{salt-hex}:{hex-digest}"
 */
export async function hashPasswordStrong(password: string, salt?: string): Promise<string> {
  const { getRandomBytesAsync, digestStringAsync, CryptoDigestAlgorithm, CryptoEncoding } = await import("expo-crypto");
  const saltHex =
    salt ??
    Array.from(await getRandomBytesAsync(16))
      .map((byte: number) => byte.toString(16).padStart(2, "0"))
      .join("");
  const digestHex = await digestStringAsync(CryptoDigestAlgorithm.SHA256, `${saltHex}:${password}`, {
    encoding: CryptoEncoding.HEX,
  });
  return `sha256:${saltHex}:${digestHex}`;
}

export function isStrongProviderHash(value: unknown): value is string {
  return typeof value === "string" && /^sha256:[0-9a-f]{32}:/.test(value);
}

/**
 * التحقق من كلمة المرور: يقبل الشكل القوي الجديد ويوفّر الترحيل
 * التدريجي من الشكل القديم عندما تُمرَّر دالة التجزئة القديمة
 * (oldHashFn: (password) => number). إذا لم تُمرَّر يقبل الشكل القوي فقط.
 */
export async function verifyProviderPasswordStrong(
  stored: unknown,
  password: string,
  oldHashFn?: (password: string) => number,
): Promise<boolean> {
  if (isStrongProviderHash(stored)) {
    const [, saltHex] = stored.split(":");
    return (await hashPasswordStrong(password, saltHex)) === stored;
  }
  return typeof oldHashFn === "function" && typeof stored === "number" && stored === oldHashFn(password);
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
