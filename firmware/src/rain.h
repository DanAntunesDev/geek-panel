#pragma once
#include <stdint.h>

// Chuva de letrinhas do fundo da tela de espera. Não depende de hardware: roda no computador nos testes.
#define RAIN_COLS 20
#define RAIN_ROWS 15

// Zera as colunas e fixa a sequência aleatória.
void rainReset(uint32_t seed);

// Avança um passo e desenha no quadro (índices de 4 bits, 120x120). Usa as cores 0 a 3 da paleta de espera:
// 3 é o fundo preto, 0 a ponta branca, 1 e 2 os tons de cinza do rastro.
void rainStep(uint8_t* frame);
