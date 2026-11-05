export const LIMITS = Object.freeze({
  title: 120,
  content: 20000,
  tags: 8,
  tagLength: 30,
  history: 200
});

const LEGACY_PREFIX = 'promptforge:v1:';

const cache = { prompts: [], history: [], uses: {} };
const listeners = new Set();
const syncListeners = new Set();
const queue = [];

let db = null;
let userId = null;
let inFlight = null;
let running = false;
let syncError = null;

function emit() {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch (error) {
      void error;
    }
  });
}

function emitSync() {
  syncListeners.forEach((listener) => {
    try {
      listener({ pending: pendingCount(), error: syncError });
    } catch (error) {
      void error;
    }
  });
}

function newId() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0'));
  return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10).join('')}`;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function pendingCount() {
  return queue.length + (inFlight ? 1 : 0);
}

function describeSyncError(error) {
  const message = String((error && error.message) || '').toLowerCase();
  if (message.includes('failed to fetch') || message.includes('network')) return 'Tidak ada koneksi ke server.';
  if (error && (error.code === '42501' || error.status === 401 || error.status === 403)) return 'Sesi login habis. Masuk lagi.';
  return 'Server menolak perubahan.';
}

function enqueue(key, run) {
  if (!db) return;
  const index = queue.findIndex((item) => item.key === key);
  if (index !== -1) queue.splice(index, 1);
  queue.push({ key, run });
  emitSync();
  pump();
}

async function pump() {
  if (running || syncError) return;
  running = true;
  while (queue.length > 0 && db) {
    inFlight = queue.shift();
    emitSync();
    try {
      const { error } = await inFlight.run(db);
      if (error) throw error;
      inFlight = null;
    } catch (error) {
      queue.unshift(inFlight);
      inFlight = null;
      syncError = describeSyncError(error);
      break;
    }
  }
  running = false;
  emitSync();
}

function promptRow(item) {
  return {
    id: item.id,
    user_id: userId,
    title: item.title,
    content: item.content,
    tags: item.tags,
    favorite: item.favorite,
    source: item.source,
    created_at: item.createdAt,
    updated_at: item.updatedAt
  };
}

function fromPromptRow(row) {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    tags: Array.isArray(row.tags) ? row.tags : [],
    favorite: Boolean(row.favorite),
    source: row.source || 'manual',
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function historyRow(entry) {
  return {
    id: entry.id,
    user_id: userId,
    type: entry.type,
    title: entry.title,
    content: entry.content,
    prompt_id: entry.promptId && UUID_PATTERN.test(entry.promptId) ? entry.promptId : null,
    created_at: entry.createdAt
  };
}

function fromHistoryRow(row) {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    content: row.content,
    promptId: row.prompt_id || null,
    createdAt: row.created_at
  };
}

function queuePromptSave(item) {
  const row = promptRow(item);
  enqueue(`prompts:${item.id}`, (client) => client.from('prompts').upsert(row, { onConflict: 'id' }));
}

function queuePromptDelete(id) {
  enqueue(`prompts:${id}`, (client) => client.from('prompts').delete().eq('id', id));
}

function queueHistorySave(entry) {
  const row = historyRow(entry);
  enqueue(`history:${entry.id}`, (client) => client.from('history').upsert(row, { onConflict: 'id' }));
}

function queueHistoryDelete(id) {
  enqueue(`history:${id}`, (client) => client.from('history').delete().eq('id', id));
}

function queueUse(feature, count) {
  const row = { user_id: userId, feature, count };
  enqueue(`usage:${feature}`, (client) => client.from('usage_stats').upsert(row, { onConflict: 'user_id,feature' }));
}

async function fetchAll(client) {
  const [promptResult, historyResult, usageResult] = await Promise.all([
    client.from('prompts').select('*').order('updated_at', { ascending: false }).limit(2000),
    client.from('history').select('*').order('created_at', { ascending: false }).limit(LIMITS.history),
    client.from('usage_stats').select('feature,count')
  ]);
  const failure = promptResult.error || historyResult.error || usageResult.error;
  if (failure) throw failure;
  return {
    prompts: promptResult.data.map(fromPromptRow),
    history: historyResult.data.map(fromHistoryRow),
    uses: Object.fromEntries(usageResult.data.map((row) => [row.feature, Number(row.count) || 0]))
  };
}

export async function loadStorage(client, user) {
  db = client;
  userId = user.id;
  queue.length = 0;
  inFlight = null;
  syncError = null;
  const data = await fetchAll(client);
  cache.prompts = data.prompts;
  cache.history = data.history;
  cache.uses = data.uses;
  emit();
  emitSync();
}

export async function refreshStorage() {
  if (!db || pendingCount() > 0 || syncError) return false;
  try {
    const data = await fetchAll(db);
    if (pendingCount() > 0) return false;
    cache.prompts = data.prompts;
    cache.history = data.history;
    cache.uses = data.uses;
    emit();
    return true;
  } catch (error) {
    return false;
  }
}

export function resetStorage() {
  db = null;
  userId = null;
  queue.length = 0;
  inFlight = null;
  syncError = null;
  cache.prompts = [];
  cache.history = [];
  cache.uses = {};
  emit();
  emitSync();
}

export function retrySync() {
  syncError = null;
  emitSync();
  pump();
}

export function onSync(listener) {
  syncListeners.add(listener);
  return () => syncListeners.delete(listener);
}

export function syncState() {
  return { pending: pendingCount(), error: syncError };
}

export function readLegacy() {
  const result = { prompts: [], history: [] };
  try {
    const read = (key) => {
      const raw = window.localStorage.getItem(LEGACY_PREFIX + key);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    };
    result.prompts = read('prompts').filter((item) => item && typeof item.content === 'string' && item.content.trim());
    result.history = read('history').filter((item) => item && typeof item.content === 'string' && typeof item.type === 'string');
  } catch (error) {
    return { prompts: [], history: [] };
  }
  return result;
}

export function importLegacy(legacy) {
  if (!db) return { ok: false, reason: 'unavailable' };
  const known = new Set(cache.prompts.map((item) => item.id));
  const idMap = new Map();
  let promptCount = 0;
  let historyCount = 0;

  legacy.prompts.forEach((item) => {
    const id = typeof item.id === 'string' && UUID_PATTERN.test(item.id) && !known.has(item.id) ? item.id : newId();
    idMap.set(item.id, id);
    const created = item.createdAt && !Number.isNaN(Date.parse(item.createdAt)) ? item.createdAt : new Date().toISOString();
    const entry = {
      id,
      title: String(item.title || '').trim().slice(0, LIMITS.title) || deriveTitle(item.content),
      content: String(item.content).trim().slice(0, LIMITS.content),
      tags: cleanTags(item.tags),
      favorite: Boolean(item.favorite),
      source: cleanSource(item.source),
      createdAt: created,
      updatedAt: item.updatedAt && !Number.isNaN(Date.parse(item.updatedAt)) ? item.updatedAt : created
    };
    cache.prompts.push(entry);
    queuePromptSave(entry);
    promptCount += 1;
  });

  legacy.history.slice(0, LIMITS.history).forEach((item) => {
    const created = item.createdAt && !Number.isNaN(Date.parse(item.createdAt)) ? item.createdAt : new Date().toISOString();
    const entry = {
      id: newId(),
      type: cleanSource(item.type),
      title: String(item.title || '').trim().slice(0, LIMITS.title) || deriveTitle(item.content),
      content: String(item.content).trim().slice(0, LIMITS.content),
      promptId: idMap.get(item.promptId) || null,
      createdAt: created
    };
    cache.history.push(entry);
    queueHistorySave(entry);
    historyCount += 1;
  });

  cache.history.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  cache.history = cache.history.slice(0, LIMITS.history);
  emit();
  return { ok: true, prompts: promptCount, history: historyCount };
}

function cleanTags(input) {
  const raw = Array.isArray(input) ? input : String(input || '').split(',');
  const seen = new Set();
  const tags = [];
  for (const item of raw) {
    const tag = String(item).trim().replace(/\s+/g, ' ').slice(0, LIMITS.tagLength);
    const key = tag.toLowerCase();
    if (!tag || seen.has(key)) continue;
    seen.add(key);
    tags.push(tag);
    if (tags.length >= LIMITS.tags) break;
  }
  return tags;
}

function deriveTitle(content) {
  const firstLine = content
    .split('\n')
    .map((line) => line.replace(/^#+\s*/, '').trim())
    .find(Boolean);
  const title = (firstLine || 'Prompt tanpa judul').slice(0, 60);
  return title.length < (firstLine || '').length ? `${title}…` : title;
}

function cleanSource(value) {
  const source = String(value || 'manual').toLowerCase();
  return /^[a-z-]{1,20}$/.test(source) ? source : 'manual';
}


function validateContent(value) {
  const content = String(value === undefined || value === null ? '' : value).trim();
  if (!content) return { ok: false, reason: 'empty' };
  if (content.length > LIMITS.content) return { ok: false, reason: 'too_long' };
  return { ok: true, content };
}

export const prompts = {
  list() {
    return [...cache.prompts].sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  },

  get(id) {
    return cache.prompts.find((item) => item.id === id) || null;
  },

  create(input) {
    if (!db) return { ok: false, reason: 'unavailable' };
    const checked = validateContent(input && input.content);
    if (!checked.ok) return checked;

    const now = new Date().toISOString();
    const title = String((input && input.title) || '').trim().slice(0, LIMITS.title) || deriveTitle(checked.content);
    const prompt = {
      id: newId(),
      title,
      content: checked.content,
      tags: cleanTags(input && input.tags),
      favorite: Boolean(input && input.favorite),
      source: cleanSource(input && input.source),
      createdAt: now,
      updatedAt: now
    };

    cache.prompts.unshift(prompt);
    queuePromptSave(prompt);
    emit();
    return { ok: true, prompt };
  },

  update(id, patch) {
    if (!db) return { ok: false, reason: 'unavailable' };
    const index = cache.prompts.findIndex((item) => item.id === id);
    if (index === -1) return { ok: false, reason: 'not_found' };

    const next = { ...cache.prompts[index] };

    if (patch.content !== undefined) {
      const checked = validateContent(patch.content);
      if (!checked.ok) return checked;
      next.content = checked.content;
    }
    if (patch.title !== undefined) {
      next.title = String(patch.title).trim().slice(0, LIMITS.title) || deriveTitle(next.content);
    }
    if (patch.tags !== undefined) next.tags = cleanTags(patch.tags);
    if (patch.favorite !== undefined) next.favorite = Boolean(patch.favorite);
    next.updatedAt = new Date().toISOString();

    cache.prompts[index] = next;
    queuePromptSave(next);
    emit();
    return { ok: true, prompt: next };
  },

  toggleFavorite(id) {
    const current = this.get(id);
    if (!current) return { ok: false, reason: 'not_found' };
    return this.update(id, { favorite: !current.favorite });
  },

  duplicate(id) {
    const current = this.get(id);
    if (!current) return { ok: false, reason: 'not_found' };
    return this.create({
      title: `${current.title} (salinan)`.slice(0, LIMITS.title),
      content: current.content,
      tags: current.tags,
      source: current.source
    });
  },

  remove(id) {
    if (!db) return { ok: false, reason: 'unavailable' };
    const index = cache.prompts.findIndex((item) => item.id === id);
    if (index === -1) return { ok: false, reason: 'not_found' };
    cache.prompts.splice(index, 1);
    queuePromptDelete(id);
    emit();
    return { ok: true };
  }
};

export const history = {
  list() {
    return [...cache.history];
  },

  add({ type, title, content, promptId }) {
    if (!db) return { ok: false, reason: 'unavailable' };
    const checked = validateContent(content);
    if (!checked.ok) return checked;

    const latest = cache.history[0];
    if (latest && latest.type === type && latest.content === checked.content) {
      return { ok: true, skipped: true };
    }

    const entry = {
      id: newId(),
      type: cleanSource(type),
      title: String(title || '').trim().slice(0, LIMITS.title) || deriveTitle(checked.content),
      content: checked.content,
      promptId: promptId ? String(promptId) : null,
      createdAt: new Date().toISOString()
    };

    cache.history.unshift(entry);
    queueHistorySave(entry);
    while (cache.history.length > LIMITS.history) {
      const dropped = cache.history.pop();
      queueHistoryDelete(dropped.id);
    }
    emit();
    return { ok: true, entry };
  },

  remove(id) {
    if (!db) return { ok: false, reason: 'unavailable' };
    const index = cache.history.findIndex((item) => item.id === id);
    if (index === -1) return { ok: false, reason: 'not_found' };
    cache.history.splice(index, 1);
    queueHistoryDelete(id);
    emit();
    return { ok: true };
  },

  clear() {
    if (!db) return { ok: false, reason: 'unavailable' };
    const owner = userId;
    cache.history = [];
    for (let index = queue.length - 1; index >= 0; index -= 1) {
      if (queue[index].key.startsWith('history:')) queue.splice(index, 1);
    }
    enqueue('history:clear', (client) => client.from('history').delete().eq('user_id', owner));
    emit();
    return { ok: true };
  }
};

export const stats = {
  uses() {
    return { ...cache.uses };
  },

  record(feature) {
    if (!db) return { ok: false, reason: 'unavailable' };
    const key = cleanSource(feature);
    cache.uses[key] = (cache.uses[key] || 0) + 1;
    queueUse(key, cache.uses[key]);
    emit();
    return { ok: true };
  },

  total() {
    return Object.values(cache.uses).reduce((sum, value) => sum + value, 0);
  }
};

export function exportPrompts(list) {
  return {
    app: 'PROMPTFORGE',
    version: 1,
    exportedAt: new Date().toISOString(),
    prompts: list
  };
}

export function onChange(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function failureMessage(reason) {
  switch (reason) {
    case 'empty':
      return 'Isi prompt tidak boleh kosong.';
    case 'too_long':
      return `Isi prompt maksimal ${LIMITS.content.toLocaleString('id-ID')} karakter.`;
    case 'unavailable':
      return 'Akunmu belum siap. Muat ulang halaman atau masuk lagi.';
    case 'not_found':
      return 'Prompt tidak ditemukan. Mungkin sudah dihapus dari tab lain.';
    default:
      return 'Perubahan tidak bisa disimpan.';
  }
}
