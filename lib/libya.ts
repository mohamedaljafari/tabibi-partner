/**
 * أدوات التوطين الليبي — تستخدم في تطبيق المريض وتطبيق الشريك ولوحة التحكم.
 *
 * قواعد أرقام الهواتف الليبية (https://www.wikipedia.org/wiki/Telephone_numbers_in_Libya):
 * - أرقام الجوال محلية تبدأ بـ 09 (90، 91، 92، 93، 94، 95) وبعدها 7 أرقام.
 *   الصيغة المحلية: 09XXXXXXXX (10 خانات تبدأ بـ 09).
 * - بصيغة E.164 الدولية: +218 9XXXXXXXX (12 خانة تبدأ بـ +2189).
 * - الرقم الدولي بدون + : 2189XXXXXXXX (11 خانة تبدأ بـ 2189).
 * خطوط ليبيانا ومdatal تبدأ بنفس البادئة 09، لذا يُتحقق من البادئة فقط.
 */

/** بادئات الجوال الليبية المحلية (بعد الصفر). */
const LIBYAN_MOBILE_PREFIXES = ["90", "91", "92", "93", "94", "95"];

export function normalizeLibyanPhone(raw: string): string {
  const digits = raw.replace(/[^\d+]/g, "").trim();
  // +218 9XXXXXXXX  →  09XXXXXXXX
  if (digits.startsWith("+218")) {
    return "0" + digits.slice(4);
  }
  // 2189XXXXXXXX  →  09XXXXXXXX
  if (digits.length === 11 && digits.startsWith("2189")) {
    return "0" + digits.slice(3);
  }
  return digits;
}

/**
 * التحقق من أن الرقم هو رقم هاتف ليبي صالح (محليًا أو دوليًا أو بعد التسوية).
 */
export function isLibyanPhone(phone: string): boolean {
  const d = normalizeLibyanPhone(phone);
  // محلي: 09 + بادئة + 7 خانات = 10 خانات
  if (d.length === 10 && d.startsWith("09") && LIBYAN_MOBILE_PREFIXES.includes(d.slice(1, 3))) {
    return true;
  }
  return false;
}

export function libyanPhoneError(phone: string): string | null {
  if (!phone) return "أدخل رقم الهاتف.";
  const d = normalizeLibyanPhone(phone);
  if (d.length === 10 && d.startsWith("09") && LIBYAN_MOBILE_PREFIXES.includes(d.slice(1, 3))) {
    return null;
  }
  if (phone.startsWith("+") && phone.length < 13) {
    return "رقم ليبي غير صالح. الصيغة: 09XXXXXXXX أو +2189XXXXXXXX.";
  }
  return "رقم ليبي غير صالح. أدخل رقمًا ليبيًا بصيغة 09XXXXXXXX (مثال: 0912345678).";
}

/** عرض الرقم بصيغة مقروءة: 09X XXX XXXX */
export function formatLibyanPhone(phone: string): string {
  const d = normalizeLibyanPhone(phone).replace(/^0/, "");
  if (d.length !== 9) return phone;
  return `0${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6, 9)}`;
}

/** تنسيق مبلغ بالدينار الليبي. */
export function formatLYD(amount: number): string {
  return `${amount.toLocaleString("ar-EG", { maximumFractionDigits: 2 })} د.ل`;
}
