import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn().mockResolvedValue(null),
    setItem: vi.fn().mockResolvedValue(undefined),
    removeItem: vi.fn().mockResolvedValue(undefined),
  },
}));

import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  openThread,
  findThread,
  readPatientThreads,
  readProviderThreads,
  readMessages,
  sendMessage,
  sendAttachmentMessage,
  removeThread,
  CHAT_THREADS_KEY,
  CHAT_MESSAGES_KEY,
} from "../lib/chat";
import type { ChatAttachment } from "../lib/chat";

const mockGet = AsyncStorage.getItem as ReturnType<typeof vi.fn>;
const mockSet = AsyncStorage.setItem as ReturnType<typeof vi.fn>;

/** حالة تخزين محاكاة تشاركها getItem/setItem */
const store = new Map<string, string>();
function resetStore() {
  store.clear();
  mockGet.mockImplementation(async (key: string) => store.get(key) ?? null);
  mockSet.mockImplementation(async (key: string, value: string) => {
    store.set(key, value);
  });
}

describe("chat library", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStore();
  });

  it("opens a thread and stores it", async () => {
    const thread = await openThread({
      requestId: "req_1",
      patientId: "p1",
      patientName: "أحمد",
      providerId: "d1",
      providerName: "د. سارة",
    });
    expect(thread.requestId).toBe("req_1");
    expect(JSON.parse(store.get(CHAT_THREADS_KEY) ?? "[]").length).toBe(1);
  });

  it("is idempotent: returns existing thread for same request", async () => {
    const first = await openThread({
      requestId: "req_2",
      patientId: "p1",
      patientName: "أحمد",
      providerId: "d1",
      providerName: "د. سارة",
    });
    const second = await openThread({
      requestId: "req_2",
      patientId: "p1",
      patientName: "أحمد",
      providerId: "d1",
      providerName: "د. سارة",
    });
    expect(second.threadId).toBe(first.threadId);
    expect(JSON.parse(store.get(CHAT_THREADS_KEY) ?? "[]").length).toBe(1);
  });

  it("finds thread by requestId", async () => {
    await openThread({
      requestId: "req_3",
      patientId: "p1",
      patientName: "أحمد",
      providerId: "d1",
      providerName: "د. سارة",
    });
    const found = await findThread("req_3");
    expect(found?.patientName).toBe("أحمد");
  });

  it("filters threads per patient and per provider", async () => {
    await openThread({
      requestId: "req_a",
      patientId: "p1",
      patientName: "أحمد",
      providerId: "d1",
      providerName: "د. سارة",
    });
    await openThread({
      requestId: "req_b",
      patientId: "p2",
      patientName: "منى",
      providerId: "d1",
      providerName: "د. سارة",
    });
    const provider = await readProviderThreads("d1");
    expect(provider.length).toBe(2);
    const patient = await readPatientThreads("p1");
    expect(patient.length).toBe(1);
  });

  it("sends text messages and trims whitespace", async () => {
    await openThread({
      requestId: "req_4",
      patientId: "p1",
      patientName: "أحمد",
      providerId: "d1",
      providerName: "د. سارة",
    });
    const msg = await sendMessage("req_4", "patient", "  سلام عليكم  ");
    expect(msg?.text).toBe("سلام عليكم");
    expect(msg?.senderRole).toBe("patient");
    const all = await readMessages("req_4");
    expect(all.length).toBe(1);
  });

  it("rejects empty messages", async () => {
    await openThread({
      requestId: "req_5",
      patientId: "p1",
      patientName: "أحمد",
      providerId: "d1",
      providerName: "د. سارة",
    });
    const msg = await sendMessage("req_5", "patient", "   ");
    expect(msg).toBeNull();
  });

  it("returns null when sending to unknown thread", async () => {
    const msg = await sendMessage("unknown", "patient", "سلام");
    expect(msg).toBeNull();
  });

  it("removes thread and its messages on cancellation", async () => {
    await openThread({
      requestId: "req_6",
      patientId: "p1",
      patientName: "أحمد",
      providerId: "d1",
      providerName: "د. سارة",
    });
    await sendMessage("req_6", "patient", "مرحبا");
    expect(await readMessages("req_6")).toHaveLength(1);
    await removeThread("req_6");
    expect(store.get(CHAT_THREADS_KEY)).toBe("[]");
    expect(await readMessages("req_6")).toEqual([]);
  });

  const sampleImage: ChatAttachment = {
    kind: "image",
    fileName: "تحليل_دم.jpg",
    mimeType: "image/jpeg",
    uri: "file:///data/images/lab.jpg",
  };

  const samplePdf: ChatAttachment = {
    kind: "file",
    fileName: "تقرير_طبي.pdf",
    mimeType: "application/pdf",
    uri: "file:///data/reports/report.pdf",
  };

  it("sends an image attachment with optional caption", async () => {
    await openThread({
      requestId: "req_att_1",
      patientId: "p1",
      patientName: "أحمد",
      providerId: "d1",
      providerName: "د. سارة",
    });
    const msg = await sendAttachmentMessage("req_att_1", "patient", sampleImage, "نتائج التحليل كما طلبت");
    expect(msg?.attachment?.kind).toBe("image");
    expect(msg?.attachment?.fileName).toBe("تحليل_دم.jpg");
    expect(msg?.text).toBe("نتائج التحليل كما طلبت");
    expect(msg?.senderRole).toBe("patient");
    const all = await readMessages("req_att_1");
    expect(all.length).toBe(1);
  });

  it("sends a PDF attachment without text", async () => {
    await openThread({
      requestId: "req_att_2",
      patientId: "p1",
      patientName: "أحمد",
      providerId: "d1",
      providerName: "د. سارة",
    });
    const msg = await sendAttachmentMessage("req_att_2", "provider", samplePdf);
    expect(msg?.attachment?.kind).toBe("file");
    expect(msg?.text).toBe("");
    const all = await readMessages("req_att_2");
    expect(all[0].attachment?.fileName).toBe("تقرير_طبي.pdf");
  });

  it("rejects attachment with empty uri", async () => {
    await openThread({
      requestId: "req_att_3",
      patientId: "p1",
      patientName: "أحمد",
      providerId: "d1",
      providerName: "د. سارة",
    });
    const msg = await sendAttachmentMessage("req_att_3", "patient", { ...sampleImage, uri: "" });
    expect(msg).toBeNull();
  });

  it("rejects attachment sent to unknown thread", async () => {
    const msg = await sendAttachmentMessage("unknown", "patient", sampleImage, "نص");
    expect(msg).toBeNull();
  });

  it("mixes text and attachment messages in order", async () => {
    await openThread({
      requestId: "req_att_4",
      patientId: "p1",
      patientName: "أحمد",
      providerId: "d1",
      providerName: "د. سارة",
    });
    await sendMessage("req_att_4", "patient", "مرحبا");
    await sendAttachmentMessage("req_att_4", "provider", samplePdf);
    await sendMessage("req_att_4", "patient", "شكرًا");
    const all = await readMessages("req_att_4");
    expect(all.length).toBe(3);
    expect(all[1].attachment?.kind).toBe("file");
  });

  it("keeps other threads when removing one", async () => {
    await openThread({
      requestId: "req_7a",
      patientId: "p1",
      patientName: "أحمد",
      providerId: "d1",
      providerName: "د. سارة",
    });
    await openThread({
      requestId: "req_7b",
      patientId: "p1",
      patientName: "أحمد",
      providerId: "d2",
      providerName: "د. عمر",
    });
    await removeThread("req_7a");
    expect(await findThread("req_7a")).toBeNull();
    expect((await findThread("req_7b"))?.providerName).toBe("د. عمر");
  });
});
