import { useEffect, useState } from "react";
import { ConfigPanel } from "./components/ConfigPanel.js";
import { ScreenTabs, type TabKey } from "./components/ScreenTabs.js";
import { TitleBar } from "./components/TitleBar.js";
import { useTheme } from "./state/useTheme.js";
import { DeviceFrame } from "./pixel/DeviceFrame.js";
import { AgendaScreen } from "./screens/AgendaScreen.js";
import { ClockScreen } from "./screens/ClockScreen.js";
import { PlayerScreen } from "./screens/PlayerScreen.js";
import { UsageScreen } from "./screens/UsageScreen.js";

export function App() {
  const [tab, setTab] = useState<TabKey>("player");
  // refaz a tela quando a cor de destaque muda
  const themeKey = useTheme();

  // Quando um lembrete dispara, a agenda vem para a frente.
  useEffect(() => window.painelApi.onAgendaReminder(() => setTab("agenda")), []);

  return (
    <div key={themeKey} style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      <TitleBar />
      <ScreenTabs active={tab} onChange={setTab} />
      <div style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column" }}>
        {tab === "config" ? (
          <ConfigPanel />
        ) : (
          <DeviceFrame>
            {tab === "player" ? <PlayerScreen /> : null}
            {tab === "usage" ? <UsageScreen /> : null}
            {tab === "clock" ? <ClockScreen /> : null}
            {tab === "agenda" ? <AgendaScreen /> : null}
          </DeviceFrame>
        )}
      </div>
    </div>
  );
}
