// Login com e-mail e senha usando o Supabase Auth (sem bibliotecas externas).
import { CONFIG } from './config.js';

const KEY = 'minharotina.auth';
const base = () => String(CONFIG.supabaseUrl || '').replace(/\/+$/, '');
export const authEnabled = () => !!(CONFIG.supabaseUrl && CONFIG.supabaseKey && CONFIG.requireLogin);

let session = read();
function read() { try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; } }
function persist() { try { session ? localStorage.setItem(KEY, JSON.stringify(session)) : localStorage.removeItem(KEY); } catch { /* ignora */ } }

export const currentUser = () => session?.user || null;
export const isLoggedIn = () => !!session?.refresh_token;

function traduz(m) {
  if (/invalid login credentials/i.test(m)) return 'E-mail ou senha incorretos.';
  if (/email not confirmed/i.test(m)) return 'Confirme seu e-mail pelo link que enviamos antes de entrar.';
  if (/already registered|already exists/i.test(m)) return 'Esse e-mail já tem conta. Toque em "Entrar".';
  if (/password should be at least|weak password/i.test(m)) return 'A senha precisa ter pelo menos 6 caracteres.';
  if (/invalid email|unable to validate email/i.test(m)) return 'E-mail inválido.';
  if (/rate limit|too many/i.test(m)) return 'Muitas tentativas. Espere alguns minutos e tente de novo.';
  if (/same password|different from the old/i.test(m)) return 'A nova senha precisa ser diferente da atual.';
  if (/failed to fetch|network/i.test(m)) return 'Sem conexão com a internet.';
  return m;
}

async function api(path, { method = 'GET', body, token } = {}) {
  const headers = { apikey: CONFIG.supabaseKey, 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  let res;
  try { res = await fetch(base() + path, { method, headers, body: body ? JSON.stringify(body) : undefined }); }
  catch { throw new Error(traduz('failed to fetch')); }
  const text = await res.text();
  let data = null; try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) throw new Error(traduz(String(data?.msg || data?.message || data?.error_description || data?.error || `Erro ${res.status}`)));
  return data;
}

function setSession(d) {
  session = { access_token: d.access_token, refresh_token: d.refresh_token,
    expires_at: Date.now() + (Number(d.expires_in) || 3600) * 1000,
    user: { id: d.user?.id, email: d.user?.email, name: d.user?.user_metadata?.name || '' } };
  persist();
}

/** cria a conta; devolve 'logged' (entrou direto) ou 'confirm' (precisa confirmar o e-mail) */
export async function signUp(email, password, name) {
  const d = await api('/auth/v1/signup', { method: 'POST',
    body: { email, password, data: { name }, options: { emailRedirectTo: appUrl() } } });
  if (d?.access_token) { setSession(d); return 'logged'; }
  return 'confirm';
}
export async function signIn(email, password) {
  setSession(await api('/auth/v1/token?grant_type=password', { method: 'POST', body: { email, password } }));
}
export async function recover(email) {
  await api(`/auth/v1/recover?redirect_to=${encodeURIComponent(appUrl())}`, { method: 'POST', body: { email } });
}
export async function changePassword(password) {
  await ensureFresh();
  await api('/auth/v1/user', { method: 'PUT', token: session.access_token, body: { password } });
}
export async function signOut() {
  const t = session?.access_token;
  session = null; persist();
  if (t) api('/auth/v1/logout', { method: 'POST', token: t }).catch(() => {});
}

/** renova o acesso quando está perto de vencer (funciona offline: mantém a sessão) */
export async function ensureFresh() {
  if (!session?.refresh_token) throw new Error('Entre com seu e-mail e senha.');
  if (Date.now() < session.expires_at - 60000) return;
  if (!navigator.onLine) return;
  try {
    const d = await api('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: session.refresh_token } });
    setSession({ ...d, user: d.user || session.user });
  } catch (e) {
    if (/invalid|revoked|not found/i.test(e.message)) { session = null; persist(); }
    throw e;
  }
}

/** links do e-mail (confirmar conta / redefinir senha) chegam como #access_token=...&type=... */
export function consumeAuthRedirect() {
  const h = location.hash.replace(/^#\/?/, '');
  if (!/access_token=/.test(h)) {
    if (/error_description=/.test(h)) {
      const p = new URLSearchParams(h);
      history.replaceState(null, '', location.pathname + '#/hoje');
      return { error: p.get('error_description') || 'O link expirou. Peça outro.' };
    }
    return null;
  }
  const p = new URLSearchParams(h);
  setSession({ access_token: p.get('access_token'), refresh_token: p.get('refresh_token'), expires_in: p.get('expires_in'),
    user: decodeUser(p.get('access_token')) });
  const type = p.get('type');
  history.replaceState(null, '', location.pathname + (type === 'recovery' ? '#/nova-senha' : '#/hoje'));
  return { type };
}
function decodeUser(jwt) {
  try {
    const b = JSON.parse(atob(jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return { id: b.sub, email: b.email, user_metadata: b.user_metadata || {} };
  } catch { return {}; }
}
const appUrl = () => location.origin + location.pathname;
