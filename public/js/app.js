import { h, icon, clear, emptyState, pageHead, link, toast, confirmDialog } from './ui.js';
import { getHealth } from './api.js';
import { initAuth, onAuthChange, currentUser, getClient, signOut, readAuthHash } from './auth.js';
import { renderAuth, renderGate } from './auth-view.js';
import { loadStorage, resetStorage, refreshStorage, retrySync, onSync, syncState, readLegacy, importLegacy } from './storage.js';
import { AI_FEATURES } from './features.js';
import { renderDashboard } from './pages/dashboard.js';
import { renderLibrary } from './pages/library.js';
import { renderWorkspace } from './pages/workspace.js';
import { renderFavorites, renderHistory } from './pages/history.js';
import { views as builderViews } from './builder.js';
import { views as imageViews } from './image-prompt.js';

const aiViews = { ...builderViews, ...imageViews };

const mainEl = document.getElementById('main');
const navEl = document.getElementById('nav');
const toggleEl = document.getElementById('menu-toggle');
const scrimEl = document.getElementById('scrim');
const bannersEl = document.getElementById('banners');
const shellEl = document.getElementById('shell');
const authRootEl = document.getElementById('auth-root');
const userBoxEl = document.getElementById('sidebar-user');
const userEmailEl = document.getElementById('user-email');
const healthEl = document.getElementById('health');
const healthTextEl = document.getElementById('health-text');

const state = {
  health: { status: 'loading' },
  healthCheckedAt: 0,
  healthListeners: new Set(),
  cleanup: null,
  guard: null,
  hash: '',
  ignoreNext: false,
  hasRendered: false,
  token: 0,
  userId: null,
  recovery: false,
  shellBound: false,
  listening: false
};

function renderPlaceholder(feature) {
  return (container) => {
    container.append(
      pageHead(feature.label, feature.summary),
      h(
        'div',
        { class: 'soon-panel' },
        h('span', { class: 'badge badge-warn', text: 'Segera hadir' }),
        h('p', { text: feature.detail }),
        h(
          'p',
          {},
          feature.backendReady ? 'Backend untuk alat ini sudah siap: ' : 'Backend: ',
          h('code', { class: 'inline-code', text: feature.backend }),
          feature.backendReady ? '. Yang belum ada hanya tampilannya.' : '.'
        ),
        h('p', { text: 'Sambil menunggu, kamu sudah bisa memakai template dan menyimpan prompt sendiri.' }),
        h(
          'div',
          { class: 'empty-actions' },
          link('#/library', 'btn btn-primary', icon('book'), 'Buka Library'),
          link('#/workspace/new', 'btn btn-quiet', icon('edit'), 'Tulis prompt')
        )
      )
    );
  };
}

const ROUTES = [
  { path: 'dashboard', label: 'Dashboard', icon: 'home', group: 'Studio', render: renderDashboard },
  ...AI_FEATURES.map((feature) => ({
    path: feature.path,
    label: feature.label,
    icon: feature.icon,
    group: 'Alat AI',
    render: aiViews[feature.path] || renderPlaceholder(feature)
  })),
  { path: 'library', label: 'Library', icon: 'book', group: 'Koleksi', render: renderLibrary },
  { path: 'workspace', label: 'Workspace', icon: 'edit', group: 'Koleksi', render: renderWorkspace },
  { path: 'favorites', label: 'Favorit', icon: 'star', group: 'Koleksi', render: renderFavorites },
  { path: 'history', label: 'Riwayat', icon: 'clock', group: 'Koleksi', render: renderHistory }
];

function renderNotFound(container) {
  container.append(
    pageHead('Halaman tidak ditemukan'),
    emptyState({
      title: 'Alamat ini tidak ada di PROMPTFORGE',
      message: 'Periksa alamatnya, atau kembali ke Dashboard.',
      actions: [link('#/dashboard', 'btn btn-primary', icon('home'), 'Ke Dashboard')]
    })
  );
}

function buildNav() {
  clear(navEl);
  const groups = [...new Set(ROUTES.map((route) => route.group))];
  groups.forEach((group, index) => {
    const titleId = `nav-group-${index}`;
    navEl.append(
      h(
        'div',
        { role: 'group', 'aria-labelledby': titleId },
        h('p', { class: 'nav-group-title', id: titleId, text: group }),
        h(
          'div',
          { class: 'nav-list' },
          ROUTES.filter((route) => route.group === group).map((route) =>
            h('a', { href: `#/${route.path}`, class: 'nav-link', dataset: { path: route.path } }, icon(route.icon), h('span', { text: route.label }))
          )
        )
      )
    );
  });
}

function updateNav(path) {
  navEl.querySelectorAll('.nav-link').forEach((anchor) => {
    if (anchor.dataset.path === path) {
      anchor.setAttribute('aria-current', 'page');
    } else {
      anchor.removeAttribute('aria-current');
    }
  });
}

function parseHash() {
  const parts = location.hash
    .replace(/^#\/?/, '')
    .split('/')
    .filter(Boolean)
    .map((part) => decodeURIComponent(part));
  return { path: parts[0] || 'dashboard', params: parts.slice(1) };
}

function navigate(path) {
  location.hash = `#${path}`;
}

function notifyHealth() {
  state.healthListeners.forEach((listener) => {
    try {
      listener(state.health);
    } catch (error) {
      console.error(error);
    }
  });
}

function renderHealth() {
  const health = state.health;
  healthEl.classList.remove('is-ok', 'is-warn', 'is-bad');
  healthEl.hidden = false;
  clear(healthTextEl);

  if (health.status === 'loading') {
    healthTextEl.append('Memeriksa server');
  } else if (health.status === 'offline') {
    healthEl.classList.add('is-bad');
    healthTextEl.append('Server offline');
  } else if (health.ai && health.ai.configured) {
    healthEl.hidden = true;
  } else {
    healthEl.classList.add('is-warn');
    healthTextEl.append('AI belum diatur');
  }

  clear(bannersEl);

  if (health.status === 'offline') {
    bannersEl.append(
      h(
        'div',
        { class: 'banner banner-bad', role: 'alert' },
        icon('alert'),
        h('p', { class: 'banner-text', text: 'Server tidak terjangkau. Workspace tetap bisa dipakai, tapi alat AI belum bisa dijalankan.' }),
        h('button', { type: 'button', class: 'btn btn-quiet btn-compact', onClick: () => refreshHealth(true) }, 'Coba lagi')
      )
    );
  } else if (health.status === 'ok' && health.ai && !health.ai.configured) {
    bannersEl.append(
      h(
        'div',
        { class: 'banner' },
        icon('info'),
        h('p', {
          class: 'banner-text',
          text: 'API key Gemini belum diatur, jadi alat AI belum aktif. Salin .env.example menjadi .env, isi GEMINI_API_KEY, lalu restart server. Fitur lain tetap bisa dipakai.'
        })
      )
    );
  }

  const sync = syncState();
  if (sync.error) {
    bannersEl.append(
      h(
        'div',
        { class: 'banner banner-bad', role: 'alert' },
        icon('alert'),
        h('p', { class: 'banner-text', text: `Perubahan terakhir belum tersimpan ke server. ${sync.error}` }),
        h('button', { type: 'button', class: 'btn btn-quiet btn-compact', onClick: () => retrySync() }, 'Coba lagi')
      )
    );
  }
}

async function refreshHealth(force = false) {
  if (!force && Date.now() - state.healthCheckedAt < 30000) return;
  state.healthCheckedAt = Date.now();
  try {
    const payload = await getHealth();
    state.health = { status: 'ok', ai: payload.ai, limits: payload.limits };
  } catch (error) {
    state.health = { status: 'offline' };
  }
  renderHealth();
  notifyHealth();
}

function setNav(open, { restoreFocus = true } = {}) {
  const wasOpen = document.body.classList.contains('nav-open');
  document.body.classList.toggle('nav-open', open);
  toggleEl.setAttribute('aria-expanded', String(open));
  toggleEl.setAttribute('aria-label', open ? 'Tutup menu' : 'Buka menu');
  if (open) {
    const first = navEl.querySelector('.nav-link');
    if (first) first.focus();
  } else if (wasOpen && restoreFocus) {
    toggleEl.focus();
  }
}

function createContext(params) {
  return {
    params,
    navigate,
    setLeaveGuard(fn) {
      state.guard = fn;
    },
    onHealth(listener) {
      state.healthListeners.add(listener);
      return () => state.healthListeners.delete(listener);
    },
    isReady(path) {
      return Boolean(aiViews[path]);
    },
    get health() {
      return state.health;
    }
  };
}

function teardown() {
  if (state.cleanup) {
    try {
      state.cleanup();
    } catch (error) {
      console.error(error);
    }
  }
  state.cleanup = null;
  state.guard = null;
}

async function handleRoute() {
  const { path, params } = parseHash();
  const route = ROUTES.find((item) => item.path === path) || null;
  const token = ++state.token;

  teardown();
  clear(mainEl);
  setNav(false, { restoreFocus: false });
  updateNav(route ? route.path : '');
  document.title = route ? `${route.label} - PROMPTFORGE` : 'Tidak ditemukan - PROMPTFORGE';

  const container = h('div', { class: 'page' });
  mainEl.append(container);

  try {
    const cleanup = await (route ? route.render : renderNotFound)(container, createContext(params));
    if (token !== state.token) {
      if (typeof cleanup === 'function') cleanup();
      return;
    }
    state.cleanup = typeof cleanup === 'function' ? cleanup : null;
  } catch (error) {
    console.error(error);
    clear(container);
    container.append(
      emptyState({
        title: 'Halaman gagal dimuat',
        message: 'Terjadi kesalahan saat menampilkan halaman ini. Muat ulang halaman, atau kembali ke Dashboard.',
        actions: [link('#/dashboard', 'btn btn-primary', 'Ke Dashboard')]
      })
    );
  }

  window.scrollTo(0, 0);
  if (state.hasRendered) {
    const heading = container.querySelector('h1');
    if (heading) heading.focus({ preventScroll: true });
  }
  state.hasRendered = true;
}

async function onHashChange() {
  if (!state.userId) return;
  if (state.ignoreNext) {
    state.ignoreNext = false;
    return;
  }

  if (state.guard) {
    const allowed = await state.guard();
    if (!allowed) {
      state.ignoreNext = true;
      location.hash = state.hash;
      return;
    }
  }

  state.hash = location.hash;
  await handleRoute();
}

function bindShell() {
  toggleEl.addEventListener('click', () => setNav(!document.body.classList.contains('nav-open')));
  scrimEl.addEventListener('click', () => setNav(false));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && document.body.classList.contains('nav-open')) setNav(false);
  });
  window.matchMedia('(min-width: 1024px)').addEventListener('change', (event) => {
    if (event.matches) setNav(false, { restoreFocus: false });
  });
  document.getElementById('skip-link').addEventListener('click', () => mainEl.focus());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && state.userId) {
      refreshHealth();
      refreshStorage();
    }
  });
  window.addEventListener('beforeunload', (event) => {
    if (syncState().pending > 0) {
      event.preventDefault();
      event.returnValue = '';
    }
  });
  document.getElementById('logout-btn').addEventListener('click', async () => {
    try {
      await signOut();
    } catch (error) {
      toast(error.message, 'error');
    }
  });
  onSync(() => renderHealth());
  window.addEventListener('hashchange', onHashChange);
}

function showAuth(mode, extra = {}) {
  teardown();
  clear(mainEl);
  shellEl.hidden = true;
  document.title = 'Masuk - PROMPTFORGE';
  renderAuth(authRootEl, { mode, onRecoveryDone, ...extra });
}

function onRecoveryDone() {
  state.recovery = false;
  const user = currentUser();
  if (user) enterApp(user);
  else showAuth('login');
}

function cleanAuthHash() {
  if (location.hash && !location.hash.startsWith('#/')) {
    history.replaceState(null, '', `${location.pathname}${location.search}#/dashboard`);
  }
}

async function offerLegacyImport() {
  const legacy = readLegacy();
  if (legacy.prompts.length === 0 && legacy.history.length === 0) return;
  const markerKey = `promptforge:imported:${state.userId}`;
  try {
    if (window.localStorage.getItem(markerKey)) return;
  } catch (error) {
    void error;
  }
  const confirmed = await confirmDialog({
    title: 'Impor data lama?',
    message: `Ditemukan ${legacy.prompts.length} prompt dan ${legacy.history.length} riwayat yang tersimpan di browser ini sebelum ada login. Impor ke akunmu sekarang?`,
    confirmLabel: 'Impor sekarang',
    cancelLabel: 'Lewati'
  });
  if (!confirmed) return;
  const result = importLegacy(legacy);
  if (result.ok) {
    try {
      window.localStorage.setItem(markerKey, '1');
    } catch (error) {
      void error;
    }
    toast(`Diimpor: ${result.prompts} prompt dan ${result.history} riwayat.`, 'success');
    handleRoute();
  }
}

async function enterApp(user) {
  if (state.userId === user.id) return;
  state.userId = user.id;
  shellEl.hidden = true;
  renderGate(authRootEl, 'loading', { onRetry: () => {} });

  try {
    await loadStorage(getClient(), user);
  } catch (error) {
    console.error(error);
    state.userId = null;
    renderGate(authRootEl, 'data', { onRetry: () => enterApp(user) });
    return;
  }

  authRootEl.hidden = true;
  clear(authRootEl);
  shellEl.hidden = false;
  userEmailEl.textContent = user.email;
  userBoxEl.hidden = false;

  if (!state.shellBound) {
    buildNav();
    bindShell();
    state.shellBound = true;
  }
  renderHealth();

  if (!location.hash || !location.hash.startsWith('#/')) {
    history.replaceState(null, '', `${location.pathname}${location.search}#/dashboard`);
  }
  state.hash = location.hash;
  state.hasRendered = false;

  handleRoute();
  refreshHealth(true);
  offerLegacyImport();
}

function leaveApp() {
  if (!state.userId) return;
  state.userId = null;
  userBoxEl.hidden = true;
  userEmailEl.textContent = '';
  resetStorage();
  history.replaceState(null, '', `${location.pathname}${location.search}`);
  showAuth('login');
}

function listenAuth() {
  if (state.listening) return;
  state.listening = true;
  onAuthChange((event, session) => {
    setTimeout(() => {
      if (event === 'PASSWORD_RECOVERY') {
        state.recovery = true;
        showAuth('recovery');
      } else if (event === 'SIGNED_OUT') {
        state.recovery = false;
        if (state.userId) leaveApp();
      } else if (event === 'SIGNED_IN' && session && session.user && !state.recovery) {
        enterApp({ id: session.user.id, email: session.user.email || '' });
      }
    }, 0);
  });
}

async function start() {
  const hashInfo = readAuthHash();
  if (hashInfo.type === 'recovery') state.recovery = true;

  renderGate(authRootEl, 'loading', { onRetry: () => {} });
  const init = await initAuth();
  if (init.status !== 'ready') {
    renderGate(authRootEl, init.status, { onRetry: start });
    return;
  }
  listenAuth();

  const user = currentUser();
  if (hashInfo.error) {
    cleanAuthHash();
    showAuth('login', { error: 'Link tidak valid atau sudah kedaluwarsa. Minta link baru, atau masuk dengan password.' });
    return;
  }
  if (state.recovery) {
    cleanAuthHash();
    if (user) showAuth('recovery');
    else showAuth('login', { error: 'Link reset tidak valid atau sudah kedaluwarsa. Minta link baru.' });
    return;
  }
  cleanAuthHash();
  if (user) await enterApp(user);
  else showAuth('login');
}

start();
