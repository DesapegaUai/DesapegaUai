import { useState } from 'react';
import Icone from './IconeMarketplace.jsx';
import {
  RAIOS, TEXTO_DO_STATUS, ativarGps, definirRaio, nomeDaReferencia, useLocalizacao,
} from '../services/localizacao.js';
import '../styles/marketplace-raio.css';

const AVISOS = ['negada', 'indisponivel', 'tempo_esgotado', 'sem_suporte', 'inseguro', 'fora_da_area', 'pedindo'];

/**
 * De onde a busca mede a distância e até quantos km. Mudar o raio refaz a busca sem recarregar.
 * Sem GPS, a referência é a cidade e o bairro escolhidos no botão de localização do topo.
 */
export default function BarraDeRaio({ total, carregando, semConexao }) {
  const local = useLocalizacao();
  const [outro, setOutro] = useState('');
  const [erro, setErro] = useState('');
  const usandoGps = local.modo === 'gps' && local.posicao;

  function aplicarOutro(e) {
    e.preventDefault();
    if (definirRaio(outro)) { setOutro(''); setErro(''); } else setErro('Use um número inteiro de 1 a 300.');
  }

  return (
    <section className="raio-barra" aria-label="Distância da busca">
      <div className="raio-ref">
        <Icone nome="local" tamanho={18} cor="#3E8B22" />
        <span>
          <b>{nomeDaReferencia(local)}</b>
          <i>
            {carregando ? 'Atualizando…' : typeof total === 'number' ? `${total} ${total === 1 ? 'anúncio' : 'anúncios'} em até ${local.raioKm} km` : `Até ${local.raioKm} km`}
            {usandoGps && local.posicao.precisao_m > 200 && ' · localização imprecisa'}
          </i>
        </span>
        {!usandoGps && (
          <button type="button" className="raio-gps" onClick={ativarGps}>Usar minha localização</button>
        )}
      </div>

      <div className="raio-opcoes" role="radiogroup" aria-label="Distância máxima">
        {RAIOS.map((km) => (
          <button key={km} type="button" role="radio" aria-checked={local.raioKm === km} className={local.raioKm === km ? 'on' : undefined} onClick={() => definirRaio(km)}>
            {km} km
          </button>
        ))}
        <form className="raio-outro" onSubmit={aplicarOutro} noValidate>
          <label htmlFor="raio-outro-barra" className="oculto">Outro raio em km</label>
          <input id="raio-outro-barra" type="number" min="1" max="300" step="1" inputMode="numeric" placeholder={RAIOS.includes(local.raioKm) ? 'Outro' : `${local.raioKm} km`} value={outro} onChange={(e) => setOutro(e.target.value)} />
          <button type="submit" aria-label="Usar esse raio">OK</button>
        </form>
      </div>

      {AVISOS.includes(local.status) && <p className="raio-aviso" role="status">{TEXTO_DO_STATUS[local.status]}</p>}
      {erro && <p className="raio-aviso" role="alert">{erro}</p>}
      {semConexao && <p className="raio-aviso" role="status">Sem conexão em tempo real. Mostrando os últimos resultados.</p>}
    </section>
  );
}
