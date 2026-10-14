// Nomes dos canais IPC, sem dependências de Node — importado tanto pelo
// processo principal quanto pelo preload (que roda em contexto sandboxed).

export const IPC_CHANNELS = {
  getConfig: "config:get",
  saveConfig: "config:save",
  getServerStatus: "server:status",
  getNetworkState: "network:get",
  networkStateUpdated: "network:updated",
  windowMinimize: "window:minimize",
  windowToggleMaximize: "window:toggle-maximize",
  windowClose: "window:close",
  secretStatus: "secret:status",
  secretSet: "secret:set",
  secretClear: "secret:clear",
  providerValidate: "provider:validate",
  authStatus: "auth:status",
  authLogin: "auth:login",
  authLogout: "auth:logout",
  resolveMediaUrl: "media:resolve-url",
  getPlayback: "playback:get",
  playbackUpdated: "playback:updated",
  controlPlayback: "playback:control",
  playUrl: "playback:play-url",
} as const;
