import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import LayoutPainel from '../components/LayoutPainel.jsx';
import Icone from '../components/IconeMarketplace.jsx';
import Toast from '../components/Toast.jsx';
import { CATEGORIAS } from '../services/categorias.js';
import { CIDADES, bairrosDaCidade } from '../services/locais.js';
import { erroDaFoto, prepararFoto } from '../services/fotosAnuncio.js';
import { formatarPreco } from '../services/formatar.js';
import {
  CONDICOES, ENTREGAS, LIMITES, buscarMeuAnuncio, salvarMeuAnuncio, validarAnuncio,
} from '../services/meusAnuncios.js';
import '../styles/marketplace-cadastro.css';

const DICAS = ['Use fotos reais e bem iluminadas', 'Descreva o produto com detalhes', 'Informe medidas e condições', 'Responda rápido às mensagens'];
const ORDEM_DOS_ERROS = ['fotos', 'titulo', 'categoria', 'condicao', 'preco', 'cidade', 'bairro', 'entrega'];

const precoParaTexto = (preco) => (preco ? String(preco).replace('.', ',') : '');
const textoParaPreco = (texto) => Number(texto.replace(/\./g, '').replace(',', '.')) || 0;
const comChave = (aviso) => ({ ...aviso, chave: Date.now() });
const semCampos = (erros, ...campos) =>
  Object.fromEntries(Object.entries(erros).filter(([campo]) => !campos.includes(campo)));

const formularioDe = (a) => ({
  titulo: a?.titulo ?? '',
  categoria: a?.categoria ?? '',
  condicao: a?.condicao ?? '',
  preco: precoParaTexto(a?.preco),
  descricao: a?.descricao ?? '',
  cidade: a?.cidade ?? '',
  bairro: a?.bairro ?? '',
  entrega: a?.entrega ?? 'retirada',
  fotos: a?.fotos ?? [],
});

function Secao({ numero, titulo, descricao, lateral, children }) {
  return (
    <section className="cad-card cad-sec" aria-labelledby={`cad-sec-${numero}`}>
      <div className="cad-sech">
        <span className="cad-num" aria-hidden="true">{numero}</span>
        <span className="cad-sectx">
          <h2 id={`cad-sec-${numero}`}>{titulo}</h2>
          {descricao && <p>{descricao}</p>}
        </span>
        {lateral && <span className="cad-lateral">{lateral}</span>}
      </div>
      {children}
    </section>
  );
}

function Campo({ id, rotulo, obrigatorio, erro, children }) {
  return (
    <div className="cad-campo">
      <label htmlFor={id}>{rotulo}{obrigatorio && <em aria-hidden="true"> *</em>}</label>
      {children}
      {erro && <p className="cad-erro" id={`${id}-erro`}>{erro}</p>}
    </div>
  );
}

function Selecao({ id, valor, onMudar, opcoes, vazio, erro, desativado }) {
  return (
    <div className={`cad-select${erro ? ' invalido' : ''}`}>
      <select
        id={id}
        value={valor}
        disabled={desativado}
        onChange={(e) => onMudar(e.target.value)}
        aria-invalid={Boolean(erro)}
        aria-describedby={erro ? `${id}-erro` : undefined}
      >
        <option value="">{vazio}</option>
        {opcoes.map((o) => <option key={o.valor} value={o.valor}>{o.rotulo}</option>)}
      </select>
      <Icone nome="seta-baixo" tamanho={18} cor="#6B726C" />
    </div>
  );
}

function Formulario({ existente }) {
  const navegar = useNavigate();
  const [form, setForm] = useState(() => formularioDe(existente));
  const [erros, setErros] = useState({});
  const [toast, setToast] = useState(null);
  const [arrastando, setArrastando] = useState(false);
  const [enviandoFotos, setEnviandoFotos] = useState(false);
  const arquivoRef = useRef(null);

  const editandoPublicado = existente?.status === 'ativo';
  const tituloDaTela = editandoPublicado ? 'Editar anúncio' : existente ? 'Continuar rascunho' : 'Cadastrar anúncio';
  const ehServico = form.categoria === 'servicos';
  const preco = textoParaPreco(form.preco);
  const temDados = Boolean(form.titulo.trim() || preco || form.fotos.length);

  const avisar = (aviso) => setToast(comChave(aviso));

  function mudar(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }));
    setErros((e) => semCampos(e, campo));
  }

  function mudarCategoria(categoria) {
    setForm((f) => ({ ...f, categoria, condicao: categoria === 'servicos' ? '' : f.condicao }));
    setErros((e) => semCampos(e, 'categoria', 'condicao'));
  }

  function mudarCidade(cidade) {
    setForm((f) => ({ ...f, cidade, bairro: '' }));
    setErros((e) => semCampos(e, 'cidade'));
  }

  async function adicionarFotos(lista) {
    const arquivos = [...lista];
    if (!arquivos.length) return;
    const vagas = LIMITES.fotos - form.fotos.length;
    if (arquivos.length > vagas) avisar({ tipo: 'erro', titulo: `Você pode adicionar até ${LIMITES.fotos} fotos.` });
    const problema = arquivos.slice(0, vagas).map(erroDaFoto).find(Boolean);
    if (problema) avisar({ tipo: 'erro', titulo: problema });
    const validas = arquivos.slice(0, Math.max(vagas, 0)).filter((a) => !erroDaFoto(a));
    if (!validas.length) return;
    setEnviandoFotos(true);
    try {
      const novas = await Promise.all(validas.map(prepararFoto));
      setForm((f) => ({ ...f, fotos: [...f.fotos, ...novas].slice(0, LIMITES.fotos) }));
      setErros((e) => semCampos(e, 'fotos'));
    } catch {
      avisar({ tipo: 'erro', titulo: 'Não foi possível abrir uma das fotos.', texto: 'Tente outra imagem.' });
    } finally {
      setEnviandoFotos(false);
    }
  }

  function aoSoltar(e) {
    e.preventDefault();
    setArrastando(false);
    adicionarFotos(e.dataTransfer.files);
  }

  const removerFoto = (indice) => mudar('fotos', form.fotos.filter((_, i) => i !== indice));
  const usarComoCapa = (indice) => mudar('fotos', [form.fotos[indice], ...form.fotos.filter((_, i) => i !== indice)]);

  const dadosParaSalvar = () => ({
    ...form,
    id: existente?.id,
    titulo: form.titulo.trim(),
    descricao: form.descricao.trim(),
    preco,
  });

  function salvar(status, aviso, aba) {
    try {
      salvarMeuAnuncio(dadosParaSalvar(), status);
      navegar(`/meus-anuncios?aba=${aba}`, { state: { aviso: comChave(aviso) } });
    } catch (erro) {
      avisar({ tipo: 'erro', titulo: 'Não foi possível salvar.', texto: erro.message });
    }
  }

  function salvarRascunho() {
    if (!temDados && !form.categoria && !form.descricao.trim()) {
      avisar({ tipo: 'info', titulo: 'Preencha algum campo para salvar o rascunho.' });
      return;
    }
    salvar('rascunho', { tipo: 'sucesso', titulo: 'Rascunho salvo', texto: 'Continue quando quiser em Meus anúncios.' }, 'rascunhos');
  }

  function publicar(e) {
    e.preventDefault();
    const encontrados = validarAnuncio(dadosParaSalvar());
    setErros(encontrados);
    const primeiro = ORDEM_DOS_ERROS.find((c) => encontrados[c]);
    if (primeiro) {
      avisar({ tipo: 'erro', titulo: 'Confira os campos destacados.', texto: encontrados[primeiro] });
      const alvo = primeiro === 'fotos' ? 'cad-enviar-fotos' : `cad-${primeiro}`;
      document.getElementById(alvo)?.focus();
      return;
    }
    salvar('ativo', { tipo: 'sucesso', titulo: editandoPublicado ? 'Alterações salvas' : 'Anúncio publicado' }, 'ativos');
  }

  const propsDoCampo = (campo) => ({
    id: `cad-${campo}`,
    'aria-invalid': Boolean(erros[campo]),
    'aria-describedby': erros[campo] ? `cad-${campo}-erro` : undefined,
  });

  const nomeDaCondicao = ehServico ? '' : form.condicao;
  const previa = temDados
    ? {
      foto: form.fotos[0],
      titulo: form.titulo.trim() || 'Título do anúncio',
      preco: preco ? formatarPreco(preco) : 'R$ 0',
      local: form.bairro ? `${form.bairro}, ${form.cidade}` : form.cidade || 'Viçosa, MG',
      entrega: ENTREGAS[form.entrega]?.titulo,
      condicao: nomeDaCondicao,
    }
    : {
      foto: '/img/fotos/mesa.webp',
      titulo: 'Mesa de escritório',
      preco: formatarPreco(250),
      local: 'Viçosa, MG',
      entrega: ENTREGAS.retirada.titulo,
      condicao: 'Usado',
    };

  return (
    <>
      <Toast aviso={toast} onFechar={() => setToast(null)} />
      <form className="cad-form" onSubmit={publicar} noValidate>
        <div className="cad-col">
          <div className="cad-cabeca">
            <h1>{tituloDaTela}</h1>
            <p>Preencha as informações para publicar seu produto.</p>
          </div>

          <Secao numero={1} titulo="Upload de fotos" descricao="Adicione fotos reais do produto para atrair mais compradores." lateral={`Adicione até ${LIMITES.fotos} fotos.`}>
            <button
              type="button"
              id="cad-enviar-fotos"
              className={`cad-drop${arrastando ? ' ativo' : ''}${erros.fotos ? ' invalido' : ''}`}
              onClick={() => arquivoRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setArrastando(true); }}
              onDragLeave={() => setArrastando(false)}
              onDrop={aoSoltar}
              aria-describedby={erros.fotos ? 'cad-fotos-erro' : undefined}
            >
              <Icone nome="upload" tamanho={32} cor="#3E8B22" />
              <b>{enviandoFotos ? 'Preparando as fotos...' : 'Arraste e solte suas fotos aqui'}</b>
              <span>ou clique para selecionar do seu computador</span>
            </button>
            <input
              ref={arquivoRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="oculto"
              tabIndex={-1}
              aria-hidden="true"
              onChange={(e) => { adicionarFotos(e.target.files); e.target.value = ''; }}
            />
            {erros.fotos && <p className="cad-erro" id="cad-fotos-erro">{erros.fotos}</p>}

            <ul className="cad-slots" aria-label="Fotos do anúncio">
              {Array.from({ length: LIMITES.fotos }, (_, i) => {
                const foto = form.fotos[i];
                return (
                  <li className={`cad-slot${foto ? ' cheio' : ''}`} key={foto ?? `vazio-${i}`}>
                    {foto ? (
                      <>
                        <button type="button" className="cad-capa" onClick={() => usarComoCapa(i)} disabled={i === 0} aria-label={i === 0 ? 'Foto de capa' : `Usar a foto ${i + 1} como capa`}>
                          <img src={foto} alt="" />
                          {i === 0 && <span>Capa</span>}
                        </button>
                        <button type="button" className="cad-tira" onClick={() => removerFoto(i)} aria-label={`Remover a foto ${i + 1}`}>
                          <Icone nome="fechar" tamanho={15} cor="#16281C" espessura={2.2} />
                        </button>
                      </>
                    ) : <Icone nome="imagem" tamanho={24} cor="#B4BBB3" espessura={1.5} />}
                  </li>
                );
              })}
            </ul>
          </Secao>

          <Secao numero={2} titulo="Informações básicas">
            <div className="cad-grade">
              <Campo id="cad-titulo" rotulo="Título do anúncio" obrigatorio erro={erros.titulo}>
                <input
                  {...propsDoCampo('titulo')}
                  className="cad-input"
                  type="text"
                  maxLength={LIMITES.titulo}
                  placeholder="Ex.: Cadeira de Escritório Ergonômica"
                  value={form.titulo}
                  onChange={(e) => mudar('titulo', e.target.value)}
                />
              </Campo>
              <Campo id="cad-categoria" rotulo="Categoria" obrigatorio erro={erros.categoria}>
                <Selecao
                  id="cad-categoria"
                  valor={form.categoria}
                  onMudar={mudarCategoria}
                  vazio="Selecione uma categoria"
                  erro={erros.categoria}
                  opcoes={CATEGORIAS.map((c) => ({ valor: c.slug, rotulo: c.nome }))}
                />
              </Campo>
              <Campo id="cad-condicao" rotulo="Condição do produto" obrigatorio={!ehServico} erro={erros.condicao}>
                <Selecao
                  id="cad-condicao"
                  valor={nomeDaCondicao}
                  onMudar={(v) => mudar('condicao', v)}
                  vazio={ehServico ? 'Não se aplica a serviços' : 'Selecione a condição'}
                  erro={erros.condicao}
                  desativado={ehServico}
                  opcoes={CONDICOES.map((c) => ({ valor: c, rotulo: c }))}
                />
              </Campo>
              <Campo id="cad-preco" rotulo="Preço" obrigatorio erro={erros.preco}>
                <div className={`cad-preco${erros.preco ? ' invalido' : ''}`}>
                  <span aria-hidden="true">R$</span>
                  <input
                    {...propsDoCampo('preco')}
                    type="text"
                    inputMode="decimal"
                    placeholder="Ex.: 250,00"
                    value={form.preco}
                    onChange={(e) => mudar('preco', e.target.value.replace(/[^\d.,]/g, ''))}
                  />
                </div>
              </Campo>
            </div>
          </Secao>

          <Secao numero={3} titulo="Descrição" descricao="Descreva o produto com detalhes para gerar mais confiança.">
            <div className="cad-area">
              <label htmlFor="cad-descricao" className="oculto">Descrição do anúncio</label>
              <textarea
                id="cad-descricao"
                rows={3}
                maxLength={LIMITES.descricao}
                placeholder="Conte detalhes sobre o produto, estado de conservação, medidas, funcionalidades, motivo da venda, etc."
                value={form.descricao}
                onChange={(e) => mudar('descricao', e.target.value)}
              />
              <span>{form.descricao.length}/{LIMITES.descricao} caracteres</span>
            </div>
          </Secao>

          <Secao numero={4} titulo="Localização e entrega">
            <div className="cad-grade">
              <Campo id="cad-cidade" rotulo="Cidade" obrigatorio erro={erros.cidade}>
                <Selecao
                  id="cad-cidade"
                  valor={form.cidade}
                  onMudar={mudarCidade}
                  vazio="Selecione sua cidade"
                  erro={erros.cidade}
                  opcoes={CIDADES.map((c) => ({ valor: c.nome, rotulo: c.nome }))}
                />
              </Campo>
              <Campo id="cad-bairro" rotulo="Bairro" obrigatorio erro={erros.bairro}>
                <Selecao
                  id="cad-bairro"
                  valor={form.bairro}
                  onMudar={(v) => mudar('bairro', v)}
                  vazio={form.cidade ? 'Selecione seu bairro' : 'Escolha a cidade primeiro'}
                  erro={erros.bairro}
                  desativado={!form.cidade}
                  opcoes={bairrosDaCidade(form.cidade).map((b) => ({ valor: b, rotulo: b }))}
                />
              </Campo>
            </div>

            <fieldset className="cad-entrega">
              <legend>Forma de entrega<em aria-hidden="true"> *</em></legend>
              <div className="cad-opcoes">
                {Object.entries(ENTREGAS).map(([valor, opcao]) => (
                  <label className={`cad-opcao${form.entrega === valor ? ' on' : ''}`} key={valor}>
                    <input type="radio" name="entrega" value={valor} checked={form.entrega === valor} onChange={() => mudar('entrega', valor)} />
                    <span className="cad-radio" aria-hidden="true" />
                    <span className="cad-opcaotx"><b>{opcao.titulo}</b><i>{opcao.descricao}</i></span>
                    <Icone nome={valor === 'retirada' ? 'retirada' : 'caminhao'} tamanho={24} cor={form.entrega === valor ? '#3E8B22' : '#8C918B'} />
                  </label>
                ))}
              </div>
            </fieldset>
          </Secao>

          <Secao numero={5} titulo="Contato">
            <div className="cad-contato">
              <span className="cad-chave" aria-hidden="true"><i /></span>
              <span className="cad-opcaotx">
                <b>Receber mensagens pelo chat da plataforma</b>
                <i>Você receberá as mensagens dos interessados no chat do DesapegaUai.</i>
              </span>
            </div>
          </Secao>
        </div>

        <aside className="cad-lado" aria-label="Pré-visualização e publicação">
          <section className="cad-card cad-previa" aria-labelledby="cad-previa-titulo">
            <div className="cad-previah">
              <h2 id="cad-previa-titulo">Pré-visualização do anúncio</h2>
              {!temDados && <span>Exemplo</span>}
            </div>
            <div className="cad-foto">
              {previa.foto ? <img src={previa.foto} alt="" /> : <Icone nome="imagem" tamanho={44} cor="#9AA39B" espessura={1.4} />}
              <span className="cad-fav" aria-hidden="true"><Icone nome="favorito" tamanho={20} cor="#3E8B22" /></span>
            </div>
            <p className="cad-pvtitulo">{previa.titulo}</p>
            <p className="cad-pvpreco">{previa.preco}</p>
            <div className="cad-pvmeta">
              <span><Icone nome="local" tamanho={17} cor="#8C918B" />{previa.local}</span>
              <span><Icone nome="retirada" tamanho={17} cor="#8C918B" />{previa.entrega}</span>
            </div>
            {previa.condicao && <span className="cad-pvtag">{previa.condicao}</span>}
            <div className="cad-nota">
              <Icone nome="mensagens" tamanho={21} cor="#3E8B22" />
              <span><b>Negociação via chat</b><i>Não realizamos pagamentos na plataforma.</i></span>
            </div>
          </section>

          <section className="cad-card cad-dicas" aria-labelledby="cad-dicas-titulo">
            <h2 id="cad-dicas-titulo">Dicas para um bom anúncio</h2>
            <ul>
              {DICAS.map((d) => <li key={d}><Icone nome="check" tamanho={19} cor="#3E8B22" espessura={2} />{d}</li>)}
            </ul>
          </section>

          <div className="cad-acoes">
            {!editandoPublicado && (
              <button type="button" className="cad-btn fantasma" onClick={salvarRascunho}>
                <Icone nome="marcador" tamanho={20} cor="#16281C" />Salvar rascunho
              </button>
            )}
            <button type="submit" className="cad-btn solido">
              <Icone nome="aviao" tamanho={20} cor="#fff" />{editandoPublicado ? 'Salvar alterações' : 'Publicar anúncio'}
            </button>
            <p className="cad-dica"><Icone nome="cadeado" tamanho={16} cor="#8C918B" />Seu anúncio será revisado antes de ir ao ar.</p>
          </div>
        </aside>
      </form>
    </>
  );
}

/** Rotas /anunciar (novo) e /anuncios/:id/editar (editar ou continuar um rascunho). */
export default function CadastrarAnuncio() {
  const { id } = useParams();
  const existente = id ? buscarMeuAnuncio(id) : null;
  const naoEncontrado = id && !existente;

  useEffect(() => {
    document.title = `DesapegaUai — ${id ? 'Editar anúncio' : 'Cadastrar anúncio'}`;
  }, [id]);

  return (
    <LayoutPainel classeMain="cad-main">
      {naoEncontrado ? (
        <div className="cad-card cad-vazio">
          <Icone nome="etiqueta" tamanho={40} cor="#4CA02B" />
          <h1>Anúncio não encontrado</h1>
          <p>Ele pode ter sido excluído.</p>
          <Link to="/meus-anuncios">Voltar para Meus anúncios</Link>
        </div>
      ) : <Formulario key={id ?? 'novo'} existente={existente} />}
    </LayoutPainel>
  );
}
