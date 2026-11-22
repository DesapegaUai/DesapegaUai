// Emojis do chat: os dados em português (nomes e busca) servidos pelo próprio site.
import DADOS_EM_PORTUGUES from 'emoji-picker-element-data/pt/cldr/data.json?url'

export { DADOS_EM_PORTUGUES }
export const LOCAL_DOS_EMOJIS = 'pt'

let preparando = null

// Na primeira vez, o navegador guarda os emojis no banco dele, e isso demora (no Safari, vários
// segundos). Esta função faz isso em segundo plano assim que a conversa abre, para o painel de
// emojis abrir na hora quando a pessoa tocar no botão. Roda uma vez só por visita.
export function prepararEmojis() {
  if (preparando) return preparando
  preparando = import('emoji-picker-element/database.js')
    .then(({ default: Database }) => new Database({ locale: LOCAL_DOS_EMOJIS, dataSource: DADOS_EM_PORTUGUES }).ready())
    .catch(() => { preparando = null }) // sem banco no navegador (aba anônima): o painel carrega quando abrir
  return preparando
}
