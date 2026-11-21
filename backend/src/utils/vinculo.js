// Selo "Vínculo acadêmico verificado": quem entra com o e-mail da UFV ou da Univiçosa.
// O Google já confirmou que o e-mail é da pessoa (email_verified), então não precisa de documento.
// A API devolve só verdadeiro ou falso; o e-mail nunca aparece para os outros (LGPD).
const DOMINIOS_ACADEMICOS = ['ufv.br', 'univicosa.com.br']

export function temVinculoAcademico(email) {
  const dominio = String(email ?? '').trim().toLowerCase().split('@')[1] ?? ''
  return DOMINIOS_ACADEMICOS.some((d) => dominio === d || dominio.endsWith(`.${d}`))
}
