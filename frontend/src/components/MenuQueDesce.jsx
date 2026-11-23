import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
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

/**
 * Menu do celular e do tablet (botão ☰ do cabeçalho): a caixa desce logo abaixo do cabeçalho.
 * O sininho e as mensagens ficam fora, à vista no cabeçalho, com o número de novos. Aqui ficam:
 * o cartão da pessoa (ou o convite para entrar), os atalhos em grade, a cidade, as categorias e o Anunciar.
 *
 * topo: onde o cabeçalho termina, em px (null = fechado). botaoRef: o ☰, para onde o foco volta.
 * onFechar precisa ser estável (useCallback).
 */
export default function MenuQueDesce({ topo, onFechar, botaoRef }) {
  const aberto = topo !== null && topo !== undefined;
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

  const atalhos = logado
    ? [['/favoritos', 'favorito', 'Favoritos'], ['/meus-anuncios', 'etiqueta', 'Meus anúncios'], ['/procura-se', 'busca', 'Procura-se']]
    : [['/favoritos', 'favorito', 'Favoritos'], ['/procura-se', 'busca', 'Procura-se'], ['/ajuda', 'ajuda', 'Ajuda']];

  return (
    <>
      {aberto && (
        <>
          <div className="mqd-fundo" style={{ top: topo }} onClick={onFechar} aria-hidden="true" />
          <nav className="mqd" id="menu-que-desce" aria-label="Menu" style={{ top: topo }}>
            {logado ? (
              <Link ref={primeiroRef} className="mqd-pessoa" to="/perfil" onClick={onFechar}>
                <span className="mqd-avatar" aria-hidden="true">
                  {perfil.foto_url ? <img src={perfil.foto_url} alt="" /> : perfil.iniciais}
                </span>
                <span className="mqd-pessoa-txt">
                  <b>{perfil.nome || 'Minha conta'}</b>
                  <small>Ver meu perfil ›</small>
                </span>
              </Link>
            ) : (
              <Link ref={primeiroRef} className="mqd-pessoa" to="/entrar" onClick={onFechar}>
                <span className="mqd-avatar" aria-hidden="true"><Icone nome="perfil" tamanho={22} cor="#fff" espessura={1.9} /></span>
                <span className="mqd-pessoa-txt">
                  <b>Entre na sua conta</b>
                  <small>Para anunciar, conversar e salvar ›</small>
                </span>
              </Link>
            )}

            <div className="mqd-grade">
              {atalhos.map(([para, icone, rotulo]) => (
                <Link key={para} className="mqd-atalho" to={para} onClick={onFechar}>
                  <span className="mqd-atalho-ic"><Icone nome={icone} tamanho={22} cor={COR} espessura={1.7} /></span>
                  {rotulo}
                </Link>
              ))}
            </div>

            <div className="mqd-cidade">
              <Icone nome="local" tamanho={22} cor={COR} espessura={1.7} />
              <span className="mqd-cidade-txt">
                <b>{nomeDaCidade}</b>
                <small>anúncios até {local.raioKm} km</small>
              </span>
              <button type="button" className="mqd-trocar" aria-label={`Localização: ${nomeDaCidade}. Trocar`} onClick={trocarCidade}>
                Trocar
              </button>
            </div>

            <p className="mqd-rotulo" id="mqd-categorias">Categorias</p>
            <ul className="mqd-chips" aria-labelledby="mqd-categorias">
              {CATEGORIAS.map((categoria) => (
                <li key={categoria.slug}>
                  <Link className="mqd-chip" to={caminhoCategoria(categoria.slug)} onClick={onFechar}>
                    <Icone nome={categoria.icone} tamanho={18} cor={COR} espessura={1.6} />
                    {categoria.nome}
                  </Link>
                </li>
              ))}
            </ul>

            <Link className="mqd-anunciar" to="/anunciar" onClick={onFechar}>
              <Icone nome="mais" tamanho={20} cor="#fff" espessura={2.2} />
              Anunciar
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
