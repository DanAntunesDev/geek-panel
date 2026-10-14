import { describe, expect, it } from "vitest";
import { volumeAt } from "../../src/renderer/screens/playerScene.js";

describe("volumeAt", () => {
  it("acha o alto-falante e os degraus", () => {
    expect(volumeAt(41, 95)).toEqual({ kind: "mute" });
    expect(volumeAt(49, 95)).toEqual({ kind: "level", level: 1 / 8 });
    expect(volumeAt(78, 95)).toEqual({ kind: "level", level: 1 });
  });

  it("ignora o resto da tela", () => {
    expect(volumeAt(10, 95)).toBeNull();
    expect(volumeAt(60, 80)).toBeNull();
    expect(volumeAt(90, 95)).toBeNull();
  });
});
