// Troca de vinil: levanta a agulha, o disco velho sai, o novo entra e a agulha desce.
export const SWAP_FRAMES = 20;
const LIFT = 4;
const OUT = 10;
const IN = 16;
const SLIDE_STEP = 11;

// Depois que uma troca começa, mudanças de título nesse prazo só atualizam o disco que está entrando.
export const SETTLE_FRAMES = 50;

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

export function trackKey(title: string, artist: string): string | null {
  return title ? `${title}|${artist}` : null;
}

// Número estável por faixa, para variar sulcos e selo do disco.
export function seedOf(title: string, artist: string): number {
  let hash = 7;
  for (const char of `${title}|${artist}`) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash % 1000;
}
