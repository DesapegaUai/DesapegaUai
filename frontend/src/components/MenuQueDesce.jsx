import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router';
import Icone from './IconeMarketplace.jsx';
import MenuCidade from './MenuCidade.jsx';
import ContextoNotificacoes from './NotificacoesAnunciosContext.js';
import useGaveta from '../hooks/useGaveta.js';
import useSair from '../hooks/useSair.js';
import { CATEGORIAS, caminhoCategoria } from '../services/categorias.js';
import { posicaoDoMenu } from '../services/cidade.js';
import { nomeDaReferencia, useLocalizacao } from '../services/localizacao.js';
import { carregarPerfil, usePerfil } from '../services/perfil.js';
import '../styles/marketplace-menu-desce.css';

const COR = '#3E8B22';

// atalhos em grade (o da página atual fica em destaque) e a linha de baixo, com Favoritos e Procura-se
const ATALHOS = [
  { para: '/', icone: 'inicio', rotulo: 'Início', ativo: (p) => p === '/' },
  { para: '/anuncios', icone: 'grade', rotulo: 'Anúncios', ativo: (p) => p === '/anuncios' },
  { para: '/meus-anuncios', icone: 'etiqueta', rotulo: 'Meus anúncios', ativo: (p) => p.startsWith('/meus-anuncios') },
];
const LINKS = [
  { para: '/favoritos', icone: 'favorito', rotulo: 'Favoritos' },
  { para: '/procura-se', icone: 'busca', rotulo: 'Procura-se' },
];

// o brilho do "Uai" do logo, no canto do cartão da pessoa
const Brilho = () => (
  <svg className="mqd-brilho" viewBox="0 0 40 40" aria-hidden="true">
    <path d="M21 3v11M7.5 9.5l7.5 7.5M34.5 9.5 27 17" />
  </svg>
);

/**
 * Menu do celular e do tablet (botão ☰ do cabeçalho): a caixa desce logo abaixo do cabeçalho.
 * O sininho e as mensagens ficam fora, à vista no cabeçalho, com o número de novos. Aqui ficam:
 * o cartão da pessoa (ou o convite para entrar), os atalhos, a cidade, as categorias e o Anunciar.
 *
 * topo: onde o cabeçalho termina, em px (null = fechado). botaoRef: o ☰, para onde o foco volta.
 * onFechar precisa ser estável (useCallback).
 */
export default function MenuQueDesce({ topo, onFechar, botaoRef }) {
  const aberto = topo !== null && topo !== undefined;
  const { pathname } = useLocation();
  const primeiroRef = useRef(null);
  const [menuCidade, setMenuCidade] = useState(null);
  const fecharCidade = useCallback(() => setMenuCidade(null), []);
  const logado = Boolean(useContext(ContextoNotificacoes)?.logado);
  const perfil = usePerfil();
  const local = useLocalizacao();
  const nomeDaCidade = nomeDaReferencia(local);
  const sair = useSair();
  useGaveta(aberto, onFechar, primeiroRef);

  // o cartão mostra o nome e a foto: se a pessoa ainda não abriu o perfil nesta visita, busca agora
  useEffect(() => {
    if (aberto && logado && !perfil.nome) carregarPerfil().catch(() => {});
  }, [aberto, logado, perfil.nome]);

  // a cidade abre o mesmo menu de localização do computador, logo abaixo do ☰
  function trocarCidade() {
    const posicao = botaoRef?.current ? posicaoDoMenu(botaoRef.current) : { top: topo + 8, left: 8 };
    onFechar();
    setMenuCidade(posicao);
  }

  return (
    <>
      {aberto && (
        <>
          <div className="mqd-fundo" style={{ top: topo }} onClick={onFechar} aria-hidden="true" />
          <nav className="mqd" id="menu-que-desce" aria-label="Menu" style={{ top: topo }}>
            <Link ref={primeiroRef} className="mqd-pessoa" to={logado ? '/perfil' : '/entrar'} onClick={onFechar}>
              <Brilho />
              <span className="mqd-avatar" aria-hidden="true">
                {!logado && <Icone nome="perfil" tamanho={24} cor="#fff" espessura={1.9} />}
                {logado && (perfil.foto_url ? <img src={perfil.foto_url} alt="" /> : perfil.iniciais)}
              </span>
              <span className="mqd-pessoa-txt">
                <b>{logado ? perfil.nome || 'Minha conta' : 'Entre na sua conta'}</b>
                <small>{logado ? 'Ver meu perfil' : 'Para anunciar, conversar e salvar'}</small>
              </span>
              <span className="mqd-pessoa-seta" aria-hidden="true"><Icone nome="seta-direita" tamanho={18} cor="#fff" espessura={2} /></span>
            </Link>

            <div className="mqd-grade">
              {ATALHOS.map((atalho) => {
                const ativo = atalho.ativo(pathname);
                return (
                  <Link key={atalho.para} className={`mqd-atalho${ativo ? ' ativo' : ''}`} to={atalho.para} aria-current={ativo ? 'page' : undefined} onClick={onFechar}>
                    <span className="mqd-atalho-ic"><Icone nome={atalho.icone} tamanho={23} cor={ativo ? '#fff' : COR} espessura={1.8} /></span>
                    {atalho.rotulo}
                  </Link>
                );
              })}
            </div>

            <div className="mqd-links">
              {LINKS.map((link) => (
                <Link key={link.para} className={`mqd-link${pathname.startsWith(link.para) ? ' ativo' : ''}`} to={link.para} onClick={onFechar}>
                  <span className="mqd-link-ic"><Icone nome={link.icone} tamanho={18} cor={COR} espessura={1.8} /></span>
                  <span className="mqd-link-txt">{link.rotulo}</span>
                  <Icone nome="seta-direita" tamanho={16} cor="#9AA79A" espessura={2} />
                </Link>
              ))}
            </div>

            <div className="mqd-cidade">
              <span className="mqd-cidade-ic"><Icone nome="local" tamanho={20} cor={COR} espessura={1.8} /></span>
              <span className="mqd-cidade-txt">
                <b>{nomeDaCidade}</b>
                <small>anúncios até {local.raioKm} km</small>
              </span>
              <button type="button" className="mqd-trocar" aria-label={`Localização: ${nomeDaCidade}. Trocar`} onClick={trocarCidade}>
                <Icone nome="trocar" tamanho={15} cor={COR} espessura={2} />
                Trocar
              </button>
            </div>

            <p className="mqd-rotulo" id="mqd-categorias">Categorias</p>
            <ul className="mqd-chips" aria-labelledby="mqd-categorias">
              {CATEGORIAS.map((categoria) => (
                <li key={categoria.slug}>
                  <Link className="mqd-chip" to={caminhoCategoria(categoria.slug)} onClick={onFechar}>
                    <span className="mqd-chip-ic"><Icone nome={categoria.icone} tamanho={16} cor={COR} espessura={1.7} /></span>
                    {categoria.nome}
                  </Link>
                </li>
              ))}
            </ul>

            <Link className="mqd-anunciar" to="/anunciar" onClick={onFechar}>
              <span className="mqd-anunciar-ic"><Icone nome="mais" tamanho={16} cor={COR} espessura={2.6} /></span>
              Anunciar grátis
            </Link>

            {logado && (
              <button type="button" className="mqd-sair" onClick={() => { onFechar(); sair(); }}>
                <Icone nome="sair" tamanho={17} cor="#8C968D" espessura={1.7} />
                Sair da conta
              </button>
            )}
          </nav>
        </>
      )}
      {menuCidade && <MenuCidade posicao={menuCidade} ancoraRef={botaoRef} onFechar={fecharCidade} />}
    </>
  );
}
