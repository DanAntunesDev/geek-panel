#pragma once
// Espelha src/shared/deviceConstants.ts e deviceProtocol.ts do app.

#define PROTOCOL_VERSION 1
#define DISCOVERY_PORT 4602
#define DEFAULT_TCP_PORT 4601

#define FRAME_SIZE 120
#define FRAME_PIXELS (FRAME_SIZE * FRAME_SIZE)
#define FRAME_BYTES (FRAME_PIXELS / 2)  // 2 pixels por byte (índice de 4 bits)
#define SCREEN_SIZE 240

// aparelho -> PC
#define MSG_HELLO 0x10
// PC -> aparelho
#define MSG_CONFIG 0x01
#define MSG_FRAME 0x02
#define MSG_BRIGHTNESS 0x04
#define MSG_REJECT 0x05
// nos dois sentidos
#define MSG_PING 0x03
