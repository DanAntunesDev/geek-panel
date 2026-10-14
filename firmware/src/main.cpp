#include <Arduino.h>
#include <ESP8266WiFi.h>
#include "portal.h"
#include "settings.h"
#ifndef LOADER_ONLY
#include "display.h"
#include "stream.h"
#include "waiting_frames.h"
#endif

static uint32_t wifiStartedAt = 0;

void setup() {
  settingsLoad();
#ifndef LOADER_ONLY
  displayInit();
  displayWaiting(WAIT_WIFI, 0);
#endif
  WiFi.persistent(true);
  WiFi.mode(WIFI_STA);
  WiFi.setSleepMode(WIFI_NONE_SLEEP);
  WiFi.hostname("geekpanel");
  // sem argumentos: usa o Wi-Fi que o aparelho já tem salvo
  WiFi.begin();
  wifiStartedAt = millis();
  portalBegin();
}

void loop() {
  portalLoop();
  uint32_t now = millis();

  // sem Wi-Fi depois de um tempo: abre a página de configuração
  if (!portalSetupMode() && WiFi.status() != WL_CONNECTED && now - wifiStartedAt > 25000) portalStartSetup();

#ifndef LOADER_ONLY
  streamLoop();
  // enquanto o PC não manda quadros, mostra a tela de espera animada
  static uint32_t lastAnimation = 0;
  static uint32_t animationFrame = 0;
  if (portalTestActive() || streamHasFrame()) return;
  if (now - lastAnimation >= 125) {
    lastAnimation = now;
    uint8_t state = WAIT_PAINEL;
    if (WiFi.status() != WL_CONNECTED) state = portalSetupMode() ? WAIT_CONFIG : WAIT_WIFI;
    else if (streamRejected()) state = WAIT_CODIGO;
    displayWaiting(state, animationFrame++);
  }
#endif
}
