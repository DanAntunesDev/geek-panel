#include "display.h"
#include <TFT_eSPI.h>
#include "protocol.h"
#include "rain.h"
#include "settings.h"

static TFT_eSPI tft;
uint8_t frameBuf[FRAME_BYTES];

// Cores de partida (bg, surface, mid, ink, accent, accentShade) em RGB565, até o app mandar as dele.
static const uint16_t DEFAULT_PALETTE[6] = {0xF7BE, 0xDEBA, 0x7BCE, 0x18E3, 0xE9B1, 0xA12D};
static uint16_t palette[16];
static uint8_t paletteCount = 6;

#define BACKLIGHT_PIN 5

void displayBrightness(uint8_t percent) {
  if (percent > 100) percent = 100;
  analogWriteRange(1023);
  uint16_t duty = (uint32_t)percent * 1023 / 100;
  if (settings.flags & FLAG_BACKLIGHT_LOW) duty = 1023 - duty;
  analogWrite(BACKLIGHT_PIN, duty);
}

void displayResetPalette() {
  for (uint8_t i = 0; i < 6; i++) palette[i] = DEFAULT_PALETTE[i];
  paletteCount = 6;
}

// O app manda cada cor em RGB565 big-endian.
void displayPalette(const uint8_t* bigEndian, uint8_t count) {
  if (count > 16) count = 16;
  for (uint8_t i = 0; i < count; i++) palette[i] = (bigEndian[i * 2] << 8) | bigEndian[i * 2 + 1];
  paletteCount = count;
}

void displayApplySettings() {
  tft.setRotation(settings.rotation & 3);
  tft.setSwapBytes(settings.flags & FLAG_SWAP);
  tft.invertDisplay(settings.flags & FLAG_INVERT);
  displayBrightness(settings.brightness);
}

void displayInit() {
  pinMode(BACKLIGHT_PIN, OUTPUT);
  tft.init();
  displayApplySettings();
  tft.fillScreen(TFT_BLACK);
  displayResetPalette();
  rainReset(micros() ^ ESP.getChipId());
}

// Desenha o quadro com a paleta dada. As telas de espera e o padrão de teste usam a de partida,
// sem mexer na que o app mandou: um quadro de espera atrasado não pode apagar as cores do painel.
static void drawFrame(const uint16_t* colors, uint8_t count) {
  static uint16_t line[SCREEN_SIZE];
  tft.startWrite();
  tft.setAddrWindow(0, 0, SCREEN_SIZE, SCREEN_SIZE);
  for (uint16_t y = 0; y < FRAME_SIZE; y++) {
    uint32_t base = (uint32_t)y * FRAME_SIZE;
    for (uint16_t x = 0; x < FRAME_SIZE; x++) {
      uint32_t at = base + x;
      uint8_t index = (at & 1) ? (frameBuf[at >> 1] >> 4) : (frameBuf[at >> 1] & 0x0F);
      uint16_t color = colors[index < count ? index : 0];
      line[x * 2] = color;
      line[x * 2 + 1] = color;
    }
    tft.pushPixels(line, SCREEN_SIZE);
    tft.pushPixels(line, SCREEN_SIZE);
  }
  tft.endWrite();
  yield();
}

void displayDraw() { drawFrame(palette, paletteCount); }

// Tela de espera: letras caindo e, no meio delas, a mensagem sendo decifrada (rain.cpp).
void displayWaiting(uint8_t state) {
  rainMessage(state);
  rainStep(frameBuf);
  drawFrame(DEFAULT_PALETTE, 6);
}

// Seis blocos, um por cor da paleta, para conferir inversão e ordem das cores.
void displayTestPattern() {
  for (uint32_t pixel = 0; pixel < FRAME_PIXELS; pixel++) {
    uint16_t x = pixel % FRAME_SIZE;
    uint16_t y = pixel / FRAME_SIZE;
    uint8_t index = (y / 60) * 3 + (x / 40);
    if (index > 5) index = 5;
    if (pixel & 1) frameBuf[pixel >> 1] = (frameBuf[pixel >> 1] & 0x0F) | (index << 4);
    else frameBuf[pixel >> 1] = (frameBuf[pixel >> 1] & 0xF0) | index;
  }
  drawFrame(DEFAULT_PALETTE, 6);
}
