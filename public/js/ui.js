const SVG_NS = 'http://www.w3.org/2000/svg';

let modalCount = 0;

function appendChildren(element, children) {
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    element.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
}

export function h(tag, props, ...children) {
  const element = document.createElement(tag);

  if (props) {
    for (const [key, value] of Object.entries(props)) {
      if (value === undefined || value === null || value === false) continue;
      if (key === 'class') {
        element.className = value;
      } else if (key === 'text') {
        element.textContent = value;
      } else if (key === 'dataset') {
        Object.assign(element.dataset, value);
      } else if (key.length > 2 && key.startsWith('on') && typeof value === 'function') {
        element.addEventListener(key.slice(2).toLowerCase(), value);
      } else if (value === true) {
        element.setAttribute(key, '');
      } else {
        element.setAttribute(key, String(value));
      }
    }
  }

  appendChildren(element, children);
  return element;
}

export function icon(name, extraClass = '') {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', `icon ${extraClass}`.trim());
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const use = document.createElementNS(SVG_NS, 'use');
  use.setAttribute('href', `#i-${name}`);
  svg.append(use);
  return svg;
}

export function clear(element) {
  while (element.firstChild) element.removeChild(element.firstChild);
  return element;
}

export function toast(message, type = 'info') {
  const region = document.getElementById('toasts');
  if (!region) return;

  const existing = [...region.children];
  if (existing.some((node) => node.textContent === message)) return;
  while (region.children.length >= 3) region.firstElementChild.remove();

  const iconName = type === 'error' ? 'alert' : type === 'success' ? 'check' : 'info';
  const element = h('div', { class: `toast toast-${type}` }, icon(iconName), h('span', { text: message }));
  region.append(element);

  const lifetime = type === 'error' ? 6000 : 3200;
  setTimeout(() => {
    element.classList.add('is-leaving');
    setTimeout(() => element.remove(), 220);
  }, lifetime);
}

export function openModal({ title, content, actions = [], wide = false }) {
  const previouslyFocused = document.activeElement;
  modalCount += 1;
  const titleId = `modal-title-${modalCount}`;

  const dialog = h('dialog', { class: wide ? 'modal modal-wide' : 'modal', 'aria-labelledby': titleId });
  const closeButton = h(
    'button',
    { type: 'button', class: 'icon-btn', 'aria-label': 'Tutup', onClick: () => dialog.close('dismiss') },
    icon('x')
  );

  dialog.append(
    h('header', { class: 'modal-head' }, h('h2', { id: titleId, text: title }), closeButton),
    h('div', { class: 'modal-body' }, content)
  );
  if (actions.length > 0) {
    dialog.append(h('footer', { class: 'modal-foot' }, actions));
  }

  const closed = new Promise((resolve) => {
    dialog.addEventListener('close', () => {
      dialog.remove();
      if (previouslyFocused && typeof previouslyFocused.focus === 'function' && document.contains(previouslyFocused)) {
        previouslyFocused.focus();
      }
      resolve(dialog.returnValue);
    });
  });

  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close('dismiss');
  });

  document.body.append(dialog);
  dialog.showModal();

  return { dialog, close: (value = 'dismiss') => dialog.close(value), closed };
}

export function confirmDialog({ title, message, confirmLabel = 'Ya', cancelLabel = 'Batal', danger = false }) {
  return new Promise((resolve) => {
    const cancelButton = h(
      'button',
      { type: 'button', class: 'btn btn-quiet', onClick: () => modal.close('cancel') },
      cancelLabel
    );
    const confirmButton = h(
      'button',
      { type: 'button', class: danger ? 'btn btn-danger' : 'btn btn-primary', onClick: () => modal.close('confirm') },
      confirmLabel
    );
    const modal = openModal({
      title,
      content: h('p', { class: 'modal-text', text: message }),
      actions: [cancelButton, confirmButton]
    });
    cancelButton.focus();
    modal.closed.then((value) => resolve(value === 'confirm'));
  });
}

function legacyCopy(text) {
  const area = h('textarea', { class: 'visually-hidden', 'aria-hidden': 'true', tabindex: '-1', readonly: true });
  area.value = text;
  document.body.append(area);
  area.select();
  let copied = false;
  try {
    copied = document.execCommand('copy');
  } catch (error) {
    copied = false;
  }
  area.remove();
  return copied;
}

export async function copyText(text, successMessage = 'Disalin ke clipboard.') {
  let copied = false;
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      copied = true;
    }
  } catch (error) {
    copied = false;
  }
  if (!copied) copied = legacyCopy(text);

  if (copied) {
    toast(successMessage, 'success');
  } else {
    toast('Tidak bisa menyalin otomatis. Pilih teksnya lalu salin manual.', 'error');
  }
  return copied;
}

export function downloadFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = h('a', { href: url, download: filename, class: 'visually-hidden' });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function safeFilename(title, fallback = 'prompt') {
  const slug = String(title || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
  return slug || fallback;
}

const dateFormatter = (() => {
  try {
    return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch (error) {
    return null;
  }
})();

export function formatDate(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return dateFormatter ? dateFormatter.format(date) : date.toLocaleString();
}

export function snippet(text, max = 160) {
  const flat = String(text).replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max).trimEnd()}…` : flat;
}

export function countText(text) {
  const trimmed = String(text).trim();
  return {
    words: trimmed ? trimmed.split(/\s+/).length : 0,
    characters: String(text).length
  };
}

const SLOT_PATTERN = /\[[^[\]\n]{1,60}\]/g;

export function countSlots(text) {
  const matches = String(text).match(SLOT_PATTERN);
  return matches ? matches.length : 0;
}

export function renderWithSlots(text) {
  const fragment = document.createDocumentFragment();
  const source = String(text);
  let cursor = 0;

  for (const match of source.matchAll(SLOT_PATTERN)) {
    if (match.index > cursor) fragment.append(document.createTextNode(source.slice(cursor, match.index)));
    fragment.append(h('mark', { class: 'slot', text: match[0] }));
    cursor = match.index + match[0].length;
  }
  if (cursor < source.length) fragment.append(document.createTextNode(source.slice(cursor)));
  return fragment;
}

export function debounce(fn, wait = 200) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

export function pageHead(title, description, actions = []) {
  return h(
    'header',
    { class: 'page-head' },
    h(
      'div',
      { class: 'page-head-text' },
      h('h1', { tabindex: '-1', text: title }),
      description ? h('p', { text: description }) : null
    ),
    actions.length > 0 ? h('div', { class: 'page-head-actions' }, actions) : null
  );
}

export function link(href, className, ...children) {
  return h('a', { href, class: className }, ...children);
}

export function emptyState({ title, message, actions = [], level = 'h2' }) {
  return h(
    'div',
    { class: 'empty' },
    h(level, { text: title }),
    h('p', { text: message }),
    actions.length > 0 ? h('div', { class: 'empty-actions' }, actions) : null
  );
}
