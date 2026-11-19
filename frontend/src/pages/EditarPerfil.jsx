import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import LayoutPainel from '../components/LayoutPainel.jsx';
import Icone from '../components/IconeMarketplace.jsx';
import { salvarPerfil, usePerfil } from '../services/perfil.js';
import '../styles/marketplace-cadastro.css';
import '../styles/marketplace-editar-perfil.css';

const LIMITE_NOME = 120;
const LIMITE_BIO = 300;

function formatarTelefone(texto) {
  const n = texto.replace(/\D/g, '').slice(0, 11);
  if (n.length <= 2) return n;
  const meio = n.length === 11 ? 7 : 6;
  if (n.length <= meio) return `(${n.slice(0, 2)}) ${n.slice(2)}`;
  return `(${n.slice(0, 2)}) ${n.slice(2, meio)}-${n.slice(meio)}`;
}

function validar({ nome, telefone, bio }) {
  const erros = {};
  const nomeLimpo = nome.trim();
  const digitos = telefone.replace(/\D/g, '');
  if (nomeLimpo.length < 2 || nomeLimpo.length > LIMITE_NOME) erros.nome = 'O nome precisa ter de 2 a 120 caracteres.';
  if (digitos && digitos.length !== 10 && digitos.length !== 11) erros.telefone = 'O telefone precisa ter DDD e número: 10 ou 11 dígitos.';
  if (bio.length > LIMITE_BIO) erros.bio = 'A bio pode ter até 300 caracteres.';
  return erros;
}

/** Editar perfil. E-mail e foto vêm da conta Google. */
export default function EditarPerfil() {
  const navegar = useNavigate();
  const perfil = usePerfil();
  const [form, setForm] = useState({ nome: perfil.nome, telefone: formatarTelefone(perfil.telefone), bio: perfil.bio });
  const [erros, setErros] = useState({});

  useEffect(() => { document.title = 'DesapegaUai — Editar perfil'; }, []);

  function mudar(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }));
    setErros((e) => Object.fromEntries(Object.entries(e).filter(([c]) => c !== campo)));
  }

  function salvar(e) {
    e.preventDefault();
    const encontrados = validar(form);
    setErros(encontrados);
    const primeiro = ['nome', 'telefone', 'bio'].find((c) => encontrados[c]);
    if (primeiro) {
      document.getElementById(`ep-${primeiro}`)?.focus();
      return;
    }
    salvarPerfil({ nome: form.nome.trim(), telefone: form.telefone.replace(/\D/g, ''), bio: form.bio.trim() });
    navegar('/perfil', { state: { aviso: { tipo: 'sucesso', titulo: 'Perfil atualizado', chave: Date.now() } } });
  }

  const propsDoCampo = (campo) => ({
    id: `ep-${campo}`,
    'aria-invalid': Boolean(erros[campo]),
    'aria-describedby': erros[campo] ? `ep-${campo}-erro` : undefined,
  });

  return (
    <LayoutPainel classeMain="ep-main">
      <nav aria-label="Você está em">
        <Link className="ep-voltar" to="/perfil">
          <Icone nome="seta-esquerda" tamanho={18} cor="#3E8B22" />Voltar para o perfil
        </Link>
      </nav>
      <h1 className="ep-titulo">Editar perfil</h1>
      <p className="ep-lead">Mantenha os seus dados atualizados.</p>

      <form className="cad-card ep-form" onSubmit={salvar} noValidate>
        <div className="ep-conta">
          <span className="ep-avatar" aria-hidden="true">{perfil.iniciais}</span>
          <div>
            <b>Foto e e-mail da conta Google</b>
            <p>Esses dados vêm da sua conta Google e não podem ser alterados aqui.</p>
          </div>
        </div>

        <div className="cad-campo">
          <label htmlFor="ep-email">E-mail</label>
          <input id="ep-email" className="cad-input ep-bloqueado" type="email" value={perfil.email} readOnly />
        </div>

        <div className="cad-campo">
          <label htmlFor="ep-nome">Nome<em aria-hidden="true"> *</em></label>
          <input {...propsDoCampo('nome')} className="cad-input" type="text" autoComplete="name" maxLength={LIMITE_NOME} value={form.nome} onChange={(e) => mudar('nome', e.target.value)} />
          {erros.nome && <p className="cad-erro" id="ep-nome-erro">{erros.nome}</p>}
        </div>

        <div className="cad-campo">
          <label htmlFor="ep-telefone">Telefone <span className="ep-opcional">(opcional)</span></label>
          <input {...propsDoCampo('telefone')} className="cad-input" type="tel" inputMode="tel" autoComplete="tel-national" placeholder="(31) 99999-9999" value={form.telefone} onChange={(e) => mudar('telefone', formatarTelefone(e.target.value))} />
          {erros.telefone && <p className="cad-erro" id="ep-telefone-erro">{erros.telefone}</p>}
        </div>

        <div className="cad-campo">
          <label htmlFor="ep-bio">Bio <span className="ep-opcional">(opcional)</span></label>
          <div className="cad-area ep-area">
            <textarea {...propsDoCampo('bio')} rows={4} maxLength={LIMITE_BIO} placeholder="Conte um pouco sobre você." value={form.bio} onChange={(e) => mudar('bio', e.target.value)} />
            <span>{form.bio.length}/{LIMITE_BIO} caracteres</span>
          </div>
          {erros.bio && <p className="cad-erro" id="ep-bio-erro">{erros.bio}</p>}
        </div>

        <div className="ep-botoes">
          <Link className="cad-btn fantasma" to="/perfil">Cancelar</Link>
          <button type="submit" className="cad-btn solido">Salvar alterações</button>
        </div>
      </form>
    </LayoutPainel>
  );
}
