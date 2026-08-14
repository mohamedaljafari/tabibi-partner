/**
 * نظام المحفظة المحاسبية (محاسبة محلية فقط — ليست محفظة دفع حقيقية).
 *
 * - محفظة المريض: سجل قيد محاسبي يرصد عمليات الشحن والدفع والاسترداد برصيد تجميعي.
 * - محفظة مقدم الخدمة: سجل مستحقات له (له) ومستحقات عليه (عليه) برصيد تجميعي.
 *
 * التخزين: AsyncStorage بالمفتاح wallets_v1 (متشارك مع تطبيقات الشريك ولوحة التحكم).
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

export const WALLETS_KEY = "wallets_v1";

export type LedgerEntryKind = "credit" | "debit";

export type LedgerEntryType =
  // محفظة المريض
  | "recharge" // شحن رصيد
  | "payment" // دفع مقابل خدمة
  | "refund" // استرداد
  // محفظة مقدم الخدمة
  | "earned" // مستحق له
  | "charge"; // مستحق عليه

export interface WalletLedgerEntry {
  id: string;
  /** المريض أو مقدم الخدمة صاحب المحفظة */
  ownerId: string;
  ownerName: string;
  role: "patient" | "provider";
  kind: LedgerEntryKind;
  type: LedgerEntryType;
  amount: number;
  description: string;
  /** مرجع اختياري (رقم طلب خدمة مثلاً) */
  reference?: string;
  createdAt: number;
}

export interface WalletSummary {
  ownerId: string;
  ownerName: string;
  role: "patient" | "provider";
  credit: number;
  debit: number;
  balance: number;
  entries: WalletLedgerEntry[];
}

export async function readWalletEntries(): Promise<WalletLedgerEntry[]> {
  const raw = await AsyncStorage.getItem(WALLETS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function genId(): string {
  return `we_${Date.now().toString(36)}_${Math.floor(Math.random() * 10000)}`;
}

export interface NewWalletEntry {
  ownerId: string;
  ownerName: string;
  role: "patient" | "provider";
  kind: LedgerEntryKind;
  type: LedgerEntryType;
  amount: number;
  description: string;
  reference?: string;
}

/**
 * التحقق من مدخل محفظة جديد قبل الحفظ.
 * - المبلغ يجب أن يكون رقمًا موجبًا أكبر من صفر.
 * - نوع المدخل يجب أن يطابق دور المالك (المريض: recharge/payment/refund — مقدم الخدمة: earned/charge).
 */
export function validateNewWalletEntry(entry: NewWalletEntry): string | null {
  if (!entry.ownerName.trim()) return "يجب تحديد اسم صاحب المحفظة";
  if (!Number.isFinite(entry.amount) || entry.amount <= 0) return "يجب أن يكون المبلغ رقمًا موجبًا";
  if (entry.role === "patient" && !["recharge", "payment", "refund"].includes(entry.type))
    return "نوع العملية غير صالح لمحفظة المريض";
  if (entry.role === "provider" && !["earned", "charge"].includes(entry.type))
    return "نوع العملية غير صالح لمحفظة مقدم الخدمة";
  return null;
}

/**
 * إضافة مدخل محاسبي جديد لمحفظة مالك. يُلحق المدخل ولا يعدل الموجود.
 */
export async function addWalletEntry(input: NewWalletEntry): Promise<WalletLedgerEntry> {
  const error = validateNewWalletEntry(input);
  if (error) throw new Error(error);
  const all = await readWalletEntries();
  const entry: WalletLedgerEntry = {
    id: genId(),
    ownerId: input.ownerId,
    ownerName: input.ownerName,
    role: input.role,
    kind: input.kind,
    type: input.type,
    amount: Math.round(input.amount * 100) / 100,
    description: input.description,
    reference: input.reference,
    createdAt: Date.now(),
  };
  await AsyncStorage.setItem(WALLETS_KEY, JSON.stringify([...all, entry]));
  return entry;
}

function walletOf(entries: WalletLedgerEntry[], ownerId: string): WalletLedgerEntry[] {
  return entries.filter((e) => e.ownerId === ownerId);
}

function summaryFor(entries: WalletLedgerEntry[], ownerId: string, ownerName: string, role: "patient" | "provider"): WalletSummary {
  const mine = walletOf(entries, ownerId);
  const credit = mine.filter((e) => e.kind === "credit").reduce((s, e) => s + e.amount, 0);
  const debit = mine.filter((e) => e.kind === "debit").reduce((s, e) => s + e.amount, 0);
  return {
    ownerId,
    ownerName,
    role,
    credit: Math.round(credit * 100) / 100,
    debit: Math.round(debit * 100) / 100,
    balance: Math.round((credit - debit) * 100) / 100,
    entries: [...mine].sort((a, b) => b.createdAt - a.createdAt),
  };
}

/** ملخص محفظة مالك واحد (مريض أو مقدم خدمة) برصيد تجميعي. */
export async function getWalletSummary(ownerId: string): Promise<WalletSummary | null> {
  const entries = await readWalletEntries();
  const mine = walletOf(entries, ownerId);
  if (mine.length === 0) return null;
  const owner = mine[0];
  return summaryFor(entries, ownerId, owner.ownerName, owner.role);
}

/** ملخصات محافظ كل المالكين (مريض أو مقدم خدمة حسب الدور). */
export async function getWalletSummaries(role?: "patient" | "provider"): Promise<WalletSummary[]> {
  const entries = await readWalletEntries();
  const owners = new Map<string, WalletSummary>();
  for (const e of entries) {
    if (role && e.role !== role) continue;
    if (!owners.has(e.ownerId)) {
      owners.set(e.ownerId, summaryFor(entries, e.ownerId, e.ownerName, e.role));
    }
  }
  return [...owners.values()].sort((a, b) => b.entries[0].createdAt - a.entries[0].createdAt);
}

/**
 * حذف مدخل محاسبي (للإدارة في لوحة التحكم فقط — لا يمكن للمستخدمين العاديين التعديل).
 */
export async function removeWalletEntry(entryId: string): Promise<boolean> {
  const entries = await readWalletEntries();
  const filtered = entries.filter((e) => e.id !== entryId);
  if (filtered.length === entries.length) return false;
  await AsyncStorage.setItem(WALLETS_KEY, JSON.stringify(filtered));
  return true;
}
