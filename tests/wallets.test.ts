import { beforeEach, describe, expect, it, vi } from "vitest";
import * as walletsLib from "../lib/wallets";

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(async () => null),
    setItem: vi.fn(async () => undefined),
    removeItem: vi.fn(async () => undefined),
  },
}));

const AsyncStorageMock = vi.mocked(
  (await import("@react-native-async-storage/async-storage")).default,
);

describe("مكتبة المحافظ المحاسبية wallets.ts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    AsyncStorageMock.getItem.mockResolvedValue(null);
  });

  describe("التحقق من المدخل validateNewWalletEntry", () => {
    it("يرفض اسمًا فارغًا", () => {
      expect(
        walletsLib.validateNewWalletEntry({
          ownerId: "p1",
          ownerName: "",
          role: "patient",
          kind: "credit",
          type: "recharge",
          amount: 100,
          description: "شحن",
        }),
      ).not.toBeNull();
    });

    it("يرفض مبلغًا صفرًا أو سالبًا", () => {
      const entry = (amount: number) => ({
        ownerId: "p1",
        ownerName: "مريض",
        role: "patient" as const,
        kind: "credit" as const,
        type: "recharge" as const,
        amount,
        description: "شحن",
      });
      expect(walletsLib.validateNewWalletEntry(entry(0))).not.toBeNull();
      expect(walletsLib.validateNewWalletEntry(entry(-5))).not.toBeNull();
      expect(walletsLib.validateNewWalletEntry(entry(50))).toBeNull();
    });

    it("يرفض نوع العملية غير المطابق للدور", () => {
      expect(
        walletsLib.validateNewWalletEntry({
          ownerId: "p1",
          ownerName: "مريض",
          role: "patient",
          kind: "debit",
          type: "earned",
          amount: 50,
          description: "خاطئ",
        }),
      ).not.toBeNull();
      expect(
        walletsLib.validateNewWalletEntry({
          ownerId: "d1",
          ownerName: "طبيب",
          role: "provider",
          kind: "credit",
          type: "payment",
          amount: 50,
          description: "خاطئ",
        }),
      ).not.toBeNull();
    });

    it("يقبل المدخلات الصالحة", () => {
      const patient = walletsLib.validateNewWalletEntry({
        ownerId: "p1",
        ownerName: "مريض",
        role: "patient",
        kind: "credit",
        type: "recharge",
        amount: 100,
        description: "شحن",
      });
      const provider = walletsLib.validateNewWalletEntry({
        ownerId: "d1",
        ownerName: "طبيب",
        role: "provider",
        kind: "credit",
        type: "earned",
        amount: 300,
        description: "مستحق",
      });
      expect(patient).toBeNull();
      expect(provider).toBeNull();
    });
  });

  describe("إضافة وحساب المحفظة", () => {
    it("يضيف مدخل شحن رصيد لمريض ويحسب الرصيد", async () => {
      AsyncStorageMock.setItem.mockImplementation(async (_k, v) => {
        return Promise.resolve();
      });
      const stored: string[] = [];
      AsyncStorageMock.getItem.mockImplementation(async () => {
        return stored[stored.length - 1] ?? null;
      });
      AsyncStorageMock.setItem.mockImplementation(async (_k, v) => {
        stored.push(v);
      });

      const entry = await walletsLib.addWalletEntry({
        ownerId: "p1",
        ownerName: "مريض",
        role: "patient",
        kind: "credit",
        type: "recharge",
        amount: 500,
        description: "شحن الرصيد",
      });
      expect(entry.id.startsWith("we_")).toBe(true);
      expect(entry.amount).toBe(500);

      const summary = await walletsLib.getWalletSummary("p1");
      expect(summary).not.toBeNull();
      expect(summary!.credit).toBe(500);
      expect(summary!.debit).toBe(0);
      expect(summary!.balance).toBe(500);
    });

    it("دفع مستحق يطرح من رصيد المريض", async () => {
      const stored: string[] = [];
      AsyncStorageMock.getItem.mockImplementation(async () => stored[stored.length - 1] ?? null);
      AsyncStorageMock.setItem.mockImplementation(async (_k, v) => void stored.push(v));

      await walletsLib.addWalletEntry({
        ownerId: "p1",
        ownerName: "مريض",
        role: "patient",
        kind: "credit",
        type: "recharge",
        amount: 500,
        description: "شحن",
      });
      await walletsLib.addWalletEntry({
        ownerId: "p1",
        ownerName: "مريض",
        role: "patient",
        kind: "debit",
        type: "payment",
        amount: 200,
        description: "دفع زيارة تمريض",
        reference: "req_1",
      });

      const s = await walletsLib.getWalletSummary("p1");
      expect(s!.balance).toBe(300);
      expect(s!.entries.length).toBe(2);
    });

    it("الاسترداد يعيد الرصيد للمريض", async () => {
      const stored: string[] = [];
      AsyncStorageMock.getItem.mockImplementation(async () => stored[stored.length - 1] ?? null);
      AsyncStorageMock.setItem.mockImplementation(async (_k, v) => void stored.push(v));

      await walletsLib.addWalletEntry({
        ownerId: "p1",
        ownerName: "مريض",
        role: "patient",
        kind: "credit",
        type: "recharge",
        amount: 200,
        description: "شحن",
      });
      await walletsLib.addWalletEntry({
        ownerId: "p1",
        ownerName: "مريض",
        role: "patient",
        kind: "debit",
        type: "payment",
        amount: 200,
        description: "دفع",
      });
      await walletsLib.addWalletEntry({
        ownerId: "p1",
        ownerName: "مريض",
        role: "patient",
        kind: "credit",
        type: "refund",
        amount: 200,
        description: "استرداد الخدمة الملغاة",
      });

      const s = await walletsLib.getWalletSummary("p1");
      expect(s!.balance).toBe(200);
    });

    it("محفظة مقدم الخدمة: مستحقات له ومستحقات عليه", async () => {
      const stored: string[] = [];
      AsyncStorageMock.getItem.mockImplementation(async () => stored[stored.length - 1] ?? null);
      AsyncStorageMock.setItem.mockImplementation(async (_k, v) => void stored.push(v));

      await walletsLib.addWalletEntry({
        ownerId: "d1",
        ownerName: "د. طبيب",
        role: "provider",
        kind: "credit",
        type: "earned",
        amount: 400,
        description: "مستحق زيارة منتهية",
        reference: "req_2",
      });
      await walletsLib.addWalletEntry({
        ownerId: "d1",
        ownerName: "د. طبيب",
        role: "provider",
        kind: "debit",
        type: "charge",
        amount: 60,
        description: "عمولة المنصة",
      });

      const s = await walletsLib.getWalletSummary("d1");
      expect(s!.credit).toBe(400);
      expect(s!.debit).toBe(60);
      expect(s!.balance).toBe(340);
      expect(s!.role).toBe("provider");
    });

    it("getWalletSummaries يعيد محافظ كل المالكين حسب الدور", async () => {
      const stored: string[] = [];
      AsyncStorageMock.getItem.mockImplementation(async () => stored[stored.length - 1] ?? null);
      AsyncStorageMock.setItem.mockImplementation(async (_k, v) => void stored.push(v));

      await walletsLib.addWalletEntry({
        ownerId: "p1",
        ownerName: "مريض",
        role: "patient",
        kind: "credit",
        type: "recharge",
        amount: 100,
        description: "شحن",
      });
      await walletsLib.addWalletEntry({
        ownerId: "d1",
        ownerName: "ممرض",
        role: "provider",
        kind: "credit",
        type: "earned",
        amount: 250,
        description: "مستحق",
      });

      const all = await walletsLib.getWalletSummaries();
      expect(all.length).toBe(2);
      const patients = await walletsLib.getWalletSummaries("patient");
      expect(patients.length).toBe(1);
      expect(patients[0].ownerName).toBe("مريض");
    });

    it("حذف مدخل محاسبي يعيد حساب الرصيد", async () => {
      const stored: string[] = [];
      AsyncStorageMock.getItem.mockImplementation(async () => stored[stored.length - 1] ?? null);
      AsyncStorageMock.setItem.mockImplementation(async (_k, v) => void stored.push(v));

      const entry = await walletsLib.addWalletEntry({
        ownerId: "p1",
        ownerName: "مريض",
        role: "patient",
        kind: "credit",
        type: "recharge",
        amount: 150,
        description: "شحن خاطئ",
      });
      expect(await walletsLib.removeWalletEntry(entry.id)).toBe(true);
      expect(await walletsLib.getWalletSummary("p1")).toBeNull();
      expect(await walletsLib.removeWalletEntry("nonexistent")).toBe(false);
    });
  });
});
