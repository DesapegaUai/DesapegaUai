import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate, useParams } from 'react-router';
import LayoutPainel from '../components/LayoutPainel.jsx';
import Icone from '../components/IconeMarketplace.jsx';
import MapaAnuncios from '../components/MapaAnuncios.jsx';
import Toast from '../components/Toast.jsx';
import useGaveta from '../hooks/useGaveta.js';
import { CATEGORIAS } from '../services/categorias.js';
import { urlDaApi } from '../services/api.js';
import { erroDaFoto } from '../services/fotosAnuncio.js';
import { formatarPreco, textoParaPreco } from '../services/formatar.js';
import { bairrosDaCidade, buscarRuas, enderecoDoPonto, listarCidades, localDoCep, nomeDoBairro } from '../services/locais.js';
import { motivoSemGps, TEXTO_DO_STATUS } from '../services/localizacao.js';
import {
  adicionarFotos, definirCapa, editarAnuncio, mudarStatus, obterCategorias, publicarAnuncio, removerFoto, verAnuncio,
} from '../services/mercadoApi.js';
import { PONTOS_DE_ENCONTRO } from '../services/conversas.js';
import { pedirAvisosDeMensagem } from '../services/push.js';
import { CONDICOES, ENTREGAS, LIMITES, TRANSPORTES, validarAnuncio } from '../services/meusAnuncios.js';
import '../styles/marketplace-acoes.css';
import '../styles/marketplace-cadastro.css';

const DICAS =['Use fotos reais e bem iluminadas', 'Descreva o produto com detalhes', 'Informe medidas e condições', 'Responda rápido às mensagens'];
const ORDEM_DOS_ERROS = ['fotos', 'titulo', 'categoria', 'condicao', 'preco', 'cidade', 'bairro', 'entrega', 'transporte'];
// campo da API -> campo da tela
const CAMPO_DA_API = { titulo: 'titulo', categoria_id: 'categoria', condicao: 'condicao', preco: 'preco', bairro_id: 'bairro', forma_entrega: 'entrega', transporte: 'transporte', fotos: 'fotos', latitude: 'local', cep: 'cep', rua: 'rua' };

const precoParaTexto = (preco) => (preco ? String(preco).replace('.', ',') : '');
const formatarCep = (cep) => (cep ?? '').replace(/\D/g, '').slice(0, 8).replace(/(\d{5})(\d{1,3})/, '$1-$2');

const formularioVazio = () => ({
  titulo: '', categoria: '', subcategoriaId: '', condicao: '', preco: '', descricao: '', entrega: 'retirada', transporte: '',
  cidadeId: '', bairroId: '', referencia: '', rua: '', cep: '', ponto: null, origem: 'bairro', precisao: null, fotos: [],
});

function formularioDaApi(a) {
  const local = a.localizacao_anuncio;
  return {
    titulo: a.titulo ?? '',
    categoria: a.categoria_slug ?? '',
    subcategoriaId: a.subcategoria_id ? String(a.subcategoria_id) : '',
    condicao: a.condicao ? a.condicao.charAt(0).toUpperCase() + a.condicao.slice(1) : '',
    preco: precoParaTexto(a.preco),
    descricao: a.descricao ?? '',
    entrega: a.forma_entrega ?? 'retirada',
    transporte: a.transporte ?? '',
    cidadeId: a.cidade_id ? String(a.cidade_id) : local?.cidade?.id ? String(local.cidade.id) : '',
    bairroId: a.bairro_id ? String(a.bairro_id) : '',
    referencia: a.localizacao ?? '',
    rua: local?.rua ?? '',
    cep: formatarCep(local?.cep ?? ''),
    ponto: local?.exata && local.origem !== 'bairro' ? { latitude: local.exata.latitude, longitude: local.exata.longitude } : null,
    origem: local?.origem ?? 'bairro',
    precisao: local?.exata?.precisao_m ?? null,
    // verAnuncio troca `fotos` por uma lista de endereços (para a página do anúncio);
    // aqui precisa do id de cada foto, que fica em `fotosApi`
    fotos: (a.fotosApi ?? []).map((f) => ({ id: f.id, url: urlDaApi(f.grande ?? f.media ?? f.pequena) })),
  };
}

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

function Campo({ id, rotulo, obrigatorio, erro, children, ajuda }) {
  return (
    <div className="cad-campo">
      <label htmlFor={id}>{rotulo}{obrigatorio && <em aria-hidden="true"> *</em>}</label>
      {children}
      {ajuda && !erro && <p className="cad-ajuda">{ajuda}</p>}
      {erro && <p className="cad-erro" id={`${id}-erro`}>{erro}</p>}
    </div>
  );
}

function Selecao({ id, valor, onMudar, opcoes, vazio, erro, desativado }) {
  return (
    <div className={`cad-select${erro ? ' invalido' : ''}`}>
      <select id={id} value={valor} disabled={desativado} onChange={(e) => onMudar(e.target.value)} aria-invalid={Boolean(erro)} aria-describedby={erro ? `${id}-erro` : undefined}>
        <option value="">{vazio}</option>
        {opcoes.map((o) => <option key={o.valor} value={o.valor}>{o.rotulo}</option>)}
      </select>
      <Icone nome="seta-baixo" tamanho={18} cor="#6B726C" />
    </div>
  );
}

// Cancelar a edição com mudanças que não foram salvas: pergunta antes (o mesmo aviso do "Excluir anúncio").
// Esc, tocar fora e "Continuar editando" fecham o aviso e mantêm o que a pessoa digitou.
function ConfirmarDescarte({ titulo, onContinuar, onDescartar }) {
  const continuarRef = useRef(null);
  useGaveta(true, onContinuar, continuarRef);
  return createPortal(
    <div className="telas-marketplace">
      <div className="acoes-fundo" onMouseDown={(e) => { if (e.target === e.currentTarget) onContinuar(); }}>
        <div className="acoes-dialogo" role="alertdialog" aria-modal="true" aria-labelledby="descartar-titulo" aria-describedby="descartar-texto">
          <h2 id="descartar-titulo">Descartar as alterações?</h2>
          <p id="descartar-texto">
            Você mudou o anúncio <b>{titulo}</b>. Se sair agora, as mudanças não são salvas e o anúncio continua como estava.
          </p>
          <div className="acoes-botoes">
            <button type="button" className="acoes-btn" onClick={onContinuar} ref={continuarRef}>Continuar editando</button>
            <button type="button" className="acoes-btn perigo" onClick={onDescartar}>Descartar alterações</button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// o formulário resumido para comparar: as fotos contam pelo id (as do anúncio) ou pela prévia (as novas)
const assinaturaDoFormulario = (f) => JSON.stringify({ ...f, fotos: f.fotos.map((foto) => foto.id ?? foto.url) });

function Formulario({ existente }) {
  const navegar = useNavigate();
  const [form, setForm] = useState(() => (existente ? formularioDaApi(existente) : formularioVazio()));
  const [erros, setErros] = useState({});
  const [toast, setToast] = useState(null);
  const [arrastando, setArrastando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [categorias, setCategorias] = useState([]);
  const [cidades, setCidades] = useState([]);
  const [bairros, setBairros] = useState([]);
  const [ruas, setRuas] = useState([]);
  const [localizando, setLocalizando] = useState(false);
  const [esperandoPermissao, setEsperandoPermissao] = useState(false);
  // as fotos que o anúncio já tinha ao abrir (o form do primeiro render): ao salvar, sai do servidor só a que a pessoa tirou
  const fotosOriginais = useRef(form.fotos.filter((f) => f.id).map((f) => f.id));
  // o formulário como abriu: o Cancelar só pergunta antes de sair se a pessoa mudou alguma coisa
  const formInicial = useRef(form);
  const [descartando, setDescartando] = useState(false);
  const continuarEditando = useCallback(() => setDescartando(false), []);
  const arquivoRef = useRef(null);
  const editandoPublicado = existente && existente.status !== 'rascunho';
  const tituloDaTela = editandoPublicado ? 'Editar anúncio' : existente ? 'Continuar rascunho' : 'Cadastrar anúncio';
  const ehServico = form.categoria === 'servicos';
  const preco = textoParaPreco(form.preco);
  const avisar = (aviso) => setToast({ ...aviso, chave: Date.now() });
  const categoria = categorias.find((c) => c.slug === form.categoria);
  const cidade = cidades.find((c) => String(c.id) === String(form.cidadeId));
  const bairro = bairros.find((b) => String(b.id) === String(form.bairroId));

  useEffect(() => {
    obterCategorias().then(setCategorias).catch(() => {});
    listarCidades().then(setCidades).catch(() => {});
  }, []);

  useEffect(() => {
    let ativo = true;
    if (form.cidadeId) bairrosDaCidade(Number(form.cidadeId)).then((lista) => { if (ativo) setBairros(lista); }).catch(() => {});
    return () => { ativo = false; };
  }, [form.cidadeId]);

  // ruas sugeridas enquanto digita
  useEffect(() => {
    if (!form.cidadeId || form.rua.trim().length < 3) return undefined;
    const espera = setTimeout(() => {
      buscarRuas(Number(form.cidadeId), form.rua.trim(), form.bairroId || undefined).then(setRuas).catch(() => setRuas([]));
    }, 350);
    return () => clearTimeout(espera);
  }, [form.cidadeId, form.bairroId, form.rua]);

  useEffect(() => () => form.fotos.forEach((f) => f.arquivo && URL.revokeObjectURL(f.url)), []); // eslint-disable-line react-hooks/exhaustive-deps

  const semCampos = (lista, ...campos) => Object.fromEntries(Object.entries(lista).filter(([c]) => !campos.includes(c)));
  function mudar(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }));
    setErros((e) => semCampos(e, campo));
  }

  function mudarCategoria(slug) {
    setForm((f) => ({ ...f, categoria: slug, subcategoriaId: '', condicao: slug === 'servicos' ? '' : f.condicao, transporte: slug === 'servicos' ? '' : f.transporte }));
    setErros((e) => semCampos(e, 'categoria', 'condicao', 'transporte'));
  }

  function mudarCidade(id) {
    setForm((f) => ({ ...f, cidadeId: id, bairroId: '', rua: '', cep: '', ponto: null, origem: 'bairro', precisao: null }));
    setErros((e) => semCampos(e, 'cidade', 'bairro', 'local'));
  }

  function adicionarArquivos(lista) {
    const arquivos = [...lista];
    if (!arquivos.length) return;
    const vagas = LIMITES.fotos - form.fotos.length;
    if (arquivos.length > vagas) avisar({ tipo: 'erro', titulo: `Você pode adicionar até ${LIMITES.fotos} fotos.` });
    const problema = arquivos.slice(0, vagas).map(erroDaFoto).find(Boolean);
    if (problema) avisar({ tipo: 'erro', titulo: problema });
    const validas = arquivos.slice(0, Math.max(vagas, 0)).filter((a) => !erroDaFoto(a));
    if (!validas.length) return;
    setForm((f) => ({ ...f, fotos: [...f.fotos, ...validas.map((arquivo) => ({ arquivo, url: URL.createObjectURL(arquivo) }))].slice(0, LIMITES.fotos) }));
    setErros((e) => semCampos(e, 'fotos'));
  }

  const removerDaLista = (i) => mudar('fotos', form.fotos.filter((_, j) => j !== i));
  const usarComoCapa = (i) => mudar('fotos', [form.fotos[i], ...form.fotos.filter((_, j) => j !== i)]);

  // aplica o endereço que a API devolveu (cidade, bairro, rua e CEP)
  async function aplicarEndereco(endereco, ponto, origem, precisao = null) {
    if (endereco.cidade?.id) await bairrosDaCidade(endereco.cidade.id).then(setBairros).catch(() => {});
    setForm((f) => ({
      ...f,
      cidadeId: endereco.cidade?.id ? String(endereco.cidade.id) : f.cidadeId,
      bairroId: endereco.bairro?.id ? String(endereco.bairro.id) : f.bairroId,
      rua: endereco.rua ?? f.rua,
      cep: endereco.cep ? formatarCep(endereco.cep) : f.cep,
      ponto, origem, precisao,
    }));
    setErros((e) => semCampos(e, 'cidade', 'bairro', 'local', 'cep'));
  }

  // Posição do navegador, só depois do clique (o navegador pede a permissão).
  // 1ª tentativa: GPS de alta precisão. Se não vier em 10 s (computador sem GPS, sinal fraco),
  // 2ª tentativa: a posição pela rede/Wi-Fi, que é a que o computador costuma ter.
  async function lerPosicaoDoNavegador() {
    const ler = (opcoes) => new Promise((ok, falha) => { navigator.geolocation.getCurrentPosition(ok, falha, opcoes); });
    const primeira = ler({ enableHighAccuracy: true, maximumAge: 0, timeout: 10_000 });
    primeira.catch(() => {}); // a falha é tratada logo abaixo, no await

    // enquanto a pessoa não responde o aviso do navegador nada acontece (nem o tempo de espera conta):
    // o botão avisa que está esperando a autorização
    let permissao = null;
    try {
      permissao = await navigator.permissions?.query({ name: 'geolocation' });
    } catch {
      // navegador que não informa a permissão: fica só o texto normal do botão
    }
    const mostrarEspera = () => setEsperandoPermissao(permissao?.state === 'prompt');
    mostrarEspera();
    permissao?.addEventListener('change', mostrarEspera);

    try {
      return await primeira;
    } catch (erro) {
      if (erro.code === 1) throw erro; // não autorizou: não adianta tentar de novo
      return await ler({ enableHighAccuracy: false, maximumAge: 5 * 60_000, timeout: 10_000 });
    } finally {
      permissao?.removeEventListener('change', mostrarEspera);
      setEsperandoPermissao(false);
    }
  }

  async function usarMinhaLocalizacao() {
    const motivo = motivoSemGps();
    if (motivo) return avisar({ tipo: 'erro', titulo: 'Localização indisponível', texto: TEXTO_DO_STATUS[motivo] });
    setLocalizando(true);
    try {
      let leitura;
      try {
        leitura = await lerPosicaoDoNavegador();
      } catch (erro) {
        const texto = erro.code === 1
          ? 'A localização está bloqueada para este site. Clique no ícone ao lado do endereço do site, libere a Localização e tente de novo. Se preferir, escolha a cidade e o bairro ou toque no mapa.'
          : 'O navegador não conseguiu descobrir onde você está. Tente de novo, escolha a cidade e o bairro ou toque no mapa.';
        return avisar({ tipo: 'erro', titulo: 'Localização indisponível', texto });
      }
      const precisao = Math.round(leitura.coords.accuracy);
      const ponto = { latitude: Number(leitura.coords.latitude.toFixed(7)), longitude: Number(leitura.coords.longitude.toFixed(7)) };
      try {
        const endereco = await enderecoDoPonto(ponto.latitude, ponto.longitude);
        await aplicarEndereco(endereco, ponto, 'gps', precisao);
        avisar({ tipo: 'sucesso', titulo: 'Localização preenchida', texto: `Precisão de ${precisao} m. Confira e ajuste o ponto no mapa se precisar.` });
      } catch (erro) {
        avisar({ tipo: 'erro', titulo: 'Não foi possível usar sua localização', texto: erro.message });
      }
    } finally {
      setLocalizando(false);
    }
  }

  async function escolherPontoNoMapa(ponto) {
    try {
      const endereco = await enderecoDoPonto(ponto.latitude, ponto.longitude);
      if (form.cidadeId && String(endereco.cidade.id) !== String(form.cidadeId)) {
        avisar({ tipo: 'info', titulo: `Esse ponto fica em ${endereco.cidade.nome}`, texto: 'A cidade do anúncio foi trocada.' });
      }
      await aplicarEndereco(endereco, ponto, 'manual');
    } catch (erro) {
      avisar({ tipo: 'erro', titulo: 'Não foi possível usar esse ponto', texto: erro.message });
    }
  }

  async function procurarCep(valor) {
    const cep = formatarCep(valor);
    mudar('cep', cep);
    if (cep.replace(/\D/g, '').length !== 8) return;
    try {
      const local = await localDoCep(cep);
      await aplicarEndereco({ ...local, rua: local.rua ?? form.rua }, local.cep_de_rua ? { latitude: local.latitude, longitude: local.longitude } : form.ponto, local.cep_de_rua ? 'manual' : form.origem);
    } catch (erro) {
      setErros((e) => ({ ...e, cep: erro.message }));
    }
  }

  function camposParaApi(status) {
    const dados = {
      titulo: form.titulo.trim(),
      descricao: form.descricao.trim(),
      preco: preco ? String(preco) : '',
      categoria_id: categoria ? String(categoria.id) : '',
      subcategoria_id: form.subcategoriaId,
      bairro_id: form.bairroId,
      condicao: ehServico ? '' : form.condicao.toLowerCase(),
      forma_entrega: form.entrega,
      transporte: ehServico ? '' : form.transporte,
      localizacao: form.referencia.trim(),
      rua: form.rua.trim(),
      cep: form.cep.replace(/\D/g, ''),
      origem_localizacao: form.ponto ? form.origem : 'bairro',
      latitude: form.ponto ? String(form.ponto.latitude) : '',
      longitude: form.ponto ? String(form.ponto.longitude) : '',
      precisao_m: form.ponto && form.origem === 'gps' && form.precisao ? String(form.precisao) : '',
    };
    if (status) dados.status = status;
    if (!form.bairroId) for (const c of ['rua', 'cep', 'origem_localizacao', 'latitude', 'longitude', 'precisao_m']) dados[c] = '';
    return dados;
  }

  function mostrarErroDaApi(erro) {
    const campos = Object.fromEntries((erro.campos ?? []).map((c) => [CAMPO_DA_API[c] ?? c, erro.message]));
    if (Object.keys(campos).length) setErros((e) => ({ ...e, ...campos }));
    avisar({ tipo: 'erro', titulo: 'Não foi possível salvar.', texto: erro.message });
  }

  async function salvarNovo(status) {
    const formulario = new FormData();
    for (const [campo, valor] of Object.entries(camposParaApi(status))) if (valor !== '') formulario.append(campo, valor);
    for (const foto of form.fotos) formulario.append('fotos', foto.arquivo, foto.arquivo.name);
    return publicarAnuncio(formulario);
  }

  async function salvarExistente(publicarRascunho) {
    const id = existente.id;
    const dados = camposParaApi();
    for (const c of ['latitude', 'longitude', 'origem_localizacao', 'precisao_m']) if (dados[c] === '') delete dados[c];
    await editarAnuncio(id, dados);

    // fotos: tira as removidas, envia as novas e ajusta a capa.
    // A API mantém o anúncio publicado com 1 a 8 fotos: tirar antes abre vaga para as novas,
    // mas, se todas as antigas saem (trocar a única foto), a última só sai depois que chega uma nova.
    const mantidas = form.fotos.filter((f) => f.id).map((f) => f.id);
    const removidas = fotosOriginais.current.filter((fid) => !mantidas.includes(fid));
    const novas = form.fotos.filter((f) => f.arquivo);
    const tirarDepois = !mantidas.length && novas.length ? removidas.pop() : null;
    let atual = null;
    async function enviar(lista) {
      if (!lista.length) return;
      const formulario = new FormData();
      for (const foto of lista) formulario.append('fotos', foto.arquivo, foto.arquivo.name);
      atual = await adicionarFotos(id, formulario);
    }
    for (const fotoId of removidas) atual = await removerFoto(id, fotoId);
    if (tirarDepois) {
      await enviar(novas.slice(0, LIMITES.fotos - 1));
      atual = await removerFoto(id, tirarDepois);
      await enviar(novas.slice(LIMITES.fotos - 1));
    } else {
      await enviar(novas);
    }
    const capa = form.fotos[0];
    if (capa) {
      const idDaCapa = capa.id ?? atual?.fotos.at(-novas.length)?.id;
      if (idDaCapa && (atual?.fotos[0]?.id ?? fotosOriginais.current[0]) !== idDaCapa) await definirCapa(id, idDaCapa);
    }
    if (publicarRascunho) await mudarStatus(id, 'ativo');
    return { id };
  }

  async function salvar(status, aviso, aba) {
    if (salvando) return;
    setSalvando(true);
    try {
      if (existente) await salvarExistente(status === 'ativo' && existente.status === 'rascunho');
      else await salvarNovo(status);
      navegar(`/meus-anuncios?aba=${aba}`, { state: { aviso: { ...aviso, chave: Date.now() } } });
    } catch (erro) {
      mostrarErroDaApi(erro);
    } finally {
      setSalvando(false);
    }
  }

  function salvarRascunho() {
    if (!form.titulo.trim() && !preco && !form.fotos.length && !form.categoria && !form.descricao.trim()) {
      avisar({ tipo: 'info', titulo: 'Preencha algum campo para salvar o rascunho.' });
      return;
    }
    salvar('rascunho', { tipo: 'sucesso', titulo: 'Rascunho salvo', texto: 'Continue quando quiser em Meus anúncios.' }, 'rascunhos');
  }

  // Cancelar (só na edição de anúncio publicado): volta para onde a pessoa estava, o anúncio ou Meus anúncios.
  // Aberta direto pelo endereço (sem tela anterior no site), vai para Meus anúncios.
  function sairSemSalvar() {
    if (window.history.state?.idx > 0) navegar(-1);
    else navegar('/meus-anuncios');
  }

  function cancelar() {
    if (assinaturaDoFormulario(form) !== assinaturaDoFormulario(formInicial.current)) setDescartando(true);
    else sairSemSalvar();
  }

  function publicar(e) {
    e.preventDefault();
    const encontrados = validarAnuncio({ ...form, preco });
    setErros(encontrados);
    const primeiro = ORDEM_DOS_ERROS.find((c) => encontrados[c]);
    if (primeiro) {
      avisar({ tipo: 'erro', titulo: 'Confira os campos destacados.', texto: encontrados[primeiro] });
      document.getElementById(primeiro === 'fotos' ? 'cad-enviar-fotos' : `cad-${primeiro}`)?.focus();
      return;
    }
    // quem publica precisa saber quando alguém chamar: o navegador pergunta se pode mostrar notificações
    pedirAvisosDeMensagem().catch(() => {});
    salvar('ativo', { tipo: 'sucesso', titulo: editandoPublicado ? 'Alterações salvas' : 'Anúncio publicado' }, 'ativos');
  }

  const propsDoCampo = (campo) => ({ id: `cad-${campo}`, 'aria-invalid': Boolean(erros[campo]), 'aria-describedby': erros[campo] ? `cad-${campo}-erro` : undefined });
  const temDados = Boolean(form.titulo.trim() || preco || form.fotos.length);
  const centroDoMapa = form.ponto ?? (bairro ? { latitude: Number(bairro.latitude), longitude: Number(bairro.longitude) } : cidade ? { latitude: Number(cidade.latitude), longitude: Number(cidade.longitude) } : null);

  return (
    <>
      <Toast aviso={toast} onFechar={() => setToast(null)} />
      {descartando && <ConfirmarDescarte titulo={existente.titulo} onContinuar={continuarEditando} onDescartar={sairSemSalvar} />}
      <form className="cad-form" onSubmit={publicar} noValidate>
        <div className="cad-col">
          <div className="cad-cabeca">
            <h1>{tituloDaTela}</h1>
            <p>Preencha as informações para publicar seu produto.</p>
          </div>

          <Secao numero={1} titulo="Fotos" descricao="Adicione fotos reais do produto para atrair mais compradores." lateral={`Até ${LIMITES.fotos} fotos.`}>
            <button type="button" id="cad-enviar-fotos" className={`cad-drop${arrastando ? ' ativo' : ''}${erros.fotos ? ' invalido' : ''}`}
              onClick={() => arquivoRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setArrastando(true); }}
              onDragLeave={() => setArrastando(false)}
              onDrop={(e) => { e.preventDefault(); setArrastando(false); adicionarArquivos(e.dataTransfer.files); }}
              aria-describedby={erros.fotos ? 'cad-fotos-erro' : undefined}>
              <Icone nome="upload" tamanho={32} cor="#3E8B22" />
              <b>Arraste e solte suas fotos aqui</b>
              <span>ou toque para escolher (JPG, PNG ou WebP, até 8 MB cada)</span>
            </button>
            <input ref={arquivoRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="oculto" tabIndex={-1} aria-hidden="true"
              onChange={(e) => { adicionarArquivos(e.target.files); e.target.value = ''; }} />
            {erros.fotos && <p className="cad-erro" id="cad-fotos-erro">{erros.fotos}</p>}
            <ul className="cad-slots" aria-label="Fotos do anúncio">
              {Array.from({ length: LIMITES.fotos }, (_, i) => {
                const foto = form.fotos[i];
                return (
                  <li className={`cad-slot${foto ? ' cheio' : ''}`} key={foto?.url ?? `vazio-${i}`}>
                    {foto ? (
                      <>
                        <button type="button" className="cad-capa" onClick={() => usarComoCapa(i)} disabled={i === 0} aria-label={i === 0 ? 'Foto de capa' : `Usar a foto ${i + 1} como capa`}>
                          <img src={foto.url} alt="" />
                          {i === 0 && <span>Capa</span>}
                        </button>
                        <button type="button" className="cad-tira" onClick={() => removerDaLista(i)} aria-label={`Remover a foto ${i + 1}`}>
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
                <input {...propsDoCampo('titulo')} className="cad-input" type="text" maxLength={LIMITES.titulo} placeholder="Ex.: Cadeira de escritório" value={form.titulo} onChange={(e) => mudar('titulo', e.target.value)} />
              </Campo>
              <Campo id="cad-categoria" rotulo="Categoria" obrigatorio erro={erros.categoria}>
                <Selecao id="cad-categoria" valor={form.categoria} onMudar={mudarCategoria} vazio="Selecione uma categoria" erro={erros.categoria} opcoes={CATEGORIAS.map((c) => ({ valor: c.slug, rotulo: c.nome }))} />
              </Campo>
              {categoria?.subcategorias?.length > 0 && (
                <Campo id="cad-subcategoria" rotulo={categoria.rotulo_filtro ?? 'Tipo'}>
                  <Selecao id="cad-subcategoria" valor={form.subcategoriaId} onMudar={(v) => mudar('subcategoriaId', v)} vazio="Opcional" opcoes={categoria.subcategorias.map((s) => ({ valor: String(s.id), rotulo: s.nome }))} />
                </Campo>
              )}
              <Campo id="cad-condicao" rotulo="Condição do produto" obrigatorio={!ehServico} erro={erros.condicao}>
                <Selecao id="cad-condicao" valor={ehServico ? '' : form.condicao} onMudar={(v) => mudar('condicao', v)} vazio={ehServico ? 'Não se aplica a serviços' : 'Selecione a condição'} erro={erros.condicao} desativado={ehServico} opcoes={CONDICOES.map((c) => ({ valor: c, rotulo: c }))} />
              </Campo>
              <Campo id="cad-preco" rotulo="Preço" obrigatorio erro={erros.preco}>
                <div className={`cad-preco${erros.preco ? ' invalido' : ''}`}>
                  <span aria-hidden="true">R$</span>
                  <input {...propsDoCampo('preco')} type="text" inputMode="decimal" placeholder="Ex.: 250,00" value={form.preco} onChange={(e) => mudar('preco', e.target.value.replace(/[^\d.,]/g, ''))} />
                </div>
              </Campo>
            </div>
          </Secao>

          <Secao numero={3} titulo="Descrição" descricao="Descreva o produto com detalhes para gerar mais confiança.">
            <div className="cad-area">
              <label htmlFor="cad-descricao" className="oculto">Descrição do anúncio</label>
              <textarea id="cad-descricao" rows={3} maxLength={LIMITES.descricao} placeholder="Estado de conservação, medidas, funcionalidades, motivo da venda…" value={form.descricao} onChange={(e) => mudar('descricao', e.target.value)} />
              <span>{form.descricao.length}/{LIMITES.descricao} caracteres</span>
            </div>
          </Secao>

          <Secao numero={4} titulo="Localização e entrega" descricao="Onde o produto está disponível para negociação. A localização é do anúncio: ela não muda se você viajar.">
            <div className="cad-gps">
              <button type="button" className="cad-btn fantasma" onClick={usarMinhaLocalizacao} disabled={localizando}>
                <Icone nome="local" tamanho={18} cor="#3E8B22" />{esperandoPermissao ? 'Autorize a localização no aviso do navegador…' : localizando ? 'Descobrindo onde você está…' : 'Usar minha localização atual'}
              </button>
              <p className="cad-ajuda">Preenche cidade, bairro, rua e CEP pelo GPS. Você também pode preencher à mão ou tocar no mapa.</p>
            </div>

            <div className="cad-grade">
              <Campo id="cad-cidade" rotulo="Cidade" obrigatorio erro={erros.cidade}>
                <Selecao id="cad-cidade" valor={form.cidadeId} onMudar={mudarCidade} vazio="Selecione a cidade" erro={erros.cidade} opcoes={cidades.map((c) => ({ valor: String(c.id), rotulo: c.nome }))} />
              </Campo>
              <Campo id="cad-bairro" rotulo="Bairro ou localidade" obrigatorio erro={erros.bairro}>
                <Selecao id="cad-bairro" valor={form.bairroId} onMudar={(v) => { mudar('bairroId', v); if (form.origem === 'bairro') mudar('ponto', null); }} vazio={form.cidadeId ? 'Selecione o bairro' : 'Escolha a cidade primeiro'} erro={erros.bairro} desativado={!form.cidadeId} opcoes={bairros.map((b) => ({ valor: String(b.id), rotulo: nomeDoBairro(b) }))} />
              </Campo>
              <Campo id="cad-cep" rotulo="CEP" erro={erros.cep} ajuda="Só você vê.">
                <input {...propsDoCampo('cep')} className="cad-input" type="text" inputMode="numeric" placeholder="00000-000" value={form.cep} onChange={(e) => procurarCep(e.target.value)} />
              </Campo>
              <Campo id="cad-rua" rotulo="Rua" erro={erros.rua} ajuda="Só você vê.">
                <input {...propsDoCampo('rua')} className="cad-input" type="text" maxLength={150} list="cad-ruas" placeholder={form.cidadeId ? 'Comece a digitar' : 'Escolha a cidade primeiro'} disabled={!form.cidadeId} value={form.rua} onChange={(e) => mudar('rua', e.target.value)} />
                <datalist id="cad-ruas">{ruas.map((r) => <option key={r.id} value={r.nome}>{[r.bairro, r.cep && formatarCep(r.cep)].filter(Boolean).join(' · ')}</option>)}</datalist>
              </Campo>
            </div>

            {centroDoMapa && (
              <div className="cad-mapa">
                <MapaAnuncios
                  centro={centroDoMapa}
                  ponto={form.ponto}
                  onEscolherPonto={escolherPontoNoMapa}
                  zoom={15}
                  altura={240}
                  rotulo="Mapa para ajustar o ponto do anúncio. Toque no lugar certo ou arraste o alfinete."
                />
                <p className="cad-ajuda">
                  {form.ponto ? `Ponto ${form.origem === 'gps' ? `do GPS${form.precisao ? ` (precisão de ${form.precisao} m)` : ''}` : 'escolhido no mapa'}. Toque no mapa ou arraste o alfinete para ajustar.` : 'Sem ponto marcado: vale o centro do bairro. Toque no mapa para marcar o lugar.'}
                </p>
              </div>
            )}
            {erros.local && <p className="cad-erro">{erros.local}</p>}

            <Campo id="cad-referencia" rotulo="Ponto de referência (aparece no anúncio)" ajuda="Opcional. Ex.: perto da UFV, em frente à rodoviária.">
              <input id="cad-referencia" className="cad-input" type="text" maxLength={120} value={form.referencia} onChange={(e) => mudar('referencia', e.target.value)} />
            </Campo>
            <div className="cad-pontos" role="group" aria-label="Pontos de encontro seguros">
              <span>Ponto de encontro seguro:</span>
              {PONTOS_DE_ENCONTRO.map((ponto) => {
                const texto = `Encontro: ${ponto}`;
                return (
                  <button type="button" key={ponto} className={form.referencia === texto ? 'on' : undefined} aria-pressed={form.referencia === texto} onClick={() => mudar('referencia', form.referencia === texto ? '' : texto)}>
                    {ponto}
                  </button>
                );
              })}
            </div>

            <p className="cad-privado">
              <Icone nome="cadeado" tamanho={17} cor="#3E8B22" />
              A rua, o CEP e o ponto exato ficam só com você. Quem vê o anúncio vê o bairro, a cidade e uma região aproximada.
            </p>

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

            {!ehServico && (
              <fieldset className="cad-entrega">
                <legend>Como levar?<em aria-hidden="true"> *</em></legend>
                <div className="cad-opcoes tres">
                  {Object.entries(TRANSPORTES).map(([valor, opcao], indice) => (
                    <label className={`cad-opcao${form.transporte === valor ? ' on' : ''}`} key={valor}>
                      <input type="radio" name="transporte" id={indice === 0 ? 'cad-transporte' : undefined} value={valor} checked={form.transporte === valor} onChange={() => mudar('transporte', valor)} />
                      <span className="cad-radio" aria-hidden="true" />
                      <span className="cad-opcaotx"><b>{opcao.titulo}</b><i>{opcao.descricao}</i></span>
                      <Icone nome={opcao.icone} tamanho={24} cor={form.transporte === valor ? '#3E8B22' : '#8C918B'} />
                    </label>
                  ))}
                </div>
                {erros.transporte && <p className="cad-erro" role="alert">{erros.transporte}</p>}
              </fieldset>
            )}
          </Secao>
        </div>

        <aside className="cad-lado" aria-label="Pré-visualização e publicação">
          <section className="cad-card cad-previa" aria-labelledby="cad-previa-titulo">
            <div className="cad-previah"><h2 id="cad-previa-titulo">Pré-visualização do anúncio</h2></div>
            <div className="cad-foto">
              {form.fotos[0] ? <img src={form.fotos[0].url} alt="" /> : <Icone nome="imagem" tamanho={44} cor="#9AA39B" espessura={1.4} />}
            </div>
            <p className="cad-pvtitulo">{form.titulo.trim() || 'Título do anúncio'}</p>
            <p className="cad-pvpreco">{preco ? formatarPreco(preco) : 'R$ 0'}</p>
            <div className="cad-pvmeta">
              <span><Icone nome="local" tamanho={17} cor="#8C918B" />{[bairro?.nome, cidade?.nome].filter(Boolean).join(', ') || 'Bairro, cidade'}</span>
              <span><Icone nome="retirada" tamanho={17} cor="#8C918B" />{ENTREGAS[form.entrega]?.titulo}</span>
              {!ehServico && TRANSPORTES[form.transporte] && <span><Icone nome={TRANSPORTES[form.transporte].icone} tamanho={17} cor="#8C918B" />{TRANSPORTES[form.transporte].titulo}</span>}
            </div>
            {!ehServico && form.condicao && <span className="cad-pvtag">{form.condicao}</span>}
            <div className="cad-nota">
              <Icone nome="mensagens" tamanho={21} cor="#3E8B22" />
              <span><b>Negociação via chat</b><i>Não realizamos pagamentos na plataforma.</i></span>
            </div>
            {!temDados && <p className="cad-ajuda">A prévia se completa enquanto você preenche.</p>}
          </section>

          <section className="cad-card cad-dicas" aria-labelledby="cad-dicas-titulo">
            <h2 id="cad-dicas-titulo">Dicas para um bom anúncio</h2>
            <ul>{DICAS.map((d) => <li key={d}><Icone nome="check" tamanho={19} cor="#3E8B22" espessura={2} />{d}</li>)}</ul>
          </section>

          <div className="cad-acoes">
            {!editandoPublicado && (
              <button type="button" className="cad-btn fantasma" onClick={salvarRascunho} disabled={salvando}>
                <Icone nome="marcador" tamanho={20} cor="#16281C" />Salvar rascunho
              </button>
            )}
            <button type="submit" className="cad-btn solido" disabled={salvando}>
              <Icone nome="aviao" tamanho={20} cor="#fff" />{salvando ? 'Salvando…' : editandoPublicado ? 'Salvar alterações' : 'Publicar anúncio'}
            </button>
            {editandoPublicado && (
              <button type="button" className="cad-btn fantasma" onClick={cancelar} disabled={salvando}>
                <Icone nome="fechar" tamanho={20} cor="#16281C" />Cancelar
              </button>
            )}
            <p className="cad-dica"><Icone nome="sino" tamanho={16} cor="#8C918B" />Ao publicar, quem ativou os avisos recebe uma notificação.</p>
          </div>
        </aside>
      </form>
    </>
  );
}

/** Rotas /anunciar (novo) e /anuncios/:id/editar (editar ou continuar um rascunho). */
export default function CadastrarAnuncio() {
  const { id } = useParams();
  const [carga, setCarga] = useState({ id: null, anuncio: null, erro: null });

  useEffect(() => {
    document.title = `DesapegaUai — ${id ? 'Editar anúncio' : 'Cadastrar anúncio'}`;
    if (!id) return undefined;
    let ativo = true;
    verAnuncio(id)
      .then((anuncio) => {
        if (!ativo) return;
        if (!anuncio.eh_meu) setCarga({ id, anuncio: null, erro: 'Só quem publicou pode editar este anúncio.' });
        else setCarga({ id, anuncio, erro: null });
      })
      .catch((erro) => { if (ativo) setCarga({ id, anuncio: null, erro: erro.message }); });
    return () => { ativo = false; };
  }, [id]);

  const carregando = id && carga.id !== id;
  const problema = id && !carregando && !carga.anuncio;

  return (
    <LayoutPainel classeMain="cad-main">
      {carregando && <p className="carregando-tela" role="status">Carregando anúncio…</p>}
      {problema && (
        <div className="cad-card cad-vazio">
          <Icone nome="etiqueta" tamanho={40} cor="#4CA02B" />
          <h1>Anúncio não encontrado</h1>
          <p>{carga.erro ?? 'Ele pode ter sido excluído.'}</p>
          <Link to="/meus-anuncios">Voltar para Meus anúncios</Link>
        </div>
      )}
      {!carregando && !problema && <Formulario key={id ?? 'novo'} existente={id ? carga.anuncio : null} />}
    </LayoutPainel>
  );
}
