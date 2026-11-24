import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import LayoutPainel from '../components/LayoutPainel.jsx';
import Icone from '../components/IconeMarketplace.jsx';
import Toast from '../components/Toast.jsx';
import AjustarFoto from '../components/AjustarFoto.jsx';
import { atualizarFotoPerfil, carregarPerfil, salvarPerfil, usePerfil } from '../services/perfil.js';
import '../styles/marketplace-cadastro.css';
import '../styles/marketplace-editar-perfil.css';

const LIMITE_NOME = 120;
const LIMITE_BIO = 300;

function formatarTelefone(texto) {
  const n = String(texto ?? '').replace(/\D/g, '').slice(0, 11);
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

/** Editar perfil. O e-mail vem da conta Google; a foto é definida na plataforma. */
export default function EditarPerfil() {
  const navegar = useNavigate();
  const perfil = usePerfil();
  const [form, setForm] = useState({
    nome: perfil.nome ?? '',
    telefone: formatarTelefone(perfil.telefone),
    bio: perfil.bio ?? '',
  });
  const [erros, setErros] = useState({});
  const [toast, setToast] = useState(null);
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const [fotoParaAjustar, setFotoParaAjustar] = useState(null); // foto escolhida, esperando o ajuste
  const fotoRef = useRef(null);
  const mexeu = useRef(false); // a pessoa já digitou: o perfil que chega depois não apaga o que ela escreveu

  useEffect(() => {
    document.title = 'DesapegaUai — Editar perfil';
    let ativo = true;
    carregarPerfil()
      .then((atual) => {
        if (ativo && !mexeu.current) setForm({ nome: atual.nome, telefone: formatarTelefone(atual.telefone), bio: atual.bio ?? '' });
      })
      .catch((erro) => {
        if (ativo) setToast({ tipo: 'erro', titulo: 'Não foi possível carregar o perfil', texto: erro.message, chave: Date.now() });
      });
    return () => { ativo = false; };
  }, []);

  function mudar(campo, valor) {
    mexeu.current = true;
    setForm((f) => ({ ...f, [campo]: valor }));
    setErros((e) => Object.fromEntries(Object.entries(e).filter(([c]) => c !== campo)));
  }

  async function salvar(e) {
    e.preventDefault();
    const encontrados = validar(form);
    setErros(encontrados);
    const primeiro = ['nome', 'telefone', 'bio'].find((c) => encontrados[c]);
    if (primeiro) {
      document.getElementById(`ep-${primeiro}`)?.focus();
      return;
    }
    try {
      await salvarPerfil({ nome: form.nome.trim(), telefone: form.telefone.replace(/\D/g, ''), bio: form.bio.trim() });
      navegar('/perfil', { state: { aviso: { tipo: 'sucesso', titulo: 'Perfil atualizado', chave: Date.now() } } });
    } catch (erro) {
      setToast({ tipo: 'erro', titulo: 'Não foi possível salvar o perfil', texto: erro.message, chave: Date.now() });
    }
  }

  // escolheu a foto: antes de enviar, abre o ajuste (arrastar e aproximar dentro do círculo)
  function escolherFoto(e) {
    const arquivo = e.target.files?.[0];
    e.target.value = '';
    if (!arquivo) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(arquivo.type)) {
      setToast({ tipo: 'erro', titulo: 'Formato de foto inválido', texto: 'Escolha uma imagem JPG, PNG ou WebP.', chave: Date.now() });
      return;
    }
    // a foto sai do ajuste já recortada e leve; a original pode ser a do celular, mais pesada
    if (arquivo.size > 25 * 1024 * 1024) {
      setToast({ tipo: 'erro', titulo: 'Foto muito grande', texto: 'Escolha uma foto de até 25 MB.', chave: Date.now() });
      return;
    }
    setFotoParaAjustar(arquivo);
  }

  async function trocarFoto(arquivo) {
    setFotoParaAjustar(null);
    setEnviandoFoto(true);
    try {
      await atualizarFotoPerfil(arquivo);
      setToast({ tipo: 'sucesso', titulo: 'Foto de perfil atualizada', chave: Date.now() });
    } catch (erro) {
      setToast({ tipo: 'erro', titulo: 'Não foi possível atualizar a foto', texto: erro.message, chave: Date.now() });
    } finally {
      setEnviandoFoto(false);
    }
  }

  const propsDoCampo = (campo) => ({
    id: `ep-${campo}`,
    'aria-invalid': Boolean(erros[campo]),
    'aria-describedby': erros[campo] ? `ep-${campo}-erro` : undefined,
  });

  return (
    <LayoutPainel classeMain="ep-main">
      <Toast aviso={toast} onFechar={() => setToast(null)} />
      <nav aria-label="Você está em">
        <Link className="ep-voltar" to="/perfil">
          <Icone nome="seta-esquerda" tamanho={18} cor="#3E8B22" />Voltar para o perfil
        </Link>
      </nav>
      <h1 className="ep-titulo">Editar perfil</h1>

      <form className="cad-card ep-form" onSubmit={salvar} noValidate>
        <div className="ep-conta">
          <button type="button" className="ep-avatar" aria-label="Trocar a foto de perfil" onClick={() => fotoRef.current?.click()} disabled={enviandoFoto}>
            {perfil.foto_url ? <img src={perfil.foto_url} alt="" /> : perfil.iniciais}
          </button>
          <div>
            <b>Foto de perfil</b>
            <p>Escolha uma foto para usar na plataforma. O e-mail da sua conta Google não pode ser alterado.</p>
            <button type="button" className="ep-foto-botao" onClick={() => fotoRef.current?.click()} disabled={enviandoFoto}>
              {enviandoFoto ? 'Enviando foto...' : 'Escolher foto'}
            </button>
            <input ref={fotoRef} type="file" accept="image/jpeg,image/png,image/webp" className="oculto" tabIndex={-1} aria-hidden="true" disabled={enviandoFoto} onChange={escolherFoto} />
            {fotoParaAjustar && <AjustarFoto arquivo={fotoParaAjustar} onUsar={trocarFoto} onCancelar={() => setFotoParaAjustar(null)} />}
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
