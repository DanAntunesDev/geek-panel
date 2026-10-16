import { toIndexed } from "../../src/renderer/device/indexed.js";
import { ensureFont } from "../../src/renderer/pixel/draw.js";
import { drawWaiting, TRANSPARENT, WAITING } from "../art/waitingScene.js";

Object.assign(window, { Waiting: { WAITING, TRANSPARENT, drawWaiting, toIndexed, ensureFont } });
