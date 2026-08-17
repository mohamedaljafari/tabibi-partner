import { supabase, type TabibiUser } from "@/lib/supabase";

/**
 * مخزن السجلات المشترك (tabibi_records) لمنظومة طبيبي.
 * كل سجل يحمل `collection` تحدد نوعه و`owner_key` لمالكه، ويتشاركه
 * المريض ومقدم الخدمة والإدارة عبر التطبيقات الثلاثة.
 */
export type MedicalRecordPayload = {
  id: string;
  ownerName: string;
  ownerType: "patient" | "family";
  createdAt: string;
  entries: ClinicalEntryPayload[];
};

export type ClinicalEntryPayload = {
  id: string;
  type: "diagnosis" | "prescription" | "service";
  title: string;
  details: string;
  providerName?: string;
  createdAt: string;
};

export type AddressPayload = {
  id: string;
  label: string;
  addressLabel: string;
  latitude: number;
  longitude: number;
  source: "map" | "current-location";
  cityId?: string;
  areaNames?: string[];
  createdAt: string;
};

export type SetupPayload = { isSetupComplete: boolean; familyMemberNames: string[] };

function now(): string {
  return new Date().toISOString();
}

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/** قراءة سجل مشترك بمالك ومجموعة معينة. */
async function readRecord<T>(
  collection: string,
  ownerKey: string,
  user: TabibiUser,
): Promise<(T & { id: string }) | null> {
  const { data, error } = await supabase
    .from("tabibi_records")
    .select("id, payload")
    .eq("collection", collection)
    .eq("owner_key", ownerKey)
    .limit(1);
  if (error) throw error;
  if (!data || data.length === 0) return null;
  return { ...(data[0].payload as T), id: data[0].id };
}

/** إنشاء أو تحديث سجل مشترك (upsert حسب owner_key). */
async function upsertRecord(
  collection: string,
  ownerKey: string,
  payload: unknown,
  user: TabibiUser,
): Promise<void> {
  const existing = await readRecord(collection, ownerKey, user);
  const record = {
    collection,
    record_key: `${collection}:${ownerKey}`,
    owner_key: ownerKey,
    payload,
    created_by: user.id,
  };
  if (existing) {
    const { error } = await supabase
      .from("tabibi_records")
      .update({ payload, updated_at: now() })
      .eq("id", existing.id);
    if (error) throw error;
    return;
  }
  const { error } = await supabase
    .from("tabibi_records")
    .insert({ ...record, created_at: now(), updated_at: now() });
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// إعدادات حساب المريض: العناوين والملفات الطبية
// ---------------------------------------------------------------------------

export async function readPatientSetup(user: TabibiUser): Promise<SetupPayload> {
  const record = await readRecord<SetupPayload>("setup", `patient:${user.id}`, user);
  return record ?? { isSetupComplete: false, familyMemberNames: [] };
}

export async function savePatientSetup(
  user: TabibiUser,
  input: Partial<SetupPayload>,
): Promise<SetupPayload> {
  const current = await readPatientSetup(user);
  const next: SetupPayload = { ...current, ...input };
  await upsertRecord("setup", `patient:${user.id}`, next, user);
  return next;
}

export async function readPatientAddresses(user: TabibiUser): Promise<AddressPayload[]> {
  const record = await readRecord<{ addresses: AddressPayload[] }>(
    "addresses",
    `patient:${user.id}`,
    user,
  );
  return record?.addresses ?? [];
}

export async function addPatientAddress(
  user: TabibiUser,
  address: Omit<AddressPayload, "id" | "createdAt">,
): Promise<AddressPayload[]> {
  const current = await readPatientAddresses(user);
  const next = [...current, { ...address, id: createId("address"), createdAt: now() }];
  await upsertRecord("addresses", `patient:${user.id}`, { addresses: next }, user);
  return next;
}

export async function readPatientMedicalRecords(
  user: TabibiUser,
): Promise<MedicalRecordPayload[]> {
  const record = await readRecord<{ records: MedicalRecordPayload[] }>(
    "medical-records",
    `patient:${user.id}`,
    user,
  );
  return record?.records ?? [];
}

export async function createMedicalRecords(
  user: TabibiUser,
  ownerNames: Array<{ ownerName: string; ownerType: "patient" | "family" }>,
): Promise<MedicalRecordPayload[]> {
  const current = await readPatientMedicalRecords(user);
  const keys = new Set(
    current.map((r) => `${r.ownerType}:${r.ownerName.toLocaleLowerCase("ar")}`),
  );
  const added: MedicalRecordPayload[] = [];
  for (const owner of ownerNames) {
    const key = `${owner.ownerType}:${owner.ownerName.toLocaleLowerCase("ar")}`;
    if (keys.has(key) || owner.ownerName.trim().length < 3) continue;
    keys.add(key);
    added.push({
      id: createId("medical-record"),
      ownerName: owner.ownerName.trim(),
      ownerType: owner.ownerType,
      createdAt: now(),
      entries: [],
    });
  }
  const next = [...current, ...added];
  await upsertRecord("medical-records", `patient:${user.id}`, { records: next }, user);
  return next;
}

export async function addClinicalEntry(
  user: TabibiUser,
  ownerName: string,
  entry: Omit<ClinicalEntryPayload, "id" | "createdAt">,
): Promise<MedicalRecordPayload[]> {
  const records = await readPatientMedicalRecords(user);
  const next = records.map((record) =>
    record.ownerName.toLocaleLowerCase("ar") === ownerName.toLocaleLowerCase("ar")
      ? {
          ...record,
          entries: [
            ...record.entries,
            { ...entry, id: createId("entry"), createdAt: now() },
          ],
        }
      : record,
  );
  await upsertRecord("medical-records", `patient:${user.id}`, { records: next }, user);
  return next;
}
