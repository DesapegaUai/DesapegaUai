import { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router';
import CardAnuncio from '../components/CardAnuncioMarketplace.jsx';
import LayoutMarketplace from '../components/LayoutMarketplace.jsx';
import Icone from '../components/IconeMarketplace.jsx';
import { Estrelas } from '../components/Estrelas.jsx';
import SeloVinculo from '../components/SeloVinculo.jsx';
import { carregarAvaliacoesUsuario, reputacao, resumoDe, rotuloDaQualidade, textoDaMedia, useAvaliacoes } from '../services/avaliacoes.js';
import { textoDoUltimoAcesso, verPerfilPublico } from '../services/mercadoApi.js';
import { useSessao } from '../services/sessao.js';
import '../styles/marketplace-avaliacao.css';
import '../styles/marketplace-perfil-publico.css';

const PRIMEIROS_ANUNCIOS = 8; // o resto aparece no botão "Ver todos"

/**
 * Perfil público de um vendedor (/usuario/:id): foto, nome, bio, reputação, avaliações e anúncios ativos.
 * Abre pelo nome ou pela foto da pessoa no chat e no anúncio. Telefone e e-mail não aparecem.
 */
export default function PerfilPublico() {
  const { id } = useParams();
  const { usuario: eu } = useSessao();
  const valido = /^\d+$/.test(String(id));
  const [resultado, setResultado] = useState(null);
  const [avaliacoesDe, setAvaliacoesDe] = useState(null);
  const [todosDe, setTodosDe] = useState(null); // id do perfil em que a pessoa pediu para ver todos os anúncios
  const usuarioId = Number(id);
  const notas = resumoDe(useAvaliacoes(), usuarioId);

  useEffect(() => {
    if (!valido) return undefined;
    let ativo = true;
    verPerfilPublico(id)
      .then((dados) => { if (ativo) setResultado({ id, ...dados, erro: null }); })
      .catch((erro) => { if (ativo) setResultado({ id, usuario: null, anuncios: [], erro: erro.message }); });
    carregarAvaliacoesUsuario(Number(id))
      .catch(() => {})
      .finally(() => { if (ativo) setAvaliacoesDe(id); });
    return () => { ativo = false; };
  }, [id, valido]);

  const atual = resultado?.id === id ? resultado : null;
  const carregando = valido && !atual;
  const pessoa = atual?.usuario;

  useEffect(() => {
    document.title = `DesapegaUai — ${pessoa?.nome ?? (carregando ? 'Carregando' : 'Perfil não encontrado')}`;
  }, [pessoa?.nome, carregando]);

  // o meu próprio perfil tem a tela completa, com os meus dados
  if (eu && valido && Number(eu.id) === usuarioId) return <Navigate to="/perfil" replace />;

  if (!pessoa) {
    return (
      <LayoutMarketplace comFab={false}>
        <div className="pub-vazio">
          <Icone nome="perfil" tamanho={40} cor="#4CA02B" />
          <h1>{carregando ? 'Carregando perfil…' : 'Perfil não encontrado'}</h1>
          <p>{atual?.erro || (carregando ? 'Aguarde um instante.' : 'Essa pessoa não está mais no DesapegaUai.')}</p>
          <Link to="/busca">Ver anúncios perto de você</Link>
        </div>
      </LayoutMarketplace>
    );
  }

  const primeiroNome = pessoa.nome.split(' ')[0];
  const carregandoNotas = avaliacoesDe !== id;
  const verTodos = todosDe === id;
  const anuncios = verTodos ? atual.anuncios : atual.anuncios.slice(0, PRIMEIROS_ANUNCIOS);

  return (
    <LayoutMarketplace comFab={false}>
      <div className="pub">
        <section className="pub-topo" aria-label={`Perfil de ${pessoa.nome}`}>
          {pessoa.foto
            ? <img className="pub-avatar" src={pessoa.foto} alt="" referrerPolicy="no-referrer" />
            : <span className="pub-avatar" aria-hidden="true">{pessoa.iniciais}</span>}
          <div className="pub-quem">
            <h1>{pessoa.nome}</h1>
            {pessoa.vinculo_academico && <p className="pub-vinculo"><SeloVinculo /></p>}
            <p className="pub-status">
              {pessoa.online && <span className="pub-online" />}
              {pessoa.online ? 'Online agora' : textoDoUltimoAcesso(pessoa.ultimo_acesso)}
              {pessoa.desde && <span> · Membro desde {pessoa.desde}</span>}
            </p>
            <p className="pub-reputacao">
              {!carregandoNotas && <span className="pub-selo" title="Reputação, pela média das avaliações">Reputação: {reputacao(notas)}</span>}
              {notas.qtd ? (
                <><Estrelas nota={notas.media} /><b>{textoDaMedia(notas.media)}</b><span>· {notas.qtd} {notas.qtd === 1 ? 'avaliação' : 'avaliações'}</span>
                  <span className="oculto">Nota média {textoDaMedia(notas.media)} de 5</span></>
              ) : carregandoNotas ? 'Carregando avaliações…' : 'Ainda sem avaliações'}
            </p>
            {pessoa.compromisso?.respostas > 0 && (
              <p className="pub-reputacao">
                <span className="pub-selo" title="Depois de cada venda, a outra pessoa diz se o combinado foi cumprido">Compromisso nas entregas: {pessoa.compromisso.taxa}%</span>
                <span>compareceu em {pessoa.compromisso.compareceu} de {pessoa.compromisso.respostas} {pessoa.compromisso.respostas === 1 ? 'negociação' : 'negociações'}</span>
              </p>
            )}
            {pessoa.bio && <p className="pub-bio">{pessoa.bio}</p>}
          </div>
          <dl className="pub-numeros">
            <div>
              <span className="pub-num-ic" aria-hidden="true"><Icone nome="etiqueta" tamanho={20} cor="#3E8B22" espessura={1.8} /></span>
              <dd>{pessoa.total_anuncios_ativos}</dd>
              <dt>{pessoa.total_anuncios_ativos === 1 ? 'Anúncio ativo' : 'Anúncios ativos'}</dt>
            </div>
            <div>
              <span className="pub-num-ic" aria-hidden="true"><Icone nome="sacola" tamanho={20} cor="#3E8B22" espessura={1.8} /></span>
              <dd>{pessoa.total_vendidos}</dd>
              <dt>{pessoa.total_vendidos === 1 ? 'Vendido' : 'Vendidos'}</dt>
            </div>
            <div>
              <span className="pub-num-ic" aria-hidden="true"><Icone nome="estrela" tamanho={20} cor="#3E8B22" espessura={1.8} /></span>
              <dd>{carregandoNotas ? '…' : notas.qtd}</dd>
              <dt>{notas.qtd === 1 ? 'Avaliação' : 'Avaliações'}</dt>
            </div>
          </dl>
        </section>

        <p className="pub-privado">
          <Icone nome="cadeado" tamanho={18} cor="#3E8B22" />
          O telefone e o e-mail de {primeiroNome} não aparecem aqui. O contato é feito somente pelo chat, a partir de um anúncio.
        </p>

        <section aria-labelledby="pub-anuncios">
          <h2 id="pub-anuncios">Anúncios de {primeiroNome}</h2>
          {atual.anuncios.length ? (
            <>
              <div className="grade g4">
                {anuncios.map((anuncio) => <CardAnuncio key={anuncio.id} anuncio={anuncio} />)}
              </div>
              {!verTodos && atual.anuncios.length > PRIMEIROS_ANUNCIOS && (
                <button type="button" className="pub-mais" onClick={() => setTodosDe(id)}>
                  Ver todos os {atual.anuncios.length} anúncios
                </button>
              )}
            </>
          ) : <p className="pub-nada">{primeiroNome} não tem anúncios ativos no momento.</p>}
        </section>

        <section aria-labelledby="pub-avaliacoes">
          <h2 id="pub-avaliacoes">Avaliações recebidas</h2>
          {notas.qtd === 0 ? (
            <p className="pub-nada">{carregandoNotas ? 'Carregando avaliações…' : `${primeiroNome} ainda não recebeu avaliações.`}</p>
          ) : (
            <ul className="pub-avals">
              {notas.lista.map((a) => (
                <li key={a.id}>
                  <div className="pub-aval-cab">
                    <span className="pub-aval-av" aria-hidden="true">{a.autor.split(' ').slice(0, 2).map((p) => p[0]).join('')}</span>
                    <span className="pub-aval-nm"><b>{a.autor}</b><small>{a.anuncio} · {a.quando}</small></span>
                    <Estrelas nota={a.nota} tamanho={14} /><span className="oculto">Nota {a.nota} de 5</span>
                  </div>
                  {a.qualidades.length > 0 && (
                    <ul className="aval-marcadas">{a.qualidades.map((q) => <li key={q}>{rotuloDaQualidade(q)}</li>)}</ul>
                  )}
                  {a.comentario && <p>“{a.comentario}”</p>}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </LayoutMarketplace>
  );
}
