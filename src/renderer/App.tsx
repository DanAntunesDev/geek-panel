import { useEffect, useMemo, useState } from "react";
import { ConfigPanel } from "./components/ConfigPanel.js";
import { ScreenTabs, type TabKey } from "./components/ScreenTabs.js";
import { ClockScreen } from "./screens/ClockScreen.js";
import { PlayerScreen } from "./screens/PlayerScreen.js";
import { UsageScreen } from "./screens/UsageScreen.js";
import {
  buildFakeClockState,
  buildFakeMediaState,
  buildFakeUsageCards,
} from "../services/fixtures/fakeState.js";
import type { AppConfig } from "../shared/types.js";

const FALLBACK_CLOCK_CONFIG = { timezone: "America/Sao_Paulo", showDate: true };

export function App() {
  const [tab, setTab] = useState<TabKey>("usage");
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    window.painelApi.getConfig().then(setConfig);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const media = useMemo(() => buildFakeMediaState(), []);
  const usageCards = useMemo(() => buildFakeUsageCards(), []);
  const clock = useMemo(
    () => buildFakeClockState(config?.clock ?? FALLBACK_CLOCK_CONFIG),
    [config, now],
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <ScreenTabs active={tab} onChange={setTab} />
      <div style={{ flex: 1, overflow: "auto" }}>
        {tab === "player" ? <PlayerScreen media={media} /> : null}
        {tab === "usage" ? <UsageScreen cards={usageCards} /> : null}
        {tab === "clock" ? <ClockScreen clock={clock} connected={false} /> : null}
        {tab === "config" ? <ConfigPanel /> : null}
      </div>
    </div>
  );
}
