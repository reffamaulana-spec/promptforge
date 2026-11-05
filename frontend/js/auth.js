let client = null;
let session = null;
const listeners = new Set();

export class AuthError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'AuthError';
    this.code = code || 'AUTH_ERROR';
  }
}

function translate(error) {
  const code = String((error && (error.code || error.error_code)) || '').toLowerCase();
  const message = String((error && error.message) || '').toLowerCase();
  const status = Number(error && error.status);

  if (code === 'invalid_credentials' || message.includes('invalid login credentials')) return 'Email atau password salah.';
  if (code === 'email_not_confirmed' || message.includes('email not confirmed')) return 'Email belum dikonfirmasi. Buka kotak masuk emailmu dan klik link konfirmasi.';
  if (code === 'user_already_exists' || message.includes('already registered')) return 'Email ini sudah terdaftar. Coba masuk, atau atur ulang password.';
  if (code === 'weak_password' || message.includes('password should be')) return 'Password terlalu lemah. Pakai minimal 8 karakter dengan campuran huruf dan angka.';
  if (code === 'same_password' || message.includes('different from the old')) return 'Password baru harus berbeda dari yang lama.';
  if (code === 'validation_failed' || message.includes('valid email')) return 'Format email tidak valid.';
  if (code === 'signup_disabled') return 'Pendaftaran akun baru sedang dinonaktifkan.';
  if (code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit' || status === 429) return 'Terlalu banyak percobaan. Tunggu beberapa menit lalu coba lagi.';
  if (message.includes('failed to fetch') || message.includes('network') || status === 0) return 'Tidak bisa menghubungi layanan login. Periksa koneksi internetmu.';
  return 'Permintaan login gagal. Coba lagi.';
}

function wrap(error) {
  return new AuthError(translate(error), error && (error.code || error.error_code));
}

export function readAuthHash() {
  const raw = location.hash.startsWith('#') ? location.hash.slice(1) : '';
  if (!raw || raw.startsWith('/')) return { type: null, error: null };
  const params = new URLSearchParams(raw);
  const description = params.get('error_description');
  const code = params.get('error_code');
  return {
    type: params.get('type'),
    error: params.get('error') ? { code, description } : null
  };
}

export async function initAuth() {
  let config = null;
  try {
    const response = await fetch('/api/config', { cache: 'no-store' });
    if (!response.ok) return { status: 'offline' };
    config = (await response.json()).supabase;
  } catch (error) {
    return { status: 'offline' };
  }

  if (!config) return { status: 'unconfigured' };
  if (!window.supabase || typeof window.supabase.createClient !== 'function') return { status: 'broken' };

  client = window.supabase.createClient(config.url, config.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });

  client.auth.onAuthStateChange((event, next) => {
    session = next;
    listeners.forEach((listener) => {
      try {
        listener(event, next);
      } catch (callbackError) {
        console.error(callbackError);
      }
    });
  });

  const { data } = await client.auth.getSession();
  session = data.session;
  return { status: 'ready' };
}

export function getClient() {
  return client;
}

export function currentUser() {
  return session && session.user ? { id: session.user.id, email: session.user.email || '' } : null;
}

export function onAuthChange(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function getAccessToken() {
  if (!client) return null;
  const { data } = await client.auth.getSession();
  return data.session ? data.session.access_token : null;
}

export async function signIn(email, password) {
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw wrap(error);
}

export async function signUp(email, password) {
  const { data, error } = await client.auth.signUp({ email, password, options: { emailRedirectTo: `${location.origin}/` } });
  if (error) throw wrap(error);
  if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    throw new AuthError('Email ini sudah terdaftar. Coba masuk, atau atur ulang password.', 'user_already_exists');
  }
  return { needsConfirmation: !data.session };
}

export async function sendReset(email) {
  const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}/` });
  if (error) throw wrap(error);
}

export async function updatePassword(password) {
  const { error } = await client.auth.updateUser({ password });
  if (error) throw wrap(error);
}

export async function signOut() {
  if (!client) return;
  const { error } = await client.auth.signOut();
  if (error) throw wrap(error);
}
