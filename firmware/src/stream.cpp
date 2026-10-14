#include "stream.h"
#include <ESP8266WiFi.h>
#include <WiFiUdp.h>
#include "display.h"
#include "parser.h"
#include "protocol.h"
#include "settings.h"

static WiFiClient client;
static WiFiUDP udp;
static bool udpOpen = false;
static bool connected = false;
static bool rejected = false;
static uint32_t rejectedAt = 0, lastTry = 0, lastSearch = 0, lastPing = 0, lastData = 0, frames = 0;

static void onFrame(void*) {
  displayDraw();
  frames++;
}

static void onConfig(void*, const uint8_t* palette, uint8_t count) { displayPalette(palette, count); }

static void onBrightness(void*, uint8_t percent) { displayBrightness(percent); }

static void onReject(void*) {
  rejected = true;
  rejectedAt = millis();
  client.stop();
}

static const ParserEvents EVENTS = {onFrame, onConfig, onBrightness, onReject, nullptr};
static MessageParser parser(EVENTS, frameBuf, FRAME_PIXELS);

static void sendHello() {
  uint8_t out[3 + 2 + 16];
  uint8_t length = strlen(settings.code);
  if (length > 16) length = 16;
  uint16_t body = 2 + length;
  out[0] = MSG_HELLO;
  out[1] = body >> 8;
  out[2] = body & 0xFF;
  out[3] = PROTOCOL_VERSION;
  out[4] = length;
  memcpy(out + 5, settings.code, length);
  client.write(out, 5 + length);
}

static void sendPing() {
  const uint8_t ping[3] = {MSG_PING, 0, 0};
  client.write(ping, 3);
}

// Procura o app na rede: pergunta em broadcast e espera a resposta com a porta.
static bool findServer(IPAddress& address, uint16_t& port) {
  if (!udpOpen) {
    udp.begin(DISCOVERY_PORT + 1);
    udpOpen = true;
  }
  uint32_t now = millis();
  if (now - lastSearch >= 1500) {
    lastSearch = now;
    const uint8_t request[6] = {'G', 'P', 'N', 'L', '?', PROTOCOL_VERSION};
    // endereço de broadcast da sub-rede (IP com os bits da máscara invertidos)
    IPAddress subnet((uint32_t)WiFi.localIP() | ~(uint32_t)WiFi.subnetMask());
    for (IPAddress target : {subnet, IPAddress(255, 255, 255, 255)}) {
      udp.beginPacket(target, DISCOVERY_PORT);
      udp.write(request, sizeof(request));
      udp.endPacket();
    }
  }
  if (udp.parsePacket() >= 8) {
    uint8_t reply[8];
    udp.read(reply, sizeof(reply));
    if (memcmp(reply, "GPNL!", 5) == 0) {
      address = udp.remoteIP();
      port = (reply[6] << 8) | reply[7];
      return true;
    }
  }
  return false;
}

void streamLoop() {
  if (WiFi.status() != WL_CONNECTED) {
    if (client.connected()) client.stop();
    connected = false;
    return;
  }
  uint32_t now = millis();

  // fica na tela de código errado por um tempo antes de tentar de novo
  if (rejected) {
    if (now - rejectedAt < 15000) return;
    rejected = false;
  }

  if (!client.connected()) {
    if (connected) {
      connected = false;
      frames = 0;
      parser.reset();
    }
    IPAddress target;
    uint16_t port = DEFAULT_TCP_PORT;
    if (settings.serverIp[0]) {
      if (now - lastTry < 2000) return;
      lastTry = now;
      if (!target.fromString(settings.serverIp)) return;
    } else if (!findServer(target, port)) {
      return;
    }
    client.setTimeout(2000);
    if (client.connect(target, port)) {
      client.setNoDelay(true);
      parser.reset();
      sendHello();
      connected = true;
      frames = 0;
      lastData = lastPing = now;
    }
    return;
  }

  uint8_t chunk[256];
  while (client.available() > 0) {
    int count = client.read(chunk, sizeof(chunk));
    if (count <= 0) break;
    for (int i = 0; i < count; i++) parser.feed(chunk[i]);
    lastData = now;
  }
  if (now - lastPing >= 2000) {
    sendPing();
    lastPing = now;
  }
  // PC calado por muito tempo: derruba e volta a procurar
  if (now - lastData > 6000) client.stop();
}

bool streamHasFrame() { return connected && frames > 0; }
bool streamRejected() { return rejected; }
uint32_t streamFrames() { return frames; }
