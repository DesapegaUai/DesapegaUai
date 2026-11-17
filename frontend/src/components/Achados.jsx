import CardAnuncio from './CardAnuncio.jsx'
import Icone from './Icone.jsx'
import '../styles/secoes.css'
import './Achados.css'

/* Dados de exemplo. Quando a busca da API estiver pronta, esta lista vem do back-end. */
const anuncios = [
  { id: 1, titulo: 'iPhone 13 128GB', preco: 2450, local: 'Centro, Viçosa', foto: '/img/fotos/iphone.webp' },
  { id: 2, titulo: 'Bicicleta Aro 29', preco: 850, local: 'Silvestre, Viçosa', foto: '/img/fotos/bicicleta.webp' },
  { id: 3, titulo: 'Mesa de escritório', preco: 250, local: 'Santo Antônio, Viçosa', foto: '/img/fotos/mesa.webp' },
  { id: 4, titulo: 'Sofá 2 lugares', preco: 600, local: 'Nova Viçosa, Viçosa', foto: '/img/fotos/sofa.webp' },
  { id: 5, titulo: 'Air Fryer Mondial', preco: 180, local: 'Bom Jesus, Viçosa', foto: '/img/fotos/airfryer.webp' },
]

// Deixa o texto em minúsculas e sem acento, para "sofa" encontrar "Sofá".
const simplificar = (texto) =>
  texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

export default function Achados({ busca = '' }) {
  const termo = simplificar(busca.trim())
  const filtrados = anuncios.filter((a) => simplificar(a.titulo).includes(termo))

  return (
    <section className="secao achados">
      <div className="secao__topo">
        <div className="achados__titulos">
          <h2>Achados perto de você</h2>
          <Icone nome="home-localizacao" tamanho={21} />
          <span className="achados__sub">Anúncios na sua região</span>
        </div>
        <a href="#" className="secao__link">
          Ver todos os anúncios
          <Icone nome="home-seta-direita" tamanho={20} />
        </a>
      </div>

      {filtrados.length === 0 ? (
        <p className="achados__vazio">Nenhum anúncio encontrado para "{busca.trim()}".</p>
      ) : (
        <div className="lista-anuncios">
          {filtrados.map((a) => (
            <CardAnuncio key={a.id} anuncio={a} />
          ))}
        </div>
      )}
    </section>
  )
}
