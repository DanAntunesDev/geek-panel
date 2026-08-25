import type { PainelApi } from "../preload/preload.js";

declare global {
  interface Window {
    painelApi: PainelApi;
  }
}
