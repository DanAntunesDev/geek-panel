// Tela de espera do aparelho (chuva de letras, máscara e frase decifrada), igual à de firmware/src/rain.cpp.
// O app usa isto só para mostrar a prévia; um teste confere que os dois geram os mesmos quadros.

import { WAITING_MASK_BASE64 } from "../../shared/waitingMask.js";

export const ROWS = 15;
export const COLS = 20;
export const FRAME = 120;
const CELL_W = 6;
const CELL_H = 8;
const GLYPH_W = 5;
const GLYPH_H = 7;
const BACKGROUND = 3;
const RED = 4;
const DARK_RED = 5;

// Paleta da tela de espera: branco, dois cinzas, preto e dois vermelhos.
export const WAITING_PALETTE = ["#F7F6F3", "#D9D7D2", "#787877", "#1C1C1C", "#D9421F", "#8C2814"] as const;

// Estados da tela de espera, na ordem de WAIT_* no firmware.
export const WAITING_STATES = [
  { id: "wifi", label: "CONECTANDO AO WI-FI" },
  { id: "painel", label: "PROCURANDO O PAINEL" },
  { id: "config", label: "CONFIGURAR O WI-FI" },
  { id: "codigo", label: "CÓDIGO ERRADO" },
] as const;

const GLYPHS: number[][] = [
  [0x0E, 0x11, 0x13, 0x15, 0x19, 0x11, 0x0E],
  [0x04, 0x0C, 0x04, 0x04, 0x04, 0x04, 0x0E],
  [0x0E, 0x11, 0x01, 0x06, 0x08, 0x10, 0x1F],
  [0x1E, 0x01, 0x01, 0x0E, 0x01, 0x01, 0x1E],
  [0x02, 0x06, 0x0A, 0x12, 0x1F, 0x02, 0x02],
  [0x1F, 0x10, 0x1E, 0x01, 0x01, 0x11, 0x0E],
  [0x06, 0x08, 0x10, 0x1E, 0x11, 0x11, 0x0E],
  [0x1F, 0x01, 0x02, 0x04, 0x08, 0x08, 0x08],
  [0x0E, 0x11, 0x11, 0x0E, 0x11, 0x11, 0x0E],
  [0x0E, 0x11, 0x11, 0x0F, 0x01, 0x02, 0x0C],
  [0x1F, 0x01, 0x06, 0x04, 0x08, 0x10, 0x10],
  [0x03, 0x06, 0x0C, 0x14, 0x04, 0x04, 0x04],
  [0x04, 0x1F, 0x11, 0x01, 0x02, 0x04, 0x08],
  [0x1F, 0x04, 0x04, 0x04, 0x04, 0x04, 0x1F],
  [0x04, 0x1F, 0x05, 0x05, 0x09, 0x11, 0x06],
  [0x04, 0x1F, 0x04, 0x1F, 0x04, 0x08, 0x10],
  [0x0A, 0x1F, 0x0A, 0x02, 0x04, 0x08, 0x10],
  [0x04, 0x1F, 0x04, 0x04, 0x08, 0x08, 0x10],
  [0x0E, 0x00, 0x1F, 0x01, 0x02, 0x04, 0x08],
  [0x11, 0x11, 0x11, 0x11, 0x12, 0x14, 0x18],
  [0x08, 0x1F, 0x09, 0x09, 0x0F, 0x01, 0x01],
  [0x1F, 0x01, 0x01, 0x0A, 0x04, 0x0A, 0x10],
  [0x00, 0x04, 0x00, 0x00, 0x04, 0x00, 0x00],
  [0x00, 0x00, 0x1F, 0x00, 0x1F, 0x00, 0x00],
];

const LETTERS: number[][] = [
  [0x0E, 0x11, 0x11, 0x1F, 0x11, 0x11, 0x11],
  [0x1E, 0x11, 0x11, 0x1E, 0x11, 0x11, 0x1E],
  [0x0E, 0x11, 0x10, 0x10, 0x10, 0x11, 0x0E],
  [0x1E, 0x11, 0x11, 0x11, 0x11, 0x11, 0x1E],
  [0x1F, 0x10, 0x10, 0x1E, 0x10, 0x10, 0x1F],
  [0x1F, 0x10, 0x10, 0x1E, 0x10, 0x10, 0x10],
  [0x0E, 0x11, 0x10, 0x17, 0x11, 0x11, 0x0F],
  [0x11, 0x11, 0x11, 0x1F, 0x11, 0x11, 0x11],
  [0x0E, 0x04, 0x04, 0x04, 0x04, 0x04, 0x0E],
  [0x07, 0x02, 0x02, 0x02, 0x02, 0x12, 0x0C],
  [0x11, 0x12, 0x14, 0x18, 0x14, 0x12, 0x11],
  [0x10, 0x10, 0x10, 0x10, 0x10, 0x10, 0x1F],
  [0x11, 0x1B, 0x15, 0x15, 0x11, 0x11, 0x11],
  [0x11, 0x11, 0x19, 0x15, 0x13, 0x11, 0x11],
  [0x0E, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0E],
  [0x1E, 0x11, 0x11, 0x1E, 0x10, 0x10, 0x10],
  [0x0E, 0x11, 0x11, 0x11, 0x15, 0x12, 0x0D],
  [0x1E, 0x11, 0x11, 0x1E, 0x14, 0x12, 0x11],
  [0x0F, 0x10, 0x10, 0x0E, 0x01, 0x01, 0x1E],
  [0x1F, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04],
  [0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0E],
  [0x11, 0x11, 0x11, 0x11, 0x11, 0x0A, 0x04],
  [0x11, 0x11, 0x11, 0x15, 0x15, 0x15, 0x0A],
  [0x11, 0x11, 0x0A, 0x04, 0x0A, 0x11, 0x11],
  [0x11, 0x11, 0x0A, 0x04, 0x04, 0x04, 0x04],
  [0x1F, 0x01, 0x02, 0x04, 0x08, 0x10, 0x1F],
];

const DOT = [0x00, 0x00, 0x00, 0x00, 0x00, 0x0C, 0x0C];
const DASH = [0x00, 0x00, 0x00, 0x1F, 0x00, 0x00, 0x00];

const TOP_PHRASE = "NO SYSTEM IS SAFE";
const TOP_RED_FROM = 13;
const MESSAGES = [
  ["CONECTANDO AO", "WI-FI..."],
  ["PROCURANDO GEEK", "PANEL... ABRA NO PC"],
  ["REDE GEEKPANEL", "ABRA 192.168.4.1"],
  ["CODIGO DE PAREAMENTO", "NAO CONFERE"],
];

const DECODE_MAX_TICKS = 220;
const HOLD_TICKS = 90;
type Phase = "decode" | "hold" | "dissolve";

interface Column {
  head: number;
  speed: number;
  length: number;
}

// Máscara: um índice de paleta por pixel; 15 é transparente.
const MASK = (() => {
  const bytes = Uint8Array.from(atob(WAITING_MASK_BASE64), (char) => char.charCodeAt(0));
  const pixels = new Uint8Array(FRAME * FRAME);
  for (let at = 0; at < pixels.length; at += 1) pixels[at] = at & 1 ? bytes[at >> 1] >> 4 : bytes[at >> 1] & 0x0f;
  return pixels;
})();

const bitmapFor = (letter: string): number[] => {
  if (letter >= "A" && letter <= "Z") return LETTERS[letter.charCodeAt(0) - 65];
  if (letter >= "0" && letter <= "9") return GLYPHS[letter.charCodeAt(0) - 48];
  return letter === "." ? DOT : DASH;
};

export class WaitingRain {
  private state = 1;
  private tick = 0;
  private columns: Column[] = [];
  private target: string[][] = [];
  private locked: boolean[][] = [];
  private current = 255;
  private phase: Phase = "decode";
  private phaseTick = 0;
  private total = 0;
  private lockedCount = 0;

  constructor(seed: number) {
    this.reset(seed);
  }

  private next(limit: number): number {
    this.state = (this.state ^ (this.state << 13)) >>> 0;
    this.state = (this.state ^ (this.state >>> 17)) >>> 0;
    this.state = (this.state ^ (this.state << 5)) >>> 0;
    return this.state % limit;
  }

  private respawn(column: Column, first: boolean): void {
    column.speed = 5 + this.next(11);
    column.length = 5 + this.next(8);
    column.head = first ? -this.next((ROWS + 6) * 16) : -this.next(8 * 16);
  }

  reset(seed: number): void {
    this.state = seed >>> 0 || 1;
    this.tick = 0;
    this.current = 255;
    // sem mensagem escolhida ainda, as grades ficam vazias (como no aparelho)
    this.target = Array.from({ length: ROWS }, () => Array(COLS).fill(""));
    this.locked = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
    this.columns = Array.from({ length: COLS }, () => ({ head: 0, speed: 0, length: 0 }));
    for (const column of this.columns) this.respawn(column, true);
  }

  // Troca a mensagem (0 a 3, a ordem de WAITING_STATES). A mesma de antes não faz nada.
  message(index: number): void {
    if (index < 0 || index >= MESSAGES.length || index === this.current) return;
    this.current = index;
    this.target = Array.from({ length: ROWS }, () => Array(COLS).fill(""));
    this.locked = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
    this.total = 0;
    this.lockedCount = 0;
    this.phase = "decode";
    this.phaseTick = 0;

    const place = (text: string, row: number) => {
      const left = Math.floor((COLS - text.length) / 2);
      [...text].forEach((letter, k) => {
        if (letter === " ") return;
        this.target[row][left + k] = letter;
        this.total += 1;
      });
    };
    place(TOP_PHRASE, 0);
    MESSAGES[index].forEach((line, i) => place(line, ROWS - MESSAGES[index].length + i));
  }

  // Quantas letras da mensagem já estão decifradas e quantas ela tem ao todo.
  progress(): { locked: number; total: number } {
    return { locked: this.lockedCount, total: this.total };
  }

  private put(frame: Uint8Array, x: number, y: number, color: number): void {
    frame[y * FRAME + x] = color;
  }

  private draw(frame: Uint8Array, column: number, row: number, bits: number[], color: number): void {
    if (color <= 1 || color === RED) {
      const shadow = color === RED ? DARK_RED : 2;
      for (let y = 0; y < GLYPH_H; y += 1) {
        for (let x = 0; x < GLYPH_W; x += 1) if (bits[y] & (1 << (GLYPH_W - 1 - x))) this.put(frame, column * CELL_W + x + 1, row * CELL_H + y + 1, shadow);
      }
    }
    for (let y = 0; y < GLYPH_H; y += 1) {
      for (let x = 0; x < GLYPH_W; x += 1) if (bits[y] & (1 << (GLYPH_W - 1 - x))) this.put(frame, column * CELL_W + x, row * CELL_H + y, color);
    }
  }

  private showMessage(frame: Uint8Array): void {
    for (let r = 0; r < ROWS; r += 1) {
      for (let c = 0; c < COLS; c += 1) {
        if (!this.locked[r][c]) continue;
        for (let y = 0; y < CELL_H; y += 1) for (let x = 0; x < CELL_W; x += 1) this.put(frame, c * CELL_W + x, r * CELL_H + y, BACKGROUND);
        const glitch = this.phase === "hold" && this.next(100) === 0;
        const color = r === 0 && c >= TOP_RED_FROM ? RED : 0;
        this.draw(frame, c, r, glitch ? GLYPHS[this.next(GLYPHS.length)] : bitmapFor(this.target[r][c]), color);
      }
    }
  }

  private advancePhase(): void {
    this.phaseTick += 1;
    if (this.phase === "decode" && (this.lockedCount >= this.total || this.phaseTick > DECODE_MAX_TICKS)) {
      for (let r = 0; r < ROWS; r += 1) for (let c = 0; c < COLS; c += 1) if (this.target[r][c] && !this.locked[r][c]) this.locked[r][c] = true;
      this.lockedCount = this.total;
      this.phase = "hold";
      this.phaseTick = 0;
    } else if (this.phase === "hold" && this.phaseTick > HOLD_TICKS) {
      this.phase = "dissolve";
      this.phaseTick = 0;
    } else if (this.phase === "dissolve") {
      for (let r = 0; r < ROWS; r += 1) {
        for (let c = 0; c < COLS; c += 1) {
          if (this.locked[r][c] && this.next(100) < 9) {
            this.locked[r][c] = false;
            this.lockedCount -= 1;
          }
        }
      }
      if (this.lockedCount === 0) {
        this.phase = "decode";
        this.phaseTick = 0;
      }
    }
  }

  // Um passo da animação: devolve o quadro de 120x120, um índice da paleta por pixel.
  step(): Uint8Array {
    const frame = new Uint8Array(FRAME * FRAME).fill(BACKGROUND);
    this.tick += 1;

    for (let c = 0; c < COLS; c += 1) {
      const column = this.columns[c];
      column.head += column.speed;
      const head = column.head >= 0 ? Math.floor(column.head / 16) : -1;
      if (head - column.length > ROWS) this.respawn(column, false);

      for (let r = 0; r < ROWS; r += 1) {
        const distance = head - r;
        if (distance < 0 || distance >= column.length) continue;
        const color = distance === 0 ? 0 : distance <= 2 ? 1 : 2;
        if (distance >= column.length - 2 && (r + c) & 1) continue;
        const pick = c * 7 + r * 13 + (distance === 0 ? this.tick : Math.floor(this.tick / (3 + (c % 3))));
        this.draw(frame, c, r, GLYPHS[pick % GLYPHS.length], color);
        if (distance === 0 && this.phase === "decode" && this.target[r][c] && !this.locked[r][c]) {
          this.locked[r][c] = true;
          this.lockedCount += 1;
        }
      }
    }
    this.showMessage(frame);
    for (let at = 0; at < MASK.length; at += 1) if (MASK[at] !== 15) frame[at] = MASK[at];
    this.advancePhase();
    return frame;
  }
}
