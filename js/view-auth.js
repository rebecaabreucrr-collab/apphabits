// Telas de login: entrar, criar conta, esqueci a senha e nova senha.
import { esc } from './utils.js';
import { A, ui, rerender, toast, go } from './ui.js';
import { signIn, signUp, recover, changePassword, currentUser } from './auth.js';
import { svg } from './icons.js';

let onLogged = () => {};
export const setOnLogged = (f) => { onLogged = f; };

const msg = () => `<p class="auth-msg ${ui.authMsg?.ok ? 'ok' : ''}" ${ui.authMsg ? '' : 'hidden'}>${esc(ui.authMsg?.text || '')}</p>`;
/** mostra a mensagem sem redesenhar o formulário (não apaga o que foi digitado) */
const say = (text, ok = false) => {
  ui.authMsg = { text, ok };
  const el = document.querySelector('.auth .auth-msg');
  if (!el) return rerender();
  el.textContent = text; el.hidden = false; el.classList.toggle('ok', ok);
};
const busy = (form, on) => {
  ui.authBusy = on;
  const btn = form.querySelector('button[type=submit]');
  if (!btn) return;
  if (on) { btn.dataset.label = btn.textContent; btn.textContent = 'Aguarde…'; btn.disabled = true; }
  else { btn.textContent = btn.dataset.label || btn.textContent; btn.disabled = false; }
};

export function renderLogin() {
  const mode = ui.authMode || 'entrar';
  const titles = { entrar: 'Entrar', criar: 'Criar conta', esqueci: 'Recuperar senha' };
  return `<div class="auth">
    <div class="auth-logo">${svg('checkc')}</div>
    <h1>Minha Rotina</h1>
    <p class="muted">Sua rotina, seus hábitos e seu autocuidado num só lugar.</p>
    ${mode !== 'esqueci' ? `<div class="seg">${[['entrar', 'Entrar'], ['criar', 'Criar conta']].map(([k, l]) =>
      `<button class="${mode === k ? 'on' : ''}" data-act="authMode" data-m="${k}">${l}</button>`).join('')}</div>` : `<h2 class="auth-sub">${titles[mode]}</h2>`}
    <form class="form" id="auth-form" novalidate>
      ${mode === 'criar' ? '<label class="field"><span>Seu nome</span><input name="name" autocomplete="given-name" required placeholder="Como quer ser chamada?"></label>' : ''}
      <label class="field"><span>E-mail</span><input type="email" name="email" autocomplete="email" inputmode="email" required value="${esc(ui.authEmail || '')}" placeholder="voce@email.com"></label>
      ${mode !== 'esqueci' ? `<label class="field"><span>Senha</span><div class="pw"><input type="password" name="password" autocomplete="${mode === 'criar' ? 'new-password' : 'current-password'}" required minlength="6" placeholder="mínimo 6 caracteres">
        <button type="button" class="pw-eye" data-act="pwToggle" aria-label="Mostrar senha">👁</button></div></label>` : ''}
      ${msg()}
      <button class="btn primary block" type="submit">${mode === 'criar' ? 'Criar minha conta' : mode === 'esqueci' ? 'Enviar link por e-mail' : 'Entrar'}</button>
    </form>
    ${mode === 'entrar' ? '<button class="link" data-act="authMode" data-m="esqueci">Esqueci minha senha</button>' : ''}
    ${mode === 'esqueci' ? '<button class="link" data-act="authMode" data-m="entrar">‹ Voltar para entrar</button>' : ''}
    <p class="small muted auth-foot">Seus dados ficam guardados no seu aparelho. O login protege o acesso ao app.</p>
  </div>`;
}

export function renderNewPassword() {
  return `<div class="auth">
    <div class="auth-logo">${svg('checkc')}</div>
    <h2 class="auth-sub">Crie uma nova senha</h2>
    <p class="muted">${esc(currentUser()?.email || '')}</p>
    <form class="form" id="newpw-form" novalidate>
      <label class="field"><span>Nova senha</span><div class="pw"><input type="password" name="password" autocomplete="new-password" required minlength="6" placeholder="mínimo 6 caracteres">
        <button type="button" class="pw-eye" data-act="pwToggle" aria-label="Mostrar senha">👁</button></div></label>
      ${msg()}
      <button class="btn primary block" type="submit">Salvar nova senha</button>
    </form></div>`;
}

A.authMode = (el) => {
  const em = document.querySelector('.auth [name=email]'); if (em) ui.authEmail = em.value.trim();
  ui.authMode = el.dataset.m; ui.authMsg = null; rerender();
};
A.pwToggle = (el) => { const i = el.parentNode.querySelector('input'); i.type = i.type === 'password' ? 'text' : 'password'; };

document.addEventListener('submit', async (e) => {
  const f = e.target;
  if (f.id !== 'auth-form' && f.id !== 'newpw-form') return;
  e.preventDefault();
  const fd = new FormData(f);
  const email = String(fd.get('email') || '').trim().toLowerCase();
  const password = String(fd.get('password') || '');
  if (f.id === 'auth-form') ui.authEmail = email;
  const mode = f.id === 'newpw-form' ? 'nova' : (ui.authMode || 'entrar');
  if (mode !== 'nova' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return say('Digite um e-mail válido.');
  if (mode !== 'esqueci' && password.length < 6) return say('A senha precisa ter pelo menos 6 caracteres.');
  if (mode === 'criar' && !String(fd.get('name') || '').trim()) return say('Digite seu nome.');
  if (ui.authBusy) return;
  busy(f, true);
  const m = document.querySelector('.auth .auth-msg'); if (m) m.hidden = true;
  try {
    if (mode === 'entrar') { await signIn(email, password); busy(f, false); onLogged(); return; }
    if (mode === 'criar') {
      const r = await signUp(email, password, String(fd.get('name')).trim());
      busy(f, false);
      if (r === 'logged') { onLogged(String(fd.get('name')).trim()); return; }
      ui.authMode = 'entrar';
      ui.authMsg = { text: 'Conta criada! Enviamos um link para o seu e-mail. Toque nele para confirmar e depois entre aqui.', ok: true };
      return rerender();
    }
    if (mode === 'esqueci') { await recover(email); busy(f, false); return say('Se esse e-mail tiver conta, enviamos um link para criar uma nova senha.', true); }
    if (mode === 'nova') { await changePassword(password); busy(f, false); ui.authMsg = null; toast('Senha alterada 💜'); go('#/hoje'); onLogged(); }
  } catch (err) {
    busy(f, false); say(err.message);
  }
});
