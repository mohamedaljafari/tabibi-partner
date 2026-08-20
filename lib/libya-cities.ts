import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * بيانات المدن الليبية ومناطقها.
 * مبدئيًا: طرابلس ومناطقها مفعّلة، وبقية المدن موجودة وغير مفعّلة
 * ويمكن تفعيلها يدويًا من لوحة التحكم الإدارية.
 */
export type LibyaCity = {
  id: string;
  name: string;
  enabled: boolean;
  areas: LibyaArea[];
};

export type LibyaArea = {
  id: string;
  name: string;
};

/**
 * قائمة المدن الليبية ومناطقها (مرجع البيانات الكامل).
 * تعديل enabled يدويًا عبر لوحة التحكم الإدارية.
 */
export const LIBYA_CITIES_RAW: { id: string; name: string; areas: string[] }[] = [
  {
    id: "tripoli",
    name: "طرابلس",
    areas: [
      "مدينة طرابلس القديمة", "المنشية", "الظهرة", "باب البحر", "السويحلي",
      "زنقة العسكر", "بن عاشور", "قرقارش", "الفواتيح", "الأندلس", "الكويفية",
      "صلاح الدين", "المجاهد", "بن غشير", "سوق الجمعة", "عين زارة",
      "طريق المطار", "طريق السواكة", "أبو سليم", "جنزور", "سيدي السائح",
      "طاطاويش", "السراج", "الهاني", "الكريمية", "باب العزيزية", "سيدي فرج",
      "حي السلام", "الكوات", "غوط الشعال", "الفحاحيل", "تاجوراء", "القصاب",
      "حي الأمانة",
    ],
  },
  { id: "benghazi", name: "بنغازي", areas: [
    "الفويهات", "الكيش", "الصابري", "سيدي خليفة", "الليثي", "الهواري",
    "حي السلام", "الفويهات العليا", "حي الكوت", "الهضبة", "بوعطني",
    "البركة", "جردس", "الكوارية", "سيدي حسين", "قاريونس", "سلوق", "بني يونس",
  ] },
  { id: "misrata", name: "مصراتة", areas: [
    "وسط المدينة", "بنو علي", "أولاد رابح", "الضيوك", "الشط", "البقلاوي",
    "الميناء", "السبالة", "القارة", "الزعفرانية", "بن جواد", "سيدي بوشعالة",
  ] },
  { id: "zawiya", name: "الزاوية", areas: [
    "وسط المدينة", "أولاد صقر", "الزوية القديمة", "الحوتة", "بويصير",
    "المالحا", "القالة", "سيدي خليفة",
  ] },
  { id: "khums", name: "الخمس", areas: [
    "وسط المدينة", "سيدي خليفة", "الجديري", "أولاد عيسى", "قلة الحامضة", "بنو عيسى",
  ] },
  { id: "sabratha", name: "صبراتة", areas: [
    "وسط المدينة", "الجوامعة", "أولاد نصير", "تاجوراء القديمة", "السبعان", "الزاوية الغربية",
  ] },
  { id: "tobruk", name: "طبرق", areas: [
    "وسط المدينة (توبيا)", "الحي الإيطالي", "رأس هلال", "شحات", "القصر", "وادي الهور",
  ] },
  { id: "sebha", name: "سبها", areas: [
    "وسط المدينة", "حي الضبعة", "المحروق", "الظهرة", "الكاشف", "الدار البيضاء",
    "قبرة", "الحي الحكومي", "أولاد عبيد",
  ] },
  { id: "bayda", name: "البيضاء", areas: [
    "وسط المدينة", "القريضة", "الكراوية", "الفيتوري", "الحواري", "سيدي خليفة",
  ] },
  { id: "gharyan", name: "غريان", areas: ["وسط المدينة", "أولاد عيسى", "القلعة", "الفشنة", "تاورغاء"] },
  { id: "bani-walid", name: "بني وليد", areas: ["وسط المدينة", "سوق الجمعة", "أولاد بو بكر", "الدافنية"] },
  { id: "sirte", name: "سرت", areas: ["وسط المدينة", "أولاد علي", "قردابيا", "الجيزية"] },
  { id: "ajdabiya", name: "أجدابيا", areas: ["وسط المدينة", "الهواري", "سيدي خليفة", "الصابري"] },
  { id: "derna", name: "درنة", areas: ["وسط المدينة", "سيدي خليفة", "القبة", "القصر"] },
  { id: "zintan", name: "الزنتان", areas: ["وسط المدينة", "الجردس", "أولاد عيسى"] },
  { id: "nalut", name: "نالوت", areas: ["وسط المدينة", "الدشيرة", "الجبل"] },
  { id: "ghadames", name: "غدامس", areas: ["وسط المدينة", "الواحة", "القصر القديم"] },
  { id: "ubari", name: "أوباري", areas: ["وسط المدينة", "تاجوراء الجنوبية", "الهضبة"] },
  { id: "murzuq", name: "مرزق", areas: ["وسط المدينة", "أولاد عيسى", "الجبل"] },
  { id: "kufra", name: "الكفرة", areas: ["وسط المدينة", "الجوف"] },
  { id: "ghat", name: "غات", areas: ["وسط المدينة", "الواحة"] },
  { id: "jufra", name: "الجفرة", areas: ["هون", "وسط المدينة", "ودان"] },
  { id: "shahat", name: "شحات", areas: ["وسط المدينة", "الجبل الأخضر"] },
  { id: "marj", name: "المرج", areas: ["وسط المدينة", "أولاد عيسى", "الكراوية"] },
];

export const LIBYA_CITIES_KEY = "libya.cities.v1";

/**
 * يجلب المدن مع حالة التفعيل المحفوظة محليًا.
 * مبدئيًا: طرابلس فقط مفعّلة.
 */
export async function getLibyaCities(): Promise<LibyaCity[]> {
  const overrides = await loadEnabledOverrides();
  const defaultEnabled = new Set(overrides.enabled ?? ["tripoli"]);
  const disabled = new Set(overrides.disabled ?? []);
  const disabledAreas = new Set(overrides.disabledAreas ?? []);
  return LIBYA_CITIES_RAW.map((city) => ({
    id: city.id,
    name: city.name,
    enabled: disabled.has(city.id) ? false : defaultEnabled.has(city.id),
    areas: city.areas
      .filter((area: string, index: number) => !disabledAreas.has(`${city.id}-area-${index}`))
      .map((area: string, index: number): LibyaArea => ({
        id: `${city.id}-area-${index}`,
        name: area,
      })),
  }));
}

/** مرجع البيانات الكامل للمدن ومناطقها (قبل تطبيق حالة التفعيل). */
export const LIBYA_CITIES: LibyaCity[] = LIBYA_CITIES_RAW.map((city) => ({
  ...city,
  enabled: false,
  areas: city.areas.map((area: string, index: number): LibyaArea => ({
    id: `${city.id}-area-${index}`,
    name: area,
  })),
}));

type EnabledOverrides = {
  enabled?: string[];
  disabled?: string[];
  disabledAreas?: string[];
};

async function loadEnabledOverrides(): Promise<EnabledOverrides> {
  try {
    const raw = await AsyncStorage.getItem(LIBYA_CITIES_KEY);
    if (!raw) return { enabled: ["tripoli"], disabled: [], disabledAreas: [] };
    return JSON.parse(raw) as EnabledOverrides;
  } catch {
    return { enabled: ["tripoli"], disabled: [], disabledAreas: [] };
  }
}

/**
 * تحديث حالة تفعيل مدينة من لوحة التحكم الإدارية.
 */
export async function setCityEnabled(cityId: string, enabled: boolean): Promise<LibyaCity[]> {
  const overrides = await loadEnabledOverrides();
  const enabledSet = new Set(overrides.enabled ?? ["tripoli"]);
  const disabledSet = new Set(overrides.disabled ?? []);
  if (enabled) {
    enabledSet.add(cityId);
    disabledSet.delete(cityId);
  } else {
    disabledSet.add(cityId);
    enabledSet.delete(cityId);
  }
  await AsyncStorage.setItem(
    LIBYA_CITIES_KEY,
    JSON.stringify({
      enabled: Array.from(enabledSet),
      disabled: Array.from(disabledSet),
    }),
  );
  return getLibyaCities();
}

export const TRIPOLI_CITY_ID = "tripoli";

export function getEnabledCities(cities: LibyaCity[]): LibyaCity[] {
  return cities.filter((city) => city.enabled);
}

export function getDisabledCities(cities: LibyaCity[]): LibyaCity[] {
  return cities.filter((city) => !city.enabled);
}

export function getCityById(cities: LibyaCity[], cityId: string): LibyaCity | undefined {
  return cities.find((city) => city.id === cityId);
}

/**
 * تحديث حالة تفعيل منطقة داخل مدينة مفعّلة من لوحة التحكم الإدارية.
 */
export async function setAreaEnabled(cityId: string, areaId: string, enabled: boolean): Promise<LibyaCity[]> {
  const overrides = await loadEnabledOverrides();
  const disabledAreas = new Set(overrides.disabledAreas ?? []);
  if (enabled) {
    disabledAreas.delete(areaId);
  } else {
    disabledAreas.add(areaId);
  }
  await AsyncStorage.setItem(
    LIBYA_CITIES_KEY,
    JSON.stringify({
      enabled: overrides.enabled ?? ["tripoli"],
      disabled: overrides.disabled ?? [],
      disabledAreas: Array.from(disabledAreas),
    }),
  );
  return getLibyaCities();
}

export function getTripoliAreas(cities: LibyaCity[]): LibyaArea[] {
  const tripoli = cities.find((city) => city.id === TRIPOLI_CITY_ID);
  return tripoli ? tripoli.areas : [];
}

const AREA_DEMAND_KEY = "tabibi.area_demand.v1";

/** Demand counts for areas (how often users select each area in search scopes). */
export type AreaDemand = Record<string, number>;

/** Reads stored area demand counts. */
export async function readAreaDemand(): Promise<AreaDemand> {
  try {
    const raw = await AsyncStorage.getItem(AREA_DEMAND_KEY);
    if (raw) return JSON.parse(raw) as AreaDemand;
  } catch {
    // corrupted data — start fresh
  }
  return {};
}

/** Increments the demand count for an area (e.g., when user selects it in a search scope). */
export async function recordAreaDemand(areaName: string): Promise<void> {
  if (!areaName.trim()) return;
  const demand = await readAreaDemand();
  demand[areaName] = (demand[areaName] ?? 0) + 1;
  await AsyncStorage.setItem(AREA_DEMAND_KEY, JSON.stringify(demand));
}

/** Returns areas sorted by demand (most used first); areas without counts keep their original order. */
export async function getAreasSortedByDemand(areas: string[]): Promise<string[]> {
  const demand = await readAreaDemand();
  const unknown = new Set<string>();
  const sorted = [...areas].sort((a, b) => {
    const hasA = Object.prototype.hasOwnProperty.call(demand, a);
    const hasB = Object.prototype.hasOwnProperty.call(demand, b);
    if (!hasA) unknown.add(a);
    if (!hasB) unknown.add(b);
    if (hasA !== hasB) return hasA ? -1 : 1;
    return (demand[b] ?? 0) - (demand[a] ?? 0);
  });
  return sorted;
}
