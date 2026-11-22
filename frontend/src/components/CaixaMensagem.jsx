import { useCallback, useEffect, useEffectEvent, useLayoutEffect, useRef, useState } from 'react';
import Icone from './IconeMarketplace.jsx';
import SeletorEmoji from './SeletorEmoji.jsx';
import CameraFoto from './CameraFoto.jsx';
import MenuRapido from './MenuRapido.jsx';
import { ANEXOS, PONTOS_DE_ENCONTRO, RESPOSTAS_RAPIDAS } from '../services/conversas.js';
import { formatarPreco, formatarTamanho } from '../services/formatar.js';
import useMediaQuery, { CELULAR } from '../hooks/useMediaQuery.js';

let proximoId = 1;

/**
 * Caixa de mensagem do chat:
 * respostas rápidas · [anexar] [câmera] [texto + emoji] [enviar]. As dicas de segurança ficam no escudo do topo da conversa.
 * - Anexos: fotos JPG, PNG ou WebP (até 5, 8 MB cada), com prévia antes de enviar. Também entram
 *   colando um print (Ctrl+V) ou arrastando a imagem para cima da conversa.
 * - Câmera: tira uma foto na hora e ela entra nos anexos (mesmos limites).
 *   Computador: janela com a webcam ao vivo · celular/tablet: câmera do próprio aparelho.
 * - Emoji: painel com 4 grupos; insere onde o cursor está.
 * - Enter envia · Shift+Enter quebra linha.
 */
// edicao: { texto, temFoto } quando a pessoa está editando uma mensagem já enviada (os anexos somem)
export default function CaixaMensagem({ onEnviar, nomeContato, onDigitar, preco = null, podeOfertar = false, edicao = null, onCancelarEdicao }) {
  const [texto, setTexto] = useState(edicao?.texto ?? '');
  const [anexos, setAnexos] = useState([]);
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [emojiAberto, setEmojiAberto] = useState(false);
  const [cameraAberta, setCameraAberta] = useState(false);
  const [soltando, setSoltando] = useState(false); // arrastando uma imagem por cima da conversa
  const ehCelular = useMediaQuery(CELULAR);
  const raizRef = useRef(null);
  const campoRef = useRef(null);
  const arquivoRef = useRef(null);
  const cameraRef = useRef(null);
  const botaoEmojiRef = useRef(null);
  const anexosRef = useRef(anexos);
  useEffect(() => { anexosRef.current = anexos; }, [anexos]);

  // Libera as prévias que não foram enviadas
  useEffect(() => () => anexosRef.current.forEach((a) => URL.revokeObjectURL(a.url)), []);

  // Campo cresce até ~5 linhas
  useLayoutEffect(() => {
    const campo = campoRef.current;
    if (!campo) return;
    campo.style.height = '';
    if (!texto) return; // vazio: altura padrão (o placeholder não pode esticar o campo)
    campo.style.height = 'auto';
    campo.style.height = `${Math.min(campo.scrollHeight, 132)}px`;
  }, [texto]);

  // editando uma foto, a legenda pode ficar vazia
  const podeEnviar = edicao ? texto.trim().length > 0 || edicao.temFoto : texto.trim().length > 0 || anexos.length > 0;

  async function enviar() {
    if (!podeEnviar) return;
    setEnviando(true);
    try {
      const resultado = await onEnviar({ texto: texto.trim(), anexos });
      if (resultado === false) return;
      setTexto('');
      setAnexos([]);
      setErro('');
      setEmojiAberto(false);
      campoRef.current?.focus();
    } catch (falha) {
      setErro(falha.message);
    } finally {
      setEnviando(false);
    }
  }

  // editando: o cursor já vai para o fim do texto
  useEffect(() => {
    if (!edicao) return;
    const campo = campoRef.current;
    campo?.focus();
    campo?.setSelectionRange(campo.value.length, campo.value.length);
  }, [edicao]);

  function aoTeclar(e) {
    if (e.key === 'Escape' && edicao) {
      e.preventDefault();
      onCancelarEdicao?.();
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      enviar();
    }
  }

  function inserirNoCursor(trecho) {
    const campo = campoRef.current;
    const ini = campo?.selectionStart ?? texto.length;
    const fim = campo?.selectionEnd ?? texto.length;
    const novo = texto.slice(0, ini) + trecho + texto.slice(fim);
    setTexto(novo);
    requestAnimationFrame(() => {
      if (!campo) return;
      campo.focus();
      const pos = ini + trecho.length;
      campo.setSelectionRange(pos, pos);
    });
  }

  function usarRespostaRapida(frase) {
    setTexto((atual) => (atual.trim() ? `${atual.trimEnd()} ${frase}` : frase));
    campoRef.current?.focus();
  }

  // oferta com o valor já calculado: quem compra não precisa fazer conta nem esconder o preço
  const ofertas = [10, 15].map((desconto) => {
    const valor = Math.round(Number(preco) * (100 - desconto)) / 100;
    return { rotulo: `${desconto}% a menos: ${formatarPreco(valor)}`, frase: `Faço uma oferta de ${formatarPreco(valor)}. Você aceita?` };
  });
  ofertas.push({ rotulo: 'Outro valor', frase: 'Faço uma oferta de R$ ' });

  function escolherArquivos(e) {
    const escolhidos = Array.from(e.target.files ?? []);
    e.target.value = ''; // permite escolher o mesmo arquivo de novo
    adicionarArquivos(escolhidos);
  }

  function abrirCamera() {
    setEmojiAberto(false);
    if (anexos.length >= ANEXOS.maxArquivos) {
      setErro(`Não deu para anexar: no máximo ${ANEXOS.maxArquivos} fotos por mensagem.`);
      return;
    }
    // Celular/tablet: a câmera do próprio aparelho é melhor (foco, flash, qualidade)
    if (window.matchMedia('(pointer: coarse)').matches) cameraRef.current?.click();
    else setCameraAberta(true);
  }

  const fecharCamera = useCallback(() => setCameraAberta(false), []);

  function usarFoto(arquivo) {
    adicionarArquivos([arquivo]);
    setCameraAberta(false);
  }

  function escolherFotoNoLugar() {
    setCameraAberta(false);
    cameraRef.current?.click(); // sem câmera: abre a escolha de imagem do aparelho
  }

  function adicionarArquivos(escolhidos) {
    const problemas = [];
    const novos = [];
    escolhidos.forEach((arquivo) => {
      if (anexos.length + novos.length >= ANEXOS.maxArquivos) {
        problemas.push(`no máximo ${ANEXOS.maxArquivos} fotos por mensagem`);
        return;
      }
      if (!ANEXOS.tipos.includes(arquivo.type)) {
        problemas.push('só dá para mandar fotos JPG, PNG ou WebP');
        return;
      }
      if (arquivo.size > ANEXOS.maxBytes) {
        problemas.push(`“${arquivo.name}” passa de ${formatarTamanho(ANEXOS.maxBytes)}`);
        return;
      }
      novos.push({
        id: proximoId++,
        arquivo, // é este File que vai para a API
        nome: arquivo.name,
        tamanho: arquivo.size,
        tipo: arquivo.type,
        url: URL.createObjectURL(arquivo),
      });
    });
    setAnexos((atual) => [...atual, ...novos]);
    setErro(problemas.length ? `Não deu para anexar: ${[...new Set(problemas)].join('; ')}.` : '');
  }

  // imagem que chegou colando (print) ou arrastando: entra nos anexos, com a mesma prévia e os mesmos limites
  const receberImagens = useEffectEvent((arquivos) => {
    if (!arquivos.length) return;
    if (edicao) {
      setErro('Termine ou cancele a edição para anexar foto.');
      return;
    }
    adicionarArquivos(arquivos);
    campoRef.current?.focus();
  });

  // Ctrl+V com um print ou uma imagem copiada. Vale com o cursor no campo ou em qualquer lugar da tela,
  // menos em outro campo de texto (a busca de conversas, por exemplo).
  useEffect(() => {
    const colar = (e) => {
      const alvo = e.target;
      const outroCampo = alvo instanceof Element && alvo !== campoRef.current && alvo.closest('input, textarea, [contenteditable="true"]');
      const dados = e.clipboardData;
      if (outroCampo || !dados) return;
      // a imagem pode vir na lista de arquivos ou só na lista de itens (depende do navegador)
      const dosItens = Array.from(dados.items ?? []).filter((item) => item.kind === 'file').map((item) => item.getAsFile()).filter(Boolean);
      const imagens = (dados.files?.length ? Array.from(dados.files) : dosItens).filter((arquivo) => arquivo.type.startsWith('image/'));
      // texto copiado (até do Word, que manda uma imagem junto) continua colando como texto
      if (!imagens.length || dados.getData('text/plain')) return;
      e.preventDefault();
      const extensao = { 'image/jpeg': 'jpg', 'image/webp': 'webp' };
      // o print colado chega como "image.png": ganha um nome que a pessoa reconhece na prévia
      receberImagens(imagens.map((arquivo) => (arquivo.name && arquivo.name !== 'image.png' ? arquivo
        : new File([arquivo], `print.${extensao[arquivo.type] ?? 'png'}`, { type: arquivo.type }))));
    };
    document.addEventListener('paste', colar);
    return () => document.removeEventListener('paste', colar);
  }, []);

  // arrastar a imagem para cima da conversa: a conversa ganha uma borda e, ao soltar, a imagem vira anexo
  useEffect(() => {
    const area = raizRef.current?.closest('.conversa') ?? raizRef.current;
    if (!area) return undefined;
    let espera = null;
    const temArquivo = (e) => Array.from(e.dataTransfer?.types ?? []).includes('Files');
    const passando = (e) => {
      if (!temArquivo(e)) return;
      e.preventDefault(); // deixa soltar aqui (sem isso o navegador abre a imagem em outra aba)
      e.dataTransfer.dropEffect = 'copy';
      setSoltando(true);
      clearTimeout(espera); // o navegador repete esse aviso enquanto a imagem está em cima da conversa
      espera = setTimeout(() => setSoltando(false), 250);
    };
    const soltar = (e) => {
      if (!temArquivo(e)) return;
      e.preventDefault();
      clearTimeout(espera);
      setSoltando(false);
      const dados = e.dataTransfer;
      const dosItens = Array.from(dados.items ?? []).filter((item) => item.kind === 'file').map((item) => item.getAsFile()).filter(Boolean);
      receberImagens(dados.files?.length ? Array.from(dados.files) : dosItens);
    };
    area.addEventListener('dragenter', passando);
    area.addEventListener('dragover', passando);
    area.addEventListener('drop', soltar);
    return () => {
      clearTimeout(espera);
      area.removeEventListener('dragenter', passando);
      area.removeEventListener('dragover', passando);
      area.removeEventListener('drop', soltar);
    };
  }, []);

  // a borda tracejada fica na conversa inteira, que é onde dá para soltar
  useEffect(() => {
    const area = raizRef.current?.closest('.conversa');
    area?.classList.toggle('soltando', soltando);
    return () => area?.classList.remove('soltando');
  }, [soltando]);

  function removerAnexo(id) {
    setAnexos((atual) => {
      const alvo = atual.find((a) => a.id === id);
      if (alvo) URL.revokeObjectURL(alvo.url);
      return atual.filter((a) => a.id !== id);
    });
  }

  const fecharEmoji = useCallback((devolverFoco) => {
    setEmojiAberto(false);
    if (devolverFoco === true) botaoEmojiRef.current?.focus();
  }, []);

  return (
    <div className="composer" ref={raizRef}>
      {soltando && (
        <div className="editando-barra" role="status">
          <Icone nome="clipe" tamanho={18} cor="#3E8B22" />
          <span><b>Solte a imagem para anexar</b></span>
        </div>
      )}
      {edicao && (
        <div className="editando-barra" role="status">
          <Icone nome="lapis" tamanho={18} cor="#3E8B22" />
          <span><b>Editando mensagem</b><span className="editando-dica"> · Enter salva, Esc cancela</span></span>
          <button type="button" aria-label="Cancelar edição" title="Cancelar edição" onClick={onCancelarEdicao}>
            <Icone nome="fechar" tamanho={18} cor="#6B726C" />
          </button>
        </div>
      )}
      {!edicao && (
      <div className="rapidas" role="group" aria-label="Respostas rápidas">
        {RESPOSTAS_RAPIDAS.map((frase) => (
          <button key={frase} type="button" className="rapida" onClick={() => usarRespostaRapida(frase)}>
            {frase}
          </button>
        ))}
        <MenuRapido
          rotulo="Ponto de encontro"
          icone="local"
          itens={PONTOS_DE_ENCONTRO.map((ponto) => ({ rotulo: ponto, frase: `Podemos nos encontrar em: ${ponto}?` }))}
          onEscolher={(item) => usarRespostaRapida(item.frase)}
        />
        {podeOfertar && Number(preco) > 0 && (
          <MenuRapido rotulo="Fazer oferta" icone="etiqueta" itens={ofertas} onEscolher={(item) => usarRespostaRapida(item.frase)} />
        )}
      </div>
      )}

      {erro && <p className="erro-anexo" role="alert">{erro}</p>}

      {anexos.length > 0 && (
        <ul className="anexos-previa" aria-label="Anexos para enviar">
          {anexos.map((a) => {
            const ehImagem = a.tipo.startsWith('image/');
            return (
              <li key={a.id} className={`anexo-item${ehImagem ? ' imagem' : ''}`}>
                {ehImagem ? (
                  <img src={a.url} alt={a.nome} />
                ) : (
                  <>
                    <span className="doc"><Icone nome="documento" tamanho={22} cor="#3E8B22" /></span>
                    <span>
                      <span className="nome">{a.nome}</span>
                      <span className="tam">{formatarTamanho(a.tamanho)}</span>
                    </span>
                  </>
                )}
                <button
                  type="button"
                  className="anexo-remover"
                  aria-label={`Remover ${a.nome}`}
                  onClick={() => removerAnexo(a.id)}
                >
                  <Icone nome="fechar" tamanho={13} cor="#fff" espessura={2.4} />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="linha-envio">
        {!edicao && (
        <>
        <button
          type="button"
          className="circ"
          aria-label="Anexar foto"
          title="Anexar foto (também dá para colar um print com Ctrl+V ou arrastar a imagem para a conversa)"
          onClick={() => arquivoRef.current?.click()}
        >
          <Icone nome="clipe" tamanho={22} cor="#3E8B22" espessura={1.7} />
        </button>
        <input
          ref={arquivoRef}
          type="file"
          className="oculto"
          tabIndex={-1}
          multiple
          accept={ANEXOS.aceitos}
          onChange={escolherArquivos}
          aria-hidden="true"
        />

        <button
          type="button"
          className="circ"
          aria-label="Tirar foto com a câmera"
          aria-haspopup="dialog"
          title="Tirar foto"
          onClick={abrirCamera}
        >
          <Icone nome="camera" tamanho={22} cor="#3E8B22" espessura={1.7} />
        </button>
        <input
          ref={cameraRef}
          type="file"
          className="oculto"
          tabIndex={-1}
          accept={ANEXOS.aceitos}
          capture="environment"
          onChange={escolherArquivos}
          aria-hidden="true"
        />
        {cameraAberta && (
          <CameraFoto onUsar={usarFoto} onFechar={fecharCamera} onEscolherArquivo={escolherFotoNoLugar} />
        )}
        </>
        )}

        <div className="campo-msg">
          <label htmlFor="campo-mensagem" className="oculto">Mensagem para {nomeContato}</label>
          <textarea
            id="campo-mensagem"
            ref={campoRef}
            rows={1}
            placeholder={ehCelular ? 'Mensagem…' : 'Escreva uma mensagem…'} // celular: 3 botões redondos deixam pouco espaço
            value={texto}
            onChange={(e) => { setTexto(e.target.value); onDigitar?.(); }}
            onKeyDown={aoTeclar}
            enterKeyHint="send"
          />
          <button
            type="button"
            ref={botaoEmojiRef}
            className={`btn-emoji${emojiAberto ? ' on' : ''}`}
            aria-label="Inserir emoji"
            aria-expanded={emojiAberto}
            aria-controls="painel-emoji"
            title="Emoji"
            onClick={() => setEmojiAberto((a) => !a)}
          >
            <Icone nome="emoji" tamanho={23} cor="#3E8B22" espessura={1.7} />
          </button>
          {emojiAberto && (
            <SeletorEmoji
              id="painel-emoji"
              onEscolher={inserirNoCursor}
              onFechar={fecharEmoji}
              ignorarRef={botaoEmojiRef}
            />
          )}
        </div>

        <button
          type="button"
          className="circ enviar"
          aria-label={edicao ? 'Salvar edição' : 'Enviar mensagem'}
          disabled={!podeEnviar || enviando}
          onClick={enviar}
        >
          <Icone nome={edicao ? 'check' : 'enviar'} tamanho={22} cor="#fff" />
        </button>
      </div>
    </div>
  );
}
