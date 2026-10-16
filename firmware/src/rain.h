#pragma once
#include <stdint.h>

// Chuva de letrinhas da tela de espera, com a mensagem aparecendo no meio, decifrada pelas letras que caem.
// Não depende de hardware: roda no computador nos testes.
#define RAIN_COLS 20
#define RAIN_ROWS 15

// Qual mensagem aparece; a ordem é a de WAIT_* em display.h.
#define RAIN_MESSAGES 4

// Zera as colunas e fixa a sequência aleatória.
void rainReset(uint32_t seed);

// Troca a mensagem. Se for a mesma de antes, não faz nada.
void rainMessage(uint8_t message);

// Avança um passo e desenha no quadro (índices de 4 bits, 120x120). Usa as cores 0 a 3 da paleta de espera:
// 3 é o fundo preto, 0 a ponta branca, 1 e 2 os tons de cinza do rastro.
void rainStep(uint8_t* frame);

// Para os testes: letras da mensagem já decifradas e quantas ela tem ao todo.
uint16_t rainLocked();
uint16_t rainTotal();
