import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Icone from './IconeMarketplace.jsx';
import {
  RAIOS, TEXTO_DO_STATUS, ativarGps, atualizarAgora, definirRaio, desativarGps, motivoSemGps, useLocalizacao, usarLocalManual,
} from '../services/localizacao.js';
import { bairrosDaCidade, listarCidades, nomeDoBairro, simplificar } from '../services/locais.js';
import '../styles/marketplace-cidade.css';

/**
 * Menu do botão de localização: usar o GPS (com a permissão do navegador), escolher o raio e,
 * sem GPS, escolher a cidade e o bairro entre os 142 municípios da Zona da Mata mineira.
 */
export default function MenuCidade({ posicao, ancoraRef, onFechar }) {
  const local = useLocalizacao();
  const menuRef = useRef(null);
  const [cidades, setCidades] = useState([]);
  const [bairros, setBairros] = useState([]);
  const [filtro, setFiltro] = useState('');
  const [raioLivre, setRaioLivre] = useState('');
  const [erro, setErro] = useState('');
  const semGps = motivoSemGps();
  const gpsLigado = local.modo === 'gps';

  useEffect(() => {
    listarCidades().then(setCidades).catch((falha) => setErro(falha.message));
  }, []);

  useEffect(() => {
    let ativo = true;
    if (local.cidade?.id) {
      bairrosDaCidade(local.cidade.id)
        .then((lista) => { if (ativo) setBairros(lista); })
        .catch(() => { if (ativo) setBairros([]); });
    }
    return () => { ativo = false; };
  }, [local.cidade?.id]);

  useEffect(() => {
    const clicouFora = (e) => {
      if (!menuRef.current?.contains(e.target) && !ancoraRef.current?.contains(e.target)) onFechar();
    };
    const tecla = (e) => {
      if (e.key === 'Escape') { onFechar(); ancoraRef.current?.focus(); }
    };
    // fecha só se a largura mudar (o celular virou): o teclado e a barra do navegador do celular mudam só a
    // altura, e fechar com eles fecharia o menu ao tocar na busca de cidade
    const larguraInicial = window.innerWidth;
    const mudouTamanho = () => { if (window.innerWidth !== larguraInicial) onFechar(); };
    document.addEventListener('mousedown', clicouFora);
    document.addEventListener('keydown', tecla);
    window.addEventListener('resize', mudouTamanho);
    return () => {
      document.removeEventListener('mousedown', clicouFora);
      document.removeEventListener('keydown', tecla);
      window.removeEventListener('resize', mudouTamanho);
    };
  }, [ancoraRef, onFechar]);

  const visiveis = useMemo(() => {
    const termo = simplificar(filtro);
    return termo ? cidades.filter((c) => simplificar(c.nome).includes(termo)).slice(0, 40) : cidades.slice(0, 40);
  }, [cidades, filtro]);

  function escolherCidade(cidade) {
    setFiltro('');
    usarLocalManual({ id: cidade.id, nome: cidade.nome });
  }

  function escolherBairro(id) {
    const bairro = bairros.find((b) => String(b.id) === id) ?? null;
    usarLocalManual(local.cidade, bairro ? { id: bairro.id, nome: bairro.nome } : null);
  }

  function aplicarRaioLivre(e) {
    e.preventDefault();
    if (!definirRaio(raioLivre)) setErro('O raio precisa ser um número inteiro de 1 a 300 km.');
    else { setErro(''); setRaioLivre(''); }
  }

  const status = gpsLigado || ['negada', 'indisponivel', 'sem_suporte', 'inseguro', 'fora_da_area'].includes(local.status)
    ? TEXTO_DO_STATUS[local.status] : null;

  return createPortal(
    <div className="telas-marketplace">
      <div className="cidade-menu local-menu" role="dialog" aria-label="Localização da busca" ref={menuRef} style={{ ...posicao, '--topo': `${posicao.top}px` }}>
        <section className="local-bloco" aria-labelledby="local-gps">
          <p className="cidade-titulo" id="local-gps">Perto de mim</p>
          {gpsLigado ? (
            <div className="local-gps-acoes">
              <button type="button" className="local-acao" onClick={atualizarAgora}>
                <Icone nome="local" tamanho={18} cor="#3E8B22" /><span>Atualizar minha localização</span>
              </button>
              <button type="button" className="local-acao discreta" onClick={desativarGps}>
                <Icone nome="fechar" tamanho={16} cor="#6B726C" /><span>Desligar localização</span>
              </button>
            </div>
          ) : (
            <button type="button" className="local-acao destaque" onClick={ativarGps} disabled={Boolean(semGps)}>
              <Icone nome="local" tamanho={18} cor="#fff" /><span>Usar minha localização</span>
            </button>
          )}
          {status && <p className={`local-status ${local.status}`} role="status">{status}</p>}
          {gpsLigado && local.posicao && (
            <p className="local-precisao">Precisão de {local.posicao.precisao_m} m · medida às {new Date(local.posicao.capturada_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
          )}
          {!gpsLigado && !status && (
            <p className="local-ajuda">O navegador vai pedir sua permissão. Você pode recusar e escolher a cidade abaixo.</p>
          )}
        </section>

        <section className="local-bloco" aria-labelledby="local-raio">
          <p className="cidade-titulo" id="local-raio">Distância máxima</p>
          <div className="local-raios" role="radiogroup" aria-labelledby="local-raio">
            {RAIOS.map((km) => (
              <button key={km} type="button" role="radio" aria-checked={local.raioKm === km} className={`local-raio${local.raioKm === km ? ' on' : ''}`} onClick={() => definirRaio(km)}>
                {km} km
              </button>
            ))}
          </div>
          <form className="local-raio-livre" onSubmit={aplicarRaioLivre} noValidate>
            <label htmlFor="raio-livre">Outro raio (km)</label>
            <input id="raio-livre" type="number" inputMode="numeric" min="1" max="300" step="1" placeholder={RAIOS.includes(local.raioKm) ? 'Ex.: 8' : String(local.raioKm)} value={raioLivre} onChange={(e) => setRaioLivre(e.target.value)} />
            <button type="submit">Usar</button>
          </form>
        </section>

        <section className="local-bloco" aria-labelledby="local-manual">
          <p className="cidade-titulo" id="local-manual">{gpsLigado ? 'Ou escolha um lugar' : 'Cidade e bairro'}</p>
          <label htmlFor="local-busca-cidade" className="oculto">Buscar cidade da Zona da Mata</label>
          <input id="local-busca-cidade" className="local-busca" type="search" placeholder="Buscar cidade" value={filtro} onChange={(e) => setFiltro(e.target.value)} autoComplete="off" />
          <div className="local-cidades" role="listbox" aria-label="Cidades da Zona da Mata mineira">
            {visiveis.map((c) => {
              const on = !gpsLigado && c.id === local.cidade?.id;
              return (
                <button type="button" role="option" aria-selected={on} className={on ? 'on' : undefined} key={c.id} onClick={() => escolherCidade(c)}>
                  <Icone nome="local" tamanho={17} cor={on ? '#3E8B22' : '#8C918B'} />
                  <span>{c.nome}</span>
                  {on && <Icone nome="check" tamanho={17} cor="#3E8B22" espessura={2.2} />}
                </button>
              );
            })}
            {cidades.length > 0 && visiveis.length === 0 && <p className="local-ajuda">Nenhuma cidade da Zona da Mata com esse nome.</p>}
          </div>
          {!gpsLigado && bairros.length > 0 && (
            <div className="local-bairro">
              <label htmlFor="local-bairro">Bairro em {local.cidade.nome} (opcional)</label>
              <select id="local-bairro" value={local.bairro?.id ?? ''} onChange={(e) => escolherBairro(e.target.value)}>
                <option value="">Cidade toda (a partir do centro)</option>
                {bairros.map((b) => <option key={b.id} value={b.id}>{nomeDoBairro(b)}</option>)}
              </select>
            </div>
          )}
        </section>
        {erro && <p className="local-status negada" role="alert">{erro}</p>}
      </div>
    </div>,
    document.body,
  );
}
