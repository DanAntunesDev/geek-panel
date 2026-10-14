import { SCENE_SIZE } from "../src/renderer/pixel/scale.js";
import { drawAgenda } from "../src/renderer/screens/agendaScene.js";
import { clockParts, drawClock, newFlipState } from "../src/renderer/screens/clockScene.js";
import { drawPlayer } from "../src/renderer/screens/playerScene.js";
import { drawUsage } from "../src/renderer/screens/usageScene.js";
import { ensureFont } from "../src/renderer/pixel/draw.js";

Object.assign(window, { Scenes: { SCENE_SIZE, drawAgenda, clockParts, drawClock, newFlipState, drawPlayer, drawUsage, ensureFont } });
