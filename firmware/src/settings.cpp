#include "settings.h"
#include <EEPROM.h>

#define SETTINGS_MAGIC 0x4750

Settings settings;

void settingsReset() {
  memset(&settings, 0, sizeof(settings));
  settings.magic = SETTINGS_MAGIC;
  settings.brightness = 60;
  // palpite comum para esta placa; dá para ajustar na página do aparelho
  settings.flags = FLAG_INVERT | FLAG_SWAP | FLAG_BACKLIGHT_LOW;
}

void settingsLoad() {
  EEPROM.begin(sizeof(Settings));
  EEPROM.get(0, settings);
  if (settings.magic != SETTINGS_MAGIC) settingsReset();
  settings.serverIp[sizeof(settings.serverIp) - 1] = 0;
  settings.code[sizeof(settings.code) - 1] = 0;
}

void settingsSave() {
  settings.magic = SETTINGS_MAGIC;
  EEPROM.put(0, settings);
  EEPROM.commit();
}
