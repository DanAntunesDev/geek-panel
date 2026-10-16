#include "portal.h"
#include <DNSServer.h>
#include <ESP8266HTTPUpdateServer.h>
#include <ESP8266WebServer.h>
#include <ESP8266WiFi.h>
#include "settings.h"
#ifndef LOADER_ONLY
#include "display.h"
#include "stream.h"
#endif

static ESP8266WebServer server(80);
static ESP8266HTTPUpdateServer updater;
static DNSServer dns;
static bool setupMode = false;
static uint32_t testUntil = 0, connectedSince = 0;

static bool authorized() {
  if (settings.code[0] == 0) return true;
  if (server.authenticate("admin", settings.code)) return true;
  server.requestAuthentication();
  return false;
}

static String esc(const String& value) {
  String out;
  for (size_t i = 0; i < value.length(); i++) {
    char c = value[i];
    if (c == '&') out += F("&amp;");
    else if (c == '<') out += F("&lt;");
    else if (c == '>') out += F("&gt;");
    else if (c == '"') out += F("&quot;");
    else out += c;
  }
  return out;
}

static String page(const String& body) {
  String html;
  html.reserve(3200);
  html += F("<!doctype html><html lang='pt-BR'><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'><title>Geek Panel</title><style>"
            "body{font-family:monospace;background:#f7f6f3;color:#1c1c1c;max-width:420px;margin:16px auto;padding:0 12px}"
            "h1{font-size:18px;border-bottom:3px solid #e8368f;display:inline-block}h2{font-size:14px;margin:20px 0 6px}"
            "label{display:block;margin:8px 0 2px}input,select{width:100%;box-sizing:border-box;padding:8px;border:2px solid #1c1c1c;background:#fff;font:inherit}"
            "input[type=checkbox]{width:auto;margin-right:8px}button{margin-top:10px;padding:8px 12px;border:2px solid #1c1c1c;background:#d9d7d2;font:inherit}"
            ".s{color:#787877}</style></head><body><h1>GEEK PAINEL</h1>");
  html += body;
  html += F("</body></html>");
  return html;
}

#ifndef LOADER_ONLY
static String checkbox(const char* name, bool on, const char* text) {
  return String(F("<label><input type='checkbox' name='")) + name + "'" + (on ? " checked" : "") + ">" + text + "</label>";
}
#endif

static void handleRoot() {
  if (!authorized()) return;
  String body;
  body.reserve(2800);
#ifdef LOADER_ONLY
  body += F("<p class='s'>Carregador (v" FW_VERSION "). Envie o firmware completo em <a href='/update'>/update</a>.</p>");
#else
  body += F("<p class='s'>Firmware v" FW_VERSION "</p>");
#endif
  body += "<p>IP: " + WiFi.localIP().toString() + "<br>Wi-Fi: " + esc(WiFi.SSID()) + " (" + String(WiFi.RSSI()) + " dBm)</p>";
#ifndef LOADER_ONLY
  body += String(F("<p>Painel: ")) + (streamHasFrame() ? "recebendo telas" : "procurando o Geek Painel no PC") + "</p>";
#endif

  body += F("<h2>Wi-Fi</h2><form method='post' action='/wifi'><label>Rede</label><input name='ssid' list='nets' autocomplete='off'><datalist id='nets'>");
  if (setupMode || server.hasArg("scan")) {
    int found = WiFi.scanNetworks();
    for (int i = 0; i < found && i < 12; i++) body += "<option value=\"" + esc(WiFi.SSID(i)) + "\">";
  }
  body += F("</datalist><label>Senha</label><input name='pass' type='password' autocomplete='off'><button>Conectar</button> <a href='/?scan=1'>buscar redes</a></form>");

#ifndef LOADER_ONLY
  body += "<h2>Painel</h2><form method='post' action='/settings'><label>IP do PC (vazio = achar sozinho)</label><input name='server' value=\"" + esc(settings.serverIp) + "\">";
  body += "<label>Código de pareamento (o mesmo da Config do app)</label><input name='code' value=\"" + esc(settings.code) + "\" maxlength='16'>";
  body += "<label>Brilho</label><input name='brightness' type='range' min='0' max='100' value='" + String(settings.brightness) + "'>";
  body += "<label>Contraste</label><input name='contrast' type='range' min='0' max='100' value='" + String(settings.contrast) + "'>";
  body += "<label>Rotação da tela</label><select name='rotation'>";
  for (int r = 0; r < 4; r++) body += String("<option value='") + r + "'" + (settings.rotation == r ? " selected" : "") + ">" + (r * 90) + "°</option>";
  body += "</select><h2>Se as cores ou a luz estiverem estranhas</h2>";
  body += checkbox("invert", settings.flags & FLAG_INVERT, "inverter cores");
  body += checkbox("swap", settings.flags & FLAG_SWAP, "trocar bytes das cores");
  body += checkbox("bl", settings.flags & FLAG_BACKLIGHT_LOW, "luz acende com sinal baixo");
  body += F("<button>Salvar</button></form><form method='post' action='/test'><button>Mostrar padrão de teste</button></form>");
#endif
  body += F("<h2>Aparelho</h2><form method='post' action='/reboot'><button>Reiniciar</button></form><form method='post' action='/reset' onsubmit=\"return confirm('Apagar o Wi-Fi e o código deste aparelho?')\"><button>Apagar tudo e recomeçar</button></form><p><a href='/update'>Atualizar firmware</a></p>");
  server.send(200, "text/html; charset=utf-8", page(body));
}

static void handleWifi() {
  if (!authorized()) return;
  String ssid = server.arg("ssid");
  if (ssid.length() == 0) {
    server.send(400, "text/html; charset=utf-8", page(F("<p>Informe o nome da rede.</p><a href='/'>voltar</a>")));
    return;
  }
  WiFi.begin(ssid.c_str(), server.arg("pass").c_str());
  uint32_t started = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - started < 15000) {
    delay(250);
    yield();
  }
  if (WiFi.status() == WL_CONNECTED) {
    server.send(200, "text/html; charset=utf-8", page("<p>Conectado! IP: " + WiFi.localIP().toString() + "</p><p class='s'>Reiniciando…</p>"));
    delay(1500);
    ESP.restart();
  } else {
    server.send(200, "text/html; charset=utf-8", page(F("<p>Não consegui conectar. Confira o nome e a senha (só rede de 2,4 GHz).</p><a href='/'>voltar</a>")));
  }
}

#ifndef LOADER_ONLY
static void handleSettings() {
  if (!authorized()) return;
  strlcpy(settings.serverIp, server.arg("server").c_str(), sizeof(settings.serverIp));
  strlcpy(settings.code, server.arg("code").c_str(), sizeof(settings.code));
  settings.brightness = constrain(server.arg("brightness").toInt(), 0, 100);
  settings.rotation = constrain(server.arg("rotation").toInt(), 0, 3);
  settings.contrast = constrain(server.arg("contrast").toInt(), 0, 100);
  settings.flags = (server.hasArg("invert") ? FLAG_INVERT : 0) | (server.hasArg("swap") ? FLAG_SWAP : 0) | (server.hasArg("bl") ? FLAG_BACKLIGHT_LOW : 0);
  settingsSave();
  displayApplySettings();
  server.sendHeader("Location", "/", true);
  server.send(303);
}

// O app manda o código sozinho, sem ninguém digitar na página.
static void handlePair() {
  if (!authorized()) return;
  if (!server.hasArg("code")) {
    server.send(400, "text/plain", "faltou o codigo");
    return;
  }
  strlcpy(settings.code, server.arg("code").c_str(), sizeof(settings.code));
  if (server.hasArg("server")) strlcpy(settings.serverIp, server.arg("server").c_str(), sizeof(settings.serverIp));
  settingsSave();
  server.send(200, "text/plain", "ok");
}

// Brilho e contraste, guardados no aparelho: valem também na tela de espera.
static void handleDisplay() {
  if (!authorized()) return;
  if (server.hasArg("brightness")) settings.brightness = constrain(server.arg("brightness").toInt(), 0, 100);
  if (server.hasArg("contrast")) settings.contrast = constrain(server.arg("contrast").toInt(), 0, 100);
  settingsSave();
  displayBrightness(settings.brightness);
  if (streamHasFrame()) displayDraw();
  server.send(200, "text/plain", "ok");
}

static void handleTest() {
  if (!authorized()) return;
  displayTestPattern();
  testUntil = millis() + 6000;
  server.sendHeader("Location", "/", true);
  server.send(303);
}
#endif

// Volta ao começo: esquece o Wi-Fi, o código e os ajustes, e abre a rede GeekPanel.
static void handleReset() {
  if (!authorized()) return;
  server.send(200, "text/html; charset=utf-8", page(F("<p>Tudo apagado. Reiniciando; em instantes aparece a rede GeekPanel.</p>")));
  delay(500);
  settingsReset();
  settingsSave();
  WiFi.disconnect(true);
  ESP.eraseConfig();
  ESP.restart();
}

static void handleReboot() {
  if (!authorized()) return;
  server.send(200, "text/html; charset=utf-8", page(F("<p>Reiniciando…</p>")));
  delay(500);
  ESP.restart();
}

static void handleStatus() {
  String json = String("{\"fw\":\"" FW_VERSION "\",\"ip\":\"") + WiFi.localIP().toString() + "\",\"rssi\":" + WiFi.RSSI() + ",\"heap\":" + ESP.getFreeHeap() +
                ",\"uptime\":" + (millis() / 1000)
#ifndef LOADER_ONLY
                + ",\"frames\":" + streamFrames()
#endif
                + "}";
  server.send(200, "application/json", json);
}

// Em modo de configuração toda página desconhecida cai aqui (portal cativo).
static void handleNotFound() {
  if (setupMode) {
    server.sendHeader("Location", "http://192.168.4.1/", true);
    server.send(302, "text/plain", "");
    return;
  }
  server.send(404, "text/plain", "nao encontrado");
}

void portalBegin() {
  server.on("/", HTTP_GET, handleRoot);
  server.on("/wifi", HTTP_POST, handleWifi);
#ifndef LOADER_ONLY
  server.on("/settings", HTTP_POST, handleSettings);
  server.on("/test", HTTP_POST, handleTest);
  server.on("/pair", HTTP_POST, handlePair);
  server.on("/display", HTTP_POST, handleDisplay);
#endif
  server.on("/reset", HTTP_POST, handleReset);
  server.on("/reboot", HTTP_POST, handleReboot);
  server.on("/status", HTTP_GET, handleStatus);
  server.onNotFound(handleNotFound);
  // com código definido, atualizar o firmware exige usuário "admin" e esse código
  updater.setup(&server, "/update", settings.code[0] ? "admin" : "", settings.code);
  server.begin();
}

void portalStartSetup() {
  WiFi.mode(WIFI_AP_STA);
  WiFi.softAP("GeekPanel");
  dns.start(53, "*", WiFi.softAPIP());
  setupMode = true;
  connectedSince = 0;
}

bool portalSetupMode() { return setupMode; }

bool portalTestActive() { return testUntil != 0 && (int32_t)(millis() - testUntil) < 0; }

void portalLoop() {
  if (setupMode) {
    dns.processNextRequest();
    // conectou: fecha a rede de configuração depois de um tempo
    if (WiFi.status() == WL_CONNECTED) {
      if (connectedSince == 0) connectedSince = millis();
      if (millis() - connectedSince > 10000) {
        WiFi.softAPdisconnect(true);
        WiFi.mode(WIFI_STA);
        setupMode = false;
      }
    } else {
      connectedSince = 0;
    }
  }
  server.handleClient();
}
