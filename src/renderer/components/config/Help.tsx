import { useEffect, useRef, useState } from "react";
import { HELP } from "./helpTopics.js";

// "i" dentro de uma bolinha: o mouse em cima mostra a dica; o clique abre o passo a passo.
export function Help({ topic }: { topic: keyof typeof HELP }) {
  const info = HELP[topic];
  const [hover, setHover] = useState(false);
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <span className="help">
      <button
        type="button"
        className="help-dot"
        aria-label={`Ajuda: ${info.title}`}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onFocus={() => setHover(true)}
        onBlur={() => setHover(false)}
        onClick={() => {
          setHover(false);
          setOpen(true);
        }}
      >
        i
      </button>
      {hover ? (
        <span className="help-tip" role="tooltip">
          <strong>{info.title}</strong>
          {info.hint}
          <em>Clique para ver o passo a passo.</em>
        </span>
      ) : null}
      {open ? (
        <div className="help-backdrop" onClick={() => setOpen(false)}>
          <div className="help-modal" role="dialog" aria-modal="true" aria-label={info.title} onClick={(event) => event.stopPropagation()}>
            <div className="help-head">
              <h3>{info.title}</h3>
              <button ref={closeRef} type="button" className="px-btn" onClick={() => setOpen(false)}>
                FECHAR
              </button>
            </div>
            <div className="help-body">
              <ol>
                {info.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
              {info.note ? <p className="help-note">{info.note}</p> : null}
              {info.links?.map((link) => (
                <p key={link.url}>
                  <a href={link.url} target="_blank" rel="noreferrer">
                    {link.label}
                  </a>
                </p>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </span>
  );
}
