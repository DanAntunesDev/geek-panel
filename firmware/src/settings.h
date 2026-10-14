#pragma once
#include <Arduino.h>

struct Settings {
  uint16_t magic;
  char serverIp[16];  // vazio = descobrir sozinho
  char code[17];      // código de pareamento
  uint8_t brightness;
  uint8_t flags;      // bit0 inverter cores, bit1 trocar bytes, bit2 luz invertida
  uint8_t rotation;
};

enum : uint8_t { FLAG_INVERT = 1, FLAG_SWAP = 2, FLAG_BACKLIGHT_LOW = 4 };

extern Settings settings;

void settingsLoad();
void settingsSave();
void settingsReset();
