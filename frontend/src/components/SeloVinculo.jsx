import Icone from './IconeMarketplace.jsx';
import '../styles/marketplace-selos.css';

/** Selo de quem entrou com o e-mail da UFV ou da Univiçosa. A API diz só sim ou não: o e-mail não aparece. */
export default function SeloVinculo() {
  return (
    <span className="selo-vinculo" title="Entrou no DesapegaUai com o e-mail da UFV ou da Univiçosa">
      <Icone nome="verificado" tamanho={15} cor="#3E8B22" espessura={1.9} />
      Vínculo acadêmico verificado
    </span>
  );
}
