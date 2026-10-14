// Teste do leitor de mensagens no computador.
// Uso: parser_test <entrada.bin> <esperado.json-simples>
//  entrada.bin: bytes que o app mandaria (gerados pelo TypeScript)
//  esperado:    [quadros][brilho][recusas][cores da paleta][12 bytes da paleta][pixels do último quadro]
//               brilho ou cores = 255 significa "não conferir"
#include <cstdio>
#include <cstdlib>
#include <vector>
#include "../src/parser.h"
#include "../src/protocol.h"

static uint8_t frameBuf[FRAME_BYTES];
static int frames = 0, rejects = 0, brightness = -1, paletteCount = -1;
static uint8_t lastPalette[16];
static std::vector<uint8_t> lastFrame;

static void onFrame(void*) {
  frames++;
  lastFrame.assign(FRAME_PIXELS, 0);
  for (uint32_t i = 0; i < FRAME_PIXELS; i++) lastFrame[i] = (i & 1) ? (frameBuf[i >> 1] >> 4) : (frameBuf[i >> 1] & 0x0F);
}
static void onConfig(void*, const uint8_t* palette, uint8_t count) {
  paletteCount = count;
  for (int i = 0; i < count * 2 && i < 16; i++) lastPalette[i] = palette[i];
}
static void onBrightness(void*, uint8_t value) { brightness = value; }
static void onReject(void*) { rejects++; }

static std::vector<uint8_t> readAll(const char* path) {
  std::vector<uint8_t> out;
  FILE* file = fopen(path, "rb");
  if (!file) return out;
  int c;
  while ((c = fgetc(file)) != EOF) out.push_back((uint8_t)c);
  fclose(file);
  return out;
}

int main(int argc, char** argv) {
  if (argc < 3) return 2;
  std::vector<uint8_t> input = readAll(argv[1]);
  std::vector<uint8_t> expected = readAll(argv[2]);
  // esperado: [frames][brilho][rejeicoes][paleta_n][paleta bytes 12][pixels 14400]
  if (input.empty() || expected.size() < 4 + 12 + FRAME_PIXELS) return 3;

  ParserEvents events = {onFrame, onConfig, onBrightness, onReject, nullptr};
  MessageParser parser(events, frameBuf, FRAME_PIXELS);

  // a rede entrega em pedaços de tamanhos irregulares
  size_t at = 0;
  unsigned seed = 12345;
  while (at < input.size()) {
    seed = seed * 1103515245 + 12345;
    size_t chunk = 1 + (seed >> 16) % 37;
    for (size_t i = 0; i < chunk && at < input.size(); i++) parser.feed(input[at++]);
  }

  int failures = 0;
  auto check = [&](bool ok, const char* what) {
    if (!ok) {
      printf("FALHOU: %s\n", what);
      failures++;
    }
  };
  check(frames == expected[0], "quantidade de quadros");
  if (expected[1] != 255) check(brightness == expected[1], "brilho");
  check(rejects == expected[2], "recusas");
  if (expected[3] != 255) {
    check(paletteCount == expected[3], "tamanho da paleta");
    for (int i = 0; i < 12; i++)
      if (lastPalette[i] != expected[4 + i]) {
        check(false, "bytes da paleta");
        break;
      }
  }
  check(lastFrame.size() == FRAME_PIXELS, "último quadro existe");
  if (lastFrame.size() == FRAME_PIXELS)
    for (uint32_t i = 0; i < FRAME_PIXELS; i++)
      if (lastFrame[i] != expected[16 + i]) {
        printf("pixel %u: veio %d, esperado %d\n", i, lastFrame[i], expected[16 + i]);
        check(false, "pixels do último quadro");
        break;
      }
  if (failures == 0) printf("ok: %d quadros, brilho %d, %d recusa(s), paleta de %d cores\n", frames, brightness, rejects, paletteCount);
  return failures == 0 ? 0 : 1;
}
