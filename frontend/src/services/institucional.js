// Páginas de ajuda e institucionais (rodapé, perfil e login).
// O conteúdo segue o Manual do Usuário do MVP. Termos e Privacidade são versões preliminares.

const PRELIMINAR = 'Versão preliminar do MVP. O texto final será definido pela equipe do projeto.';

export const PAGINAS_INSTITUCIONAIS = [
  {
    slug: 'como-funciona',
    titulo: 'Como funciona',
    resumo: 'O DesapegaUai aproxima quem quer desapegar de quem está procurando, em Viçosa e região.',
    secoes: [
      {
        titulo: 'O que você pode fazer',
        lista: [
          'Encontrar: pesquise, filtre e veja anúncios por categoria.',
          'Favoritar: guarde os anúncios de que você gostou.',
          'Conversar: combine os detalhes com o vendedor pelo chat.',
          'Anunciar: publique, edite e exclua os seus anúncios.',
          'Cuidar do perfil: veja e atualize os seus dados.',
          'Entrar com segurança: acesse com a sua conta Google, sem criar senha.',
        ],
      },
      {
        titulo: 'Para comprar',
        passos: [
          'Procure pelo nome no campo de busca ou escolha uma categoria.',
          'Use os filtros de preço, condição, bairro e distância para refinar a lista.',
          'Abra o anúncio para ver as fotos, o preço, a descrição e o nome do vendedor.',
          'Clique em Conversar e combine a retirada pelo chat.',
        ],
      },
      {
        titulo: 'Para vender',
        passos: [
          'Clique em Anunciar, no alto da página.',
          'Adicione as fotos e preencha título, categoria, condição, preço, descrição, cidade, bairro e forma de entrega.',
          'Clique em Publicar anúncio, ou em Salvar rascunho para terminar depois.',
          'Acompanhe tudo em Meus anúncios: edite, marque como vendido ou exclua.',
        ],
        link: { texto: 'Ver as regras para anunciar', para: '/ajuda/regras-para-anunciar' },
      },
      {
        titulo: 'O que precisa de login',
        paragrafos: [
          'Ver a página inicial, as categorias e os anúncios, pesquisar e filtrar não precisam de login.',
          'Para favoritar, conversar, anunciar e abrir o perfil, entre com a sua conta Google.',
        ],
      },
      {
        titulo: 'Pagamento e entrega',
        paragrafos: [
          'A negociação, o pagamento e a entrega são combinados diretamente entre comprador e vendedor. O DesapegaUai não intermedia pagamentos nem entregas.',
        ],
        link: { texto: 'Ver as dicas de segurança', para: '/ajuda/dicas-de-seguranca' },
      },
    ],
  },
  {
    slug: 'regras-para-anunciar',
    titulo: 'Regras para anunciar',
    resumo: 'Confira o que é preciso para publicar um anúncio.',
    secoes: [
      {
        titulo: 'Regras de preenchimento',
        tabela: {
          cabecalho: ['Campo', 'Obrigatório', 'Regra'],
          linhas: [
            ['Fotos', 'Sim', 'De 1 a 8 fotos em JPG, PNG ou WebP, com até 8 MB cada.'],
            ['Título', 'Sim', 'De 3 a 80 caracteres.'],
            ['Categoria', 'Sim', 'Uma das 8 categorias.'],
            ['Condição', 'Sim, exceto em Serviços', 'Novo, Seminovo ou Usado.'],
            ['Preço', 'Sim', 'Valor maior que zero.'],
            ['Descrição', 'Não', 'Até 1.000 caracteres.'],
            ['Cidade e bairro', 'Sim', 'Escolha nas listas disponíveis.'],
            ['Forma de entrega', 'Sim', 'Retirada em mãos ou Combinar com o vendedor.'],
          ],
        },
      },
      {
        titulo: 'Rascunho',
        paragrafos: [
          'Use Salvar rascunho para terminar o anúncio depois. O rascunho não aparece para outras pessoas e fica guardado em Meus anúncios até você publicar.',
        ],
      },
      {
        titulo: 'Depois de publicar',
        lista: [
          'Editar: altera os dados do anúncio.',
          'Marcar como vendido: o anúncio sai da busca, mas continua em Meus anúncios, nos favoritos e nas conversas.',
          'Excluir: apaga o anúncio, as fotos, os favoritos e as conversas ligadas a ele. A exclusão não pode ser desfeita.',
        ],
      },
      {
        titulo: 'Para um bom anúncio',
        lista: [
          'Use fotos reais e bem iluminadas.',
          'Descreva o produto com detalhes.',
          'Informe medidas e condições.',
          'Responda rápido às mensagens.',
        ],
      },
    ],
  },
  {
    slug: 'perguntas-frequentes',
    titulo: 'Perguntas frequentes',
    resumo: 'Veja o que significa cada aviso e como resolver.',
    secoes: [
      {
        perguntas: [
          ['Preciso criar uma senha?', 'Não. O acesso é feito com a sua conta Google, e a sua conta no DesapegaUai é criada no primeiro acesso.'],
          ['Apareceu “Para continuar, aceite os Termos de uso e a Política de privacidade”.', 'Marque a caixa de aceite e clique em Google novamente.'],
          ['Apareceu “A conta Google precisa ter um e-mail verificado”.', 'Verifique o e-mail na sua conta Google ou use outra conta.'],
          ['Apareceu “Não foi possível confirmar o login com o Google”.', 'Clique em Google e escolha a conta mais uma vez.'],
          ['Apareceu “Entrar com o Google está indisponível no momento”.', 'Aguarde alguns minutos e tente de novo.'],
          ['Apareceu “Não foi possível carregar o login do Google”.', 'Verifique a sua conexão e recarregue a página.'],
          ['Minha foto não foi aceita.', 'Envie fotos JPG, PNG ou WebP com até 8 MB cada.'],
          ['O telefone não foi aceito.', 'Digite o DDD seguido do número, com 10 ou 11 dígitos.'],
          ['Nenhum anúncio aparece na lista.', 'Clique em Limpar nos filtros ou aumente a distância.'],
          ['Posso favoritar ou conversar no meu próprio anúncio?', 'Não. Também não é possível abrir conversa em um anúncio já vendido.'],
        ],
      },
    ],
  },
  {
    slug: 'dicas-de-seguranca',
    titulo: 'Dicas de segurança',
    resumo: 'O DesapegaUai não intermedia pagamentos nem entregas. Siga estes cuidados ao negociar.',
    secoes: [
      {
        cartoes: [
          ['local', 'Encontre-se em locais públicos', 'Prefira lugares movimentados.'],
          ['olho', 'Confira o produto', 'Veja o estado do item antes de fechar o negócio.'],
          ['escudo-simples', 'Nunca pague adiantado', 'Só faça o pagamento depois de ver o produto.'],
          ['mensagens', 'Use o chat da plataforma', 'Converse e combine os detalhes pelo DesapegaUai.'],
        ],
      },
      {
        titulo: 'Sua privacidade',
        paragrafos: [
          'O telefone e o e-mail do vendedor não aparecem no anúncio. O contato é feito somente pelo chat, e só você e a outra pessoa veem a conversa.',
        ],
      },
      {
        titulo: 'Computador compartilhado',
        paragrafos: [
          'Seu acesso fica salvo no navegador por até 7 dias. Em computadores compartilhados, sempre saia da conta ao terminar.',
        ],
      },
    ],
  },
  {
    slug: 'sobre-nos',
    titulo: 'Sobre nós',
    resumo: 'Classificados locais para comprar, vender e desapegar em Viçosa e região.',
    secoes: [
      {
        paragrafos: [
          'O DesapegaUai é uma plataforma web de classificados locais. Ela conecta quem quer vender produtos usados a compradores de Viçosa e da Zona da Mata mineira.',
          'A ideia é dar uma nova chance para o que você não usa mais e fortalecer a comunidade da sua região.',
          'O projeto nasceu no Projeto de Extensão Cidades Inteligentes, do curso de Análise e Desenvolvimento de Sistemas.',
        ],
      },
      { titulo: 'Cidades atendidas', paragrafos: ['Viçosa, Teixeiras, Ponte Nova e Ubá.'] },
      {
        titulo: 'Equipe do projeto',
        lista: ['Alice Campos', 'Anthony Rocha', 'Henrique Lucrécio', 'João Pedro', 'Marina Vieira', 'Rayanne Fernandes', 'Rhayane de Freitas Eloi'],
      },
    ],
  },
  {
    slug: 'fale-conosco',
    titulo: 'Fale conosco',
    resumo: 'Fale com a equipe do DesapegaUai.',
    secoes: [
      {
        titulo: 'Instagram',
        paragrafos: ['Mande uma mensagem para a equipe pelo Instagram.'],
        externo: { texto: '@desapegauai', href: 'https://instagram.com/desapegauai' },
      },
      {
        titulo: 'Falar com um vendedor',
        paragrafos: ['Para combinar uma compra, use o botão Conversar no anúncio. O contato com vendedores é feito somente pelo chat.'],
      },
      {
        titulo: 'Antes de escrever',
        paragrafos: ['Veja se a sua dúvida já está respondida nas perguntas frequentes.'],
        link: { texto: 'Ver as perguntas frequentes', para: '/ajuda/perguntas-frequentes' },
      },
    ],
  },
  {
    slug: 'termos-de-uso',
    titulo: 'Termos de uso',
    resumo: 'Regras para usar o DesapegaUai.',
    aviso: PRELIMINAR,
    secoes: [
      {
        titulo: 'O serviço',
        paragrafos: [
          'O DesapegaUai é uma plataforma de classificados locais que aproxima compradores e vendedores de Viçosa e região.',
          'A negociação, o pagamento e a entrega são combinados diretamente entre as pessoas. A plataforma não intermedia pagamentos nem entregas.',
        ],
      },
      {
        titulo: 'Conta e acesso',
        paragrafos: [
          'O acesso é feito com uma conta Google com e-mail verificado. Para favoritar, conversar, anunciar e usar o perfil, é preciso aceitar estes Termos e a Política de privacidade.',
        ],
      },
      {
        titulo: 'Anúncios',
        paragrafos: ['Quem anuncia é responsável pelas fotos e informações publicadas, que devem seguir as regras para anunciar.'],
        link: { texto: 'Ver as regras para anunciar', para: '/ajuda/regras-para-anunciar' },
      },
      {
        titulo: 'Conversas',
        paragrafos: ['O contato entre as pessoas é feito pelo chat da plataforma. Use o chat com respeito e siga as dicas de segurança.'],
      },
      {
        titulo: 'Exclusão',
        paragrafos: ['Você pode excluir os seus anúncios a qualquer momento. A exclusão apaga o anúncio, as fotos, os favoritos e as conversas ligadas a ele.'],
      },
    ],
  },
  {
    slug: 'politica-de-privacidade',
    titulo: 'Política de privacidade',
    resumo: 'Quais dados o DesapegaUai usa e o que fica visível para outras pessoas.',
    aviso: PRELIMINAR,
    secoes: [
      {
        titulo: 'Dados que usamos',
        lista: [
          'Da sua conta Google: nome, e-mail e foto.',
          'Do seu perfil: telefone e bio, os dois opcionais.',
          'Dos seus anúncios: fotos, descrição, preço, cidade e bairro.',
          'Das conversas: as mensagens trocadas pelo chat.',
        ],
      },
      {
        titulo: 'O que fica visível',
        paragrafos: [
          'Nos anúncios aparecem as fotos, o preço, a descrição, a condição, o bairro e o nome do vendedor.',
          'O telefone e o e-mail não aparecem. O contato é feito somente pelo chat, e só você e a outra pessoa veem a conversa.',
        ],
      },
      {
        titulo: 'Acesso salvo no navegador',
        paragrafos: ['Seu acesso fica salvo no navegador por até 7 dias. Em computadores compartilhados, saia da conta ao terminar.'],
      },
      {
        titulo: 'Seus controles',
        paragrafos: ['Você pode editar o nome, o telefone e a bio no perfil e excluir os seus anúncios a qualquer momento.'],
      },
    ],
  },
];

export const buscarPaginaInstitucional = (slug) => PAGINAS_INSTITUCIONAIS.find((p) => p.slug === slug);

/** Destino de cada link do rodapé, do perfil e do login. */
export const LINKS_AJUDA = {
  'Sobre nós': '/ajuda/sobre-nos',
  'Como funciona': '/ajuda/como-funciona',
  'Regras para anunciar': '/ajuda/regras-para-anunciar',
  'Perguntas frequentes': '/ajuda/perguntas-frequentes',
  'Dicas de segurança': '/ajuda/dicas-de-seguranca',
  'Fale conosco': '/ajuda/fale-conosco',
  'Termos de uso': '/ajuda/termos-de-uso',
  'Política de privacidade': '/ajuda/politica-de-privacidade',
};
