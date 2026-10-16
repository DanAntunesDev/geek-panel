#include "parser.h"
#include "protocol.h"

MessageParser::MessageParser(const ParserEvents& events, uint8_t* frameBuffer, uint32_t framePixels)
    : events_(events), frame_(frameBuffer), framePixels_(framePixels) {
  reset();
}

void MessageParser::reset() {
  headerGot_ = 0;
  type_ = 0;
  bodyLen_ = bodyGot_ = 0;
  pixelPos_ = 0;
  havePending_ = overflow_ = false;
  pendingRun_ = 0;
  brightness_ = 0;
}

void MessageParser::putRun(uint8_t run, uint8_t index) {
  index &= 0x0F;
  if (pixelPos_ + run > framePixels_) {
    overflow_ = true;
    return;
  }
  while (run--) {
    if (pixelPos_ & 1) frame_[pixelPos_ >> 1] = (frame_[pixelPos_ >> 1] & 0x0F) | (index << 4);
    else frame_[pixelPos_ >> 1] = (frame_[pixelPos_ >> 1] & 0xF0) | index;
    pixelPos_++;
  }
}

void MessageParser::endMessage() {
  switch (type_) {
    case MSG_FRAME:
      // quadro incompleto ou grande demais é descartado: a tela fica como estava
      if (!overflow_ && pixelPos_ == framePixels_ && events_.frame) events_.frame(events_.context);
      break;
    case MSG_CONFIG:
      if (bodyLen_ >= 4 && events_.config) {
        const uint16_t needed = 4 + config_[3] * 2;
        if (needed <= sizeof(config_) && needed <= bodyLen_) events_.config(events_.context, config_ + 4, config_[3]);
      }
      break;
    case MSG_BRIGHTNESS:
      if (bodyLen_ >= 1 && events_.brightness) events_.brightness(events_.context, brightness_);
      break;
    case MSG_REJECT:
      if (events_.reject) events_.reject(events_.context);
      break;
  }
}

void MessageParser::feed(uint8_t b) {
  if (headerGot_ < 3) {
    header_[headerGot_++] = b;
    if (headerGot_ < 3) return;
    type_ = header_[0];
    bodyLen_ = (header_[1] << 8) | header_[2];
    bodyGot_ = 0;
    pixelPos_ = 0;
    overflow_ = false;
    havePending_ = false;
    if (bodyLen_ == 0) {
      endMessage();
      headerGot_ = 0;
    }
    return;
  }

  if (type_ == MSG_FRAME) {
    if (!havePending_) {
      pendingRun_ = b;
      havePending_ = true;
    } else {
      putRun(pendingRun_, b);
      havePending_ = false;
    }
  } else if (type_ == MSG_CONFIG && bodyGot_ < sizeof(config_)) {
    config_[bodyGot_] = b;
  } else if (type_ == MSG_BRIGHTNESS && bodyGot_ == 0) {
    brightness_ = b;
  }

  if (++bodyGot_ == bodyLen_) {
    endMessage();
    headerGot_ = 0;
  }
}
