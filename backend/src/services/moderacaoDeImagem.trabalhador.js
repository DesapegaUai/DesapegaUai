// Linha de execução separada (Worker) da moderação de imagens: carrega o NSFW.js (modelo MobileNetV2) no
// TensorFlow.js em WebAssembly e analisa os quadros de 224x224 px (RGB) que a API manda. Fica separada para
// a API continuar respondendo (chat, busca) enquanto uma foto é analisada.
import { parentPort } from 'node:worker_threads'

const tf = await import('@tensorflow/tfjs')
await import('@tensorflow/tfjs-backend-wasm')
await tf.setBackend('wasm')
tf.enableProdMode()
const { load } = await import('nsfwjs')

// o NSFW.js escreve no terminal (console.info) qual modelo carregou: aqui não precisa (o log da API é só de eventos)
const informar = console.info
console.info = () => {}
let modelo
try {
  modelo = await load('MobileNetV2')
} finally {
  console.info = informar
}

const LADO = 224

parentPort.on('message', async ({ id, pixels }) => {
  let imagem = null
  try {
    imagem = tf.tensor3d(pixels, [LADO, LADO, 3], 'int32')
    const previsoes = await modelo.classify(imagem, 5)
    parentPort.postMessage({ id, previsoes })
  } catch (erro) {
    parentPort.postMessage({ id, erro: erro.message })
  } finally {
    imagem?.dispose()
  }
})

parentPort.postMessage({ pronta: true })
