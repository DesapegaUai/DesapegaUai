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

/**
 * Preço digitado para número (0 quando não dá para ler): "1.500,00" → 1500 · "99,90" → 99.9.
 * Um ponto só, seguido de 1 ou 2 dígitos e sem vírgula, é a casa dos centavos: o teclado do celular
 * em inglês só tem ponto, e "99.90" virava R$ 9.990. Com 3 dígitos depois ("1.500") continua sendo milhar.
 */
export function textoParaPreco(texto) {
  let t = String(texto ?? '').trim();
  if (!t.includes(',') && /^\d+\.\d{1,2}$/.test(t)) t = t.replace('.', ',');
  const numero = Number(t.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(numero) && numero > 0 ? Math.round(numero * 100) / 100 : 0;
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

/** '2026-11-16T12:00:00.000Z' → "16/11" */
export function formatarData(iso) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

/** 312 → "312 anúncios" · 1 → "1 anúncio" · 1500 → "1.500 anúncios" */
export function formatarQuantidade(qtd) {
  return `${qtd.toLocaleString('pt-BR')} ${qtd === 1 ? 'anúncio' : 'anúncios'}`;
}
