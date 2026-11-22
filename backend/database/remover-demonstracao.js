// npm run remover-demonstracao               mostra o que seria apagado (não apaga nada)
// npm run remover-demonstracao -- --confirmar  apaga as contas de demonstração e tudo delas
//
// Tira do banco do .env as três contas de exemplo que vêm do seed.sql (Diego, Larissa e Usuário Teste),
// com os anúncios, as conversas, os favoritos, as avaliações, os pedidos e as fotos delas, do mesmo jeito
// que o "Excluir minha conta" do site. Serve para deixar no site publicado só os anúncios de verdade.
// As contas são achadas pelo google_id fixo do seed ("teste-..."): uma conta real, criada pelo login do
// Google, nunca tem esse google_id. Os testes automáticos usam essas contas: não rode no banco dos testes.
import { db } from '../src/config/db.js'
import { env } from '../src/config/env.js'
import { excluirContaComFotos } from '../src/services/exclusaoDeConta.js'

export const CONTAS_DE_DEMONSTRACAO = ['teste-diego', 'teste-larissa', 'teste-usuario']

const confirmar = process.argv.includes('--confirmar')

try {
  console.log(`Banco: ${env.db.nome}`)
  const [contas] = await db.query(
    `SELECT u.id, u.nome,
            (SELECT COUNT(*) FROM anuncio a WHERE a.usuario_id = u.id) AS anuncios,
            (SELECT COUNT(*) FROM conversa c JOIN anuncio a ON a.id = c.anuncio_id
              WHERE c.comprador_id = u.id OR a.usuario_id = u.id) AS conversas
       FROM usuario u WHERE u.google_id IN (?) ORDER BY u.id`,
    [CONTAS_DE_DEMONSTRACAO],
  )

  if (contas.length === 0) {
    console.log('Nenhuma conta de demonstração neste banco. Nada a fazer.')
  } else {
    console.log('\nContas de demonstração encontradas:')
    for (const c of contas) console.log(`  ${c.id} ${c.nome}: ${c.anuncios} anúncio(s), ${c.conversas} conversa(s)`)

    if (!confirmar) {
      console.log('\nNada foi apagado. Para apagar, rode de novo com --confirmar')
    } else {
      for (const c of contas) {
        const r = await excluirContaComFotos(c.id, 'conta_de_demonstracao')
        console.log(`  apagada: ${c.nome} (${r.anuncios} anúncio(s), ${r.conversas} conversa(s))`)
      }
      const [[sobra]] = await db.query('SELECT COUNT(*) AS n FROM anuncio WHERE status = ?', ['ativo'])
      console.log(`\nPronto. Anúncios ativos que ficaram no site: ${sobra.n}`)
    }
  }
} catch (erro) {
  console.error('Não foi possível remover as contas de demonstração:', erro.message)
  process.exitCode = 1
} finally {
  await db.end()
}
