// Troca de vinil: levanta a agulha, o disco velho sai, o novo entra e a agulha desce.
// A agulha leva 6 quadros para subir; só então o disco velho sai.
export const SWAP_FRAMES = 16;
const LIFT = 6;
const OUT = 11;
const IN = 16;
const SLIDE_STEP = 13;

// Até aqui o disco velho ainda está no prato: uma faixa nova ainda cabe nesta mesma troca.
export const OLD_DISC_FRAMES = OUT;

export interface SwapFrame {
  armUp: boolean;
  vinylOffset: number;
  // Qual faixa aparece no marquee e no desenho do disco.
  content: "old" | "new";
  ringHidden: boolean;
}

export function swapAt(frame: number): SwapFrame {
  if (frame < LIFT) return { armUp: true, vinylOffset: 0, content: "old", ringHidden: false };
  if (frame < OUT) return { armUp: true, vinylOffset: -(frame - LIFT + 1) * SLIDE_STEP, content: "old", ringHidden: true };
  if (frame < IN) return { armUp: true, vinylOffset: (IN - frame) * SLIDE_STEP, content: "new", ringHidden: true };
  return { armUp: false, vinylOffset: 0, content: "new", ringHidden: false };
}

export const swapDone = (frame: number) => frame >= SWAP_FRAMES;

export interface SwapState {
  // quadro em que a troca atual começou; -1 sem troca
  start: number;
  // faixa nova esperando por uma troca
  pending: boolean;
}

// Cada faixa nova ganha uma troca completa. Se o disco velho ainda está no prato, a troca em
// andamento já serve; se o novo já entrou, a próxima começa quando esta terminar.
export function advanceSwap(state: SwapState, frame: number): void {
  if (state.start >= 0 && swapDone(frame - state.start)) state.start = -1;
  if (!state.pending) return;
  if (state.start < 0) {
    state.pending = false;
    state.start = frame;
  } else if (frame - state.start < OLD_DISC_FRAMES) {
    state.pending = false;
  }
}

export function trackKey(title: string, artist: string): string | null {
  return title ? `${title}|${artist}` : null;
}

// Número estável por faixa, para variar sulcos e selo do disco.
export function seedOf(title: string, artist: string): number {
  let hash = 7;
  for (const char of `${title}|${artist}`) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash % 1000;
}
