import type { ClockState } from "../../shared/types.js";

export function ClockScreen({ clock, connected }: { clock: ClockState; connected: boolean }) {
  return (
    <section style={{ padding: 24, textAlign: "center" }}>
      <p style={{ fontSize: 48, fontWeight: "bold", margin: "32px 0 8px" }}>{clock.time}</p>
      {clock.date ? <p style={{ margin: 0 }}>{clock.date}</p> : null}
      <p style={{ marginTop: 24, fontSize: 12 }}>
        <span
          aria-hidden
          style={{
            display: "inline-block",
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: connected ? "var(--cor-acento)" : "var(--cor-superficie)",
            marginRight: 6,
          }}
        />
        {connected ? "display conectado" : "display desconectado"}
      </p>
    </section>
  );
}
