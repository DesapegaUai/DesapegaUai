// Moderação de fotos e vídeos do DesapegaUai, sem serviço pago e sem mandar a imagem para fora: o NSFW.js
// (modelo MobileNetV2, licença MIT) roda aqui no servidor, em WebAssembly, numa linha de execução separada
// (moderacaoDeImagem.trabalhador.js), para a API não travar enquanto analisa. O modelo dá a chance de a
// imagem ser de cada tipo:
//   Neutral (comum), Drawing (desenho), Sexy (sensual: biquíni, maiô, lingerie), Porn (nudez, sexo) e
//   Hentai (desenho pornográfico).
// Recusa quando Porn + Hentai chega a 70%; no vídeo, um quadro com 85% ou dois com 70%. Sexy não recusa:
// vender biquíni pode. Se a análise não puder ser feita, a foto não entra (503: "tente de novo").
// A linha separada liga na primeira foto e desliga depois de 5 minutos parada, porque o servidor tem pouca
// memória (ela ocupa uns 130 MB enquanto está ligada).
// Violência em foto não tem modelo gratuito que caiba no servidor: fica com o texto e a denúncia.
import { spawn } from 'node:child_process'
import { Worker } from 'node:worker_threads'
import caminhoDoFfmpeg from 'ffmpeg-static'
import sharp from 'sharp'
import { erroHttp } from '../utils/erroHttp.js'
import { registrar } from '../utils/log.js'

export const LIMITE = 0.7
export const LIMITE_FORTE = 0.85
export const QUADROS_DO_VIDEO = 8
const LADO = 224
const BYTES_DO_QUADRO = LADO * LADO * 3
const MAXIMO_DE_PIXELS = 40_000_000
const DESLIGAR_PARADA_MS = 5 * 60 * 1000
const TEMPO_MAXIMO_MS = 30 * 1000
const TEMPO_DO_FFMPEG_MS = 30 * 1000

const MOTIVO = 'a IA do DesapegaUai encontrou nudez ou conteúdo sexual, que não são permitidos. Fotos de roupa de banho, como biquíni e maiô, podem.'

// ---------------------------------------------------------------- a linha separada

let linha = null // { trabalhador, pronta }
let proximoPedido = 0
const pedidos = new Map() // id -> { concluir, falhar, relogio }
let relogioDaParada = null
let classificadorDeTeste = null

/** Para os testes: troca o modelo por uma função (pixels) => previsões. null volta ao modelo de verdade. */
export function trocarClassificadorParaTestes(funcao) {
  classificadorDeTeste = funcao
}

/** Desliga a linha separada (ao encerrar a API e no fim dos testes). */
export async function desligarModeracao() {
  if (linha) await desligar(linha, new Error('a moderação foi desligada'))
}

/** 'parada' (liga na próxima foto) ou 'ligada' */
export const estadoDaModeracao = () => (linha ? 'ligada' : 'parada')

async function desligar(atual, motivo) {
  if (linha === atual) linha = null
  clearTimeout(relogioDaParada)
  for (const [id, pedido] of pedidos) {
    if (pedido.linha !== atual) continue
    clearTimeout(pedido.relogio)
    pedidos.delete(id)
    pedido.falhar(motivo)
  }
  await atual.trabalhador.terminate().catch(() => {})
}

function programarDesligamento() {
  clearTimeout(relogioDaParada)
  relogioDaParada = setTimeout(() => {
    if (linha && pedidos.size === 0) desligar(linha, new Error('parada'))
  }, DESLIGAR_PARADA_MS)
  relogioDaParada.unref()
}

const temPedido = (atual) => [...pedidos.values()].some((pedido) => pedido.linha === atual)

function ligar() {
  if (linha) return linha
  // enquanto carrega, a linha segura o processo ligado; parada (sem pedido), solta (unref)
  const trabalhador = new Worker(new URL('./moderacaoDeImagem.trabalhador.js', import.meta.url))
  const atual = { trabalhador }
  atual.pronta = new Promise((pronta, falhou) => {
    const demorou = setTimeout(() => desligar(atual, new Error('o modelo demorou demais para carregar')), TEMPO_MAXIMO_MS * 2)
    trabalhador.on('message', (mensagem) => {
      if (mensagem.pronta) {
        clearTimeout(demorou)
        pronta()
      } else {
        const pedido = pedidos.get(mensagem.id)
        if (!pedido) return
        pedidos.delete(mensagem.id)
        clearTimeout(pedido.relogio)
        if (mensagem.erro) pedido.falhar(new Error(mensagem.erro))
        else pedido.concluir(mensagem.previsoes)
      }
      if (!temPedido(atual)) {
        trabalhador.unref()
        programarDesligamento()
      }
    })
    trabalhador.on('error', (erro) => {
      clearTimeout(demorou)
      falhou(erro)
      desligar(atual, erro)
    })
    trabalhador.on('exit', () => {
      clearTimeout(demorou)
      const parou = new Error('a linha da moderação parou')
      falhou(parou)
      desligar(atual, parou)
    })
  })
  atual.pronta.catch(() => {}) // quem espera trata o erro; aqui é só para não sobrar promessa recusada solta
  linha = atual
  return atual
}

// Fila: uma análise por vez na linha separada. Assim o tempo limite de cada uma só conta quando chega a
// vez dela (com muita foto chegando junto, as últimas não "estouram" o tempo esperando na fila), e a fila
// tem teto: passou dele, a foto é recusada com "tente de novo" em vez de acumular memória.
const MAXIMO_NA_FILA = 200
let fila = Promise.resolve()
let naFila = 0

/** pixels: 224 x 224 x 3 (RGB). Devolve as previsões do modelo: [{ className, probability }] */
function classificar(pixels) {
  if (naFila >= MAXIMO_NA_FILA) return Promise.reject(new Error('fila da moderação cheia'))
  naFila += 1
  const vez = fila.then(() => classificarAgora(pixels))
  fila = vez.catch(() => {})
  return vez.finally(() => { naFila -= 1 })
}

async function classificarAgora(pixels) {
  if (classificadorDeTeste) return classificadorDeTeste(pixels)
  const atual = ligar()
  await atual.pronta // se não carregar, o erro sai daqui (nenhum pedido fica pendurado)
  if (linha !== atual) throw new Error('a linha da moderação parou')
  clearTimeout(relogioDaParada)
  const id = ++proximoPedido
  return new Promise((concluir, falhar) => {
    // travou: esta linha sai e a próxima foto liga outra
    const relogio = setTimeout(() => desligar(atual, new Error('a análise demorou demais')), TEMPO_MAXIMO_MS)
    pedidos.set(id, { concluir, falhar, relogio, linha: atual })
    atual.trabalhador.ref() // trabalhando: segura o processo até responder
    const copia = new Uint8Array(pixels) // cópia: o Buffer do sharp pode dividir a memória com outros
    atual.trabalhador.postMessage({ id, pixels: copia }, [copia.buffer])
  })
}

// ---------------------------------------------------------------- a decisão

/** Porn + Hentai: a chance de ser nudez ou sexo (Sexy, como biquíni, fica de fora). */
export function chanceDeConteudoSexual(previsoes) {
  const chance = Object.fromEntries(previsoes.map((p) => [p.className, p.probability]))
  return (chance.Porn ?? 0) + (chance.Hentai ?? 0)
}

export const fotoRecusada = (previsoes) => chanceDeConteudoSexual(previsoes) >= LIMITE

/** Vídeo: recusa com um quadro bem claro (85%) ou dois quadros acima do limite (70%). */
export function videoRecusado(previsoesDosQuadros) {
  const chances = previsoesDosQuadros.map(chanceDeConteudoSexual)
  return chances.some((c) => c >= LIMITE_FORTE) || chances.filter((c) => c >= LIMITE).length >= 2
}

function recusa(mensagem, campo) {
  const erro = erroHttp(422, mensagem)
  erro.codigo = 'CONTEUDO_PROIBIDO'
  erro.campos = [campo]
  return erro
}

// ---------------------------------------------------------------- fotos

/** A foto em 224 x 224 px, RGB, já girada pelo EXIF (como o modelo espera). */
export async function pixelsDaFoto(buffer) {
  const { data, info } = await sharp(buffer, { limitInputPixels: MAXIMO_DE_PIXELS })
    .rotate()
    .resize(LADO, LADO, { fit: 'fill' })
    .removeAlpha()
    .toColourspace('srgb')
    .raw()
    .toBuffer({ resolveWithObject: true })
  if (info.channels === 3) return data
  // foto em tons de cinza: repete o canal nos três
  const rgb = Buffer.alloc(BYTES_DO_QUADRO)
  for (let i = 0; i < LADO * LADO; i += 1) rgb.fill(data[i * info.channels], i * 3, i * 3 + 3)
  return rgb
}

/**
 * Recusa (422, CONTEUDO_PROIBIDO) foto com nudez ou conteúdo sexual.
 * posicao/total: para dizer qual foto foi ("A 2ª foto foi recusada").
 */
export async function exigirFotoPermitida(buffer, { onde = 'anuncio', usuarioId = null, posicao = 1, total = 1 } = {}) {
  let pixels
  try {
    pixels = await pixelsDaFoto(buffer)
  } catch {
    throw erroHttp(400, 'Uma das fotos não abriu. Envie fotos JPG, PNG ou WebP.')
  }

  let previsoes
  try {
    previsoes = await classificar(pixels)
  } catch (erro) {
    registrar('moderacao.indisponivel', { onde, erro: erro.message })
    throw erroHttp(503, 'Não foi possível conferir a foto agora. Tente de novo em instantes.')
  }
  if (!fotoRecusada(previsoes)) return

  registrar('moderacao.foto_recusada', { onde, usuario_id: usuarioId, chance: Number(chanceDeConteudoSexual(previsoes).toFixed(2)) })
  const qual = total > 1 ? `A ${posicao}ª foto` : onde === 'perfil' ? 'A foto de perfil' : 'A foto'
  throw recusa(`${qual} foi recusada: ${MOTIVO}`, onde === 'perfil' ? 'foto' : 'fotos')
}

// ---------------------------------------------------------------- vídeos

function rodarFfmpeg(argumentos, { limite = Infinity, aceitarErro = false } = {}) {
  return new Promise((concluir, falhar) => {
    const processo = spawn(caminhoDoFfmpeg, argumentos, { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true })
    const partes = []
    let tamanho = 0
    let erros = ''
    const relogio = setTimeout(() => processo.kill('SIGKILL'), TEMPO_DO_FFMPEG_MS)
    processo.stdout.on('data', (parte) => {
      tamanho += parte.length
      if (tamanho > limite) return processo.kill('SIGKILL')
      partes.push(parte)
    })
    processo.stderr.on('data', (parte) => { if (erros.length < 4000) erros += parte })
    processo.on('error', (erro) => { clearTimeout(relogio); falhar(erro) })
    processo.on('close', (codigo) => {
      clearTimeout(relogio)
      if (codigo === 0 || aceitarErro) concluir({ saida: Buffer.concat(partes), erros })
      else falhar(new Error(erros.trim().slice(0, 500) || `ffmpeg saiu com ${codigo}`))
    })
  })
}

// o ffmpeg sem arquivo de saída só lê o começo e escreve a duração ("Duration: 00:00:12.34")
async function duracaoDoVideo(caminho) {
  const { erros } = await rodarFfmpeg(['-hide_banner', '-nostdin', '-protocol_whitelist', 'file,pipe', '-i', caminho], { aceitarErro: true })
  const partes = /Duration: (\d+):(\d{2}):(\d{2}(?:\.\d+)?)/.exec(erros)
  return partes ? Number(partes[1]) * 3600 + Number(partes[2]) * 60 + Number(partes[3]) : null
}

// no máximo 2 vídeos sendo abertos pelo ffmpeg ao mesmo tempo (o servidor tem 1 processador)
const FFMPEG_AO_MESMO_TEMPO = 2
let ffmpegRodando = 0
const esperandoFfmpeg = []
async function naVezDoFfmpeg(tarefa) {
  if (ffmpegRodando >= FFMPEG_AO_MESMO_TEMPO) await new Promise((vez) => esperandoFfmpeg.push(vez))
  else ffmpegRodando += 1
  try {
    return await tarefa()
  } finally {
    const proximo = esperandoFfmpeg.shift()
    if (proximo) proximo() // a vaga passa direto para quem esperava
    else ffmpegRodando -= 1
  }
}

/** Até 8 quadros espalhados pelo vídeo, em 224 x 224 px RGB. */
export function quadrosDoVideo(caminho) {
  return naVezDoFfmpeg(() => tirarQuadros(caminho))
}

// Cada quadro sai de um ffmpeg que pula direto para o instante (-ss antes do -i): não precisa decodificar o
// vídeo inteiro, então um vídeo longo em 4K não estoura o tempo. Quadro maior que 4K não é decodificado
// (vídeo montado com resolução gigante usaria memória demais), e o ffmpeg usa uma linha só.
const MAXIMO_DE_PIXELS_DO_QUADRO = 3840 * 2160

async function tirarQuadros(caminho) {
  const duracao = await duracaoDoVideo(caminho)
  // instantes no meio de cada pedaço do vídeo (evita o primeiro quadro preto e o fim, onde o pulo falha);
  // sem a duração no arquivo (WebM gravado no navegador), instantes cada vez mais espaçados: o que passar
  // do fim só não abre
  const instantes = duracao > 0
    ? Array.from({ length: QUADROS_DO_VIDEO }, (_, i) => (duracao * (i + 0.5)) / QUADROS_DO_VIDEO)
    : [0, 1, 2, 4, 8, 16, 32, 64]
  const quadros = []
  for (const instante of instantes) {
    try {
      const { saida } = await rodarFfmpeg([
        '-hide_banner', '-nostdin', '-loglevel', 'error',
        // só lê o arquivo do vídeo: nada de abrir outros arquivos ou endereços citados dentro dele
        '-protocol_whitelist', 'file,pipe',
        '-threads', '1', '-max_pixels', String(MAXIMO_DE_PIXELS_DO_QUADRO),
        '-ss', instante.toFixed(3), '-i', caminho, '-an', '-sn', '-dn',
        '-frames:v', '1', '-vf', `scale=${LADO}:${LADO}`, '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:1',
      ], { limite: BYTES_DO_QUADRO })
      if (saida.length >= BYTES_DO_QUADRO) quadros.push(saida.subarray(0, BYTES_DO_QUADRO))
    } catch (erro) {
      if (!caminhoDoFfmpeg || erro.code === 'ENOENT' || erro.code === 'EACCES') throw erro
      // esse instante não abriu: tenta os outros
    }
  }
  return quadros
}

/** Recusa (422, CONTEUDO_PROIBIDO) vídeo com nudez ou conteúdo sexual; 400 se o vídeo não abrir. */
export async function exigirVideoPermitido(caminho, { usuarioId = null } = {}) {
  let quadros
  try {
    quadros = await quadrosDoVideo(caminho)
  } catch (erro) {
    if (!caminhoDoFfmpeg || erro.code === 'ENOENT' || erro.code === 'EACCES') {
      registrar('moderacao.ffmpeg_ausente', { erro: erro.message })
      throw erroHttp(503, 'Não foi possível conferir o vídeo agora. Tente mais tarde.')
    }
    quadros = []
  }
  if (quadros.length === 0) throw erroHttp(400, 'Não foi possível abrir o vídeo. Envie um vídeo MP4, MOV ou WebM.')

  const previsoes = []
  try {
    for (const quadro of quadros) previsoes.push(await classificar(quadro))
  } catch (erro) {
    registrar('moderacao.indisponivel', { onde: 'chat', erro: erro.message })
    throw erroHttp(503, 'Não foi possível conferir o vídeo agora. Tente de novo em instantes.')
  }
  if (!videoRecusado(previsoes)) return

  registrar('moderacao.video_recusado', {
    usuario_id: usuarioId,
    quadros: quadros.length,
    chance: Number(Math.max(...previsoes.map(chanceDeConteudoSexual)).toFixed(2)),
  })
  throw recusa(`O vídeo foi recusado: ${MOTIVO.replace('. Fotos de roupa de banho, como biquíni e maiô, podem.', '.')}`, 'video')
}
