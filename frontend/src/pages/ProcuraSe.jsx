import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import LayoutMarketplace from '../components/LayoutMarketplace.jsx';
import Icone from '../components/IconeMarketplace.jsx';
import SeloVinculo from '../components/SeloVinculo.jsx';
import Toast from '../components/Toast.jsx';
import { formatarPreco, textoParaPreco } from '../services/formatar.js';
import { bairrosDaCidade, listarCidades, nomeDoBairro } from '../services/locais.js';
import { useLocalizacao } from '../services/localizacao.js';
import { excluirProcura, listarProcuras, obterCategorias, publicarProcura } from '../services/mercadoApi.js';
import { useSessao } from '../services/sessao.js';
import '../styles/marketplace-cadastro.css';
import '../styles/marketplace-procura.css';

const formatoData = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' });

/**
 * Procura-se: quem quer comprar diz o que precisa, o bairro e até quanto paga.
 * Quando alguém publica um anúncio parecido na mesma cidade, a API avisa os dois no sininho.
 */
export default function ProcuraSe() {
  const navegar = useNavigate();
  const { usuario } = useSessao();
  const local = useLocalizacao();
  const [pedidos, setPedidos] = useState(null);
  const [erroDaLista, setErroDaLista] = useState(null);
  const [categorias, setCategorias] = useState([]);
  const [cidades, setCidades] = useState([]);
  // os bairros vêm junto com a cidade a que pertencem: trocou de cidade, a lista antiga não aparece
  const [bairrosDe, setBairrosDe] = useState({ cidadeId: '', lista: [], falhou: false });
  const [tentativaBairros, setTentativaBairros] = useState(0);
  // a lista de cidades não veio (internet fraca no celular): mostra o aviso com "Tentar de novo"
  const [cidadesFalharam, setCidadesFalharam] = useState(false);
  const [form, setForm] = useState(() => ({ titulo: '', categoriaId: '', cidadeId: String(local.cidade?.id ?? ''), bairroId: String(local.bairro?.id ?? ''), preco: '' }));
  const [erros, setErros] = useState({});
  const [enviando, setEnviando] = useState(false);
  const [toast, setToast] = useState(null);
  const avisar = useCallback((tipo, titulo, texto) => setToast({ tipo, titulo, texto, chave: Date.now() }), []);

  const carregar = useCallback(() => {
    listarProcuras().then((lista) => { setPedidos(lista); setErroDaLista(null); }).catch((falha) => setErroDaLista(falha.message));
  }, []);

  const buscarCidades = useCallback(() => {
    listarCidades().then(setCidades).catch(() => setCidadesFalharam(true));
  }, []);

  useEffect(() => {
    document.title = 'DesapegaUai — Procura-se';
    carregar();
    obterCategorias().then(setCategorias).catch(() => {});
    buscarCidades();
  }, [carregar, buscarCidades]);

  useEffect(() => {
    let ativo = true;
    const cidadeId = form.cidadeId;
    if (cidadeId) {
      bairrosDaCidade(Number(cidadeId))
        .then((lista) => { if (ativo) setBairrosDe({ cidadeId, lista, falhou: false }); })
        .catch(() => { if (ativo) setBairrosDe({ cidadeId, lista: [], falhou: true }); });
    }
    return () => { ativo = false; };
  }, [form.cidadeId, tentativaBairros]);
  const bairros = bairrosDe.cidadeId === form.cidadeId ? bairrosDe.lista : [];
  const bairrosFalharam = bairrosDe.cidadeId === form.cidadeId && bairrosDe.falhou;

  function mudar(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor, ...(campo === 'cidadeId' ? { bairroId: '' } : {}) }));
    setErros((e) => ({ ...e, [campo]: undefined }));
  }

  async function publicar(evento) {
    evento.preventDefault();
    if (!usuario) { navegar('/entrar'); return; }
    const encontrados = {};
    if (form.titulo.trim().length < 3) encontrados.titulo = 'Diga o que você procura (de 3 a 80 letras).';
    // o erro fica no campo que falta: sem cidade, na cidade (o bairro só abre depois dela)
    if (!form.cidadeId) encontrados.cidadeId = 'Escolha a cidade.';
    else if (!form.bairroId) encontrados.bairroId = 'Escolha o bairro.';
    if (form.preco && !(textoParaPreco(form.preco) > 0)) encontrados.preco = 'Informe um valor maior que zero ou deixe em branco.';
    setErros(encontrados);
    const primeiro = ['titulo', 'cidadeId', 'bairroId', 'preco'].find((campo) => encontrados[campo]);
    if (primeiro) {
      // leva a pessoa até o campo que falta (no celular ele pode estar fora da tela)
      const campo = document.getElementById({ titulo: 'pro-titulo', cidadeId: 'pro-cidade', bairroId: 'pro-bairro', preco: 'pro-preco' }[primeiro]);
      campo?.focus({ preventScroll: true });
      campo?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return;
    }

    setEnviando(true);
    try {
      await publicarProcura({
        titulo: form.titulo.trim(),
        bairro_id: Number(form.bairroId),
        categoria_id: form.categoriaId ? Number(form.categoriaId) : null,
        preco_max: form.preco ? String(textoParaPreco(form.preco)) : null,
      });
      setForm((f) => ({ ...f, titulo: '', preco: '' }));
      carregar();
      avisar('sucesso', 'Pedido publicado', 'Quando alguém anunciar algo parecido na sua cidade, você recebe um aviso no sininho.');
    } catch (falha) {
      // a moderação recusou o que foi escrito: a mensagem fica também embaixo do campo
      if (falha.campos?.includes('titulo')) setErros({ titulo: falha.message });
      avisar('erro', 'Não foi possível publicar o pedido', falha.message);
    } finally {
      setEnviando(false);
    }
  }

  async function excluir(pedido) {
    if (!window.confirm(`Excluir o pedido "${pedido.titulo}"?`)) return;
    try {
      await excluirProcura(pedido.id);
      setPedidos((lista) => lista.filter((p) => p.id !== pedido.id));
      avisar('sucesso', 'Pedido excluído');
    } catch (falha) {
      avisar('erro', 'Não foi possível excluir o pedido', falha.message);
    }
  }

  return (
    <LayoutMarketplace comFab={false} classeConteudo="pag-procura">
      <Toast aviso={toast} onFechar={() => setToast(null)} />
      <div className="titulo-pagina">
        <h1 className="t-titulo-1">Procura-se</h1>
        {pedidos && pedidos.length > 0 && <span className="titulo-selo">{pedidos.length} {pedidos.length === 1 ? 'pedido' : 'pedidos'}</span>}
      </div>
      <p className="pro-intro">
        Não achou o que queria? Diga o que você precisa e até quanto paga. Quando alguém publicar um anúncio
        parecido na sua cidade, o DesapegaUai avisa você e avisa quem está vendendo.
      </p>

      <div className="pro-corpo">
        <form className="cad-card cad-sec pro-form" onSubmit={publicar} noValidate aria-labelledby="pro-form-titulo">
          <h2 id="pro-form-titulo">Publicar um pedido</h2>
          <div className="cad-campo">
            <label htmlFor="pro-titulo">O que você procura?<em aria-hidden="true"> *</em></label>
            <input id="pro-titulo" className="cad-input" type="text" maxLength={80} placeholder="Ex.: escrivaninha para quarto" value={form.titulo}
              aria-invalid={Boolean(erros.titulo)} onChange={(e) => mudar('titulo', e.target.value)} />
            {erros.titulo && <p className="cad-erro" role="alert">{erros.titulo}</p>}
          </div>
          <div className="cad-campo">
            <label htmlFor="pro-categoria">Categoria</label>
            <select id="pro-categoria" className="cad-input" value={form.categoriaId} onChange={(e) => mudar('categoriaId', e.target.value)}>
              <option value="">Qualquer categoria</option>
              {categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
          <div className="cad-campo">
            <label htmlFor="pro-cidade">Cidade<em aria-hidden="true"> *</em></label>
            <select id="pro-cidade" className="cad-input" value={form.cidadeId} aria-invalid={Boolean(erros.cidadeId)} onChange={(e) => mudar('cidadeId', e.target.value)}>
              <option value="">Selecione a cidade</option>
              {cidades.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
            {erros.cidadeId && <p className="cad-erro" role="alert">{erros.cidadeId}</p>}
            {cidadesFalharam && (
              <p className="cad-erro" role="alert">
                Não foi possível carregar as cidades.{' '}
                <button type="button" className="pro-tentar" onClick={() => { setCidadesFalharam(false); buscarCidades(); }}>Tentar de novo</button>
              </p>
            )}
          </div>
          <div className="cad-campo">
            <label htmlFor="pro-bairro">Bairro ou localidade<em aria-hidden="true"> *</em></label>
            <select id="pro-bairro" className="cad-input" value={form.bairroId} disabled={!form.cidadeId} aria-invalid={Boolean(erros.bairroId)} onChange={(e) => mudar('bairroId', e.target.value)}>
              <option value="">{form.cidadeId ? 'Selecione o bairro' : 'Escolha a cidade primeiro'}</option>
              {bairros.map((b) => <option key={b.id} value={b.id}>{nomeDoBairro(b)}</option>)}
            </select>
            {erros.bairroId && <p className="cad-erro" role="alert">{erros.bairroId}</p>}
            {bairrosFalharam && (
              <p className="cad-erro" role="alert">
                Não foi possível carregar os bairros.{' '}
                <button type="button" className="pro-tentar" onClick={() => { setBairrosDe((b) => ({ ...b, falhou: false })); setTentativaBairros((t) => t + 1); }}>Tentar de novo</button>
              </p>
            )}
          </div>
          <div className="cad-campo">
            <label htmlFor="pro-preco">Até quanto você paga? (R$)</label>
            <input id="pro-preco" className="cad-input" type="text" inputMode="decimal" placeholder="Opcional. Ex.: 150" value={form.preco}
              aria-invalid={Boolean(erros.preco)} onChange={(e) => mudar('preco', e.target.value.replace(/[^\d.,]/g, ''))} />
            {erros.preco && <p className="cad-erro" role="alert">{erros.preco}</p>}
          </div>
          <button type="submit" className="cad-btn solido" disabled={enviando}>
            <Icone nome="busca" tamanho={20} cor="#fff" espessura={1.9} />
            {usuario ? (enviando ? 'Publicando…' : 'Publicar pedido') : 'Entrar para publicar'}
          </button>
          <p className="cad-ajuda">O pedido aparece com o seu nome. Telefone e e-mail não aparecem: o contato é pelo chat do anúncio.</p>
        </form>

        <section className="pro-lista" aria-label="Pedidos publicados">
          {erroDaLista && <p className="pro-vazio" role="alert">Não foi possível carregar os pedidos. {erroDaLista}</p>}
          {!erroDaLista && pedidos === null && <p className="pro-vazio">Carregando pedidos…</p>}
          {!erroDaLista && pedidos?.length === 0 && (
            <div className="pro-vazio">
              <Icone nome="busca" tamanho={36} cor="#4CA02B" />
              <b>Ninguém publicou um pedido ainda</b>
              <span>Seja a primeira pessoa a dizer o que está procurando.</span>
            </div>
          )}
          {pedidos?.length > 0 && (
            <ul>
              {pedidos.map((p) => (
                <li className="pro-item" key={p.id}>
                  {/* a marca do DesapegaUai (o mesmo desenho do ícone do site) no lugar do ícone da categoria */}
                  <img className="pro-icone" src="/favicon.svg" alt="" width="52" height="52" />
                  <div className="pro-txt">
                    <b>{p.titulo}</b>
                    <span className="pro-meta">
                      {p.preco_max ? `Paga até ${formatarPreco(p.preco_max)}` : 'Valor a combinar'} · {p.bairro}, {p.cidade}
                    </span>
                    <span className="pro-quem">
                      <Link className="link-perfil" to={`/usuario/${p.usuario.id}`}>{p.usuario.nome}</Link>
                      {p.usuario.vinculo_academico && <SeloVinculo />}
                      <span>· {formatoData.format(new Date(p.criada_em))}</span>
                    </span>
                  </div>
                  {p.eh_minha
                    ? <button type="button" className="pro-acao perigo" onClick={() => excluir(p)}>Excluir</button>
                    : <Link className="pro-acao" to="/anunciar">Tenho isso</Link>}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </LayoutMarketplace>
  );
}
