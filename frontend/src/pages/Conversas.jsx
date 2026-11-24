import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import LayoutMarketplace from '../components/LayoutMarketplace.jsx';
import AudioDoChat from '../components/AudioDoChat.jsx';
import CaixaMensagem from '../components/CaixaMensagem.jsx';
import MenuMensagem from '../components/MenuMensagem.jsx';
import Icone from '../components/IconeMarketplace.jsx';
import Toast from '../components/Toast.jsx';
import CartaoAvaliacao from '../components/CartaoAvaliacao.jsx';
import CartaoCompromisso from '../components/CartaoCompromisso.jsx';
import DenunciarUsuario from '../components/DenunciarUsuario.jsx';
import MenuConversa from '../components/MenuConversa.jsx';
import { lerArquivadas, salvarArquivadas, posicaoDoMenu } from '../services/conversas.js';
import { carregarMinhasAvaliacoes, daConversa, useAvaliacoes } from '../services/avaliacoes.js';
import { formatarPreco } from '../services/formatar.js';
import {
  apagarMensagemPelaApi, editarMensagemPelaApi, enviarAudioPelaApi, enviarFotosPelaApi, enviarMensagemPelaApi, enviarVideoPelaApi, excluirConversa, iniciais, listarConversas, listarMensagens, mensagemDaApi, mudarStatus, textoDoUltimoAcesso,
} from '../services/mercadoApi.js';
import { urlDaApi } from '../services/api.js';
import { useSessao } from '../services/sessao.js';
import { avisar as avisarSocket, emitir, ouvir, quandoReconectar, useTempoReal } from '../services/tempoReal.js';
import { pedirAvisosDeMensagem } from '../services/push.js';
import '../styles/marketplace-conversas.css';
import '../styles/marketplace-perfil-publico.css';

const FILTROS = [
  { id: 'todas', rotulo: 'Todas', teste: () => true },
  { id: 'nao-lidas', rotulo: 'Não lidas', teste: (c) => c.naoLidas > 0 },
  { id: 'vendendo', rotulo: 'Vendendo', teste: (c) => c.vendendo },
  { id: 'comprando', rotulo: 'Comprando', teste: (c) => !c.vendendo },
  { id: 'arquivadas', rotulo: 'Arquivadas', teste: () => true }, // mostra só as arquivadas; os outros filtros escondem
];

function previa(conversa) {
  const ultima = conversa.mensagens.at(-1);
  if (!ultima) return 'Conversa iniciada';
  if (ultima.apagada) return ultima.autor === 'eu' ? 'Você apagou esta mensagem' : 'Mensagem apagada';
  const texto = ultima.texto || (ultima.temFoto ? '📷 Foto' : ultima.temVideo ? '🎥 Vídeo' : ultima.audioSegundos ? `🎤 Áudio (${duracaoEmTexto(ultima.audioSegundos)})` : '');
  return ultima.autor === 'eu' ? `Você: ${texto}` : texto;
}

function quando(conversa) {
  const ultima = conversa.mensagens.at(-1);
  if (!ultima) return '';
  return ultima.dia === 'Hoje' ? ultima.hora : ultima.dia;
}

const CHAVE_BARRA_DO_ANUNCIO = 'desapegauai:barra-do-anuncio';

const duracaoEmTexto = (segundos) => `${Math.floor(segundos / 60)}:${String(Math.floor(segundos % 60)).padStart(2, '0')}`;

// Vídeo no balão, como no WhatsApp: parado, mostra a imagem com o botão de play e a duração; tocando, mostra
// os controles. O #t=0.1 faz o iPhone mostrar o primeiro quadro. Tocar no vídeo não abre o menu da mensagem.
function VideoDoChat({ url }) {
  const [tocando, setTocando] = useState(false);
  const [duracao, setDuracao] = useState(null);
  const videoRef = useRef(null);
  return (
    <div className={`bolha-video-quadro${tocando ? ' tocando' : ''}`} onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
      <video
        ref={videoRef}
        className="bolha-video"
        src={`${url}#t=0.1`}
        controls={tocando}
        playsInline
        preload="metadata"
        onLoadedMetadata={(e) => setDuracao(e.currentTarget.duration)}
        aria-label="Vídeo enviado na conversa"
      />
      {!tocando && (
        <button type="button" className="video-play" aria-label="Assistir o vídeo" onClick={() => { setTocando(true); videoRef.current?.play().catch(() => {}); }}>
          <span aria-hidden="true" />
        </button>
      )}
      {!tocando && Number.isFinite(duracao) && (
        <span className="video-duracao" aria-hidden="true">
          <svg viewBox="0 0 16 12" width="16" height="12"><rect x="0" y="1" width="11" height="10" rx="2" fill="#fff" /><path d="M11 6l5-3v6z" fill="#fff" /></svg>
          {duracaoEmTexto(duracao)}
        </span>
      )}
    </div>
  );
}

function Avatar({ conversa, grande }) {
  return (
    <span className={`avatar${grande ? ' g' : ''}`} aria-hidden="true">
      {conversa.foto ? <img src={conversa.foto} alt="" referrerPolicy="no-referrer" /> : conversa.iniciais}
      {conversa.online && <span className="on-dot" />}
    </span>
  );
}

/** Conversas em tempo real: mensagens, lidas, "digitando" e quem está online. */
export default function Conversas() {
  const { id } = useParams();
  const navegar = useNavigate();
  const { usuario } = useSessao();
  const { conectado } = useTempoReal();
  const meuId = usuario?.id;
  const [toast, setToast] = useState(null);
  const [conversas, setConversas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [carregandoAvaliacoes, setCarregandoAvaliacoes] = useState(true);
  const [filtro, setFiltro] = useState('todas');
  const [busca, setBusca] = useState('');
  const [digitando, setDigitando] = useState({});
  const avaliacoes = useAvaliacoes();
  const msgsRef = useRef(null);
  const abertaRef = useRef(null);
  const ultimoAvisoDigitando = useRef(0);
  const conversasRef = useRef([]);
  useLayoutEffect(() => { conversasRef.current = conversas; }, [conversas]);
  const avisar = useCallback((tipo, titulo, texto) => setToast({ tipo, titulo, texto, chave: Date.now() }), []);

  // opções de uma mensagem (editar, apagar para mim, apagar para todos) e a mensagem que está sendo editada
  const [menuMensagem, setMenuMensagem] = useState(null); // { mensagem, posicao, origem }
  const [editando, setEditando] = useState(null);
  // muda quando a conversa aberta precisa ser lida de novo da API (voltou a conexão ou a pessoa voltou para o site):
  // o celular desliga o tempo real em segundo plano, e os avisos de "entregue" e "lida" desse intervalo se perdem
  const [recarregarAberta, setRecarregarAberta] = useState(0);
  // barra do anúncio: começa recolhida numa faixa fina, para sobrar espaço para a conversa;
  // tocar (ou puxar para baixo) abre. A escolha fica guardada neste navegador.
  const [anuncioAberto, setAnuncioAberto] = useState(() => {
    try { return localStorage.getItem(CHAVE_BARRA_DO_ANUNCIO) === 'aberta'; } catch { return false; }
  });
  const inicioDoToque = useRef(null);
  const fecharMenuDaMensagem = useCallback((devolverFoco) => {
    setMenuMensagem((atual) => {
      if (devolverFoco === true) atual?.origem?.focus();
      return null;
    });
  }, []);
  // troca uma mensagem pela versão nova (editada ou apagada para todos), nas duas telas
  const trocarMensagem = useCallback((conversaId, nova) => {
    setConversas((lista) => lista.map((c) => (c.id === conversaId
      ? { ...c, mensagens: c.mensagens.map((m) => (m.id === nova.id ? nova : m)) }
      : c)));
  }, []);
  // tira a mensagem da tela ("apagar para mim")
  const tirarMensagem = useCallback((conversaId, mensagemId) => {
    setConversas((lista) => lista.map((c) => (c.id === conversaId
      ? { ...c, mensagens: c.mensagens.filter((m) => m.id !== mensagemId) }
      : c)));
  }, []);

  // arquivadas saem da lista principal e ficam no filtro "Arquivadas" (guardado neste navegador)
  const [arquivadas, setArquivadas] = useState(() => lerArquivadas(meuId));
  const mudarArquivadas = useCallback((conversaId, arquivar) => setArquivadas((atuais) => {
    if (atuais.has(conversaId) === arquivar) return atuais;
    const novas = new Set(atuais);
    if (arquivar) novas.add(conversaId); else novas.delete(conversaId);
    salvarArquivadas(meuId, novas);
    return novas;
  }), [meuId]);
  const [focarAvaliacao, setFocarAvaliacao] = useState(null); // conversa em que o menu pediu "Avaliar"

  // só a conversa que a pessoa abriu (abrir é o que marca como lida e deixa os tiques azuis do outro lado)
  const selecionada = id ? conversas.find((c) => String(c.id) === String(id)) ?? null : null;
  const selecionadaId = selecionada?.id;
  useLayoutEffect(() => { abertaRef.current = selecionadaId; }, [selecionadaId]);
  const naoLidas = conversas.reduce((t, c) => t + (c.naoLidas > 0 ? 1 : 0), 0);
  const podeAvaliar = (c) => c.anuncio.vendido && !c.vendendo;
  const [marcandoVendido, setMarcandoVendido] = useState(false);

  // Quem vende fecha a negociação aqui mesmo: o anúncio vira "vendido" e quem comprou já pode avaliar.
  async function marcarComoVendido() {
    if (!selecionada || marcandoVendido) return;
    const comprador = selecionada.nome.split(' ')[0];
    if (!window.confirm(`Marcar "${selecionada.anuncio.titulo}" como vendido? O anúncio sai da busca e ${comprador} poderá avaliar você.`)) return;
    setMarcandoVendido(true);
    try {
      await mudarStatus(selecionada.anuncio.id, 'vendido');
      const anuncioId = selecionada.anuncio.id;
      setConversas((lista) => lista.map((c) => (c.anuncio.id === anuncioId ? { ...c, anuncio: { ...c.anuncio, status: 'vendido', vendido: true } } : c)));
      avisar('sucesso', 'Anúncio marcado como vendido', `${comprador} já pode avaliar você aqui no chat.`);
    } catch (erro) {
      avisar('erro', 'Não foi possível marcar como vendido', erro.message);
    } finally {
      setMarcandoVendido(false);
    }
  }

  // Reservado: combinou com alguém, mas ainda não entregou. O anúncio continua na busca, com a etiqueta.
  async function reservarOuLiberar() {
    if (!selecionada || marcandoVendido) return;
    const novoStatus = selecionada.anuncio.status === 'reservado' ? 'ativo' : 'reservado';
    setMarcandoVendido(true);
    try {
      await mudarStatus(selecionada.anuncio.id, novoStatus);
      const anuncioId = selecionada.anuncio.id;
      setConversas((lista) => lista.map((c) => (c.anuncio.id === anuncioId ? { ...c, anuncio: { ...c.anuncio, status: novoStatus } } : c)));
      avisar('sucesso', novoStatus === 'reservado' ? 'Anúncio reservado' : 'Reserva retirada',
        novoStatus === 'reservado' ? 'Ele continua na busca, com a etiqueta Reservado.' : 'O anúncio voltou a aparecer como disponível.');
    } catch (erro) {
      avisar('erro', 'Não foi possível mudar o anúncio', erro.message);
    } finally {
      setMarcandoVendido(false);
    }
  }

  // ---- opções dos três pontinhos, na lista de conversas ----

  // Excluir: tira da minha caixa. Para a outra pessoa nada muda.
  async function excluirConversaDaLista(conversa) {
    const nome = conversa.nome.split(' ')[0];
    if (!window.confirm(`Excluir a conversa com ${nome}? Ela sai da sua lista e você não verá mais estas mensagens. ${nome} continua com a conversa.`)) return;
    try {
      await excluirConversa(conversa.id);
      setConversas((lista) => lista.filter((c) => c.id !== conversa.id));
      mudarArquivadas(conversa.id, false);
      if (conversa.id === selecionadaId) navegar('/conversas', { replace: true });
      avisar('sucesso', 'Conversa excluída', 'Ela saiu da sua caixa de mensagens.');
    } catch (erro) {
      avisar('erro', 'Não foi possível excluir a conversa', erro.message);
    }
  }

  // Arquivar: sai da lista principal e fica no filtro "Arquivadas". Desarquivar: volta.
  function arquivarOuDesarquivar(conversa) {
    const arquivar = !arquivadas.has(conversa.id);
    mudarArquivadas(conversa.id, arquivar);
    if (arquivar && conversa.id === selecionadaId) navegar('/conversas', { replace: true });
    if (arquivar) avisar('sucesso', 'Conversa arquivada', 'Ela fica no filtro Arquivadas e volta para a lista se chegar mensagem nova.');
    else avisar('sucesso', 'Conversa desarquivada', 'Ela voltou para a lista de conversas.');
  }

  // Avaliação: abre a conversa no cartão de avaliar, ou explica quando ela vai ficar disponível.
  function abrirAvaliacao(conversa) {
    const primeiroNome = conversa.nome.split(' ')[0];
    if (conversa.vendendo) {
      avisar('info', 'Quem avalia é quem comprou', conversa.anuncio.vendido
        ? `${primeiroNome} pode avaliar você por esta conversa.`
        : `Marque o anúncio como vendido para ${primeiroNome} poder avaliar você.`);
      return;
    }
    if (!conversa.anuncio.vendido) {
      avisar('info', 'A avaliação ainda não está liberada', `Você poderá dar as estrelas quando ${primeiroNome} marcar o anúncio como vendido.`);
      return;
    }
    setFocarAvaliacao(conversa.id);
    navegar(`/conversas/${conversa.id}`);
  }

  // a conversa pedida abriu: rola até o cartão de avaliação
  useEffect(() => {
    if (focarAvaliacao === null || focarAvaliacao !== selecionadaId || carregandoAvaliacoes) return undefined;
    const espera = setTimeout(() => {
      const cartao = msgsRef.current?.querySelector('.aval-cartao, .aval-depois');
      if (cartao) {
        cartao.scrollIntoView({ behavior: 'smooth', block: 'center' });
        cartao.querySelector('input, button')?.focus({ preventScroll: true });
      }
      setFocarAvaliacao(null);
    }, 300);
    return () => clearTimeout(espera);
  }, [focarAvaliacao, selecionadaId, carregandoAvaliacoes]);

  const recarregarLista = useCallback(() => {
    if (!meuId) return Promise.resolve();
    return listarConversas(meuId)
      .then((resultado) => setConversas((atuais) => resultado.itens.map((nova) => {
        const antiga = atuais.find((c) => c.id === nova.id);
        return antiga && antiga.mensagens.length > 1 ? { ...nova, mensagens: antiga.mensagens } : nova;
      })))
      .catch((erro) => avisar('erro', 'Não foi possível carregar as conversas', erro.message));
  }, [meuId, avisar]);

  useEffect(() => { document.title = 'DesapegaUai — Conversas'; }, []);

  useEffect(() => {
    let ativo = true;
    if (!meuId) return undefined;
    listarConversas(meuId)
      .then((resultado) => { if (ativo) setConversas(resultado.itens); })
      .catch((erro) => { if (ativo) avisar('erro', 'Não foi possível carregar as conversas', erro.message); })
      .finally(() => { if (ativo) setCarregando(false); });
    carregarMinhasAvaliacoes()
      .catch(() => {})
      .finally(() => { if (ativo) setCarregandoAvaliacoes(false); });
    return () => { ativo = false; };
  }, [meuId, avisar]);

  useEffect(() => {
    if (!carregando && id && !conversas.some((c) => String(c.id) === String(id))) navegar('/conversas', { replace: true });
  }, [carregando, conversas, id, navegar]);

  // abriu a conversa: carrega as mensagens (o servidor marca como lidas e avisa o outro lado)
  useEffect(() => {
    if (selecionadaId === undefined || !meuId) return undefined;
    let ativo = true;
    listarMensagens(selecionadaId, meuId)
      .then((resultado) => {
        if (!ativo) return;
        setConversas((lista) => lista.map((c) => (c.id === selecionadaId
          ? {
            ...c,
            anuncio: { ...c.anuncio, ...resultado.anuncio, vendido: resultado.anuncio.status === 'vendido' },
            online: resultado.outro_usuario?.online ?? c.online,
            ultimoAcesso: resultado.outro_usuario?.ultimo_acesso ?? c.ultimoAcesso,
            mensagens: resultado.mensagens,
            naoLidas: 0,
          }
          : c)));
      })
      .catch((erro) => { if (ativo) avisar('erro', 'Não foi possível carregar as mensagens', erro.message); });
    return () => { ativo = false; };
  }, [selecionadaId, meuId, avisar, recarregarAberta]);

  // tempo real
  useEffect(() => {
    if (!meuId) return undefined;
    const parares = [
      ouvir('perfil_atualizado', ({ id: quem, nome, foto_url: foto }) => {
        setConversas((lista) => lista.map((c) => (Number(c.outro_usuario?.id) === Number(quem)
          ? { ...c, nome, foto: urlDaApi(foto), iniciais: iniciais(nome), outro_usuario: { ...c.outro_usuario, nome, foto_url: foto } }
          : c)));
      }),
      ouvir('nova_mensagem', (dados) => {
        const mensagem = mensagemDaApi(dados, meuId);
        const aberta = String(dados.conversa_id) === String(abertaRef.current);
        const conhecida = conversasRef.current.some((c) => c.id === dados.conversa_id);
        setConversas((lista) => {
          const i = lista.findIndex((c) => c.id === dados.conversa_id);
          if (i < 0) return lista;
          const c = lista[i];
          const atualizada = {
            ...c,
            mensagens: [...c.mensagens.filter((m) => m.id !== mensagem.id), mensagem],
            naoLidas: mensagem.minha || aberta ? c.naoLidas : c.naoLidas + 1,
          };
          return [atualizada, ...lista.filter((_, j) => j !== i)];
        });
        setDigitando((d) => ({ ...d, [dados.conversa_id]: false }));
        if (!mensagem.minha) mudarArquivadas(dados.conversa_id, false); // mensagem nova tira do arquivo
        if (!conhecida) recarregarLista();
        if (aberta && !mensagem.minha && !document.hidden) emitir('marcar_lidas', { conversa_id: dados.conversa_id }).catch(() => {});
      }),
      ouvir('mensagem_editada', (dados) => trocarMensagem(dados.conversa_id, mensagemDaApi(dados, meuId))),
      ouvir('mensagem_apagada', (dados) => trocarMensagem(dados.conversa_id, mensagemDaApi(dados, meuId))),
      ouvir('mensagem_oculta', ({ conversa_id: conversaId, id: mensagemId }) => tirarMensagem(conversaId, mensagemId)),
      ouvir('mensagens_lidas', ({ conversa_id: conversaId, leitor_id: leitorId }) => {
        if (leitorId === meuId) return;
        setConversas((lista) => lista.map((c) => (c.id === conversaId
          ? { ...c, mensagens: c.mensagens.map((m) => (m.minha ? { ...m, lida: true, entregue: true } : m)) }
          : c)));
      }),
      // a mensagem chegou no aparelho da outra pessoa: dois tiques sem cor
      ouvir('mensagens_entregues', ({ conversa_id: conversaId, ate_id: ateId }) => {
        setConversas((lista) => lista.map((c) => (c.id === conversaId
          ? { ...c, mensagens: c.mensagens.map((m) => (m.minha && m.id <= ateId ? { ...m, entregue: true } : m)) }
          : c)));
      }),
      ouvir('digitando', ({ conversa_id: conversaId }) => {
        setDigitando((d) => ({ ...d, [conversaId]: Date.now() }));
        setTimeout(() => setDigitando((d) => (Date.now() - (d[conversaId] || 0) >= 3000 ? { ...d, [conversaId]: false } : d)), 3100);
      }),
      ouvir('presenca', ({ usuario_id: outroId, online, ultimo_acesso: ultimoAcesso }) => {
        setConversas((lista) => lista.map((c) => (c.outro_usuario.id === outroId ? { ...c, online, ultimoAcesso: ultimoAcesso ?? c.ultimoAcesso } : c)));
      }),
      ouvir('conversa_criada', () => recarregarLista()),
      // excluí a conversa em outra aba ou aparelho: some daqui também
      ouvir('conversa_excluida', ({ conversa_id: excluidaId }) => setConversas((lista) => lista.filter((c) => c.id !== excluidaId))),
      // o vendedor marcou como vendido: o cartão de avaliação aparece na hora para quem comprou
      ouvir('anuncio_removido', ({ id: anuncioId, motivo }) => {
        if (motivo !== 'vendido') return;
        setConversas((lista) => lista.map((c) => (c.anuncio.id === anuncioId ? { ...c, anuncio: { ...c.anuncio, status: 'vendido', vendido: true } } : c)));
      }),
      // o vendedor reservou ou liberou o anúncio: a etiqueta muda na hora dos dois lados
      ouvir('anuncio_atualizado', ({ id: anuncioId, status }) => {
        if (!status) return;
        setConversas((lista) => lista.map((c) => (c.anuncio.id === anuncioId ? { ...c, anuncio: { ...c.anuncio, status, vendido: status === 'vendido' } } : c)));
      }),
      quandoReconectar(() => {
        recarregarLista();
        // tiques, edições e mensagens apagadas enquanto estava sem conexão; com o site em segundo plano,
        // espera a pessoa voltar (ler a conversa marca como lida, e ninguém está olhando)
        if (!document.hidden) setRecarregarAberta((n) => n + 1);
      }),
    ];
    return () => parares.forEach((parar) => parar());
  }, [meuId, recarregarLista, mudarArquivadas, trocarMensagem, tirarMensagem]);

  // voltou para a aba com a conversa aberta: o que chegou enquanto ela estava escondida passa a contar como lido
  useEffect(() => {
    const aoVoltar = () => {
      if (document.hidden || abertaRef.current == null) return;
      emitir('marcar_lidas', { conversa_id: abertaRef.current }).catch(() => {});
      setRecarregarAberta((n) => n + 1); // e atualiza os tiques das mensagens que eu mandei
    };
    document.addEventListener('visibilitychange', aoVoltar);
    return () => document.removeEventListener('visibilitychange', aoVoltar);
  }, []);

  useLayoutEffect(() => {
    const caixa = msgsRef.current;
    if (caixa) caixa.scrollTop = caixa.scrollHeight;
  }, [selecionada?.id, selecionada?.mensagens.length]);

  const visiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const teste = FILTROS.find((f) => f.id === filtro).teste;
    const soArquivadas = filtro === 'arquivadas';
    return conversas.filter((c) => arquivadas.has(c.id) === soArquivadas && teste(c)
      && (!termo || c.nome.toLowerCase().includes(termo) || c.anuncio.titulo.toLowerCase().includes(termo)));
  }, [conversas, filtro, busca, arquivadas]);

  function mostrarAnuncio(aberto) {
    setAnuncioAberto(aberto);
    try { localStorage.setItem(CHAVE_BARRA_DO_ANUNCIO, aberto ? 'aberta' : 'recolhida'); } catch { /* sem localStorage: vale só agora */ }
  }

  function avisarQueEstouDigitando() {
    if (!selecionada || Date.now() - ultimoAvisoDigitando.current < 2000) return;
    ultimoAvisoDigitando.current = Date.now();
    avisarSocket('digitando', { conversa_id: selecionada.id });
  }

  async function enviar({ texto, anexos }) {
    if (!selecionada) return false;
    if (editando) {
      try {
        const { mensagem } = await editarMensagemPelaApi(selecionada.id, editando.id, texto);
        trocarMensagem(selecionada.id, mensagemDaApi(mensagem, meuId));
        setEditando(null);
        return true;
      } catch (erro) {
        avisar('erro', 'Não foi possível editar a mensagem', erro.message);
        return false;
      }
    }
    // primeira mensagem: o navegador pergunta se pode avisar quando responderem, mesmo com o site fechado
    pedirAvisosDeMensagem()
      .then((permitiu) => { if (permitiu) avisar('sucesso', 'Avisos de mensagem ligados', 'Você vai receber um aviso quando responderem, mesmo com o site fechado.'); })
      .catch(() => {});
    try {
      let enviadas;
      if (anexos.length > 0) {
        // fotos e vídeos vão pela API (arquivo não passa pelo Socket.IO); o texto vira a legenda do último
        const fotos = anexos.filter((a) => !a.tipo.startsWith('video/'));
        const videos = anexos.filter((a) => a.tipo.startsWith('video/'));
        enviadas = [];
        if (fotos.length) enviadas.push(...(await enviarFotosPelaApi(selecionada.id, fotos.map((a) => a.arquivo), videos.length ? '' : texto)).mensagens);
        for (const [i, video] of videos.entries()) {
          enviadas.push((await enviarVideoPelaApi(selecionada.id, video.arquivo, i === videos.length - 1 ? texto : '')).mensagem);
        }
      } else {
        try {
          enviadas = [(await emitir('enviar_mensagem', { conversa_id: selecionada.id, texto })).mensagem];
        } catch (erroSocket) {
          if (conectado) throw erroSocket;
          enviadas = [(await enviarMensagemPelaApi(selecionada.id, texto)).mensagem];
        }
      }
      const locais = enviadas.map((mensagem) => mensagemDaApi({ ...mensagem, minha: true }, meuId));
      const ids = new Set(locais.map((m) => m.id));
      setConversas((lista) => lista.map((c) => (c.id === selecionada.id
        ? { ...c, mensagens: [...c.mensagens.filter((m) => !ids.has(m.id)), ...locais] }
        : c)));
      return true;
    } catch (erro) {
      avisar('erro', 'Mensagem não enviada', erro.message);
      return false;
    }
  }

  // áudio gravado na caixa de mensagem: vai pela API (o servidor converte e desenha as ondas)
  async function enviarAudio(gravacao) {
    if (!selecionada) return false;
    try {
      const { mensagem } = await enviarAudioPelaApi(selecionada.id, gravacao);
      const local = mensagemDaApi({ ...mensagem, minha: true }, meuId);
      setConversas((lista) => lista.map((c) => (c.id === selecionada.id
        ? { ...c, mensagens: [...c.mensagens.filter((m) => m.id !== local.id), local] }
        : c)));
      return true;
    } catch (erro) {
      avisar('erro', 'Áudio não enviado', erro.message);
      return false;
    }
  }

  async function apagarMensagem(mensagem, para) {
    if (!selecionada) return;
    try {
      if (para === 'todos') {
        const { mensagem: apagada } = await apagarMensagemPelaApi(selecionada.id, mensagem.id, 'todos');
        trocarMensagem(selecionada.id, mensagemDaApi(apagada, meuId));
      } else {
        await apagarMensagemPelaApi(selecionada.id, mensagem.id, 'mim');
        tirarMensagem(selecionada.id, mensagem.id);
      }
      if (editando?.id === mensagem.id) setEditando(null);
    } catch (erro) {
      avisar('erro', 'Não foi possível apagar a mensagem', erro.message);
    }
  }

  // tocar na mensagem abre as opções (no link da foto, abre a foto)
  function abrirMenuDaMensagem(evento, mensagem) {
    if (evento.target.closest('a')) return;
    setMenuMensagem({ mensagem, posicao: posicaoDoMenu(evento.currentTarget, mensagem.minha), origem: evento.currentTarget });
  }

  // Celular: como no WhatsApp, apertar e segurar a mensagem abre as opções; só tocar não abre nada.
  // Computador: clicar ou usar o botão direito abre. Pelo teclado, Enter abre.
  const toque = useRef({ espera: null, x: 0, y: 0, abriu: false, tipo: 'mouse' });
  useEffect(() => {
    const t = toque.current;
    return () => clearTimeout(t.espera);
  }, []);

  function aoApertarBolha(e, mensagem) {
    const t = toque.current;
    t.tipo = e.pointerType;
    t.abriu = false;
    if (e.pointerType !== 'touch' || e.target.closest('button')) return;
    const bolha = e.currentTarget;
    t.x = e.clientX;
    t.y = e.clientY;
    clearTimeout(t.espera);
    t.espera = setTimeout(() => {
      t.abriu = true;
      navigator.vibrate?.(15); // um toque leve no Android, como no WhatsApp
      setMenuMensagem({ mensagem, posicao: posicaoDoMenu(bolha, mensagem.minha), origem: bolha });
    }, 450);
  }

  function aoMexerNaBolha(e) {
    const t = toque.current;
    if (Math.hypot(e.clientX - t.x, e.clientY - t.y) > 10) clearTimeout(t.espera); // está rolando a conversa
  }

  function aoSoltarBolha() {
    clearTimeout(toque.current.espera);
  }

  function aoClicarBolha(e, mensagem) {
    const t = toque.current;
    if (t.abriu) {
      // acabou de segurar: o "soltar" não abre a foto nem o vídeo
      e.preventDefault();
      t.abriu = false;
      return;
    }
    if (t.tipo === 'touch') return;
    abrirMenuDaMensagem(e, mensagem);
  }

  function aoMenuDoNavegador(e, mensagem) {
    e.preventDefault(); // nada do menu do navegador (copiar, salvar imagem) por cima das opções
    if (toque.current.tipo !== 'touch') abrirMenuDaMensagem(e, mensagem);
  }

  const statusDoContato = (c) => (digitando[c.id] ? 'digitando…' : c.online ? 'Online agora' : textoDoUltimoAcesso(c.ultimoAcesso));

  return (
    <LayoutMarketplace comAbas={false} comFab={false} classeConteudo={`pag-conversas${id ? ' conversa-aberta' : ''}`}>
      <Toast aviso={toast} onFechar={() => setToast(null)} />
      {/* sem o título na tela, para sobrar espaço para a conversa (o leitor de tela continua lendo) */}
      <h1 className="oculto">Conversas{naoLidas > 0 ? ` (${naoLidas} ${naoLidas === 1 ? 'não lida' : 'não lidas'})` : ''}</h1>
      {!conectado && <div className="conv-reconectando"><span className="titulo-selo alerta" role="status">Reconectando…</span></div>}

      <div className={`conv-corpo${id ? ' aberta' : ''}`}>
        <section className="lista-conv" aria-label="Lista de conversas">
          <div className="lista-topo">
            <div className="busca-conv">
              <Icone nome="busca" tamanho={19} cor="#4CA02B" espessura={1.7} />
              <label htmlFor="busca-conversa" className="oculto">Buscar conversa</label>
              <input id="busca-conversa" type="search" placeholder="Buscar conversa" value={busca} onChange={(e) => setBusca(e.target.value)} autoComplete="off" />
            </div>
            <div className="chips-conv" role="group" aria-label="Filtrar conversas">
              {FILTROS.map((f) => (
                <button key={f.id} type="button" className={`chip-s${filtro === f.id ? ' on' : ''}`} aria-pressed={filtro === f.id} onClick={() => setFiltro(f.id)}>{f.rotulo}</button>
              ))}
            </div>
          </div>

          <div className="itens-conv">
            {visiveis.length === 0 && <p className="lista-vazia">{carregando ? 'Carregando conversas…' : filtro === 'arquivadas' ? 'Nenhuma conversa arquivada.' : 'Nenhuma conversa ainda. Abra um anúncio e toque em Conversar.'}</p>}
            {visiveis.map((c) => {
              const on = c.id === selecionada?.id;
              return (
                <div key={c.id} className="item-conv-caixa">
                  <Link to={`/conversas/${c.id}`} className={`item-conv${on ? ' on' : ''}${c.naoLidas ? ' nao-lida' : ''}`} aria-current={on ? 'true' : undefined}>
                    <Avatar conversa={c} />
                    <span className="item-txt">
                      <span className="item-l1"><span className="item-nome">{c.nome}</span><span className="item-hora">{quando(c)}</span></span>
                      <span className="item-anuncio">{c.anuncio.titulo}</span>
                      <span className="item-l3">
                        <span className="item-msg">{digitando[c.id] ? 'digitando…' : previa(c)}</span>
                        {!carregandoAvaliacoes && c.naoLidas === 0 && podeAvaliar(c) && !daConversa(avaliacoes, c.id) && (
                          <span className="item-avaliar"><Icone nome="estrela" tamanho={12} cor="none" preenchimento="#3E8B22" espessura={0} />Avaliar</span>
                        )}
                        {c.naoLidas > 0 && <span className="item-qtd" aria-label={`${c.naoLidas} não lidas`}>{c.naoLidas}</span>}
                      </span>
                    </span>
                  </Link>
                  <MenuConversa
                    conversa={c}
                    arquivada={arquivadas.has(c.id)}
                    onArquivar={arquivarOuDesarquivar}
                    onAvaliar={abrirAvaliacao}
                    onExcluir={excluirConversaDaLista}
                  />
                </div>
              );
            })}
          </div>
        </section>

        {selecionada ? (
          <section className="conversa" aria-label={`Conversa com ${selecionada.nome}`}>
            <div className="conv-topo">
              <Link className="conv-voltar" to="/conversas" aria-label="Voltar para a lista"><Icone nome="seta-esquerda" tamanho={20} cor="#3E8B22" /></Link>
              <Link className="link-perfil" to={`/usuario/${selecionada.outro_usuario.id}`} aria-label={`Ver o perfil de ${selecionada.nome}`}>
                <Avatar conversa={selecionada} grande />
              </Link>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h2 className="conv-nome"><Link className="link-perfil" to={`/usuario/${selecionada.outro_usuario.id}`} title="Ver perfil">{selecionada.nome}</Link></h2>
                <div className="conv-status" aria-live="polite">
                  {selecionada.online && <span className="pt-verde" />}
                  <span>{statusDoContato(selecionada)}</span>
                </div>
              </div>
              <div className="conv-acoes">
                {/* aqui ficam só segurança e denúncia; arquivar, avaliar e excluir estão nos três pontinhos da lista */}
                <button type="button" className="conv-acao conv-seguranca" aria-label="Dicas de segurança" title="Dicas de segurança" onClick={() => navegar('/ajuda/dicas-de-seguranca')}>
                  <Icone nome="escudo-simples" tamanho={22} cor="#3E8B22" />
                </button>
                <DenunciarUsuario
                  key={selecionada.id}
                  conversa={selecionada}
                  onDenunciado={() => avisar('sucesso', 'Denúncia enviada', 'Obrigado por avisar. Vamos analisar o que aconteceu.')}
                />
              </div>
            </div>

            <div
              className={`conv-anuncio${anuncioAberto ? '' : ' recolhida'}`}
              onTouchStart={(e) => { inicioDoToque.current = e.touches[0].clientY; }}
              onTouchEnd={(e) => {
                // puxar para baixo abre a barra; empurrar para cima recolhe
                const distancia = e.changedTouches[0].clientY - (inicioDoToque.current ?? e.changedTouches[0].clientY);
                inicioDoToque.current = null;
                if (distancia > 30 && !anuncioAberto) mostrarAnuncio(true);
                else if (distancia < -30 && anuncioAberto) mostrarAnuncio(false);
              }}
            >
              {!anuncioAberto ? (
                <button type="button" className="conv-anuncio-faixa" aria-expanded="false" onClick={() => mostrarAnuncio(true)} title="Mostrar o anúncio">
                  <span className="mini">{selecionada.anuncio.foto ? <img src={selecionada.anuncio.foto} alt="" /> : <Icone nome="etiqueta" tamanho={18} cor="#4CA02B" />}</span>
                  <span className="t">{selecionada.anuncio.titulo}</span>
                  <span className="p">
                    {formatarPreco(selecionada.anuncio.preco)}
                    {selecionada.anuncio.vendido && <span className="tag-vendido">Vendido</span>}
                    {selecionada.anuncio.status === 'reservado' && <span className="tag-vendido reservado">Reservado</span>}
                  </span>
                  <span className="oculto">Mostrar o anúncio</span>
                  <Icone nome="seta-baixo" tamanho={20} cor="#3E8B22" />
                </button>
              ) : (
              <>
              <span className="mini">{selecionada.anuncio.foto ? <img src={selecionada.anuncio.foto} alt="" /> : <Icone nome="etiqueta" tamanho={24} cor="#4CA02B" />}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="t">{selecionada.anuncio.titulo}</div>
                <div className="p">
                  {formatarPreco(selecionada.anuncio.preco)}
                  {selecionada.anuncio.vendido && <span className="tag-vendido">Vendido</span>}
                  {selecionada.anuncio.status === 'reservado' && <span className="tag-vendido reservado">Reservado</span>}
                </div>
              </div>
              {selecionada.vendendo && !selecionada.anuncio.vendido && (
                <>
                  <button type="button" className="btn-ver" disabled={marcandoVendido} onClick={reservarOuLiberar}>
                    {selecionada.anuncio.status === 'reservado' ? 'Tirar reserva' : 'Reservar'}
                  </button>
                  <button type="button" className="btn-ver btn-vendido" disabled={marcandoVendido} onClick={marcarComoVendido}>
                    {marcandoVendido ? 'Marcando…' : 'Marcar como vendido'}
                  </button>
                </>
              )}
              <Link className="btn-ver" to={`/anuncio/${selecionada.anuncio.id}`}>Ver anúncio</Link>
              <button type="button" className="conv-anuncio-recolher" aria-expanded="true" aria-label="Esconder o anúncio" title="Esconder o anúncio" onClick={() => mostrarAnuncio(false)}>
                <Icone nome="seta-baixo" tamanho={20} cor="#3E8B22" />
              </button>
              </>
              )}
            </div>

            <div className="msgs" ref={msgsRef} role="log" aria-live="polite" aria-label="Mensagens" tabIndex={0}>
              {selecionada.mensagens.length === 0 && <p className="lista-vazia">Mande a primeira mensagem para {selecionada.nome.split(' ')[0]}.</p>}
              {selecionada.mensagens.map((m, i) => {
                const anterior = selecionada.mensagens[i - 1];
                const proxima = selecionada.mensagens[i + 1];
                // como no iPhone: mensagens seguidas da mesma pessoa ficam juntas, e só a última tem o "rabinho"
                const primeira = !anterior || anterior.autor !== m.autor || anterior.dia !== m.dia;
                const ultima = !proxima || proxima.autor !== m.autor || proxima.dia !== m.dia;
                const midia = !m.apagada && Boolean(m.foto || m.video);
                return (
                <Fragment key={m.id}>
                  {m.dia !== anterior?.dia && <div className="dia"><span>{m.dia}</span></div>}
                  <div className={`linha-msg${m.autor === 'eu' ? ' eu' : ''}${primeira ? ' primeira' : ''}${ultima ? ' ultima' : ''}`}>
                    <div
                      className={`bolha${m.apagada ? ' apagada' : ''}${midia ? ' midia' : ''}${midia && !m.texto ? ' so-midia' : ''}${m.audio && !m.apagada ? ' com-audio' : ''}${m.editada ? ' com-editada' : ''}${menuMensagem?.mensagem.id === m.id ? ' em-destaque' : ''}`}
                      role="button"
                      tabIndex={0}
                      aria-haspopup="menu"
                      aria-label={`${m.apagada ? 'Mensagem apagada' : m.texto || (m.video ? 'Vídeo' : m.audio ? `Áudio de ${duracaoEmTexto(m.audio.segundos ?? 0)}` : 'Foto')}. Abrir opções da mensagem`}
                      onPointerDown={(e) => aoApertarBolha(e, m)}
                      onPointerMove={aoMexerNaBolha}
                      onPointerUp={aoSoltarBolha}
                      onPointerCancel={aoSoltarBolha}
                      onClick={(e) => aoClicarBolha(e, m)}
                      onContextMenu={(e) => aoMenuDoNavegador(e, m)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrirMenuDaMensagem(e, m); } }}
                    >
                      {m.apagada && <p className="texto-apagada">{m.autor === 'eu' ? 'Você apagou esta mensagem' : 'Mensagem apagada'}</p>}
                      {m.foto && (
                        <div className="bolha-anexos">
                          <a className="bolha-img" href={m.foto.grande} target="_blank" rel="noreferrer" aria-label="Abrir a foto em tamanho grande">
                            <img src={m.foto.pequena} alt={m.texto ? `Foto: ${m.texto}` : 'Foto enviada na conversa'} width="240" height="240" />
                          </a>
                        </div>
                      )}
                      {m.video && (
                        <div className="bolha-anexos">
                          <VideoDoChat url={m.video.url} />
                        </div>
                      )}
                      {m.audio && (
                        <AudioDoChat
                          url={m.audio.url}
                          segundos={m.audio.segundos}
                          ondas={m.audio.ondas}
                          foto={m.autor === 'eu' ? urlDaApi(usuario?.foto_url) : selecionada.foto}
                          iniciais={m.autor === 'eu' ? iniciais(usuario?.nome ?? '') : selecionada.iniciais}
                        />
                      )}
                      {m.texto && <p>{m.texto}</p>}
                      <div className="meta">
                        {m.editada && <span className="editada">editada</span>}
                        <span>{m.hora}</span>
                        {/* como no WhatsApp: ✓ enviada, ✓✓ entregue (chegou no aparelho), ✓✓ azul lida */}
                        {m.autor === 'eu' && !m.apagada && (() => {
                          const estado = m.lida ? 'Lida' : m.entregue ? 'Entregue' : 'Enviada';
                          return (
                            <span className={`tiques ${estado.toLowerCase()}`} aria-label={estado} title={estado}>
                              <Icone nome={estado === 'Enviada' ? 'check' : 'lida'} tamanho={16} cor={estado === 'Lida' ? '#BFF0FF' : 'rgba(255,255,255,.85)'} espessura={estado === 'Lida' ? 2.4 : undefined} />
                            </span>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                </Fragment>
                );
              })}
              {digitando[selecionada.id] && <p className="digitando" aria-live="polite">{selecionada.nome.split(' ')[0]} está digitando…</p>}
              {selecionada.anuncio.vendido && (
                <CartaoCompromisso
                  key={`compromisso-${selecionada.id}`}
                  conversa={selecionada}
                  onRespondido={() => avisar('sucesso', 'Resposta registrada', 'Obrigado por contar como foi o combinado.')}
                />
              )}
              {/* depois de avaliar, a caixa some da conversa (o aviso "Avaliação enviada" confirma) */}
              {!carregandoAvaliacoes && podeAvaliar(selecionada) && !daConversa(avaliacoes, selecionada.id) && (
                <CartaoAvaliacao
                  key={selecionada.id}
                  conversa={selecionada}
                  onAvaliado={() => avisar('sucesso', 'Avaliação enviada', `Obrigado! A nota já aparece no perfil de ${selecionada.nome.split(' ')[0]}.`)}
                />
              )}
            </div>

            {menuMensagem && (
              <MenuMensagem
                mensagem={menuMensagem.mensagem}
                posicao={menuMensagem.posicao}
                onEditar={(m) => setEditando(m)}
                onApagarParaMim={(m) => apagarMensagem(m, 'mim')}
                onApagarParaTodos={(m) => apagarMensagem(m, 'todos')}
                onFechar={fecharMenuDaMensagem}
              />
            )}
            <CaixaMensagem
              key={`${selecionada.id}-${editando?.id ?? 'nova'}`}
              edicao={editando ? { texto: editando.texto, temFoto: editando.temFoto || editando.temVideo } : null}
              onCancelarEdicao={() => setEditando(null)}
              nomeContato={selecionada.nome}
              onEnviar={enviar}
              onEnviarAudio={enviarAudio}
              onDigitar={avisarQueEstouDigitando}
              preco={selecionada.anuncio.preco}
              podeOfertar={!selecionada.vendendo && !selecionada.anuncio.vendido}
            />
          </section>
        ) : (
          <section className="conversa" aria-label="Conversa">
            <p className="lista-vazia">{carregando ? 'Carregando conversas…' : 'Selecione uma conversa para começar.'}</p>
          </section>
        )}
      </div>
    </LayoutMarketplace>
  );
}
