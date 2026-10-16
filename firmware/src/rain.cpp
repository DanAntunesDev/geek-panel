#include "rain.h"
#include <string.h>

// No aparelho a máscara fica na memória de programa; no computador (testes) é um vetor comum.
#ifdef ARDUINO
#include <pgmspace.h>
#else
#define PROGMEM
#define pgm_read_byte(address) (*(address))
#endif
#include "rain_mask.h"

#define FRAME_SIZE 120
#define BACKGROUND 3
#define RED 4
#define DARK_RED 5
#define GLYPH_W 5
#define GLYPH_H 7
#define CELL_W 6
#define CELL_H 8

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

// Letras da mensagem. Os números reaproveitam os 10 primeiros glifos da chuva.
static const uint8_t LETTERS[26][GLYPH_H] = {
    {0x0E, 0x11, 0x11, 0x1F, 0x11, 0x11, 0x11}, {0x1E, 0x11, 0x11, 0x1E, 0x11, 0x11, 0x1E}, {0x0E, 0x11, 0x10, 0x10, 0x10, 0x11, 0x0E},
    {0x1E, 0x11, 0x11, 0x11, 0x11, 0x11, 0x1E}, {0x1F, 0x10, 0x10, 0x1E, 0x10, 0x10, 0x1F}, {0x1F, 0x10, 0x10, 0x1E, 0x10, 0x10, 0x10},
    {0x0E, 0x11, 0x10, 0x17, 0x11, 0x11, 0x0F}, {0x11, 0x11, 0x11, 0x1F, 0x11, 0x11, 0x11}, {0x0E, 0x04, 0x04, 0x04, 0x04, 0x04, 0x0E},
    {0x07, 0x02, 0x02, 0x02, 0x02, 0x12, 0x0C}, {0x11, 0x12, 0x14, 0x18, 0x14, 0x12, 0x11}, {0x10, 0x10, 0x10, 0x10, 0x10, 0x10, 0x1F},
    {0x11, 0x1B, 0x15, 0x15, 0x11, 0x11, 0x11}, {0x11, 0x11, 0x19, 0x15, 0x13, 0x11, 0x11}, {0x0E, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0E},
    {0x1E, 0x11, 0x11, 0x1E, 0x10, 0x10, 0x10}, {0x0E, 0x11, 0x11, 0x11, 0x15, 0x12, 0x0D}, {0x1E, 0x11, 0x11, 0x1E, 0x14, 0x12, 0x11},
    {0x0F, 0x10, 0x10, 0x0E, 0x01, 0x01, 0x1E}, {0x1F, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04}, {0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0E},
    {0x11, 0x11, 0x11, 0x11, 0x11, 0x0A, 0x04}, {0x11, 0x11, 0x11, 0x15, 0x15, 0x15, 0x0A}, {0x11, 0x11, 0x0A, 0x04, 0x0A, 0x11, 0x11},
    {0x11, 0x11, 0x0A, 0x04, 0x04, 0x04, 0x04}, {0x1F, 0x01, 0x02, 0x04, 0x08, 0x10, 0x1F},
};
static const uint8_t DOT[GLYPH_H] = {0x00, 0x00, 0x00, 0x00, 0x00, 0x0C, 0x0C};
static const uint8_t DASH[GLYPH_H] = {0x00, 0x00, 0x00, 0x1F, 0x00, 0x00, 0x00};

// Frase fixa no alto, acima da máscara; a última palavra sai em vermelho.
#define TOP_PHRASE "NO SYSTEM IS SAFE"
#define TOP_RED_FROM 13

// Duas linhas no rodapé. A ordem é a de WAIT_* (wifi, painel, config, codigo).
#define MESSAGE_LINES 2
static const char* const MESSAGES[RAIN_MESSAGES][MESSAGE_LINES] = {
    {"CONECTANDO AO", "WI-FI..."},
    {"PROCURANDO GEEK", "PAINEL... ABRA NO PC"},
    {"REDE GEEKPANEL", "ABRA 192.168.4.1"},
    {"CODIGO DE PAREAMENTO", "NAO CONFERE"},
};

struct Column {
  int32_t head;    // posição da ponta, em 1/16 de linha
  int32_t speed;   // quanto ela anda por passo, em 1/16 de linha
  uint8_t length;  // linhas do rastro
};

// Fases da mensagem: as letras vão sendo decifradas, ficam um tempo, e se desfazem para recomeçar.
enum Phase : uint8_t { DECODE, HOLD, DISSOLVE };
#define DECODE_MAX_TICKS 220
#define HOLD_TICKS 90

static Column columns[RAIN_COLS];
static char target[RAIN_ROWS][RAIN_COLS];
static bool locked[RAIN_ROWS][RAIN_COLS];
static uint8_t currentMessage = 255;
static Phase phase = DECODE;
static uint32_t phaseTick = 0;
static uint16_t total = 0;
static uint16_t lockedCount = 0;
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
  currentMessage = 255;
  for (Column& column : columns) respawn(column, true);
}

void rainMessage(uint8_t message) {
  if (message >= RAIN_MESSAGES || message == currentMessage) return;
  currentMessage = message;
  for (int r = 0; r < RAIN_ROWS; r++) {
    for (int c = 0; c < RAIN_COLS; c++) {
      target[r][c] = 0;
      locked[r][c] = false;
    }
  }
  total = 0;
  lockedCount = 0;
  phase = DECODE;
  phaseTick = 0;

  // a frase do alto fica na primeira linha, centralizada
  const char* top = TOP_PHRASE;
  int topLength = 0;
  while (top[topLength]) topLength++;
  for (int k = 0; k < topLength; k++) {
    if (top[k] == ' ') continue;
    target[0][(RAIN_COLS - topLength) / 2 + k] = top[k];
    total++;
  }

  // as duas linhas de status ficam coladas embaixo, no rodapé
  for (int i = 0; i < MESSAGE_LINES; i++) {
    const char* text = MESSAGES[message][i];
    int length = 0;
    while (text[length]) length++;
    int left = (RAIN_COLS - length) / 2;
    for (int k = 0; k < length; k++) {
      if (text[k] == ' ') continue;
      target[RAIN_ROWS - MESSAGE_LINES + i][left + k] = text[k];
      total++;
    }
  }
}

uint16_t rainLocked() { return lockedCount; }
uint16_t rainTotal() { return total; }

static void put(uint8_t* frame, int x, int y, uint8_t color) {
  uint32_t at = (uint32_t)y * FRAME_SIZE + x;
  uint8_t& cell = frame[at >> 1];
  cell = (at & 1) ? (uint8_t)((cell & 0x0F) | (color << 4)) : (uint8_t)((cell & 0xF0) | color);
}

// Letra com relevo: uma sombra cinza um pixel para baixo e para a direita, que cabe na própria célula.
static void draw(uint8_t* frame, int column, int row, const uint8_t* bits, uint8_t color) {
  if (color <= 1 || color == RED) {
    uint8_t shadow = color == RED ? DARK_RED : 2;
    for (int y = 0; y < GLYPH_H; y++) {
      for (int x = 0; x < GLYPH_W; x++) {
        if (bits[y] & (1 << (GLYPH_W - 1 - x))) put(frame, column * CELL_W + x + 1, row * CELL_H + y + 1, shadow);
      }
    }
  }
  for (int y = 0; y < GLYPH_H; y++) {
    for (int x = 0; x < GLYPH_W; x++) {
      if (bits[y] & (1 << (GLYPH_W - 1 - x))) put(frame, column * CELL_W + x, row * CELL_H + y, color);
    }
  }
}

static const uint8_t* bitmapFor(char letter) {
  if (letter >= 'A' && letter <= 'Z') return LETTERS[letter - 'A'];
  if (letter >= '0' && letter <= '9') return GLYPHS[letter - '0'];
  return letter == '.' ? DOT : DASH;
}

// Letras já decifradas aparecem em branco por cima da chuva; de vez em quando uma falha e vira letra solta.
static void showMessage(uint8_t* frame) {
  for (int r = 0; r < RAIN_ROWS; r++) {
    for (int c = 0; c < RAIN_COLS; c++) {
      if (!locked[r][c]) continue;
      // a chuva que passou por baixo da letra sai
      for (int y = 0; y < CELL_H; y++) {
        for (int x = 0; x < CELL_W; x++) put(frame, c * CELL_W + x, r * CELL_H + y, BACKGROUND);
      }
      bool glitch = phase == HOLD && next(100) == 0;
      uint8_t color = r == 0 && c >= TOP_RED_FROM ? RED : 0;
      draw(frame, c, r, glitch ? GLYPHS[next(GLYPH_COUNT)] : bitmapFor(target[r][c]), color);
    }
  }
}

static void advancePhase() {
  phaseTick++;
  if (phase == DECODE && (lockedCount >= total || phaseTick > DECODE_MAX_TICKS)) {
    // quem a chuva não alcançou a tempo aparece de uma vez
    for (int r = 0; r < RAIN_ROWS; r++) {
      for (int c = 0; c < RAIN_COLS; c++) {
        if (target[r][c] && !locked[r][c]) locked[r][c] = true;
      }
    }
    lockedCount = total;
    phase = HOLD;
    phaseTick = 0;
  } else if (phase == HOLD && phaseTick > HOLD_TICKS) {
    phase = DISSOLVE;
    phaseTick = 0;
  } else if (phase == DISSOLVE) {
    for (int r = 0; r < RAIN_ROWS; r++) {
      for (int c = 0; c < RAIN_COLS; c++) {
        if (locked[r][c] && next(100) < 9) {
          locked[r][c] = false;
          lockedCount--;
        }
      }
    }
    if (lockedCount == 0) {
      phase = DECODE;
      phaseTick = 0;
    }
  }
}

// A máscara fica na frente da chuva; o índice 15 dela é transparente.
static void showMask(uint8_t* frame) {
  for (uint32_t i = 0; i < sizeof(RAIN_MASK); i++) {
    uint8_t pair = pgm_read_byte(&RAIN_MASK[i]);
    if (pair == 0xFF) continue;
    if ((pair & 0x0F) != 15) frame[i] = (frame[i] & 0xF0) | (pair & 0x0F);
    if ((pair >> 4) != 15) frame[i] = (frame[i] & 0x0F) | (pair & 0xF0);
  }
}

void rainStep(uint8_t* frame) {
  memset(frame, (BACKGROUND << 4) | BACKGROUND, FRAME_SIZE * FRAME_SIZE / 2);
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
      draw(frame, c, r, GLYPHS[pick % GLYPH_COUNT], color);
      // a ponta passou por uma letra da mensagem: ela fica decifrada
      if (distance == 0 && phase == DECODE && target[r][c] && !locked[r][c]) {
        locked[r][c] = true;
        lockedCount++;
      }
    }
  }
  showMessage(frame);
  showMask(frame);
  advancePhase();
}
