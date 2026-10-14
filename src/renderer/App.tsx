import { useMemo, useState } from "react";
import { ConfigPanel } from "./components/ConfigPanel.js";
import { ScreenTabs, type TabKey } from "./components/ScreenTabs.js";
import { ClockScreen } from "./screens/ClockScreen.js";
import { PlayerScreen } from "./screens/PlayerScreen.js";
import { UsageScreen } from "./screens/UsageScreen.js";
import { buildFakeMediaState, buildFakeUsageCards } from "../services/fixtures/fakeState.js";

export function App() {
  const [tab, setTab] = useState<TabKey>("usage");

  const media = useMemo(() => buildFakeMediaState(), []);
  const usageCards = useMemo(() => buildFakeUsageCards(), []);

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <ScreenTabs active={tab} onChange={setTab} />
      <div style={{ flex: 1, overflow: "auto" }}>
        {tab === "player" ? <PlayerScreen media={media} /> : null}
        {tab === "usage" ? <UsageScreen cards={usageCards} /> : null}
        {tab === "clock" ? <ClockScreen connected={false} /> : null}
        {tab === "config" ? <ConfigPanel /> : null}
      </div>
    </div>
  );
}
