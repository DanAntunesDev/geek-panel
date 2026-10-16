#pragma once
#include <Arduino.h>

void displayInit();
void displayApplySettings();
void displayBrightness(uint8_t percent);
void displayPalette(const uint8_t* bigEndian, uint8_t count);
void displayResetPalette();
// Desenha o quadro guardado em frameBuf (120x120, 4 bits por pixel) ampliado 2x.
void displayDraw();
void displayWaiting(uint8_t state);
void displayTestPattern();

extern uint8_t frameBuf[];

// Telas de espera; a ordem é a das mensagens em rain.cpp.
enum : uint8_t { WAIT_WIFI, WAIT_PAINEL, WAIT_CONFIG, WAIT_CODIGO };
