"""Converte uma imagem do rosto da máscara na máscara da tela de espera.

Uso: python3 firmware/tools/mask-from-image.py imagem.png [prévia.png]

O rosto é recortado por um contorno fixo (as letras do fundo ficam de fora) e cada pixel vira uma das
cores da tela de espera. Grava firmware/src/rain_mask.h e src/shared/waitingMask.ts.
"""
import base64
import sys

from PIL import Image, ImageDraw

SIZE = 120
WHITE, LIGHT, GRAY, BLACK, RED, CLEAR = 0, 1, 2, 3, 4, 15

# Rosto da imagem de referência (1000x1000): x de 355 a 645, y de 285 a 715.
SRC_LEFT, SRC_TOP, SRC_W, SRC_H = 355, 285, 290, 430
# Onde ele fica na grade de 120x120: 60 de largura por 90 de altura.
GRID_LEFT, GRID_TOP, GRID_W, GRID_H = 30, 11, 60, 90

HALF = [(500, 285), (455, 291), (412, 308), (380, 338), (362, 380), (357, 430), (358, 490), (364, 535), (376, 575), (392, 620), (414, 658), (445, 690), (478, 708), (500, 715)]
OUTLINE = HALF + [(1000 - x, y) for x, y in reversed(HALF)]

path = sys.argv[1]
source = Image.open(path).convert("RGB")

to_grid = lambda x, y: (GRID_LEFT + (x - SRC_LEFT) * GRID_W / SRC_W, GRID_TOP + (y - SRC_TOP) * GRID_H / SRC_H)
inside = Image.new("L", (SIZE, SIZE), 0)
ImageDraw.Draw(inside).polygon([to_grid(x, y) for x, y in OUTLINE], fill=255)

cell_w, cell_h = SRC_W / GRID_W, SRC_H / GRID_H


def classify(gx, gy):
    left = SRC_LEFT + (gx - GRID_LEFT) * cell_w
    top = SRC_TOP + (gy - GRID_TOP) * cell_h
    dark = red = total = 0
    for y in range(int(top), int(top + cell_h) + 1):
        for x in range(int(left), int(left + cell_w) + 1):
            r, g, b = source.getpixel((min(x, 999), min(y, 999)))
            total += 1
            if r > 140 and r - g > 55 and r - b > 55:
                red += 1
            elif 0.299 * r + 0.587 * g + 0.114 * b < 100:
                dark += 1
    if red / total > 0.35:
        return RED
    if dark / total > 0.22:
        return BLACK
    if dark / total > 0.12:
        return GRAY
    return WHITE


grid = [[CLEAR] * SIZE for _ in range(SIZE)]
for gy in range(SIZE):
    for gx in range(SIZE):
        if inside.getpixel((gx, gy)) >= 128:
            grid[gy][gx] = classify(gx, gy)

# traços finos demais para sobreviver à redução (a linha da boca e as narinas) são refeitos por cima
def line(points, thick, color):
    pts = [to_grid(x, y) for x, y in points]
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        steps = int(max(abs(x1 - x0), abs(y1 - y0), 1)) * 2
        for i in range(steps + 1):
            cx = round(x0 + (x1 - x0) * i / steps)
            cy = round(y0 + (y1 - y0) * i / steps)
            for dy in range(thick):
                for dx in range(thick):
                    x, y = cx - thick // 2 + dx, cy - thick // 2 + dy
                    if 0 <= x < SIZE and 0 <= y < SIZE and grid[y][x] != CLEAR:
                        grid[y][x] = color


line([(402, 590), (430, 615), (470, 632), (500, 636), (530, 632), (570, 615), (598, 590)], 2, BLACK)
line([(440, 640), (470, 646), (500, 648), (530, 646), (560, 640)], 1, BLACK)
line([(462, 578), (480, 590), (500, 594), (520, 590), (538, 578)], 2, BLACK)
for side in (False, True):
    flip = (lambda x: 1000 - x) if side else (lambda x: x)
    line([(flip(484), 520), (flip(474), 556), (flip(470), 578)], 1, GRAY)

# perto da borda só sobra cinza: lá a imagem tem o contorno e as dobras pontilhadas, que virariam sujeira preta
from PIL import ImageFilter

core = inside.filter(ImageFilter.MinFilter(7))
for y in range(SIZE):
    for x in range(SIZE):
        if grid[y][x] == BLACK and core.getpixel((x, y)) < 128:
            grid[y][x] = GRAY

# contorno cinza em volta do rosto, para ele aparecer sobre o fundo preto
face = [[grid[y][x] != CLEAR for x in range(SIZE)] for y in range(SIZE)]
for y in range(SIZE):
    for x in range(SIZE):
        if face[y][x] and not all(0 <= nx < SIZE and 0 <= ny < SIZE and face[ny][nx] for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1))):
            grid[y][x] = GRAY

data = bytes(grid[at // SIZE][at % SIZE] | (grid[(at + 1) // SIZE][(at + 1) % SIZE] << 4) for at in range(0, SIZE * SIZE, 2))
rows = "".join(("\n  " if i % 24 == 0 else " ") + f"{value}," for i, value in enumerate(data))
open("firmware/src/rain_mask.h", "w").write(
    "// Gerado por firmware/tools/mask-from-image.py. Não edite à mão.\n"
    "// Máscara da tela de espera: 120x120, 4 bits por pixel (paleta de espera); o índice 15 é transparente.\n"
    "#pragma once\n#include <stdint.h>\n\n"
    f"static const uint8_t RAIN_MASK[{len(data)}] PROGMEM = {{{rows}\n}};\n"
)
open("src/shared/waitingMask.ts", "w").write(
    "// Gerado por firmware/tools/mask-from-image.py. Não edite à mão.\n"
    "// Máscara da tela de espera (a mesma do firmware): 120x120, 4 bits por pixel, em base64.\n"
    f'export const WAITING_MASK_BASE64 = "{base64.b64encode(data).decode()}";\n'
)

if len(sys.argv) > 2:
    tones = [(247, 246, 243), (217, 215, 210), (120, 120, 119), (28, 28, 28), (217, 66, 31), (140, 40, 20)]
    scale = 4
    preview = Image.new("RGB", (SIZE * scale, SIZE * scale), (40, 60, 90))
    for y in range(SIZE):
        for x in range(SIZE):
            if grid[y][x] < 6:
                ImageDraw.Draw(preview).rectangle([x * scale, y * scale, x * scale + scale - 1, y * scale + scale - 1], fill=tones[grid[y][x]])
    preview.save(sys.argv[2])
print(f"máscara gerada a partir de {path}")
