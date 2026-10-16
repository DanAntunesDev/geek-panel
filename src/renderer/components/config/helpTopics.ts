// Passo a passo de cada ajuste da Config, aberto pelo "i" ao lado do título.

export interface HelpTopic {
  title: string;
  // frase curta que aparece ao passar o mouse
  hint: string;
  steps: string[];
  links?: { label: string; url: string }[];
  note?: string;
}

export const HELP: Record<string, HelpTopic> = {
  device: {
    title: "Ligar o GeekMagic ao painel",
    hint: "Como parear o aparelho com este computador.",
    steps: [
      "Ligue o aparelho. Se ele não achar o painel, a tela mostra \"procurando o Geek Painel\".",
      "Deixe este app aberto no computador e confira que \"Conectar ao aparelho sozinho\" está marcado.",
      "Se o aparelho aparecer como RECUSADO, o código dele é diferente do que está aqui: clique em ENVIAR CÓDIGO AO APARELHO.",
      "Primeira vez, ou trocou de Wi-Fi: com o celular, entre na rede GeekPanel, abra http://192.168.4.1 e informe o nome e a senha do seu Wi-Fi (só rede de 2,4 GHz).",
      "Para recomeçar do zero, use APAGAR WI-FI E CÓDIGO DO APARELHO e repita o passo anterior.",
      "O firewall do computador pode perguntar sobre as portas 4601 e 4602: permita na rede privada.",
    ],
  },
  appearance: {
    title: "Cores do painel",
    hint: "Como mudar as cores do app e do aparelho.",
    steps: [
      "Escolha uma cor pronta ou digite um código no formato #RRGGBB.",
      "A cor de destaque pinta o anel de progresso, o equalizador, as abas e as opções marcadas.",
      "As cores de tokens e do relógio são opcionais: em PADRÃO, a tela usa o visual original.",
      "Clique em SALVAR CONFIGURAÇÃO. O aparelho recebe as cores novas na hora.",
    ],
  },
  rotation: {
    title: "Rodízio das telas",
    hint: "Como escolher o que aparece no aparelho.",
    steps: [
      "AUTO alterna as telas marcadas, cada uma pelo tempo que você definir.",
      "Escolher PLAYER, TOKENS, RELÓGIO ou AGENDA fixa uma tela só.",
      "Desmarque uma tela para tirá-la do rodízio automático.",
      "No modo AUTO, o player só aparece quando algo está tocando, e a agenda só quando está conectada.",
    ],
  },
  providers: {
    title: "Chaves dos provedores de IA",
    hint: "Como conseguir a chave de cada provedor.",
    steps: [
      "Entre no painel de desenvolvedor do provedor (OpenAI, Anthropic, Google Gemini ou outro).",
      "Procure por API keys e crie uma chave nova.",
      "Copie a chave na hora: a maioria dos provedores só mostra uma vez.",
      "Cole em \"Chave (API key)\" e clique em GUARDAR E TESTAR.",
      "A chave fica no cofre do sistema e nunca volta para esta tela.",
    ],
    note: "Para ver o consumo na tela Tokens, OpenAI e Anthropic pedem também uma chave de administração (veja o \"i\" de cada provedor).",
  },
  openai: {
    title: "OpenAI",
    hint: "Chave comum e chave de administração.",
    steps: [
      "Entre em platform.openai.com com a sua conta.",
      "Abra Settings, depois API keys, e clique em Create new secret key.",
      "Cole a chave em \"Chave (API key)\" e clique em GUARDAR E TESTAR.",
      "Para o consumo: em Settings > Organization > Admin keys, crie uma chave de administração (só contas de organização) e cole em \"Chave de administração\".",
      "Informe um limite mensal de tokens se quiser ver a porcentagem; 0 deixa sem limite.",
    ],
    links: [{ label: "platform.openai.com", url: "https://platform.openai.com/api-keys" }],
  },
  anthropic: {
    title: "Anthropic",
    hint: "Chave comum e chave de administração.",
    steps: [
      "Entre em console.anthropic.com com a sua conta.",
      "Abra Settings > API keys e clique em Create Key.",
      "Cole a chave em \"Chave (API key)\" e clique em GUARDAR E TESTAR.",
      "Para o consumo: em Settings > Admin keys, crie uma chave de administração (só contas de organização) e cole em \"Chave de administração\".",
      "Informe um limite mensal de tokens se quiser ver a porcentagem; 0 deixa sem limite.",
    ],
    links: [{ label: "console.anthropic.com", url: "https://console.anthropic.com/settings/keys" }],
  },
  gemini: {
    title: "Google Gemini",
    hint: "Como pegar a chave do Gemini.",
    steps: [
      "Entre em aistudio.google.com com a sua conta Google.",
      "Clique em Get API key e depois em Create API key.",
      "Cole a chave em \"Chave (API key)\" e clique em GUARDAR E TESTAR.",
      "O Gemini não oferece consumo por API: a tela Tokens mostra só que a chave é válida.",
    ],
    links: [{ label: "aistudio.google.com", url: "https://aistudio.google.com/apikey" }],
  },
  spotify: {
    title: "Spotify",
    hint: "Como criar o aplicativo e conectar a conta.",
    steps: [
      "Entre em developer.spotify.com/dashboard com a sua conta Spotify.",
      "Clique em Create app. Dê um nome qualquer e marque \"Web API\".",
      "Em Redirect URIs, adicione exatamente http://127.0.0.1:4615/callback e salve.",
      "Abra o app criado, copie o Client ID e cole no campo \"ID do aplicativo\" aqui.",
      "Clique em CONECTAR e autorize no navegador que abrir.",
      "Controlar o player (pausar, pular, volume) pelo Spotify exige conta Premium.",
    ],
    links: [{ label: "developer.spotify.com/dashboard", url: "https://developer.spotify.com/dashboard" }],
  },
  google: {
    title: "Conta Google do YouTube",
    hint: "Como criar o aplicativo Google para YouTube e YouTube Music.",
    steps: [
      "Entre em console.cloud.google.com com a conta do YouTube (por exemplo, a do Premium).",
      "Crie um projeto novo (menu do topo > Novo projeto).",
      "Em APIs e serviços > Biblioteca, procure por YouTube Data API v3 e clique em Ativar.",
      "Em Tela de permissão OAuth, escolha Externo, preencha o nome e o e-mail e, em Usuários de teste, adicione o seu e-mail.",
      "Em Credenciais > Criar credenciais > ID do cliente OAuth, escolha o tipo \"App para computador\".",
      "Copie o ID e o segredo do cliente. Cole o ID em \"ID do aplicativo\", o segredo em \"Segredo do aplicativo\" e clique em GUARDAR.",
      "Clique em CONECTAR e escolha a conta no navegador que abrir.",
    ],
    links: [{ label: "console.cloud.google.com", url: "https://console.cloud.google.com/apis/credentials" }],
    note: "O app do Google da Agenda é outro: pode ser de outro projeto e de outra conta.",
  },
  calendar: {
    title: "Google Agenda",
    hint: "Como criar o aplicativo Google da agenda.",
    steps: [
      "Entre em console.cloud.google.com com a conta da agenda que você quer mostrar.",
      "Crie um projeto novo (menu do topo > Novo projeto). Pode ser diferente do projeto do YouTube.",
      "Em APIs e serviços > Biblioteca, procure por Google Calendar API e clique em Ativar.",
      "Em Tela de permissão OAuth, escolha Externo, preencha o nome e o e-mail e, em Usuários de teste, adicione o e-mail da agenda.",
      "Em Credenciais > Criar credenciais > ID do cliente OAuth, escolha o tipo \"App para computador\".",
      "Copie o ID e o segredo. Cole o ID em \"ID do aplicativo Google\", o segredo em \"Segredo do aplicativo\" e clique em GUARDAR.",
      "Clique em CONECTAR, escolha a conta da agenda e marque \"Mostrar a agenda no painel\".",
    ],
    links: [{ label: "console.cloud.google.com", url: "https://console.cloud.google.com/apis/credentials" }],
  },
  link: {
    title: "Tocar por link",
    hint: "Como usar o campo de link.",
    steps: [
      "Cole o endereço de uma música, vídeo ou playlist do serviço.",
      "Clique em VALIDAR para ver o título antes de tocar.",
      "Marque \"Usar esta fonte no player\" e clique em TOCAR.",
      "YouTube e YouTube Music tocam dentro do app; o Spotify toca no aplicativo aberto na sua conta.",
    ],
  },
  clock: {
    title: "Relógio",
    hint: "Fuso e nome da cidade.",
    steps: [
      "O fuso horário usa o formato Continente/Cidade, por exemplo America/Sao_Paulo, America/Manaus ou Europe/Lisbon.",
      "O nome da cidade que aparece na tela é só texto: escreva o que quiser. Vazio usa o nome do fuso.",
      "O relógio digital mostra segundos e data; o analógico e o flip podem esconder os dois.",
    ],
    links: [{ label: "lista de fusos", url: "https://pt.wikipedia.org/wiki/Lista_de_fusos_hor%C3%A1rios_tz" }],
  },
};
