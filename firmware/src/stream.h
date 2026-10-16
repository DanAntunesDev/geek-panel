#pragma once
#include <Arduino.h>

void streamLoop();
// Já chegou pelo menos um quadro do PC nesta ligação.
bool streamHasFrame();
// O PC recusou o código de pareamento há pouco.
bool streamRejected();
uint32_t streamFrames();
