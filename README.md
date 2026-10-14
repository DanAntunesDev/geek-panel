# geek-panel

Painel em pixel art para o meu GeekMagic SmallTV: um toca-discos que mostra o que está tocando, relógio, consumo de tokens e a agenda do dia.

![telas do painel](assets/preview.png)

É um app de desktop (Electron + React + TypeScript). Cada tela é desenhada em 120x120 pixels, metade dos 240x240 do display, então no aparelho cada pixel vira 2x2 sem borrar.

## Telas

- **Player**: mostra e controla o que está tocando. Lê os players abertos no Linux (MPRIS), o Spotify e links do YouTube / YouTube Music. Tem play/pause, faixa anterior e próxima, voltar e avançar 10 s, e dá para clicar no anel de progresso para pular.
- **Relógio**: digital (matriz de LED), analógico e flip.
- **Tokens**: consumo do mês da OpenAI e da Anthropic, com um limite que eu defino. As duas só entregam isso para chave de administração; a chave comum não lê consumo.
- **Agenda**: próximos eventos do Google Agenda, com aviso 10 e 5 minutos antes (dá para mudar) e na hora de começar.

## Rodando

```
yarn
yarn dev      # abre a janela
yarn build    # compila e empacota em release/
yarn test
```

## Configuração

Fica tudo na aba Config: IP do display, relógio, agenda, fontes de música e provedores. As chaves e os logins vão para o cofre do sistema (libsecret no Linux), nunca para um arquivo de texto.

Para o Spotify e o Google é preciso criar o próprio app nos painéis deles e colar o Client ID (e o segredo, no caso do Google). No Spotify, cadastre o retorno `http://127.0.0.1:4615/callback`. Para a agenda, ative a API do Google Agenda no mesmo projeto.

## Display

Testado com um SmallTV-Ultra (firmware Ultra-V9.0.51). Esse firmware só mostra imagens e GIFs, então a ideia é gerar as telas como GIF e mandar pelo Wi-Fi. O envio ainda não está pronto: por enquanto as telas só rodam na janela do app.

## Notas

- A paleta é fechada: 4 cores e 2 tons derivados.
- Feito no Linux. No Windows ainda não testei.
