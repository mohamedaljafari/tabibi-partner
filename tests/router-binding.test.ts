import { describe, expect, it } from "vitest";
import { appRouter } from "../server/routers";

describe("tabibi central router binding", () => {
  it("exposes the centralized tabibi router", () => {
    expect(appRouter.tabibi).toBeDefined();
    expect(typeof appRouter.tabibi.createUser).toBe("function");
    expect(typeof appRouter.tabibi.signIn).toBe("function");
    expect(typeof appRouter.tabibi.me).toBe("function");
    expect(typeof appRouter.tabibi.readRecord).toBe("function");
    expect(typeof appRouter.tabibi.deleteAccount).toBe("function");
  });
});
