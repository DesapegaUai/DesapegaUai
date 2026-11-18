// Formatos de texto (10-especificacoes-tecnicas → "Textos e formatos")

const reaisInteiros = new Intl.NumberFormat('pt-BR', {
  style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0,
});
const reaisComCentavos = new Intl.NumberFormat('pt-BR', {
  style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2,
});

/** 1200 → "R$ 1.200" · 49.9 → "R$ 49,90" · com unidade: "R$ 50 / hora" */
export function formatarPreco(valor, unidade) {
  const texto = Number.isInteger(valor)
    ? reaisInteiros.format(valor)
    : reaisComCentavos.format(valor);
  return unidade ? `${texto} / ${unidade}` : texto;
}

/** 2_400_000 → "2,4 MB" · 320_000 → "313 KB" */
export function formatarTamanho(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB`;
}

/** Hora atual no formato do chat: "14:32" */
export function horaAgora() {
  return new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

/** 312 → "312 anúncios" · 1 → "1 anúncio" · 1500 → "1.500 anúncios" */
export function formatarQuantidade(qtd) {
  return `${qtd.toLocaleString('pt-BR')} ${qtd === 1 ? 'anúncio' : 'anúncios'}`;
}
