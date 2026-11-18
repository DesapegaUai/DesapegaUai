// Conversas de exemplo (protótipos 10-conversas e 10b-conversa-aberta).
// "eu" = Ana Beatriz (usuária logada). Trocar por chamadas à API / WebSocket depois.
// A conversa com o Rafael é a do protótipo; as outras ganharam mensagens curtas
// porque no protótipo a prévia delas veio vazia.

export const CONVERSAS = [
  {
    id: 'rafael-lima',
    nome: 'Rafael Lima',
    iniciais: 'RL',
    online: true,
    vendendo: true,
    naoLidas: 2,
    anuncio: { id: 'casa-5', titulo: 'Air fryer Mondial 4L', preco: 260 },
    mensagens: [
      { id: 1, autor: 'outro', dia: 'Hoje', hora: '14:12', texto: 'Oi Ana! Boa tarde 👋 A air fryer ainda está disponível?' },
      { id: 2, autor: 'eu', dia: 'Hoje', hora: '14:18', texto: 'Oi Rafael, boa tarde! Está sim, em ótimo estado — usei por uns 8 meses.' },
      { id: 3, autor: 'outro', dia: 'Hoje', hora: '14:20', texto: 'Acompanha a caixa e o manual?' },
      { id: 4, autor: 'eu', dia: 'Hoje', hora: '14:25', texto: 'Acompanha a caixa original, o manual eu perdi mas está tudo online no site da Mondial.' },
      { id: 5, autor: 'outro', dia: 'Hoje', hora: '14:30', texto: 'Perfeito. Aceita R$ 240 pegando hoje?' },
      { id: 6, autor: 'outro', dia: 'Hoje', hora: '14:32', texto: 'Consigo buscar hoje à noite, pode ser?' },
    ],
  },
  {
    id: 'juliana-prado',
    nome: 'Juliana Prado',
    iniciais: 'JP',
    online: false,
    vendendo: true,
    naoLidas: 1,
    anuncio: { id: 'casa-4', titulo: 'Mesa de jantar 4 lugares', preco: 480 },
    mensagens: [
      { id: 1, autor: 'outro', dia: 'Hoje', hora: '10:40', texto: 'Oi! A mesa vem com as 4 cadeiras?' },
      { id: 2, autor: 'eu', dia: 'Hoje', hora: '10:52', texto: 'Vem sim, as 4 cadeiras estão inteiras. Só a mesa tem um risquinho no canto.' },
      { id: 3, autor: 'outro', dia: 'Hoje', hora: '11:05', texto: 'Obrigada! Vou combinar com meu irmão o frete.' },
    ],
  },
  {
    id: 'marcos-vinicius',
    nome: 'Marcos Vinícius',
    iniciais: 'MV',
    online: false,
    vendendo: false,
    naoLidas: 0,
    anuncio: { id: 'liv-1', titulo: 'Cálculo A — Flemming', preco: 60 },
    mensagens: [
      { id: 1, autor: 'eu', dia: 'Ontem', hora: '17:10', texto: 'Oi Marcos, o livro ainda está disponível?' },
      { id: 2, autor: 'outro', dia: 'Ontem', hora: '17:24', texto: 'Está sim! Posso entregar na UFV amanhã.' },
      { id: 3, autor: 'eu', dia: 'Ontem', hora: '17:30', texto: 'Fechado então, te encontro na biblioteca às 18h.' },
    ],
  },
  {
    id: 'carla-bittencourt',
    nome: 'Carla Bittencourt',
    iniciais: 'CB',
    online: true,
    vendendo: true,
    naoLidas: 0,
    anuncio: { id: 'casa-1', titulo: 'Sofá 3 lugares cinza', preco: 780 },
    mensagens: [
      { id: 1, autor: 'outro', dia: 'Ontem', hora: '20:02', texto: 'Qual a medida do sofá?' },
      { id: 2, autor: 'eu', dia: 'Ontem', hora: '20:15', texto: '2,10 m de largura e 90 cm de profundidade.' },
      { id: 3, autor: 'outro', dia: 'Ontem', hora: '20:21', texto: 'Vou medir a sala e te aviso amanhã 🙂' },
    ],
  },
  {
    id: 'diego-rocha',
    nome: 'Diego Rocha',
    iniciais: 'DR',
    online: false,
    vendendo: false,
    naoLidas: 0,
    anuncio: { id: 'vei-2', titulo: 'Bicicleta aro 29', preco: 1150 },
    mensagens: [
      { id: 1, autor: 'eu', dia: 'Seg', hora: '09:15', texto: 'Bom dia! A bicicleta já foi revisada?' },
      { id: 2, autor: 'outro', dia: 'Seg', hora: '09:48', texto: 'Foi sim, troquei pastilhas e corrente mês passado.' },
    ],
  },
  {
    id: 'lorena-castro',
    nome: 'Lorena Castro',
    iniciais: 'LC',
    online: false,
    vendendo: true,
    naoLidas: 0,
    anuncio: { id: 'ele-3', titulo: 'Fone JBL Tune 510', preco: 120 },
    mensagens: [
      { id: 1, autor: 'outro', dia: 'Seg', hora: '15:30', texto: 'Pode deixar na portaria do meu prédio?' },
      { id: 2, autor: 'eu', dia: 'Seg', hora: '15:41', texto: 'Posso sim, me passa o endereço.' },
      { id: 3, autor: 'outro', dia: 'Seg', hora: '15:44', texto: 'Combinado, obrigada!' },
    ],
  },
];

export const NAO_LIDAS_TOTAL = CONVERSAS.reduce((total, c) => total + c.naoLidas, 0);

export const RESPOSTAS_RAPIDAS = [
  'Ainda está disponível?',
  'Aceita retirada hoje?',
  'Posso combinar no Centro',
];

/** Anexos aceitos no chat */
export const ANEXOS = {
  aceitos: 'image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip',
  maxArquivos: 5,
  maxBytes: 10 * 1024 * 1024, // 10 MB por arquivo
};
