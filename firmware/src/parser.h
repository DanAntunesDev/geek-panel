#pragma once
#include <stddef.h>
#include <stdint.h>

// Leitor das mensagens do app: [tipo u8][tamanho u16 BE][corpo]. Não depende de hardware,
// então roda no computador nos testes.
struct ParserEvents {
  // Quadro completo, 4 bits por pixel (2 pixels por byte).
  void (*frame)(void* context);
  void (*config)(void* context, const uint8_t* paletteBigEndian, uint8_t count);
  void (*brightness)(void* context, uint8_t percent);
  void (*reject)(void* context);
  void* context;
};

class MessageParser {
 public:
  MessageParser(const ParserEvents& events, uint8_t* frameBuffer, uint32_t framePixels);
  void reset();
  void feed(uint8_t byte);

 private:
  void endMessage();
  void putRun(uint8_t run, uint8_t index);

  ParserEvents events_;
  uint8_t* frame_;
  uint32_t framePixels_;
  uint8_t header_[3];
  uint8_t headerGot_;
  uint8_t type_;
  uint16_t bodyLen_, bodyGot_;
  uint32_t pixelPos_;
  bool havePending_, overflow_;
  uint8_t pendingRun_;
  uint8_t config_[24];
  uint8_t brightness_;
};
