import { windowCloseIcon, windowMaximizeIcon, windowMinimizeIcon } from "../pixel/icons.js";
import { PALETTE, SPRITE_COLORS } from "../pixel/palette.js";
import { PixelIconButton } from "../pixel/PixelIconButton.js";

export function TitleBar() {
  return (
    <header
      style={
        {
          background: PALETTE.ink,
          color: PALETTE.bg,
          height: 34,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 4px 0 10px",
          flexShrink: 0,
          WebkitAppRegion: "drag",
        } as React.CSSProperties
      }
    >
      <span className="pixel-title" style={{ fontSize: 9 }}>
        GEEK PAINEL
      </span>
      <div style={{ display: "flex", WebkitAppRegion: "no-drag" } as React.CSSProperties}>
        <PixelIconButton
          grid={windowMinimizeIcon()}
          colors={{ K: PALETTE.bg }}
          scale={2}
          label="Minimizar"
          onClick={() => window.painelApi.minimizeWindow()}
        />
        <PixelIconButton
          grid={windowMaximizeIcon()}
          colors={{ K: PALETTE.bg }}
          scale={2}
          label="Maximizar"
          onClick={() => window.painelApi.toggleMaximizeWindow()}
        />
        <PixelIconButton
          grid={windowCloseIcon()}
          colors={{ K: SPRITE_COLORS.A }}
          scale={2}
          label="Fechar"
          onClick={() => window.painelApi.closeWindow()}
        />
      </div>
    </header>
  );
}
