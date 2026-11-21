// npm run celular: sobe o site numa segunda porta (5175), visível para o celular na mesma rede Wi-Fi.
// Liga o atalho /entrar?teste=1 (2 ou 3) para entrar como usuário de teste, porque o login do Google não
// funciona por endereço de rede. Nada aparece na tela de login.
// O npm run dev normal (porta 5173) não muda e pode continuar aberto. Para parar: Ctrl+C.
import { spawn } from 'node:child_process'
import os from 'node:os'
import process from 'node:process'

const PORTA = 5175 // a 5174 é usada pelos testes de navegador (npm run e2e)

// endereços deste computador na rede (ignora os internos e os de máquina virtual, que o celular não alcança)
const enderecos = Object.values(os.networkInterfaces())
  .flat()
  .filter((rede) => rede && rede.family === 'IPv4' && !rede.internal && !rede.address.startsWith('172.'))
  .map((rede) => `http://${rede.address}:${PORTA}/`)

console.log('')
console.log('No celular (mesma rede Wi-Fi), abra:')
for (const endereco of enderecos) console.log(`  ${endereco}`)
console.log('')
console.log('Para entrar como usuário de teste (o login do Google não funciona pelo endereço da rede):')
for (const endereco of enderecos) {
  console.log(`  ${endereco}entrar?teste=1  (Diego)`)
  console.log(`  ${endereco}entrar?teste=2  (Larissa)`)
  console.log(`  ${endereco}entrar?teste=3  (Usuário Teste)`)
}
console.log('')

const vite = spawn('npx', ['vite', '--port', String(PORTA), '--strictPort'], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, CELULAR: '1', VITE_LOGIN_TESTE: '1' },
})
vite.on('exit', (codigo) => process.exit(codigo ?? 0))
