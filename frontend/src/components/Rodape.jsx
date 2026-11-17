import Icone from './Icone.jsx'
import './Rodape.css'

const colunas = [
  { id: 'institucional', titulo: 'Institucional', links: ['Sobre nós', 'Como funciona', 'Regras para anunciar'] },
  { id: 'conta', titulo: 'Minha conta', links: ['Meus anúncios', 'Favoritos', 'Mensagens'] },
  { id: 'ajuda', titulo: 'Ajuda', links: ['Perguntas frequentes', 'Dicas de segurança', 'Fale conosco'] },
]

export default function Rodape() {
  return (
    <footer className="rodape">
      <div className="rodape-in">
        <div className="rodape-cols">
          <div className="rodape-marca">
            <img className="rodape-logo" src="/img/logo-negativo.svg" alt="DesapegaUai" width="1221" height="261" />
            <p className="rodape-desc">Compre e venda com gente do seu bairro, em Viçosa e região.</p>
            <a className="rodape-cta" href="#">
              <Icone nome="adicionar" tamanho={18} />
              Anunciar grátis
            </a>
          </div>

          {/* No celular cada coluna vira uma sanfona: a caixinha escondida (checkbox) abre e fecha a lista só com CSS */}
          {colunas.map((c) => (
            <div key={c.id} className="rodape-col">
              <input type="checkbox" id={`rodape-${c.id}`} className="rodape-abre" />
              <h3 className="rodape-tit">
                <label htmlFor={`rodape-${c.id}`}>
                  {c.titulo}
                  <Icone nome="seta-baixo" tamanho={20} />
                </label>
              </h3>
              <div className="rodape-lista">
                {c.links.map((l) => (
                  <a key={l} href="#">
                    {l}
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="rodape-seg">
          <span className="rodape-seg-ic">
            <Icone nome="seguranca" tamanho={22} />
          </span>
          <div className="rodape-seg-txt">
            <p>
              <b>Negocie com segurança.</b> O DesapegaUai não intermedia pagamentos nem entregas. Combine tudo
              direto com o anunciante, nunca pague adiantado e prefira encontros em locais públicos.
            </p>
            <a className="rodape-seg-link" href="#">
              Ver dicas de segurança
            </a>
          </div>
        </div>
      </div>

      <div className="rodape-base">
        <div className="rodape-base-in">
          <span className="rodape-copy">
            © {new Date().getFullYear()} DesapegaUai. Todos os direitos reservados.
          </span>
          <nav className="rodape-links" aria-label="Links legais">
            <a href="#">Termos de uso</a>
            <a href="#">Política de privacidade</a>
          </nav>
          <div className="rodape-local">
            <span className="rodape-cidade">
              <Icone nome="localizacao" tamanho={18} />
              Viçosa e região
            </span>
            <a
              className="rodape-social"
              href="https://instagram.com/desapegauai"
              target="_blank"
              rel="noreferrer"
              aria-label="Instagram do DesapegaUai"
            >
              <Icone nome="instagram" tamanho={20} />
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
