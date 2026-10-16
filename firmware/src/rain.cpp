#include "rain.h"

#define FRAME_SIZE 120
#define GLYPH_W 5
#define GLYPH_H 7
#define CELL_W 6
#define CELL_H 8
#define BACKGROUND 3

// Letrinhas 5x7: números e uns símbolos que lembram katakana. Cada linha é um número de 5 bits.
static const uint8_t GLYPHS[][GLYPH_H] = {
    {0x0E, 0x11, 0x13, 0x15, 0x19, 0x11, 0x0E}, {0x04, 0x0C, 0x04, 0x04, 0x04, 0x04, 0x0E}, {0x0E, 0x11, 0x01, 0x06, 0x08, 0x10, 0x1F},
    {0x1E, 0x01, 0x01, 0x0E, 0x01, 0x01, 0x1E}, {0x02, 0x06, 0x0A, 0x12, 0x1F, 0x02, 0x02}, {0x1F, 0x10, 0x1E, 0x01, 0x01, 0x11, 0x0E},
    {0x06, 0x08, 0x10, 0x1E, 0x11, 0x11, 0x0E}, {0x1F, 0x01, 0x02, 0x04, 0x08, 0x08, 0x08}, {0x0E, 0x11, 0x11, 0x0E, 0x11, 0x11, 0x0E},
    {0x0E, 0x11, 0x11, 0x0F, 0x01, 0x02, 0x0C}, {0x1F, 0x01, 0x06, 0x04, 0x08, 0x10, 0x10}, {0x03, 0x06, 0x0C, 0x14, 0x04, 0x04, 0x04},
    {0x04, 0x1F, 0x11, 0x01, 0x02, 0x04, 0x08}, {0x1F, 0x04, 0x04, 0x04, 0x04, 0x04, 0x1F}, {0x04, 0x1F, 0x05, 0x05, 0x09, 0x11, 0x06},
    {0x04, 0x1F, 0x04, 0x1F, 0x04, 0x08, 0x10}, {0x0A, 0x1F, 0x0A, 0x02, 0x04, 0x08, 0x10}, {0x04, 0x1F, 0x04, 0x04, 0x08, 0x08, 0x10},
    {0x0E, 0x00, 0x1F, 0x01, 0x02, 0x04, 0x08}, {0x11, 0x11, 0x11, 0x11, 0x12, 0x14, 0x18}, {0x08, 0x1F, 0x09, 0x09, 0x0F, 0x01, 0x01},
    {0x1F, 0x01, 0x01, 0x0A, 0x04, 0x0A, 0x10}, {0x00, 0x04, 0x00, 0x00, 0x04, 0x00, 0x00}, {0x00, 0x00, 0x1F, 0x00, 0x1F, 0x00, 0x00},
};
#define GLYPH_COUNT (sizeof(GLYPHS) / sizeof(GLYPHS[0]))

struct Column {
  int32_t head;    // posição da ponta, em 1/16 de linha
  int32_t speed;   // quanto ela anda por passo, em 1/16 de linha
  uint8_t length;  // linhas do rastro
};

static Column columns[RAIN_COLS];
static uint32_t state = 1;
static uint32_t tick = 0;

static uint32_t next(uint32_t limit) {
  state ^= state << 13;
  state ^= state >> 17;
  state ^= state << 5;
  return state % limit;
}

static void respawn(Column& column, bool first) {
  column.speed = 5 + next(11);
  column.length = 5 + next(8);
  // na partida as colunas começam espalhadas; depois, esperam um pouco fora da tela antes de cair de novo
  column.head = first ? -(int32_t)next((RAIN_ROWS + 6) * 16) : -(int32_t)next(8 * 16);
}

void rainReset(uint32_t seed) {
  state = seed ? seed : 1;
  tick = 0;
  for (Column& column : columns) respawn(column, true);
}

static void put(uint8_t* frame, int x, int y, uint8_t color) {
  uint32_t at = (uint32_t)y * FRAME_SIZE + x;
  uint8_t& cell = frame[at >> 1];
  cell = (at & 1) ? (uint8_t)((cell & 0x0F) | (color << 4)) : (uint8_t)((cell & 0xF0) | color);
}

static void glyph(uint8_t* frame, int column, int row, uint32_t pick, uint8_t color) {
  const uint8_t* bits = GLYPHS[pick % GLYPH_COUNT];
  for (int y = 0; y < GLYPH_H; y++) {
    for (int x = 0; x < GLYPH_W; x++) {
      if (bits[y] & (1 << (GLYPH_W - 1 - x))) put(frame, column * CELL_W + x, row * CELL_H + y, color);
    }
  }
}

void rainStep(uint8_t* frame) {
  for (uint32_t i = 0; i < (uint32_t)FRAME_SIZE * FRAME_SIZE / 2; i++) frame[i] = (BACKGROUND << 4) | BACKGROUND;
  tick++;

  for (int c = 0; c < RAIN_COLS; c++) {
    Column& column = columns[c];
    column.head += column.speed;
    int head = column.head >= 0 ? column.head / 16 : -1;
    if (head - column.length > RAIN_ROWS) respawn(column, false);

    for (int r = 0; r < RAIN_ROWS; r++) {
      int distance = head - r;
      if (distance < 0 || distance >= column.length) continue;
      // a ponta é branca, depois vêm os dois cinzas; as últimas letras do rastro ficam falhadas
      uint8_t color = distance == 0 ? 0 : distance <= 2 ? 1 : 2;
      if (distance >= column.length - 2 && ((r + c) & 1)) continue;
      // a ponta troca de letra a cada passo; o rastro troca devagar
      uint32_t pick = c * 7 + r * 13 + (distance == 0 ? tick : tick / (3 + c % 3));
      glyph(frame, c, r, pick, color);
    }
  }
}
