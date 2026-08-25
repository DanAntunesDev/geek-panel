import type { MediaState } from "../../shared/types.js";

// Tela simulada do player (entrega 1). Sem animação de disco ainda —
// a rotação por quadros entra na entrega de firmware/acabamento.
export function PlayerScreen({ media }: { media: MediaState }) {
  const progress = media.durationSeconds > 0 ? media.positionSeconds / media.durationSeconds : 0;

  return (
    <section style={{ padding: 24, textAlign: "center" }}>
      <div
        aria-hidden
        style={{
          width: 160,
          height: 160,
          margin: "0 auto 16px",
          borderRadius: "50%",
          background: "var(--cor-texto)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: "50%",
            background: "var(--cor-fundo)",
          }}
        />
      </div>
      <p style={{ fontWeight: "bold", fontSize: 18, borderBottom: "2px solid var(--cor-acento)", display: "inline-block" }}>
        {media.title}
      </p>
      <p style={{ margin: "4px 0 16px" }}>{media.artist}</p>
      <div style={{ background: "var(--cor-superficie)", borderRadius: 8, height: 8, overflow: "hidden" }}>
        <div
          style={{
            width: `${Math.round(progress * 100)}%`,
            height: "100%",
            background: "var(--cor-acento)",
          }}
        />
      </div>
      <p style={{ fontSize: 12, marginTop: 8 }}>{media.status}</p>
      <div style={{ display: "flex", justifyContent: "center", gap: 16, marginTop: 16 }}>
        <button disabled>⏮</button>
        <button disabled>{media.status === "Playing" ? "⏸" : "▶"}</button>
        <button disabled>⏭</button>
      </div>
    </section>
  );
}
