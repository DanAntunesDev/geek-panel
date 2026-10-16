import { describe, expect, it } from "vitest";
import { callDevice } from "../../src/main/deviceAdmin.js";

describe("callDevice", () => {
  it("manda o formulário e aceita 200", async () => {
    let seen: { url: string; body: string } | null = null;
    const result = await callDevice("10.0.0.9", "/pair", { code: "123456" }, async (url, init) => {
      seen = { url, body: init.body };
      return { status: 200 };
    });
    expect(seen).toEqual({ url: "http://10.0.0.9/pair", body: "code=123456" });
    expect(result).toMatchObject({ ok: true, status: 200, host: "10.0.0.9" });
  });

  it("explica o 401 e devolve o código", async () => {
    const result = await callDevice("10.0.0.9", "/pair", {}, async () => ({ status: 401 }));
    expect(result).toMatchObject({ ok: false, status: 401 });
    expect(result.message).toMatch(/outro código/);
  });

  it("status 0 quando o aparelho não responde", async () => {
    const result = await callDevice("10.0.0.9", "/reset", {}, async () => {
      throw new Error("ECONNREFUSED");
    });
    expect(result).toMatchObject({ ok: false, status: 0 });
  });
});
