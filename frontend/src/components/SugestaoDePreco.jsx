import { useEffect, useState } from 'react';
import BrilhoIA from './BrilhoIA.jsx';
import { formatarPreco, textoParaPreco } from '../services/formatar.js';
import { origemDaBusca, useLocalizacao } from '../services/localizacao.js';
import { sugerirPreco } from '../services/mercadoApi.js';

const ESPERA_MS = 600; // espera a pessoa parar de digitar o título

/**
 * Sugestão de preço ao anunciar (faixa embaixo do preço, opção A): a IA do DesapegaUai entende o produto
 * pelo título e mostra a faixa de preço dos parecidos perto de onde ele está, se o preço digitado está
 * acima ou abaixo da média e um botão para usar o preço sugerido. Sem produto reconhecido ou com menos de
 * 3 parecidos, não aparece nada.
 */
export default function SugestaoDePreco({ titulo, condicao, cidadeId, bairroId, anuncioId, precoDigitado, onUsar }) {
  const local = useLocalizacao();
  const limpo = titulo.trim();
  const ondeEsta = bairroId ? { bairro_id: bairroId } : cidadeId ? { cidade_id: cidadeId } : origemDaBusca(local);
  const consulta = limpo.length >= 3
    ? JSON.stringify({ titulo: limpo, condicao: condicao ? condicao.toLowerCase() : undefined, ...ondeEsta, raio_km: 30, anuncio_id: anuncioId ?? undefined })
    : null;
  const [resultado, setResultado] = useState({ consulta: null, dados: null });

  useEffect(() => {
    if (!consulta) return undefined;
    const controle = new AbortController();
    const relogio = setTimeout(() => {
      sugerirPreco(JSON.parse(consulta), { sinal: controle.signal })
        .then((dados) => setResultado({ consulta, dados }))
        .catch(() => {}); // sem conexão: o formulário continua normal, só sem a sugestão
    }, ESPERA_MS);
    return () => {
      clearTimeout(relogio);
      controle.abort();
    };
  }, [consulta]);

  const dados = resultado.consulta === consulta ? resultado.dados : null;
  if (!dados?.sugestao) return null;

  const { de, ate, preco, media } = dados.sugestao;
  const digitado = textoParaPreco(precoDigitado);
  const diferenca = digitado > 0 ? Math.round(((digitado - media) / media) * 100) : null;
  const posicao = diferenca === null ? null : Math.abs(diferenca) < 5 ? 'media' : diferenca > 0 ? 'acima' : 'abaixo';
  const frase = {
    media: 'Seu preço está na média.',
    acima: `Seu preço está ${diferenca}% acima da média.`,
    abaixo: `Seu preço está ${-diferenca}% abaixo da média.`,
  }[posicao];
  const parecidos = `${dados.total} ${dados.tipo.plural.toLowerCase()} parecid${dados.tipo.genero === 'a' ? 'as' : 'os'}`;

  return (
    <div className="cad-sugestao" role="status" aria-live="polite">
      <span className="cad-sugestao-ia" aria-hidden="true"><BrilhoIA tamanho={18} cor="#fff" /></span>
      <div className="cad-sugestao-txt">
        <p className="cad-sugestao-faixa">A IA sugere entre <b>{formatarPreco(de)}</b> e <b>{formatarPreco(ate)}</b></p>
        <p className="cad-sugestao-base">{parecidos} perto de você{dados.mesmo_estado ? ', no mesmo estado' : ''}</p>
        {frase && <p className={`cad-sugestao-comparacao ${posicao}`}>{frase}</p>}
      </div>
      {digitado !== preco && (
        <button type="button" className="cad-sugestao-usar" onClick={() => onUsar(preco)}>Usar {formatarPreco(preco)}</button>
      )}
    </div>
  );
}
