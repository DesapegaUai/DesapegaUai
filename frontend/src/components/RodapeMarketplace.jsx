import { useState } from 'react';
import { Link } from 'react-router';
import Icone from './IconeMarketplace.jsx';
import useMediaQuery, { CELULAR } from '../hooks/useMediaQuery.js';
import '../styles/marketplace-rodape.css';

const logoNegativo = '/img/logo-negativo.svg';

// Links internos usam rotas do app; os institucionais ainda não têm tela (href="#").
const COLUNAS = [
  {
    id: 'institucional',
    titulo: 'Institucional',
    links: [
      { texto: 'Sobre nós', href: '#' },
      { texto: 'Como funciona', href: '#' },
      { texto: 'Regras para anunciar', href: '#' },
    ],
  },
  {
    id: 'conta',
    titulo: 'Minha conta',
    links: [
      { texto: 'Meus anúncios', para: '/perfil' },
      { texto: 'Favoritos', para: '/favoritos' },
      { texto: 'Mensagens', para: '/conversas' },
    ],
  },
  {
    id: 'ajuda',
    titulo: 'Ajuda',
    links: [
      { texto: 'Perguntas frequentes', href: '#' },
      { texto: 'Dicas de segurança', href: '#' },
      { texto: 'Fale conosco', href: '#' },
    ],
  },
];

function LinkRodape({ link }) {
  return link.para
    ? <Link to={link.para}>{link.texto}</Link>
    : <a href={link.href}>{link.texto}</a>;
}

/** Rodapé escuro. No celular as 3 colunas viram sanfonas (abrir/fechar). */
export default function RodapeMarketplace() {
  const ehCelular = useMediaQuery(CELULAR);
  const [abertas, setAbertas] = useState({});

  const alternar = (id) => setAbertas((atual) => ({ ...atual, [id]: !atual[id] }));

  return (
    <footer className="mkt-rodape">
      <div className="mkt-rodape-in">
        <div className="mkt-rodape-cols">
          <div className="mkt-rodape-marca">
            <img className="mkt-rodape-logo" src={logoNegativo} alt="DesapegaUai" width="206" height="44" loading="lazy" />
            <p className="mkt-rodape-desc">Compre e venda com gente do seu bairro, em Viçosa e região.</p>
            <Link className="mkt-rodape-cta" to="/anunciar">
              <Icone nome="mais" tamanho={18} cor="#15290D" espessura={2.2} />
              Anunciar grátis
            </Link>
          </div>

          {COLUNAS.map((col) => {
            const aberta = ehCelular && !!abertas[col.id];
            const idLista = `rodape-lista-${col.id}`;
            return (
              <div key={col.id} className={`mkt-rodape-col${aberta ? ' aberta' : ''}`}>
                <h3 className="mkt-rodape-tit">
                  {ehCelular ? (
                    <button
                      type="button"
                      className="mkt-rodape-tit-btn"
                      aria-expanded={aberta}
                      aria-controls={idLista}
                      onClick={() => alternar(col.id)}
                    >
                      {col.titulo}
                      <Icone nome="seta-baixo" tamanho={20} cor="#C0C7BD" espessura={1.8} />
                    </button>
                  ) : (
                    col.titulo
                  )}
                </h3>
                <div className="mkt-rodape-lista" id={idLista}>
                  {col.links.map((link) => <LinkRodape key={link.texto} link={link} />)}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mkt-rodape-seg">
          <span className="mkt-rodape-seg-ic">
            <Icone nome="escudo" tamanho={22} cor="#82C03A" espessura={1.7} />
          </span>
          <div className="mkt-rodape-seg-txt">
            <p>
              <b>Negocie com segurança.</b> O DesapegaUai não intermedia pagamentos nem entregas.
              Combine tudo direto com o anunciante, nunca pague adiantado e prefira encontros em
              locais públicos.
            </p>
            <a className="mkt-rodape-seg-link" href="#">Ver dicas de segurança</a>
          </div>
        </div>
      </div>

      <div className="mkt-rodape-base">
        <div className="mkt-rodape-base-in">
          <span className="mkt-rodape-copy">© {new Date().getFullYear()} DesapegaUai. Todos os direitos reservados.</span>
          <nav className="mkt-rodape-links" aria-label="Links legais">
            <a href="#">Termos de uso</a>
            <a href="#">Política de privacidade</a>
          </nav>
          <div className="mkt-rodape-local">
            <span className="mkt-rodape-cidade">
              <Icone nome="local" tamanho={18} cor="#82C03A" espessura={1.7} />
              Viçosa e região
            </span>
            <a
              className="mkt-rodape-social"
              href="https://instagram.com/desapegauai"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram do DesapegaUai (abre em nova aba)"
            >
              <Icone nome="instagram" tamanho={20} cor="#CCD2CA" espessura={1.7} />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
