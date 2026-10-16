# Firmware do aparelho

Firmware para o GeekMagic SmallTV-Ultra (ESP8266, 4 MB, display ST7789 240x240). O aparelho não desenha nada sozinho: o app no PC desenha as telas e manda os quadros pelo Wi-Fi, e ele só exibe, em 2x (cada pixel de 120x120 vira 2x2).

Testado em um aparelho só. Os pinos e as opções do display (inverter cores, luz) vêm de projetos da comunidade para a mesma placa, por isso dá para ajustar tudo pela página do aparelho.

## Como ele acha o PC

1. Liga, entra no Wi-Fi que já estava salvo nele. Se não conseguir em 25 s, abre a rede `GeekPanel` com uma página de configuração (`192.168.4.1`).
2. Manda um UDP em broadcast (porta 4602). O app responde com a porta TCP.
3. Conecta, manda o código de pareamento e passa a receber os quadros.

Enquanto não acha o app, mostra uma chuva de letrinhas em preto, branco e cinza (`src/rain.cpp`) sobre uma máscara de V de Vingança ao fundo (`src/rain_mask.h`). As letras têm um relevo cinza e, embaixo, no rodapé, a frase do momento vai sendo decifrada, uma palavra por linha: conectando ao Wi-Fi, procurando o Geek Panel, configurar o Wi-Fi ou código errado. A chuva é calculada no próprio aparelho; a máscara é um desenho de 120x120 gerado por `node firmware/tools/gen-mask.mjs`.

A página do aparelho (`http://IP-DELE/`) tem Wi-Fi, IP do PC (opcional), código de pareamento, brilho, rotação e um padrão de teste. Com o código definido, as ações e o `/update` pedem usuário `admin` e esse código. O app também usa `/pair` para mandar o código sozinho e `/reset` para apagar o Wi-Fi e os ajustes (o botão "Apagar tudo e recomeçar" faz o mesmo).

## Compilar

```
pip install platformio
cd firmware
pio run -e firmware    # painel completo
pio run -e loader      # carregador mínimo (só Wi-Fi, página e atualização)
```

O binário sai em `.pio/build/<env>/firmware.bin`.

O leitor de mensagens (`src/parser.cpp`) e a chuva (`src/rain.cpp`) são testados no computador: `yarn test` (precisa de `g++`). O teste da chuva confere que ela só usa as quatro cores e que a mensagem é decifrada inteira.

## Gravar

O firmware de fábrica aceita atualização pela página `/update` do aparelho. Antes de gravar, guarde o firmware oficial para poder voltar (a pasta `recovery/` não vai para o git):

1. Baixe `FW-Smalltv-Ultra-V9.0.50.zip` de [GeekMagicClock/smalltv-ultra](https://github.com/GeekMagicClock/smalltv-ultra) e confira o MD5 do `.bin` com o `md5sum.txt`.
2. Abra `http://IP-DO-APARELHO/update`, escolha o `firmware.bin` e envie. Não desligue até reiniciar.
3. Se o aparelho recusar com "Not Enough Space", nada foi gravado: envie antes o `loader`, depois o `firmware`.
4. Se o Wi-Fi salvo não funcionar, entre na rede `GeekPanel` e configure.

Para voltar ao original: envie o `.bin` oficial em `/update` (ou `http://192.168.4.1/update` na rede `GeekPanel`).

## Protocolo

Está descrito em `src/shared/deviceProtocol.ts` (app) e `src/protocol.h` (aqui). Mensagens `[tipo u8][tamanho u16][corpo]`; quadro em RLE, pares `[repetições][índice da paleta]`.
