#pragma once
#include <Arduino.h>

void portalBegin();
void portalLoop();
// Abre a rede "GeekPanel" para configurar o Wi-Fi.
void portalStartSetup();
bool portalSetupMode();
// O padrão de teste está na tela; o resto não deve desenhar por cima.
bool portalTestActive();
