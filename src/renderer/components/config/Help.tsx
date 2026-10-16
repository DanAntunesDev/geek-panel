import { useState } from "react";
import { HELP } from "./helpTopics.js";
import { Modal } from "./Modal.js";

// "i" dentro de uma bolinha: o mouse em cima mostra a dica; o clique abre o passo a passo.
export function Help({ topic }: { topic: keyof typeof HELP }) {
  const info = HELP[topic];
  const [hover, setHover] = useState(false);
  const [open, setOpen] = useState(false);
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
        <Modal title={info.title} onClose={() => setOpen(false)}>
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
        </Modal>
      ) : null}
    </span>
  );
}
