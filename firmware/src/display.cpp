#include "display.h"
#include <TFT_eSPI.h>
#include "protocol.h"
#include "settings.h"
#include "waiting_frames.h"

static TFT_eSPI tft;
uint8_t frameBuf[FRAME_BYTES];

// Mesmas cores do app (bg, surface, mid, ink, accent, accentShade) em RGB565.
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
}

void displayDraw() {
  static uint16_t line[SCREEN_SIZE];
  tft.startWrite();
  tft.setAddrWindow(0, 0, SCREEN_SIZE, SCREEN_SIZE);
  for (uint16_t y = 0; y < FRAME_SIZE; y++) {
    uint32_t base = (uint32_t)y * FRAME_SIZE;
    for (uint16_t x = 0; x < FRAME_SIZE; x++) {
      uint32_t at = base + x;
      uint8_t index = (at & 1) ? (frameBuf[at >> 1] >> 4) : (frameBuf[at >> 1] & 0x0F);
      uint16_t color = palette[index < paletteCount ? index : 0];
      line[x * 2] = color;
      line[x * 2 + 1] = color;
    }
    tft.pushPixels(line, SCREEN_SIZE);
    tft.pushPixels(line, SCREEN_SIZE);
  }
  tft.endWrite();
  yield();
}

// Descomprime um quadro de espera (RLE em PROGMEM) para frameBuf.
void displayWaiting(uint8_t state, uint32_t frame) {
  if (state >= WAIT_STATES) return;
  displayResetPalette();
  uint8_t which = WAIT_FIRST_FRAME[state] + (frame % WAIT_FRAME_COUNT[state]);
  uint32_t at = pgm_read_dword(&WAIT_OFFSET[which]);
  uint32_t end = pgm_read_dword(&WAIT_OFFSET[which + 1]);
  uint32_t pixel = 0;
  while (at + 1 < end && pixel < FRAME_PIXELS) {
    uint8_t run = pgm_read_byte(&WAIT_DATA[at++]);
    uint8_t index = pgm_read_byte(&WAIT_DATA[at++]) & 0x0F;
    while (run-- && pixel < FRAME_PIXELS) {
      if (pixel & 1) frameBuf[pixel >> 1] = (frameBuf[pixel >> 1] & 0x0F) | (index << 4);
      else frameBuf[pixel >> 1] = (frameBuf[pixel >> 1] & 0xF0) | index;
      pixel++;
    }
  }
  displayDraw();
}

// Seis blocos, um por cor da paleta, para conferir inversão e ordem das cores.
void displayTestPattern() {
  displayResetPalette();
  for (uint32_t pixel = 0; pixel < FRAME_PIXELS; pixel++) {
    uint16_t x = pixel % FRAME_SIZE;
    uint16_t y = pixel / FRAME_SIZE;
    uint8_t index = (y / 60) * 3 + (x / 40);
    if (index > 5) index = 5;
    if (pixel & 1) frameBuf[pixel >> 1] = (frameBuf[pixel >> 1] & 0x0F) | (index << 4);
    else frameBuf[pixel >> 1] = (frameBuf[pixel >> 1] & 0xF0) | index;
  }
  displayDraw();
}
