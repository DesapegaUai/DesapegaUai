// Cidades e bairros atendidos (os mesmos de backend/database/seed.sql).
// Quando as telas forem ligadas na API, esta lista vem de GET /api/cidades.

export const CIDADES = [
  {
    nome: 'Viçosa',
    bairros: [
      'Centro', 'Ramos', 'Santa Clara', 'Bela Vista', 'Betânia', 'Clélia Bernardes', 'Santo Antônio',
      'Campus UFV', 'Fátima', 'Bom Jesus', 'Sagrada Família', 'Nova Viçosa', 'Amoras', 'Vale do Sol',
      'Barrinha', 'Júlia Mollá', 'Inconfidência', 'João Braz', 'Silvestre', 'Novo Silvestre',
    ],
  },
  { nome: 'Teixeiras', bairros: ['Centro'] },
  { nome: 'Ponte Nova', bairros: ['Centro', 'Palmeiras'] },
  { nome: 'Ubá', bairros: ['Centro', 'São Domingos'] },
];

export const bairrosDaCidade = (cidade) => CIDADES.find((c) => c.nome === cidade)?.bairros ?? [];
