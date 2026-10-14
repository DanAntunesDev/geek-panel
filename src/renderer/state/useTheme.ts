import { useEffect, useState } from "react";
import { applyAccent } from "../pixel/palette.js";

// Aplica a cor de destaque da config e avisa quem usa a paleta fora do canvas.
export function useTheme(onAccent?: (accent: string) => void): string | null {
  const [accent, setAccent] = useState<string | null>(null);

  useEffect(() => {
    const apply = (next: string) => {
      applyAccent(next);
      onAccent?.(next);
      setAccent(next);
    };
    window.painelApi.getConfig().then((config) => apply(config.theme.accent));
    return window.painelApi.onThemeUpdate(apply);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return accent;
}
