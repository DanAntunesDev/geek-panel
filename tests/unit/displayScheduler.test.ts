import { describe, expect, it } from "vitest";
import { DisplayScheduler, type SchedulerInputs } from "../../src/main/displayScheduler.js";
import type { DisplayMode } from "../../src/shared/types.js";

function setup(overrides: Partial<SchedulerInputs> = {}) {
  let time = 1_000_000;
  const inputs: SchedulerInputs = {
    mode: "automatic",
    seconds: { player: 30, usage: 10, clock: 30, agenda: 20 },
    available: { player: true, usage: true, clock: true, agenda: true },
    ...overrides,
  };
  const changes: DisplayMode[] = [];
  const scheduler = new DisplayScheduler({ inputs: () => inputs, onChange: (screen) => changes.push(screen), now: () => time });
  return {
    inputs,
    changes,
    scheduler,
    advance: (seconds: number) => {
      time += seconds * 1000;
      scheduler.tick();
    },
  };
}

describe("DisplayScheduler", () => {
  it("no modo fixo mostra sempre a tela escolhida", () => {
    const { scheduler, advance } = setup({ mode: "usage" });
    scheduler.tick();
    advance(500);
    expect(scheduler.current()).toBe("usage");
  });

  it("no automático passa de tela no tempo configurado, em ordem, e volta ao início", () => {
    const { scheduler, advance, changes } = setup();
    scheduler.tick();
    expect(scheduler.current()).toBe("player");
    advance(29);
    expect(scheduler.current()).toBe("player");
    advance(1);
    expect(scheduler.current()).toBe("usage");
    advance(10);
    expect(scheduler.current()).toBe("clock");
    advance(30);
    expect(scheduler.current()).toBe("agenda");
    advance(20);
    expect(scheduler.current()).toBe("player");
    expect(changes).toEqual(["player", "usage", "clock", "agenda", "player"]);
  });

  it("pula as telas sem conteúdo e sai da tela que ficou sem conteúdo", () => {
    const { scheduler, advance, inputs } = setup({ available: { player: false, usage: false, clock: true, agenda: true } });
    scheduler.tick();
    expect(scheduler.current()).toBe("clock");
    advance(30);
    expect(scheduler.current()).toBe("agenda");
    inputs.available.agenda = false;
    advance(1);
    expect(scheduler.current()).toBe("clock");
  });

  it("sem nenhuma tela disponível cai no relógio", () => {
    const { scheduler } = setup({ available: { player: false, usage: false, clock: false, agenda: false } });
    scheduler.tick();
    expect(scheduler.current()).toBe("clock");
  });

  it("o lembrete leva a agenda para a frente e depois o modo volta ao normal", () => {
    const { scheduler, advance } = setup({ mode: "clock" });
    scheduler.tick();
    expect(scheduler.current()).toBe("clock");
    scheduler.forceAgenda(30_000);
    expect(scheduler.current()).toBe("agenda");
    advance(29);
    expect(scheduler.current()).toBe("agenda");
    advance(2);
    expect(scheduler.current()).toBe("clock");
  });
});
