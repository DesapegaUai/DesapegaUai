// npm run fotos              mostra as fotos sem registro no banco (órfãs) e os registros sem arquivo
// npm run fotos -- --apagar  apaga as órfãs e acerta os registros
// Confere as pastas uploads e uploads-privados com o banco do .env. Antes de usar --apagar, veja se
// o nome do banco que aparece é o mesmo banco dessas pastas: com o banco errado, toda foto parece órfã.
import { db } from '../src/config/db.js'
import { env } from '../src/config/env.js'
import { conferirFotos } from '../src/services/conferenciaDeFotos.js'
import { PASTA_PRIVADA, PASTA_UPLOADS } from '../src/utils/fotos.js'

const apagar = process.argv.includes('--apagar')

try {
  console.log(`Banco: ${env.db.nome}`)
  console.log(`Pastas: ${PASTA_UPLOADS} e ${PASTA_PRIVADA}`)
  const relatorio = await conferirFotos({ corrigir: apagar })

  console.log(`\n${relatorio.arquivos} arquivos e ${relatorio.registros} registros conferidos.`)
  console.log(`Arquivos sem registro: ${relatorio.orfaos.length}`)
  for (const orfao of relatorio.orfaos) console.log(`  ${orfao.apagado ? 'apagado' : 'encontrado'}: ${orfao.caminho} (${orfao.motivo})`)
  console.log(`Registros sem arquivo: ${relatorio.semArquivo.length}`)
  for (const registro of relatorio.semArquivo) console.log(`  ${registro.corrigido ? 'corrigido' : 'encontrado'}: ${registro.tipo} ${registro.id}`)

  const pendentes = relatorio.orfaos.filter((o) => !o.apagado).length + relatorio.semArquivo.filter((r) => !r.corrigido).length
  if (pendentes === 0) console.log('\nTudo certo: nenhuma foto sobrando e nenhuma faltando.')
  else if (!apagar) console.log('\nPara corrigir, rode: npm run fotos -- --apagar')
  else console.log('\nAlguns arquivos não puderam ser apagados. Veja o log e rode de novo.')
} catch (erro) {
  console.error('Não foi possível conferir as fotos:', erro.message)
  process.exitCode = 1
} finally {
  await db.end()
}
