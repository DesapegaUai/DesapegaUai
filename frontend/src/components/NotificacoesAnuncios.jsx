import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Toast from './Toast.jsx';
import ContextoNotificacoes from './NotificacoesAnunciosContext.js';
import { api, urlDaApi } from '../services/api.js';
import { iniciais } from '../services/mercadoApi.js';
import { desinscreverAparelho, inscreverAparelho, motivoSemPush, reinscreverSePermitido } from '../services/push.js';
import { useSessao } from '../services/sessao.js';
import { ouvir, quandoReconectar } from '../services/tempoReal.js';

/**
 * Avisos do sininho: histórico (API), chegada em tempo real (Socket.IO) e push no aparelho.
 * São duas chaves no sininho: anúncios novos (desligada por padrão) e mensagens do chat (ligada por
 * padrão). Chave desligada = aquele aviso para de aparecer. Com as duas desligadas não aparece
 * nenhum aviso na tela e o aparelho sai do push; o histórico do sininho e os contadores continuam.
 * Também cuida das mensagens do chat: avisa quando chega uma mensagem nova em qualquer tela
 * e guarda quantas conversas estão com mensagem não lida (o selo no ícone de mensagens).
 */
export function NotificacoesAnunciosProvider({ children }) {
  const { usuario } = useSessao();
  const [itens, setItens] = useState([]);
  const [naoLidas, setNaoLidas] = useState(0);
  const [mensagensNaoLidas, setMensagensNaoLidas] = useState(0);
  const [toque, setToque] = useState(0); // sobe a cada aviso que chega: o sininho balança uma vez
  const [preferencias, setPreferencias] = useState({ anuncios: false, mensagens: true, raio_km: null, cidade: null, bairro: null, push: null });
  // os ouvintes do tempo real leem as preferências mais recentes daqui, sem precisar se reinscrever
  const preferenciasRef = useRef(preferencias);
  useEffect(() => { preferenciasRef.current = preferencias; }, [preferencias]);
  const [aviso, setAviso] = useState(null);
  const [ocupado, setOcupado] = useState(false);

  // extra: { pessoa, link } no aviso de mensagem nova (foto de quem mandou e a conversa que abre ao tocar)
  const informar = useCallback((tipo, titulo, texto, extra = {}) => setAviso({ tipo, titulo, texto, ...extra, chave: Date.now() }), []);

  const recarregar = useCallback(async () => {
    if (!usuario) return;
    const [lista, prefs] = await Promise.all([api.get('/notificacoes?por_pagina=20'), api.get('/notificacoes/preferencias')]);
    setItens(lista.itens);
    setNaoLidas(lista.nao_lidas);
    setPreferencias(prefs);
  }, [usuario]);

  // trocou de conta (ou saiu): os avisos da conta anterior somem
  const [dono, setDono] = useState(usuario?.id ?? null);
  if ((usuario?.id ?? null) !== dono) {
    setDono(usuario?.id ?? null);
    setItens([]);
    setNaoLidas(0);
    setMensagensNaoLidas(0);
    setPreferencias({ anuncios: false, mensagens: true, raio_km: null, cidade: null, bairro: null, push: null });
  }

  useEffect(() => {
    if (!usuario) return undefined;
    let ativo = true;
    const pedidoDePreferencias = api.get('/notificacoes/preferencias');
    Promise.all([api.get('/notificacoes?por_pagina=20'), pedidoDePreferencias])
      .then(([lista, prefs]) => {
        if (!ativo) return;
        setItens(lista.itens);
        setNaoLidas(lista.nao_lidas);
        setPreferencias(prefs);
        // só volta a inscrever o aparelho no push se a pessoa não desligou os avisos
        if (prefs.anuncios || prefs.mensagens) reinscreverSePermitido();
      })
      .catch(() => {});
    const pararNova = ouvir('nova_notificacao', (nova) => {
      setItens((lista) => [nova, ...lista.filter((n) => n.id !== nova.id)].slice(0, 20));
      setNaoLidas((total) => total + 1);
      setToque((vezes) => vezes + 1);
      // o aviso entra no histórico de qualquer jeito; só aparece na tela se a pessoa não desligou tudo
      const { anuncios, mensagens } = preferenciasRef.current;
      if (!document.hidden && (anuncios || mensagens)) {
        informar('info', nova.titulo, nova.texto, {
          imagem: urlDaApi(nova.foto), // a foto de capa do anúncio publicado
          link: nova.anuncio_id ? `/anuncio/${nova.anuncio_id}` : null,
        });
      }
    });
    const pararLidas = ouvir('notificacoes_lidas', ({ nao_lidas: total }) => setNaoLidas(total));

    // Mensagens do chat. O servidor conta as conversas não lidas; aqui só pedimos de novo quando algo muda.
    // `pedido` garante que uma resposta atrasada não passe por cima de uma mais nova.
    let pedido = 0;
    const contarMensagens = () => {
      pedido += 1;
      const meu = pedido;
      api.get('/conversas/nao-lidas')
        .then(({ total }) => { if (ativo && meu === pedido) setMensagensNaoLidas(total); })
        .catch(() => {});
    };
    contarMensagens();

    // abriu o site (ou entrou na conta) com mensagem esperando: avisa na hora, sem precisar ativar nada.
    // Na mesma aba, só avisa de novo se chegou mais mensagem desde o último aviso.
    Promise.all([api.get('/conversas/nao-lidas'), pedidoDePreferencias])
      .then(([{ total }, prefs]) => {
        if (!ativo || !total || !prefs.mensagens || window.location.pathname.startsWith('/conversas')) return;
        const chave = `desapegauai:mensagens-avisadas:${usuario.id}`;
        try {
          if (Number(sessionStorage.getItem(chave)) >= total) return;
          sessionStorage.setItem(chave, String(total));
        } catch {
          // sem sessionStorage (aba anônima): avisa assim mesmo
        }
        informar('info', 'Você tem mensagem nova', total === 1 ? '1 conversa com mensagem não lida.' : `${total} conversas com mensagem não lida.`, { link: '/conversas' });
      })
      .catch(() => {});

    // mensagem que chegou com o site fora da tela: o aviso aparece quando a pessoa voltar
    let chegouForaDaTela = null;
    const pararMensagem = ouvir('nova_mensagem', (mensagem) => {
      if (Number(mensagem.remetente_id) === Number(usuario.id)) return; // fui eu que mandei
      contarMensagens();
      if (!preferenciasRef.current.mensagens) return;
      const texto = String(mensagem.texto ?? '') || (mensagem.foto ? '📷 Foto' : '');
      // como no WhatsApp: a foto e o nome de quem mandou (sem foto, as iniciais do perfil) e o texto
      const nome = mensagem.remetente?.nome ?? '';
      const aviso = {
        conversaId: mensagem.conversa_id,
        titulo: nome || 'Nova mensagem',
        resumo: texto.length > 90 ? `${texto.slice(0, 90)}…` : texto,
        extra: { pessoa: { nome, foto: urlDaApi(mensagem.remetente?.foto_url), iniciais: iniciais(nome) }, link: `/conversas/${mensagem.conversa_id}` },
      };
      if (document.hidden) {
        chegouForaDaTela = aviso;
        return;
      }
      // quem já está com essa conversa aberta vê a mensagem chegar na própria tela
      if (window.location.pathname === `/conversas/${mensagem.conversa_id}`) return;
      informar('info', aviso.titulo, aviso.resumo, aviso.extra);
    });
    const aoVoltarParaOSite = () => {
      if (document.hidden || !chegouForaDaTela) return;
      const aviso = chegouForaDaTela;
      chegouForaDaTela = null;
      if (window.location.pathname !== `/conversas/${aviso.conversaId}`) informar('info', aviso.titulo, aviso.resumo, aviso.extra);
    };
    document.addEventListener('visibilitychange', aoVoltarParaOSite);
    const pararLeitura = ouvir('mensagens_lidas', ({ leitor_id: leitorId }) => {
      if (Number(leitorId) === Number(usuario.id)) contarMensagens();
    });
    const pararConversa = ouvir('conversa_criada', contarMensagens);

    const pararReconexao = quandoReconectar(() => { recarregar().catch(() => {}); contarMensagens(); });
    return () => {
      ativo = false;
      pararNova(); pararLidas(); pararMensagem(); pararLeitura(); pararConversa(); pararReconexao();
      document.removeEventListener('visibilitychange', aoVoltarParaOSite);
    };
  }, [usuario, recarregar, informar]);

  // número de conversas com mensagem não lida no título da aba, como "(2) DesapegaUai": dá para ver
  // de outra aba. As telas trocam o título sozinhas, então o número volta sempre que o título muda.
  useEffect(() => {
    const prefixo = mensagensNaoLidas > 0 ? `(${mensagensNaoLidas}) ` : '';
    const aplicar = () => {
      const titulo = prefixo + document.title.replace(/^\(\d+\) /, '');
      if (document.title !== titulo) document.title = titulo;
    };
    aplicar();
    const elemento = document.querySelector('title');
    if (!elemento) return undefined;
    const observador = new MutationObserver(aplicar);
    observador.observe(elemento, { childList: true, characterData: true, subtree: true });
    return () => observador.disconnect();
  }, [mensagensNaoLidas]);

  const ativar = useCallback(async (raioKm = preferencias.raio_km) => {
    if (!usuario) return informar('info', 'Entre na sua conta para receber avisos');
    setOcupado(true);
    try {
      setPreferencias(await api.put('/notificacoes/preferencias', { anuncios: true, raio_km: raioKm }));
      await recarregar();
      // O push depende de a pessoa responder ao pedido do navegador, que pode demorar ou nem aparecer.
      // Os avisos com o site aberto já estão ligados: o interruptor não fica preso esperando.
      const pedidoDePush = inscreverAparelho().catch((erro) => ({ ok: false, motivo: erro.message }));
      const push = await Promise.race([pedidoDePush, new Promise((seguir) => { setTimeout(() => seguir(null), 4000); })]);
      informar('sucesso', 'Avisos de anúncios novos ativados',
        push === null ? 'Para receber também com o site fechado, permita as notificações quando o navegador pedir.'
          : push.ok ? 'Você vai receber os avisos neste aparelho, mesmo com o site fechado.' : push.motivo);
    } catch (erro) {
      informar('erro', 'Não foi possível ativar os avisos', erro.message);
    } finally {
      setOcupado(false);
    }
  }, [usuario, preferencias.raio_km, informar, recarregar]);

  const desativar = useCallback(async () => {
    setOcupado(true);
    try {
      const novas = await api.put('/notificacoes/preferencias', { anuncios: false });
      setPreferencias(novas);
      // desligou tudo: o aparelho também sai do push, para não chegar nada com o site fechado
      if (!novas.mensagens) await desinscreverAparelho().catch(() => {});
      // o servidor apaga os avisos de anúncio que já tinham chegado; tira da caixinha na hora
      // e depois confere com o servidor (os de avaliação continuam)
      setItens((lista) => lista.filter((n) => n.tipo !== 'novo_anuncio'));
      await recarregar().catch(() => {});
      informar('info', 'Avisos de anúncios novos desativados', 'Os avisos de anúncio que já tinham chegado foram removidos.');
    } catch (erro) {
      informar('erro', 'Não foi possível desativar os avisos', erro.message);
    } finally {
      setOcupado(false);
    }
  }, [informar, recarregar]);

  // liga ou desliga os avisos de mensagem nova do chat
  const avisarMensagens = useCallback(async (ligar) => {
    setOcupado(true);
    try {
      const novas = await api.put('/notificacoes/preferencias', { mensagens: ligar });
      setPreferencias(novas);
      if (!novas.mensagens && !novas.anuncios) await desinscreverAparelho().catch(() => {});
      informar('info', ligar ? 'Avisos de mensagens ativados' : 'Avisos de mensagens desativados');
    } catch (erro) {
      informar('erro', 'Não foi possível mudar os avisos de mensagens', erro.message);
    } finally {
      setOcupado(false);
    }
  }, [informar]);

  const mudarRaio = useCallback(async (raioKm) => {
    try {
      setPreferencias(await api.put('/notificacoes/preferencias', { raio_km: raioKm }));
    } catch (erro) {
      informar('erro', 'Não foi possível mudar a distância dos avisos', erro.message);
    }
  }, [informar]);

  // de onde quero receber os avisos de anúncio: uma cidade (com ou sem bairro) ou, com cidade null, por distância
  const mudarLocalidade = useCallback(async (cidadeId, bairroId = null) => {
    try {
      setPreferencias(await api.put('/notificacoes/preferencias', { cidade_id: cidadeId, bairro_id: bairroId }));
    } catch (erro) {
      informar('erro', 'Não foi possível mudar a localidade dos avisos', erro.message);
    }
  }, [informar]);

  const marcarLidas = useCallback(async () => {
    if (!naoLidas) return;
    try {
      const { nao_lidas: total } = await api.patch('/notificacoes/lidas', {});
      setNaoLidas(total);
      setItens((lista) => lista.map((n) => ({ ...n, lida: true })));
    } catch (erro) {
      informar('erro', 'Não foi possível marcar como lidas', erro.message);
    }
  }, [naoLidas, informar]);

  // abriu um aviso: só ele vira lido, e o número do sininho passa a contar os que ainda não foram abertos
  const marcarLida = useCallback(async (id) => {
    const aviso = itens.find((n) => n.id === id);
    if (!aviso || aviso.lida) return;
    // tira do contador na hora; se o servidor recusar, a próxima carga corrige
    setItens((lista) => lista.map((n) => (n.id === id ? { ...n, lida: true } : n)));
    setNaoLidas((total) => Math.max(0, total - 1));
    try {
      const { nao_lidas: total } = await api.patch('/notificacoes/lidas', { ids: [id] });
      setNaoLidas(total);
    } catch {
      recarregar().catch(() => {});
    }
  }, [itens, recarregar]);

  useEffect(() => {
    const aoSair = () => desinscreverAparelho().catch(() => {});
    window.addEventListener('desapegauai:logout', aoSair);
    return () => window.removeEventListener('desapegauai:logout', aoSair);
  }, []);

  const contexto = useMemo(() => ({
    logado: Boolean(usuario), itens, naoLidas, mensagensNaoLidas, toque, ocupado,
    ativadas: preferencias.anuncios, mensagensAtivadas: preferencias.mensagens !== false, raioKm: preferencias.raio_km,
    cidade: preferencias.cidade ?? null, bairro: preferencias.bairro ?? null, push: preferencias.push, motivoSemPush: motivoSemPush(),
    ativar, desativar, avisarMensagens, mudarRaio, mudarLocalidade, marcarLidas, marcarLida, informar,
  }), [usuario, itens, naoLidas, mensagensNaoLidas, toque, ocupado, preferencias, ativar, desativar, avisarMensagens, mudarRaio, mudarLocalidade, marcarLidas, marcarLida, informar]);

  return (
    <ContextoNotificacoes.Provider value={contexto}>
      <Toast aviso={aviso} onFechar={() => setAviso(null)} />
      {children}
    </ContextoNotificacoes.Provider>
  );
}
