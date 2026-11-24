// Áudio no chat: gravar pelo microfone (o Chrome dos testes tem um microfone de mentira que faz bipes),
// ouvir antes de mandar, a outra pessoa receber na hora com as ondas, tocar, trocar a velocidade e apagar.
// Conversa 1 do seed: Larissa (2) comprando a air fryer do Diego (1).
import { execFileSync } from 'node:child_process'
import { readFileSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { expect, test } from '@playwright/test'
import { entrarComo, vigiarErros } from './ajuda.js'

// um áudio de 3 s gerado na hora com o ffmpeg da API (fala de mentira: um tom), como se viesse do Chrome
function audioDeTeste() {
  const ffmpeg = createRequire(path.resolve('../backend/package.json'))('ffmpeg-static')
  const arquivo = path.join(os.tmpdir(), `desapegauai-e2e-audio-${process.pid}.webm`)
  execFileSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=3,volume=4', '-c:a', 'libopus', arquivo])
  const dados = readFileSync(arquivo)
  rmSync(arquivo, { force: true })
  return dados
}

test.describe('Áudio no chat', () => {
  test('grava, ouve antes de mandar, a outra pessoa recebe com as ondas e consegue ouvir; apagar tira o áudio', async ({ browser, browserName }) => {
    test.skip(browserName !== 'chromium', 'só o Chrome tem o microfone de mentira para o teste')
    const daCompradora = await browser.newContext({ permissions: ['microphone'] })
    const doVendedor = await browser.newContext()
    const compradora = await daCompradora.newPage()
    const vendedor = await doVendedor.newPage()
    const erros = vigiarErros(compradora)
    const errosDoVendedor = vigiarErros(vendedor)
    await entrarComo(compradora, 2)
    await entrarComo(vendedor, 1)
    await vendedor.goto('/conversas/1')
    await compradora.goto('/conversas/1')
    const audiosAntes = await vendedor.locator('.bolha.com-audio').count()

    // gravar: o microfone fica ao lado do emoji; a linha de escrever vira a barra de gravação
    await compradora.getByRole('button', { name: 'Gravar áudio' }).click()
    const gravador = compradora.getByRole('group', { name: 'Gravação de áudio' })
    await expect(gravador.getByRole('timer')).toHaveText(/^0:0[1-9]$/, { timeout: 10_000 })
    await compradora.waitForTimeout(1500)
    await gravador.getByRole('button', { name: 'Parar a gravação' }).click()

    // pronto: dá para ouvir antes de mandar (ou apagar)
    const pronto = compradora.getByRole('group', { name: 'Áudio gravado' })
    await expect(pronto.getByRole('button', { name: 'Ouvir antes de mandar' })).toBeVisible()
    await expect(pronto.locator('.audio-ondas i')).toHaveCount(40)
    await pronto.getByRole('button', { name: 'Enviar o áudio' }).click()
    await expect(compradora.getByRole('button', { name: 'Gravar áudio' })).toBeVisible() // a caixa volta ao normal

    // a compradora vê o próprio áudio; o vendedor recebe na hora, sem recarregar
    const minha = compradora.locator('.linha-msg.eu .bolha.com-audio').last()
    await expect(minha.getByRole('button', { name: /^Tocar o áudio de 0:0\d$/ })).toBeVisible()
    await expect(vendedor.locator('.bolha.com-audio')).toHaveCount(audiosAntes + 1)
    const recebida = vendedor.locator('.bolha.com-audio').last()
    await expect(recebida.locator('.audio-ondas i')).toHaveCount(40)
    // o bipe do microfone de mentira aparece nas ondas: pelo menos uma barrinha sobe (o silêncio é 3 px)
    const alturas = await recebida.locator('.audio-ondas i').evaluateAll((barras) => barras.map((b) => parseFloat(b.style.height)))
    expect(Math.max(...alturas)).toBeGreaterThan(3)

    // a lista de conversas mostra que chegou um áudio (no celular a lista fica escondida com a conversa aberta)
    await expect(vendedor.locator('.item-msg').filter({ hasText: /🎤 Áudio \(0:0\d\)/ })).not.toHaveCount(0)

    // antes de tocar, como no WhatsApp: a foto de quem mandou, e ainda não tem o botão de velocidade
    await expect(recebida.locator('.audio-foto')).toBeVisible()
    await expect(recebida.getByRole('button', { name: /^Velocidade/ })).toHaveCount(0)

    // ouvir: o botão vira "Pausar", o som anda e a velocidade troca para 1,5x
    await recebida.getByRole('button', { name: /^Tocar o áudio/ }).click()
    await expect(recebida.getByRole('button', { name: 'Pausar o áudio' })).toBeVisible()
    await expect.poll(() => recebida.locator('audio').evaluate((a) => a.currentTime)).toBeGreaterThan(0.2)
    await recebida.getByRole('button', { name: /^Velocidade 1x/ }).click()
    await expect(recebida.getByRole('button', { name: /^Velocidade 1,5x/ })).toBeVisible()
    expect(await recebida.locator('audio').evaluate((a) => a.playbackRate)).toBe(1.5)

    // áudio não se edita: o menu da mensagem não tem "Editar"; apagar para todos tira para os dois
    await minha.click({ button: 'right' })
    const menu = compradora.getByRole('menu', { name: 'Opções da mensagem' })
    await expect(menu.getByRole('menuitem')).toHaveText(['Apagar para mim', 'Apagar para todos'])
    await menu.getByRole('menuitem', { name: 'Apagar para todos' }).click()
    await expect(vendedor.locator('.bolha.com-audio')).toHaveCount(audiosAntes)
    await expect(vendedor.locator('.msgs').getByText('Mensagem apagada').last()).toBeVisible()

    expect([...erros, ...errosDoVendedor]).toEqual([])
    await doVendedor.close()
    await daCompradora.close()
  })

  test('quem recebe um áudio consegue ouvir, em qualquer navegador (o servidor entrega M4A)', async ({ browser, browserName }) => {
    test.skip(browserName === 'webkit', 'o WebKit de teste do Windows não toca nenhum formato de áudio (MP3, WebM, OGG nem M4A); o Safari de verdade toca M4A')
    const daCompradora = await browser.newContext()
    const compradora = await daCompradora.newPage()
    const erros = vigiarErros(compradora)
    await entrarComo(compradora, 2)
    const doVendedor = await browser.newContext()
    const vendedor = await doVendedor.newPage()
    await entrarComo(vendedor, 1)
    const resposta = await vendedor.request.post('/api/conversas/1/audios', {
      multipart: { audio: { name: 'audio.webm', mimeType: 'audio/webm', buffer: audioDeTeste() } },
    })
    expect(resposta.status(), await resposta.text()).toBe(201)
    const { mensagem } = await resposta.json()

    await compradora.goto('/conversas/1')
    const recebida = compradora.locator('.linha-msg:not(.eu) .bolha.com-audio').last()
    const tocar = recebida.getByRole('button', { name: 'Tocar o áudio de 0:03' })
    const foto = recebida.locator('.audio-foto')
    const velocidade = recebida.getByRole('button', { name: /^Velocidade/ })
    await expect(tocar).toBeVisible()
    // como no WhatsApp: antes de tocar aparece a foto de quem mandou, sem o botão de velocidade
    await expect(foto).toBeVisible()
    await expect(velocidade).toHaveCount(0)

    // tocando: a foto vira a velocidade
    await tocar.click()
    await expect.poll(() => recebida.locator('audio').evaluate((a) => a.currentTime), { timeout: 15_000 }).toBeGreaterThan(0.2)
    await expect(recebida.locator('.audio-ondas i.ouvida').first()).toBeVisible() // as barrinhas já tocadas ficam coloridas
    await expect(velocidade).toHaveText('1x')
    await expect(foto).toHaveCount(0)

    // pausado no meio: a velocidade continua, mesmo subindo e descendo a conversa, até ouvir tudo
    await recebida.getByRole('button', { name: 'Pausar o áudio' }).click()
    await expect(velocidade).toBeVisible()
    await compradora.locator('.msgs').evaluate((m) => { m.scrollTop = 0 })
    await compradora.locator('.msgs').evaluate((m) => { m.scrollTop = m.scrollHeight })
    await expect(velocidade).toBeVisible()
    await expect(foto).toHaveCount(0)

    // ouviu até o fim (em 2x): a foto volta no lugar da velocidade
    await velocidade.click()
    await velocidade.click()
    await expect(velocidade).toHaveText('2x')
    await recebida.getByRole('button', { name: /^Tocar o áudio/ }).click()
    await expect(foto).toBeVisible({ timeout: 15_000 })
    await expect(velocidade).toHaveCount(0)
    await expect(tocar).toBeVisible()

    // recarregou a página: continua a foto; a velocidade escolhida (2x) vale para o próximo play, como no WhatsApp
    await compradora.reload()
    await expect(foto).toBeVisible()
    await expect(velocidade).toHaveCount(0)
    await tocar.click()
    await expect(velocidade).toHaveText('2x')
    expect(await recebida.locator('audio').evaluate((a) => a.playbackRate)).toBe(2)
    await recebida.getByRole('button', { name: 'Pausar o áudio' }).click()

    await vendedor.request.delete(`/api/conversas/1/mensagens/${mensagem.id}?para=todos`)
    expect(erros).toEqual([])
    await doVendedor.close()
    await daCompradora.close()
  })

  test('navegador que não grava áudio: o microfone não aparece e o resto da caixa funciona', async ({ browser }) => {
    const contexto = await browser.newContext()
    const pagina = await contexto.newPage()
    const erros = vigiarErros(pagina)
    await pagina.addInitScript(() => { delete window.MediaRecorder })
    await entrarComo(pagina, 2)
    await pagina.goto('/conversas/1')
    await expect(pagina.getByRole('button', { name: 'Enviar mensagem' })).toBeVisible()
    await expect(pagina.getByRole('button', { name: 'Gravar áudio' })).toHaveCount(0)
    await expect(pagina.getByRole('button', { name: 'Inserir emoji' })).toBeVisible()
    expect(erros).toEqual([])
    await contexto.close()
  })

  test('com o microfone bloqueado, o site explica como liberar', async ({ browser, browserName }) => {
    test.skip(browserName === 'webkit', 'o WebKit de teste do Windows não tem o gravador de áudio; o Safari de verdade tem (iOS 14.3 em diante)')
    const contexto = await browser.newContext() // sem a permissão do microfone
    const pagina = await contexto.newPage()
    await pagina.addInitScript(() => {
      navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('Permission denied', 'NotAllowedError'))
    })
    await entrarComo(pagina, 2)
    await pagina.goto('/conversas/1')
    await pagina.getByRole('button', { name: 'Gravar áudio' }).click()
    await expect(pagina.getByRole('alert')).toContainText('O microfone está bloqueado para este site')
    await expect(pagina.getByRole('button', { name: 'Gravar áudio' })).toBeVisible() // a caixa volta ao normal
    await contexto.close()
  })
})
