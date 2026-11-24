// Áudio gravado no chat. Cada navegador grava num formato (Chrome e Android em WebM, Firefox em OGG,
// iPhone em MP4), então o servidor converte tudo para M4A (AAC), que toca em qualquer aparelho. Na mesma
// passada o ffmpeg mede a duração de verdade e o volume de cada pedacinho, que vira o desenho das ondas
// do balão: onde tem fala a barrinha sobe, no silêncio fica reta.
import { spawn } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import caminhoDoFfmpeg from 'ffmpeg-static'
import { erroHttp } from '../utils/erroHttp.js'
import { registrar } from '../utils/log.js'

export const MAXIMO_DE_SEGUNDOS = 120
export const BARRAS_DAS_ONDAS = 40
const MINIMO_DE_SEGUNDOS = 0.5
const TAXA_DA_MEDICAO = 8000 // amostras por segundo usadas só para medir o volume
const NIVEIS = '0123456789abcdefghijklmnopqrstuv' // 32 alturas: "0" é silêncio (reto), "v" é fala alta
// o formato é decidido pelo começo do arquivo, nunca pelo nome ou pelo tipo que o navegador diz
const LEITOR_DO_FORMATO = { webm: 'matroska', ogg: 'ogg', mp4: 'mov' }
const TEMPO_MAXIMO_MS = 30_000
const AO_MESMO_TEMPO = 2 // o servidor é pequeno: no máximo 2 conversões juntas, as outras esperam a vez

// WebM (1A 45 DF A3), OGG ("OggS") ou MP4/M4A (caixa "ftyp" no 5º byte). Outro arquivo: null.
export function formatoDoAudio(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return null
  if (buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3) return 'webm'
  if (buffer.toString('latin1', 0, 4) === 'OggS') return 'ogg'
  if (buffer.toString('latin1', 4, 8) === 'ftyp') return 'mp4'
  return null
}

// Volume de cada barrinha a partir do som (PCM de 16 bits, um canal). A conta é em decibéis, sem
// "aumentar" o áudio baixo: -50 dB ou menos (silêncio, chiado de fundo) fica reto; -12 dB ou mais, cheia.
export function desenharOndas(pcm, barras = BARRAS_DAS_ONDAS) {
  const amostras = Math.floor(pcm.length / 2)
  const porBarra = Math.max(1, Math.floor(amostras / barras))
  let ondas = ''
  for (let barra = 0; barra < barras; barra++) {
    const inicio = Math.min(amostras, barra * porBarra)
    const fim = barra === barras - 1 ? amostras : Math.min(amostras, inicio + porBarra)
    let soma = 0
    for (let i = inicio; i < fim; i++) {
      const valor = pcm.readInt16LE(i * 2) / 32768
      soma += valor * valor
    }
    const volume = fim > inicio ? Math.sqrt(soma / (fim - inicio)) : 0
    const decibeis = volume > 0 ? 20 * Math.log10(volume) : -100
    const nivel = Math.max(0, Math.min(1, (decibeis + 50) / 38))
    ondas += NIVEIS[Math.round(nivel * (NIVEIS.length - 1))]
  }
  return ondas
}

let emAndamento = 0
const fila = []
async function esperarAVez() {
  if (emAndamento >= AO_MESMO_TEMPO) await new Promise((seguir) => fila.push(seguir))
  emAndamento++
}
function liberarAVez() {
  emAndamento--
  fila.shift()?.()
}

// Roda o ffmpeg e devolve o que ele escreveu na saída (o som em PCM, para medir o volume)
function rodarFfmpeg(argumentos) {
  return new Promise((concluir, falhar) => {
    const processo = spawn(caminhoDoFfmpeg, argumentos, { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true })
    const partes = []
    let tamanho = 0
    let erros = ''
    const limiteDoSom = (MAXIMO_DE_SEGUNDOS + 10) * TAXA_DA_MEDICAO * 2
    const relogio = setTimeout(() => processo.kill('SIGKILL'), TEMPO_MAXIMO_MS)
    processo.stdout.on('data', (parte) => {
      tamanho += parte.length
      if (tamanho > limiteDoSom) return processo.kill('SIGKILL')
      partes.push(parte)
    })
    processo.stderr.on('data', (parte) => { if (erros.length < 2000) erros += parte })
    processo.on('error', (erro) => { clearTimeout(relogio); falhar(erro) })
    processo.on('close', (codigo) => {
      clearTimeout(relogio)
      if (codigo === 0) concluir(Buffer.concat(partes))
      else falhar(new Error(erros.trim().slice(0, 500) || `ffmpeg saiu com ${codigo}`))
    })
  })
}

/**
 * Converte o áudio que chegou do navegador. Devolve { m4a, segundos, ondas }.
 * Recusa (400) arquivo que não é áudio, áudio sem som gravado, mais curto que meio segundo ou
 * mais longo que 2 minutos. O M4A sai sem os dados do arquivo original (aparelho, data, local).
 */
export async function converterAudio(buffer) {
  const formato = formatoDoAudio(buffer)
  if (!formato) throw erroHttp(400, 'O arquivo não é um áudio gravado pelo chat.')

  await esperarAVez()
  let pasta = null
  try {
    pasta = await mkdtemp(path.join(os.tmpdir(), 'desapegauai-audio-'))
    const entrada = path.join(pasta, `entrada.${formato}`)
    const saida = path.join(pasta, 'saida.m4a')
    await writeFile(entrada, buffer)

    let pcm
    try {
      pcm = await rodarFfmpeg([
        '-hide_banner', '-nostdin', '-loglevel', 'error',
        // só lê o arquivo de entrada: nada de abrir outros arquivos ou endereços citados dentro dele
        '-protocol_whitelist', 'file,pipe',
        '-f', LEITOR_DO_FORMATO[formato], '-i', entrada,
        '-t', String(MAXIMO_DE_SEGUNDOS + 5),
        // 1ª saída: o M4A, só com o som, sem os dados do arquivo original
        '-map', '0:a:0', '-vn', '-sn', '-dn', '-map_metadata', '-1',
        '-ac', '1', '-ar', '44100', '-c:a', 'aac', '-b:a', '64k', '-movflags', '+faststart', '-f', 'mp4', '-y', saida,
        // 2ª saída: o som cru em 8 kHz, para medir a duração e o volume
        '-map', '0:a:0', '-ac', '1', '-ar', String(TAXA_DA_MEDICAO), '-f', 's16le', 'pipe:1',
      ])
    } catch (erro) {
      // o programa ffmpeg não está no servidor (o npm não conseguiu baixar): a culpa não é do áudio
      if (!caminhoDoFfmpeg || erro.code === 'ENOENT' || erro.code === 'EACCES') {
        registrar('chat.ffmpeg_ausente', { caminho: caminhoDoFfmpeg, erro: erro.message })
        throw erroHttp(503, 'O envio de áudio está indisponível no momento. Tente mais tarde.')
      }
      registrar('chat.audio_invalido', { formato, bytes: buffer.length, erro: erro.message })
      throw erroHttp(400, 'Não foi possível ler o áudio. Grave de novo.')
    }

    const segundos = pcm.length / 2 / TAXA_DA_MEDICAO
    if (segundos < MINIMO_DE_SEGUNDOS) throw erroHttp(400, 'O áudio ficou curto demais. Grave de novo.')
    if (segundos > MAXIMO_DE_SEGUNDOS + 1) throw erroHttp(400, 'O áudio pode ter no máximo 2 minutos.')

    return {
      m4a: await readFile(saida),
      segundos: Math.min(MAXIMO_DE_SEGUNDOS, Math.max(1, Math.round(segundos))),
      ondas: desenharOndas(pcm),
    }
  } finally {
    liberarAVez()
    if (pasta) await rm(pasta, { recursive: true, force: true }).catch(() => {})
  }
}
