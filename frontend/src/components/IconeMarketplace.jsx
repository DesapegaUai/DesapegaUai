// Ícones de traço do DesapegaUai (mesmos desenhos do protótipo e de 09.5-icones).
// Uso: <Icone nome="busca" tamanho={21} cor="#4CA02B" />

const DESENHOS = {
  upload: <path d="M6.4 17.4A4.4 4.4 0 0 1 7 8.7a5.6 5.6 0 0 1 10.7 1.1 3.9 3.9 0 0 1-.5 7.6M12 20.4V11.6M9 14.4 12 11.4l3 3" />,
  aviao: <path d="M20.4 3.6 10.6 13.4M20.4 3.6l-6.6 16.8-3.2-7-7-3.2z" />,
  marcador: <path d="M7 4.4h10v15.2L12 16l-5 3.6z" />,
  retirada: <path d="M9 11.4a3 3 0 1 0 0-6 3 3 0 0 0 0 6M3.6 19.4c0-3 2.4-4.6 5.4-4.6s5.4 1.6 5.4 4.6M15.4 8.4h5M15.4 12h5M15.4 15.6h3" />,
  caminhao: <path d="M2.8 7.4h9.6v9.2H2.8zM12.4 10.6h4l3 3v3h-7zM6.4 18.6a1.6 1.6 0 1 0 0-3.2 1.6 1.6 0 0 0 0 3.2M16.6 18.6a1.6 1.6 0 1 0 0-3.2 1.6 1.6 0 0 0 0 3.2" />,
  menu: <path d="M4.5 7h15M4.5 12h15M4.5 17h15" />,
  busca: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-4.4-4.4" />
    </>
  ),
  local: (
    <path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11zM12 12.6a2.6 2.6 0 1 0 0-5.2 2.6 2.6 0 0 0 0 5.2" />
  ),
  'seta-baixo': <path d="M6 9.5l6 6 6-6" />,
  'seta-direita': <path d="M9.5 6l6 6-6 6" />,
  'seta-esquerda': <path d="M14.5 6l-6 6 6 6" />,
  favorito: (
    <path d="M12 20.2s-7.6-4.7-7.6-9.8A4.5 4.5 0 0 1 12 7.3a4.5 4.5 0 0 1 7.6 3.1c0 5.1-7.6 9.8-7.6 9.8z" />
  ),
  mensagens: <path d="M20 12.4a7.6 7.6 0 0 1-11 6.8L4.4 20.6l1.4-4.5A7.6 7.6 0 1 1 20 12.4z" />,
  perfil: <path d="M12 11.6a3.6 3.6 0 1 0 0-7.2 3.6 3.6 0 0 0 0 7.2M5 20c0-3.7 3.1-5.7 7-5.7s7 2 7 5.7" />,
  filtros: <path d="M4 7h16M7 12h10M10 17h4" />,
  fechar: <path d="M7 7l10 10M17 7 7 17" />,
  arquivo: <path d="M4 5.6h16v3.8H4zM5.4 9.4v8.4a1.4 1.4 0 0 0 1.4 1.4h10.4a1.4 1.4 0 0 0 1.4-1.4V9.400M10 13h4" />,
  lixeira: <path d="M5 7.200h14M9.8 7.200V5.400a1 1 0 0 1 1-1h2.400a1 1 0 0 1 1 1v1.800M7 7.200l.800 11.400a1.5 1.5 0 0 0 1.5 1.400h5.400a1.5 1.5 0 0 0 1.5-1.400L17 7.200M10.3 11v5.400M13.7 11v5.4" />,
  bandeira: <path d="M6 20.5V4.4M6 5.2c3.6-2 6.4 1.8 10.2.2.5-.2.9.1.9.6v7.2c0 .4-.2.7-.6.9-3.9 1.6-6.8-2.3-10.5-.2" />,
  mais: <path d="M12 5.5v13M5.5 12h13" />,
  check: <path d="M5 12.6l4.4 4.4L19 7.4" />,
  imagem: (
    <>
      <path d="M4.6 5.6h14.8v12.8H4.6zM4.6 15.4l4-4 3.4 3.4 2.8-2.8 4.6 4.6" />
      <circle cx="9" cy="9.4" r="1.3" />
    </>
  ),
  escudo: (
    <>
      <path d="M12 3.2 5 6v5.6c0 4.3 2.9 7.6 7 9.2 4.1-1.6 7-4.9 7-9.2V6z" />
      <path d="m9.2 12.1 2 2 3.8-3.9" />
    </>
  ),
  instagram: (
    <>
      <rect x="3.6" y="3.6" width="16.8" height="16.8" rx="5" />
      <circle cx="12" cy="12" r="3.9" />
      <circle cx="17.1" cy="6.9" r=".6" fill="currentColor" />
    </>
  ),

  // Painel (perfil / menu lateral)
  inicio: <path d="M4 10.6 12 4l8 6.6V19a1 1 0 0 1-1 1h-4.4v-5.4H9.4V20H5a1 1 0 0 1-1-1z" />,
  grade: <path d="M4.6 4.6h5.2v5.2H4.6zM14.2 4.6h5.2v5.2h-5.2zM4.6 14.2h5.2v5.2H4.6zM14.2 14.2h5.2v5.2h-5.2z" />,
  etiqueta: (
    <>
      <path d="M4 11.6V5.2A1.2 1.2 0 0 1 5.2 4h6.4l8.4 8.4-7.6 7.6z" />
      <circle cx="8.4" cy="8.4" r="1.2" />
    </>
  ),
  sair: <path d="M9.6 20H5.4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h4.2M15 8.2 18.8 12 15 15.8M9.4 12h9.2" />,
  sino: <path d="M17.6 10.4a5.6 5.6 0 1 0-11.2 0c0 5-2.1 6.4-2.1 6.4h15.4s-2.1-1.4-2.1-6.4zM13.6 19.6a1.9 1.9 0 0 1-3.2 0" />,
  relogio: <path d="M12 20.5a8.5 8.5 0 1 0 0-17 8.5 8.5 0 0 0 0 17zM12 7.6V12l3 1.8" />,
  sacola: <path d="M6 8h12l-1 11.4H7zM9 8V6.4a3 3 0 0 1 6 0V8" />,
  estrela: <path d="M12 3.6l2.5 5.4 5.9.7-4.4 4 1.2 5.8L12 16.6 6.8 19.5 8 13.7l-4.4-4 5.9-.7z" />,
  cadeado: (
    <>
      <path d="M7 10.6V8.4a5 5 0 0 1 10 0v2.2M5.6 10.6h12.8v9H5.6z" />
      <circle cx="12" cy="14.6" r="1.4" />
    </>
  ),
  verificado: (
    <>
      <path d="M12 3.4l7 2.8v5.2c0 4.3-2.9 7.7-7 9.2-4.1-1.5-7-4.9-7-9.2V6.2z" />
      <path d="M9.2 12.2l2 2 3.6-3.8" />
    </>
  ),
  'escudo-simples': <path d="M12 3.4l7 2.8v5.2c0 4.3-2.9 7.7-7 9.2-4.1-1.5-7-4.9-7-9.2V6.2z" />,
  ajuda: (
    <>
      <circle cx="12" cy="12" r="8.4" />
      <path d="M9.8 9.6a2.2 2.2 0 1 1 3.4 1.9c-.7.5-1.2.9-1.2 1.9M12 16.6h.02" />
    </>
  ),
  calendario: <path d="M5.4 6.4h13.2v13H5.4zM8.6 4v3M15.4 4v3M5.4 10.4h13.2" />,
  olho: (
    <>
      <path d="M2.6 12S6 6.2 12 6.2 21.4 12 21.4 12 18 17.8 12 17.8 2.6 12 2.6 12z" />
      <circle cx="12" cy="12" r="2.8" />
    </>
  ),
  engrenagem: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 14.2a7.4 7.4 0 0 0 0-4.4l-2.2-.4-.9-1.6 1-2a7.6 7.6 0 0 0-3.8-2.2l-1.5 1.7h-1.8L8.7 3.6A7.6 7.6 0 0 0 4.9 5.8l1 2-.9 1.6-2.2.4a7.4 7.4 0 0 0 0 4.4l2.2.4.9 1.6-1 2a7.6 7.6 0 0 0 3.8 2.2l1.5-1.7h1.8l1.5 1.7a7.6 7.6 0 0 0 3.8-2.2l-1-2 .9-1.6z" />
    </>
  ),
  lapis: <path d="M15.6 4.6l3.8 3.8L8.8 19H5v-3.8z" />,
  camera: (
    <>
      <path d="M4 8.4h3.4l1.5-2.2h6.2l1.5 2.2H20v10.2H4z" />
      <circle cx="12" cy="13.4" r="3" />
    </>
  ),
  'mais-horizontal': (
    <>
      <circle cx="6" cy="12" r="1.2" />
      <circle cx="12" cy="12" r="1.2" />
      <circle cx="18" cy="12" r="1.2" />
    </>
  ),
  'mais-vertical': (
    <>
      <circle cx="12" cy="5.6" r="1.1" />
      <circle cx="12" cy="12" r="1.1" />
      <circle cx="12" cy="18.4" r="1.1" />
    </>
  ),
  'seta-link': <path d="M5 12h13M13.4 6.4 19 12l-5.6 5.6" />,
  // compartilhar (três pontos ligados) e copiar link (dois elos de corrente)
  compartilhar: (
    <>
      <circle cx="18" cy="5.5" r="2.6" />
      <circle cx="6" cy="12" r="2.6" />
      <circle cx="18" cy="18.5" r="2.6" />
      <path d="M8.3 10.8l7.4-4M8.3 13.2l7.4 4" />
    </>
  ),
  link: <path d="M10 14a4.2 4.2 0 0 0 6 0l3-3a4.2 4.2 0 0 0-6-6l-1 1M14 10a4.2 4.2 0 0 0-6 0l-3 3a4.2 4.2 0 0 0 6 6l1-1" />,

  // Conversas
  telefone: <path d="M6.4 4.2 9 4.9l1 3.4-2 1.6a11 11 0 0 0 6.1 6.1l1.6-2 3.4 1 .7 2.6a2 2 0 0 1-2.2 2.4C11.7 19.4 4.6 12.3 4 6.4a2 2 0 0 1 2.4-2.2z" />,
  enviar: <path d="M4.4 12h15.2M12.6 5.2 19.6 12l-7 6.8" />,
  lida: <path d="M3.4 12.8l3.4 3.4 7-7.6M10.4 16.2l1.2 1.2 8-8.6" />,
  clipe: <path d="M20 11.6l-7.9 7.9a4.9 4.9 0 0 1-6.9-6.9l8.3-8.3a3.3 3.3 0 0 1 4.6 4.6l-8.3 8.3a1.6 1.6 0 0 1-2.3-2.3l7.6-7.6" />,
  emoji: (
    <>
      <circle cx="12" cy="12" r="8.4" />
      <path d="M8.6 14a4.2 4.2 0 0 0 6.8 0M9.3 9.8h.01M14.7 9.8h.01" />
    </>
  ),
  documento: <path d="M13.8 3.6H7.2a1.6 1.6 0 0 0-1.6 1.6v13.6a1.6 1.6 0 0 0 1.6 1.6h9.6a1.6 1.6 0 0 0 1.6-1.6V8.2zM13.8 3.6v4.6h4.6M8.8 13h6.4M8.8 16.4h4.2" />,
  trocar: <path d="M19.4 11A7.5 7.5 0 0 0 6 7.2L4.6 8.6M4.6 4.6v4h4M4.6 13a7.5 7.5 0 0 0 13.4 3.8l1.4-1.4M19.4 19.4v-4h-4" />,

  // Categorias
  casa: <path d="M3.4 10.6 12 3.6l8.6 7M5.4 9.1v9.7a1.4 1.4 0 0 0 1.4 1.4h10.4a1.4 1.4 0 0 0 1.4-1.4V9.1M9.8 20.2v-5.6h4.4v5.6" />,
  eletronicos: <path d="M8.3 3h7.4a1.6 1.6 0 0 1 1.6 1.6v14.8A1.6 1.6 0 0 1 15.7 21H8.3a1.6 1.6 0 0 1-1.6-1.6V4.6A1.6 1.6 0 0 1 8.3 3zM10.6 17.8h2.8" />,
  moda: <path d="M9.2 3.4 12 5.3l2.8-1.9 4.4 2.7-1.9 3.1-1.6-1v11.4H8.3V8.2l-1.6 1L4.8 6.1z" />,
  veiculos: <path d="M4.6 13.4h14.8M6.6 17h11M7.2 17v2.2M16.8 17v2.2M6.4 13.4l1.9-4.6A1.6 1.6 0 0 1 9.8 7.8h4.4a1.6 1.6 0 0 1 1.5 1l1.9 4.6v3.6H6.4z" />,
  livros: <path d="M4 5.6A1.6 1.6 0 0 1 5.6 4H10a2 2 0 0 1 2 2v13a2 2 0 0 0-2-1.9H4zM20 5.6A1.6 1.6 0 0 0 18.4 4H14a2 2 0 0 0-2 2v13a2 2 0 0 1 2-1.9h6z" />,
  games: <path d="M9.4 8.2h5.2a5.4 5.4 0 0 1 5.4 5.4v.6a2.9 2.9 0 0 1-5.2 1.8l-.6-.8H9.8l-.6.8A2.9 2.9 0 0 1 4 14.2v-.6a5.4 5.4 0 0 1 5.4-5.4zM7.6 12.4h2.2M8.7 11.3v2.2M14.6 12.4h1.6" />,
  servicos: <path d="M14.6 3.6a4.2 4.2 0 0 0 5.4 5.4l1.2 1.2-3 3-1.2-1.2a4.2 4.2 0 0 1-5.4-5.4zM11.2 11.4 3.5 19a1.9 1.9 0 0 0 2.7 2.7l7.6-7.7" />,
  outros: <path d="M5.4 5.4h4.2v4.2H5.4zM14.4 5.4h4.2v4.2h-4.2zM5.4 14.4h4.2v4.2H5.4zM14.4 14.4h4.2v4.2h-4.2z" />,
};

export default function IconeMarketplace({
  nome,
  tamanho = 24,
  cor = 'currentColor',
  espessura = 1.65,
  preenchimento = 'none',
  className,
}) {
  return (
    <svg
      width={tamanho}
      height={tamanho}
      viewBox="0 0 24 24"
      fill={preenchimento}
      stroke={cor}
      strokeWidth={espessura}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flex: 'none', color: cor }}
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {DESENHOS[nome]}
    </svg>
  );
}
