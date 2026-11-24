// Áudio do chat: o que o gravador (CaixaMensagem) e o balão (AudioDoChat) usam.
// As ondas seguem a mesma conta do servidor (backend/src/services/audioDoChat.js): cada barrinha é o
// volume de um pedaço do áudio, de 0 (silêncio, fica reto) a 31 (fala alta).

export const MAXIMO_DE_SEGUNDOS = 120;
export const BARRAS = 40;
const NIVEL_MAXIMO = 31;

/** 7 → "0:07" · 75 → "1:15" */
export const duracaoEmTexto = (segundos) => `${Math.floor(segundos / 60)}:${String(Math.floor(segundos % 60)).padStart(2, '0')}`;

/** As ondas que a API manda ("00af…", um caractere por barrinha) viram números de 0 a 31. */
export function niveisDasOndas(ondas) {
  const niveis = [...String(ondas ?? '')].map((letra) => parseInt(letra, 32)).filter(Number.isFinite);
  return niveis.length ? niveis : Array(BARRAS).fill(0);
}

/** Volume (0 a 1, como o do microfone) para o nível da barrinha: -50 dB ou menos é reto, -12 dB ou mais é cheio. */
export function nivelDoVolume(volume) {
  const decibeis = volume > 0 ? 20 * Math.log10(volume) : -100;
  return Math.round(Math.max(0, Math.min(1, (decibeis + 50) / 38)) * NIVEL_MAXIMO);
}

/** Junta os níveis medidos durante a gravação (vários por segundo) em poucas barrinhas, pela média. */
export function resumirNiveis(niveis, barras = BARRAS) {
  if (!niveis.length) return Array(barras).fill(0);
  return Array.from({ length: barras }, (_, i) => {
    const inicio = Math.floor((i * niveis.length) / barras);
    const fim = Math.max(inicio + 1, Math.floor(((i + 1) * niveis.length) / barras));
    const pedaco = niveis.slice(inicio, fim);
    return Math.round(pedaco.reduce((soma, n) => soma + n, 0) / pedaco.length);
  });
}

/** Altura da barrinha em px: 3 no silêncio (uma linha reta) e até 24 na fala alta. */
export const alturaDaBarra = (nivel) => 3 + Math.round((Math.max(0, Math.min(NIVEL_MAXIMO, nivel)) / NIVEL_MAXIMO) * 21);

/** O navegador deixa gravar? Precisa de HTTPS (ou localhost), do microfone e do gravador do navegador. */
export const podeGravarAudio = () => typeof window !== 'undefined' && window.isSecureContext
  && Boolean(navigator.mediaDevices?.getUserMedia) && typeof window.MediaRecorder !== 'undefined';

/** Formato da gravação: o primeiro que o navegador aceita (o servidor converte qualquer um deles para M4A). */
export function formatoDeGravacao() {
  if (typeof MediaRecorder === 'undefined') return '';
  const opcoes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
  return opcoes.find((tipo) => MediaRecorder.isTypeSupported?.(tipo)) ?? '';
}

/** Mensagem para a pessoa quando o microfone não abre. */
export function textoDoErroDoMicrofone(erro) {
  if (erro?.name === 'NotAllowedError' || erro?.name === 'SecurityError') {
    return 'O microfone está bloqueado para este site. Toque no ícone ao lado do endereço do site, libere o Microfone e tente de novo.';
  }
  if (erro?.name === 'NotFoundError' || erro?.name === 'OverconstrainedError') return 'Nenhum microfone foi encontrado neste aparelho.';
  if (erro?.name === 'NotReadableError') return 'O microfone está sendo usado por outro programa. Feche o outro programa e tente de novo.';
  return 'Não foi possível usar o microfone. Tente de novo.';
}
