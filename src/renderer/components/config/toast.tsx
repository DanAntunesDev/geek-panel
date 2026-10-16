import { useEffect, useState } from "react";
import { describeError } from "./auth.js";

// Aviso flutuante: todo botão da Config responde aqui, mesmo com o resultado fora da tela.
type Toast = { id: number; tone: "ok" | "err"; text: string };

const listeners = new Set<(toast: Toast) => void>();
let counter = 0;

export function notify(tone: Toast["tone"], text: string): void {
  counter += 1;
  listeners.forEach((listener) => listener({ id: counter, tone, text }));
}

// Roda a ação e avisa o resultado. Devolve undefined se falhou.
export async function act<T>(okText: string | ((value: T) => string), action: () => Promise<T>): Promise<T | undefined> {
  try {
    const value = await action();
    notify("ok", typeof okText === "function" ? okText(value) : okText);
    return value;
  } catch (error) {
    notify("err", describeError(error));
    return undefined;
  }
}

const SHOWN_MS = 7000;

export function Toaster() {
  const [toast, setToast] = useState<Toast | null>(null);

  useEffect(() => {
    listeners.add(setToast);
    return () => void listeners.delete(setToast);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), SHOWN_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  if (!toast) return null;
  return (
    <div className={`cfg-toast cfg-toast-${toast.tone}`} role="status" onClick={() => setToast(null)}>
      <strong>{toast.tone === "ok" ? "OK" : "ERRO"}</strong> {toast.text}
    </div>
  );
}
