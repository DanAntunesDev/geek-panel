// Relógio local da posição: a leitura real só ancora quando traz novidade.
export interface ClockInput {
  // posição que o relógio local marca agora, em segundos
  local: number;
  // última posição lida da fonte (antes desta leitura)
  lastReported: number | null;
  reported: number;
  duration: number;
  playing: boolean;
  newTrack: boolean;
}

// Alguns players (Firefox via MPRIS) repetem a mesma posição enquanto tocam;
// se a gente aceitasse sempre, a barra voltaria ao mesmo ponto a cada leitura.
export function anchorPosition(input: ClockInput): number {
  const { local, lastReported, reported, duration, playing, newTrack } = input;
  if (newTrack) return duration > 0 && reported > duration ? 0 : reported;
  const stale = playing && lastReported !== null && reported === lastReported;
  return stale ? local : reported;
}
