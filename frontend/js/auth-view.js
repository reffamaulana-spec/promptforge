import { h, icon, clear } from './ui.js';
import { signIn, signUp, sendReset, updatePassword, AuthError } from './auth.js';

const MIN_PASSWORD = 8;

function emailField(id) {
  return h(
    'div',
    { class: 'field' },
    h('label', { for: id, text: 'Email' }),
    h('input', { id, class: 'input', type: 'email', name: 'email', autocomplete: 'email', required: true, inputmode: 'email', spellcheck: 'false' })
  );
}

function passwordField(id, label, autocomplete, hint) {
  const hintId = hint ? `${id}-hint` : null;
  return h(
    'div',
    { class: 'field' },
    h('label', { for: id, text: label }),
    h('input', {
      id,
      class: 'input',
      type: 'password',
      name: id,
      autocomplete,
      required: true,
      minlength: String(MIN_PASSWORD),
      'aria-describedby': hintId
    }),
    hint ? h('p', { class: 'hint', id: hintId, text: hint }) : null
  );
}

function shell(title, subtitle, ...body) {
  return h(
    'main',
    { class: 'auth-card' },
    h('div', { class: 'auth-brand' }, icon('logo', 'brand-mark'), h('span', { class: 'brand-name', text: 'PROMPTFORGE' })),
    h('h1', { class: 'auth-title', tabindex: '-1', text: title }),
    subtitle ? h('p', { class: 'auth-sub', text: subtitle }) : null,
    ...body
  );
}

export function renderAuth(root, { mode = 'login', notice = null, error = null, onRecoveryDone }) {
  clear(root);
  root.hidden = false;

  const message = h('p', { class: 'auth-message', role: 'alert' });
  const info = h('p', { class: 'auth-notice', role: 'status' });
  if (error) message.textContent = error;
  if (notice) info.textContent = notice;

  function show(next, extra = {}) {
    renderAuth(root, { mode: next, onRecoveryDone, ...extra });
  }

  function bind(form, submit, label, busyLabel) {
    const button = h('button', { type: 'submit', class: 'btn btn-primary auth-submit' }, label);
    form.append(button);
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      message.textContent = '';
      info.textContent = '';
      button.disabled = true;
      button.textContent = busyLabel;
      try {
        await submit();
      } catch (failure) {
        message.textContent = failure instanceof AuthError ? failure.message : 'Terjadi kesalahan. Coba lagi.';
      } finally {
        if (button.isConnected) {
          button.disabled = false;
          button.textContent = label;
        }
      }
    });
  }

  let card;

  if (mode === 'login') {
    const form = h('form', { class: 'auth-form', novalidate: false }, emailField('auth-email'), passwordField('auth-password', 'Password', 'current-password'));
    bind(
      form,
      async () => {
        await signIn(form.elements.email.value.trim(), form.elements['auth-password'].value);
      },
      'Masuk',
      'Memproses…'
    );
    card = shell(
      'Masuk',
      'Masuk untuk memakai PROMPTFORGE dan menyimpan prompt di akunmu.',
      info,
      message,
      form,
      h(
        'div',
        { class: 'auth-links' },
        h('button', { type: 'button', class: 'link-btn', onClick: () => show('forgot') }, 'Lupa password?'),
        h('button', { type: 'button', class: 'link-btn', onClick: () => show('signup') }, 'Belum punya akun? Daftar')
      )
    );
  } else if (mode === 'signup') {
    const form = h(
      'form',
      { class: 'auth-form' },
      emailField('auth-email'),
      passwordField('auth-password', 'Password', 'new-password', `Minimal ${MIN_PASSWORD} karakter.`),
      passwordField('auth-password2', 'Ulangi password', 'new-password')
    );
    bind(
      form,
      async () => {
        const email = form.elements.email.value.trim();
        const password = form.elements['auth-password'].value;
        if (password.length < MIN_PASSWORD) throw new AuthError(`Password minimal ${MIN_PASSWORD} karakter.`);
        if (password !== form.elements['auth-password2'].value) throw new AuthError('Kedua password tidak sama.');
        const result = await signUp(email, password);
        if (result.needsConfirmation) {
          show('login', { notice: 'Akun dibuat. Kami mengirim link konfirmasi ke emailmu. Klik link itu, lalu masuk di sini.' });
        }
      },
      'Buat akun',
      'Membuat akun…'
    );
    card = shell(
      'Buat akun',
      'Gratis. Prompt, favorit, dan riwayatmu tersimpan di akun.',
      info,
      message,
      form,
      h('div', { class: 'auth-links' }, h('button', { type: 'button', class: 'link-btn', onClick: () => show('login') }, 'Sudah punya akun? Masuk'))
    );
  } else if (mode === 'forgot') {
    const form = h('form', { class: 'auth-form' }, emailField('auth-email'));
    bind(
      form,
      async () => {
        await sendReset(form.elements.email.value.trim());
        show('login', { notice: 'Jika email itu terdaftar, link untuk mengatur ulang password sudah dikirim. Periksa kotak masuk dan folder spam.' });
      },
      'Kirim link reset',
      'Mengirim…'
    );
    card = shell(
      'Atur ulang password',
      'Masukkan emailmu. Kami kirim link untuk membuat password baru.',
      info,
      message,
      form,
      h('div', { class: 'auth-links' }, h('button', { type: 'button', class: 'link-btn', onClick: () => show('login') }, 'Kembali ke Masuk'))
    );
  } else {
    const form = h(
      'form',
      { class: 'auth-form' },
      passwordField('auth-password', 'Password baru', 'new-password', `Minimal ${MIN_PASSWORD} karakter.`),
      passwordField('auth-password2', 'Ulangi password baru', 'new-password')
    );
    bind(
      form,
      async () => {
        const password = form.elements['auth-password'].value;
        if (password.length < MIN_PASSWORD) throw new AuthError(`Password minimal ${MIN_PASSWORD} karakter.`);
        if (password !== form.elements['auth-password2'].value) throw new AuthError('Kedua password tidak sama.');
        await updatePassword(password);
        onRecoveryDone();
      },
      'Simpan password baru',
      'Menyimpan…'
    );
    card = shell('Password baru', 'Buat password baru untuk akunmu.', info, message, form);
  }

  root.append(card);
  const first = card.querySelector('input');
  if (first) first.focus();
}

export function renderGate(root, kind, { onRetry }) {
  clear(root);
  root.hidden = false;

  if (kind === 'loading') {
    root.append(h('main', { class: 'auth-card', role: 'status' }, h('div', { class: 'auth-brand' }, icon('logo', 'brand-mark'), h('span', { class: 'brand-name', text: 'PROMPTFORGE' })), h('p', { class: 'auth-sub', text: 'Memuat…' })));
    return;
  }

  const content = {
    unconfigured: {
      title: 'Login belum diatur',
      text: 'Server belum tahu proyek Supabase-mu. Lakukan langkah ini:',
      steps: [
        'Buat proyek di supabase.com, lalu buka Project Settings, API.',
        'Salin Project URL dan anon public key ke file .env sebagai SUPABASE_URL dan SUPABASE_ANON_KEY.',
        'Jalankan isi supabase/schema.sql di SQL Editor Supabase.',
        'Restart server (npm run dev), lalu muat ulang halaman ini.'
      ]
    },
    offline: {
      title: 'Server tidak terjangkau',
      text: 'Halaman tidak bisa menghubungi server.',
      steps: ['Pastikan "npm run dev" masih berjalan di terminal.', 'Lalu tekan Coba lagi.']
    },
    data: {
      title: 'Data akun gagal dimuat',
      text: 'Server login bisa dihubungi, tapi data tidak bisa dibaca.',
      steps: ['Pastikan isi supabase/schema.sql sudah dijalankan di SQL Editor Supabase.', 'Jalankan "npm run check:supabase" untuk memeriksa, lalu tekan Coba lagi.']
    },
    broken: {
      title: 'Pustaka login gagal dimuat',
      text: 'File frontend/vendor/supabase.js tidak termuat.',
      steps: ['Jalankan "npm install" lalu "npm run vendor" di folder proyek.', 'Restart server dan muat ulang halaman.']
    }
  }[kind];

  root.append(
    shell(
      content.title,
      content.text,
      h('ol', { class: 'auth-steps' }, content.steps.map((step) => h('li', { text: step }))),
      h('button', { type: 'button', class: 'btn btn-quiet', onClick: onRetry }, 'Coba lagi')
    )
  );
}
