import { useEffect, useRef, type ReactNode } from "react";

// Janela por cima da tela, com título, botão de fechar, Esc e clique fora.
export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  // a janela pode ser redesenhada o tempo todo; o foco e o Esc só se ligam uma vez
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="help-backdrop" onClick={onClose}>
      <div className="help-modal" role="dialog" aria-modal="true" aria-label={title} onClick={(event) => event.stopPropagation()}>
        <div className="help-head">
          <h3>{title}</h3>
          <button ref={closeRef} type="button" className="px-btn" onClick={onClose}>
            FECHAR
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
