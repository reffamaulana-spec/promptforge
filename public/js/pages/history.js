import {
  h,
  icon,
  clear,
  toast,
  copyText,
  confirmDialog,
  openModal,
  renderWithSlots,
  formatDate,
  snippet,
  debounce,
  emptyState,
  pageHead,
  link
} from '../ui.js';
import { prompts, history, onChange, failureMessage } from '../storage.js';
import { HISTORY_LABELS } from '../features.js';

function matchesQuery(text, query) {
  if (!query) return true;
  const haystack = text.toLowerCase();
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => haystack.includes(word));
}

function iconButton(name, label, onClick) {
  return h('button', { type: 'button', class: 'icon-btn', 'aria-label': label, title: label, onClick }, icon(name));
}

export function renderFavorites(container, ctx) {
  let query = '';
  const list = h('ul', { class: 'rows' });
  const count = h('p', { class: 'result-count', 'aria-live': 'polite' });

  function update() {
    const favorites = prompts.list().filter((item) => item.favorite);
    const shown = favorites.filter((item) => matchesQuery(`${item.title} ${item.content} ${item.tags.join(' ')}`, query));
    clear(list);
    count.textContent = favorites.length === 0 ? '' : `${shown.length} dari ${favorites.length} favorit`;

    if (favorites.length === 0) {
      list.append(
        h(
          'li',
          {},
          emptyState({
            title: 'Belum ada favorit',
            message: 'Buka sebuah prompt di Workspace lalu tekan Favorit. Prompt yang sering kamu pakai akan terkumpul di sini.',
            actions: [link('#/workspace', 'btn btn-primary', 'Buka Workspace')]
          })
        )
      );
      return;
    }

    if (shown.length === 0) {
      list.append(h('li', { class: 'hint' }, 'Tidak ada favorit yang cocok dengan pencarian.'));
      return;
    }

    shown.forEach((item) => {
      list.append(
        h(
          'li',
          { class: 'row' },
          h(
            'div',
            { class: 'row-main' },
            link(`#/workspace/${item.id}`, 'row-title', item.title),
            h('p', { class: 'row-text', text: snippet(item.content, 180) }),
            h(
              'div',
              { class: 'row-meta' },
              h('span', { text: formatDate(item.updatedAt) }),
              item.tags.length > 0 ? h('ul', { class: 'tags' }, item.tags.map((tag) => h('li', { text: `#${tag}` }))) : null
            )
          ),
          h(
            'div',
            { class: 'row-actions' },
            iconButton('copy', `Salin ${item.title}`, () => copyText(item.content, 'Prompt disalin.')),
            iconButton('star', `Hapus ${item.title} dari favorit`, () => {
              const result = prompts.toggleFavorite(item.id);
              if (!result.ok) {
                toast(failureMessage(result.reason), 'error');
                return;
              }
              toast('Dihapus dari favorit.', 'success');
            })
          )
        )
      );
    });
  }

  const search = h('input', {
    type: 'search',
    class: 'input',
    placeholder: 'Cari di favorit',
    'aria-label': 'Cari di favorit',
    autocomplete: 'off',
    onInput: debounce((event) => {
      query = event.target.value.trim();
      update();
    }, 150)
  });

  container.append(
    pageHead('Favorit', 'Prompt yang kamu tandai bintang di Workspace.'),
    h('div', { class: 'block' }, h('div', { class: 'toolbar' }, search), count),
    list
  );
  update();

  return onChange(update);
}

export function renderHistory(container, ctx) {
  let query = '';
  let type = 'all';
  const list = h('ul', { class: 'rows' });
  const count = h('p', { class: 'result-count', 'aria-live': 'polite' });
  const clearButton = h(
    'button',
    {
      type: 'button',
      class: 'btn btn-danger-quiet',
      onClick: async () => {
        const confirmed = await confirmDialog({
          title: 'Hapus seluruh riwayat?',
          message: 'Semua entri riwayat akan dihapus. Prompt di Workspace tidak ikut terhapus.',
          confirmLabel: 'Hapus riwayat',
          danger: true
        });
        if (!confirmed) return;
        const result = history.clear();
        toast(result.ok ? 'Riwayat dihapus.' : failureMessage(result.reason), result.ok ? 'success' : 'error');
      }
    },
    icon('trash'),
    'Hapus semua'
  );
  const typeSelect = h('select', {
    class: 'select',
    'aria-label': 'Filter jenis riwayat',
    onChange: (event) => {
      type = event.target.value;
      update();
    }
  });

  function saveToWorkspace(entry) {
    const result = prompts.create({ title: entry.title, content: entry.content, source: 'history' });
    if (!result.ok) {
      toast(failureMessage(result.reason), 'error');
      return;
    }
    toast('Disimpan ke Workspace.', 'success');
  }

  function viewEntry(entry) {
    const modal = openModal({
      title: entry.title,
      wide: true,
      content: h(
        'div',
        { class: 'block' },
        h('p', { class: 'section-note', text: `${HISTORY_LABELS[entry.type] || entry.type}, ${formatDate(entry.createdAt)}` }),
        h('pre', { class: 'prompt-view', tabindex: '0' }, renderWithSlots(entry.content))
      ),
      actions: [
        h('button', { type: 'button', class: 'btn btn-quiet', onClick: () => copyText(entry.content, 'Isi riwayat disalin.') }, icon('copy'), 'Salin'),
        h(
          'button',
          {
            type: 'button',
            class: 'btn btn-primary',
            onClick: () => {
              saveToWorkspace(entry);
              modal.close('saved');
            }
          },
          icon('save'),
          'Simpan ke Workspace'
        )
      ]
    });
  }

  function refreshTypeOptions(entries) {
    const present = [...new Set(entries.map((entry) => entry.type))];
    const previous = type;
    clear(typeSelect);
    typeSelect.append(h('option', { value: 'all', text: 'Semua jenis' }));
    present.forEach((value) => typeSelect.append(h('option', { value, text: HISTORY_LABELS[value] || value })));
    if (previous !== 'all' && !present.includes(previous)) type = 'all';
    typeSelect.value = type;
  }

  function update() {
    const entries = history.list();
    refreshTypeOptions(entries);
    const shown = entries.filter((entry) => (type === 'all' || entry.type === type) && matchesQuery(`${entry.title} ${entry.content}`, query));
    clear(list);
    clearButton.disabled = entries.length === 0;
    count.textContent = entries.length === 0 ? '' : `${shown.length} dari ${entries.length} entri`;

    if (entries.length === 0) {
      list.append(
        h(
          'li',
          {},
          emptyState({
            title: 'Riwayat masih kosong',
            message: 'Setiap kali kamu menyimpan prompt atau memakai template, entrinya tercatat di sini.',
            actions: [link('#/library', 'btn btn-primary', icon('book'), 'Buka Library')]
          })
        )
      );
      return;
    }

    if (shown.length === 0) {
      list.append(h('li', { class: 'hint' }, 'Tidak ada entri yang cocok dengan filter.'));
      return;
    }

    shown.forEach((entry) => {
      list.append(
        h(
          'li',
          { class: 'row' },
          h(
            'div',
            { class: 'row-main' },
            h('span', { class: 'row-title', text: entry.title }),
            h('p', { class: 'row-text', text: snippet(entry.content, 180) }),
            h(
              'div',
              { class: 'row-meta' },
              h('span', { class: 'badge badge-violet', text: HISTORY_LABELS[entry.type] || entry.type }),
              h('span', { text: formatDate(entry.createdAt) })
            )
          ),
          h(
            'div',
            { class: 'row-actions' },
            iconButton('eye', `Lihat ${entry.title}`, () => viewEntry(entry)),
            iconButton('copy', `Salin ${entry.title}`, () => copyText(entry.content, 'Isi riwayat disalin.')),
            iconButton('save', `Simpan ${entry.title} ke Workspace`, () => saveToWorkspace(entry)),
            iconButton('trash', `Hapus ${entry.title} dari riwayat`, () => {
              const result = history.remove(entry.id);
              if (!result.ok) toast(failureMessage(result.reason), 'error');
            })
          )
        )
      );
    });
  }

  const search = h('input', {
    type: 'search',
    class: 'input',
    placeholder: 'Cari di riwayat',
    'aria-label': 'Cari di riwayat',
    autocomplete: 'off',
    onInput: debounce((event) => {
      query = event.target.value.trim();
      update();
    }, 150)
  });

  container.append(
    pageHead('Riwayat', 'Catatan prompt yang pernah kamu simpan atau pakai. Riwayat menyimpan maksimal 200 entri terbaru.'),
    h('div', { class: 'block' }, h('div', { class: 'toolbar' }, search, typeSelect, clearButton), count),
    list
  );
  update();

  return onChange(update);
}
