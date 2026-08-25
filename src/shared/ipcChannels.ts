// Nomes dos canais IPC, sem dependências de Node — importado tanto pelo
// processo principal quanto pelo preload (que roda em contexto sandboxed).

export const IPC_CHANNELS = {
  getConfig: "config:get",
  saveConfig: "config:save",
  getServerStatus: "server:status",
} as const;
