import { useEffect } from 'react'

// Menu que abre por cima da página preso a um botão (os três pontinhos, por exemplo): fecha quando a página
// rola de verdade (o botão sai do lugar) ou quando a largura da tela muda (o celular virou). Não fecha com:
// - o aviso de rolagem que o navegador manda um quadro depois, de uma rolagem que terminou antes do toque
//   (era o que fazia o menu abrir e fechar na hora, no fim da lista de conversas);
// - a rolagem de dentro do próprio menu;
// - a barra de endereço ou o teclado do celular aparecendo e sumindo (mudam só a altura da tela).
export default function useFecharAoMexer(aberto, ancoraRef, fechar) {
  useEffect(() => {
    if (!aberto) return undefined
    const inicio = ancoraRef.current?.getBoundingClientRect()
    const largura = window.innerWidth
    const saiuDoLugar = () => {
      const agora = ancoraRef.current?.getBoundingClientRect()
      return !agora || !inicio || Math.abs(agora.top - inicio.top) > 4 || Math.abs(agora.left - inicio.left) > 4
    }
    const rolou = () => { if (saiuDoLugar()) fechar() }
    const mudouTamanho = () => { if (window.innerWidth !== largura || saiuDoLugar()) fechar() }
    window.addEventListener('scroll', rolou, true)
    window.addEventListener('resize', mudouTamanho)
    return () => {
      window.removeEventListener('scroll', rolou, true)
      window.removeEventListener('resize', mudouTamanho)
    }
  }, [aberto, ancoraRef, fechar])
}
