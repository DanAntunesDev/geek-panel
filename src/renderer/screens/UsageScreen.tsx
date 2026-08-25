import type { UsageCard } from "../../shared/types.js";

export function UsageScreen({ cards }: { cards: UsageCard[] }) {
  return (
    <section>
      <header
        style={{
          background: "var(--cor-texto)",
          color: "var(--cor-fundo)",
          padding: "12px 16px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <strong>TOKENIZER</strong>
        <span aria-label="atualizar">⟳</span>
      </header>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: 16 }}>
        {cards.map((card) => (
          <div
            key={card.id}
            style={{
              background: "var(--cor-superficie)",
              borderRadius: 12,
              padding: 12,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>{card.label}</span>
              <span
                style={{
                  fontSize: 11,
                  padding: "2px 6px",
                  borderRadius: 6,
                  background: card.status === "ok" ? "var(--cor-texto)" : "var(--cor-acento)",
                  color: "var(--cor-fundo)",
                }}
              >
                {card.status}
              </span>
            </div>
            <p style={{ margin: "4px 0", fontSize: 20, fontWeight: "bold" }}>
              {card.used} / {card.limit}
            </p>
            <p style={{ margin: 0, fontSize: 12 }}>{card.period}</p>
            <div style={{ background: "var(--cor-fundo)", borderRadius: 8, height: 6, marginTop: 8, overflow: "hidden" }}>
              <div
                style={{
                  width: `${card.percentage}%`,
                  height: "100%",
                  background: "var(--cor-acento)",
                }}
              />
            </div>
            <p style={{ margin: "8px 0 0", fontSize: 10, opacity: 0.7 }}>updated now</p>
          </div>
        ))}
      </div>
    </section>
  );
}
