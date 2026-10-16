import { useEffect, useState } from "react";
import type { ThemeConfig } from "../../shared/types.js";
import { applyTheme } from "../pixel/palette.js";

// Aplica o tema da config e devolve uma chave que muda junto, para refazer a tela.
export function useTheme(onTheme?: (theme: ThemeConfig) => void): string | null {
  const [key, setKey] = useState<string | null>(null);

  useEffect(() => {
    const apply = (theme: ThemeConfig) => {
      applyTheme(theme);
      onTheme?.(theme);
      setKey(JSON.stringify(theme));
    };
    window.painelApi.getConfig().then((config) => apply(config.theme));
    return window.painelApi.onThemeUpdate(apply);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return key;
}
