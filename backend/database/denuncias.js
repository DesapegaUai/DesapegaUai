// npm run denuncias: a equipe revisa os anúncios denunciados (os três pontinhos da página do anúncio).
//
//   npm run denuncias                    lista os anúncios com denúncia aberta (os em análise primeiro)
//   npm run denuncias -- --liberar 12    está tudo certo: o anúncio 12 volta como estava e as denúncias fecham
//   npm run denuncias -- --remover 12    não segue as regras: apaga o anúncio 12 (com fotos e conversas)
//
// Com 3 pessoas diferentes denunciando, o anúncio já saiu da busca sozinho (em análise). O vendedor é
// avisado no sininho e no celular em cada passo e nunca fica sabendo quem denunciou.
// No servidor: cd /opt/desapegauai/backend && sudo -u desapegauai npm run denuncias
import { db } from '../src/config/db.js'
import * as denunciaModel from '../src/models/denunciaAnuncioModel.js'
import { PESSOAS_PARA_ANALISE, liberarAnuncio, removerAnuncio } from '../src/services/denunciaAnuncioService.js'

const NOME_DO_MOTIVO = {
  proibido: 'produto proibido ou ilegal',
  golpe: 'parece golpe',
  improprio: 'foto ou texto impróprio',
  falso: 'anúncio falso ou enganoso',
  outro: 'outro motivo',
}

function lerAcao(argumentos) {
  const [opcao, valor] = argumentos
  if (!opcao) return { acao: 'listar' }
  if (!['--liberar', '--remover'].includes(opcao) || !/^\d+$/.test(valor ?? '')) {
    throw new Error('Use: npm run denuncias  |  npm run denuncias -- --liberar <id>  |  npm run denuncias -- --remover <id>')
  }
  return { acao: opcao.slice(2), anuncioId: Number(valor) }
}

async function listar() {
  const pendentes = await denunciaModel.pendentes()
  if (!pendentes.length) {
    console.log('Nenhum anúncio com denúncia aberta.')
    return
  }
  console.log(`${pendentes.length} anúncio(s) com denúncia aberta (com ${PESSOAS_PARA_ANALISE} pessoas, sai da busca sozinho):\n`)
  for (const anuncio of pendentes) {
    const contagem = {}
    for (const motivo of anuncio.motivos) contagem[motivo] = (contagem[motivo] ?? 0) + 1
    const situacao = anuncio.status === 'em_analise' ? 'EM ANÁLISE (fora da busca)' : `no ar (${anuncio.status})`
    console.log(`#${anuncio.id}  ${anuncio.titulo}`)
    console.log(`    ${situacao} · vendedor #${anuncio.vendedor_id} ${anuncio.vendedor_nome} · ${anuncio.pessoas} pessoa(s)`)
    console.log(`    motivos: ${Object.entries(contagem).map(([m, n]) => `${NOME_DO_MOTIVO[m] ?? m} (${n})`).join(', ')}`)
    for (const { motivo, descricao } of await denunciaModel.descricoes(anuncio.id)) {
      if (descricao) console.log(`    - ${NOME_DO_MOTIVO[motivo] ?? motivo}: "${descricao.replace(/\s+/g, ' ').slice(0, 200)}"`)
    }
    console.log('')
  }
  console.log('Para decidir: npm run denuncias -- --liberar <id>   ou   npm run denuncias -- --remover <id>')
}

let codigo = 0
try {
  const { acao, anuncioId } = lerAcao(process.argv.slice(2))
  if (acao === 'listar') await listar()
  if (acao === 'liberar') {
    const { estavaEmAnalise } = await liberarAnuncio(anuncioId)
    console.log(estavaEmAnalise
      ? `Anúncio #${anuncioId} liberado: voltou para a busca e o vendedor foi avisado.`
      : `Denúncias do anúncio #${anuncioId} fechadas (ele não estava fora da busca).`)
  }
  if (acao === 'remover') {
    await removerAnuncio(anuncioId)
    console.log(`Anúncio #${anuncioId} removido (com fotos e conversas) e o vendedor foi avisado.`)
  }
} catch (erro) {
  console.error(erro.message)
  codigo = 1
} finally {
  await db.end()
}
process.exitCode = codigo
