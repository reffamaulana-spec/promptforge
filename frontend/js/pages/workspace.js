import {
  h,
  icon,
  clear,
  toast,
  copyText,
  confirmDialog,
  downloadFile,
  safeFilename,
  formatDate,
  snippet,
  countText,
  countSlots,
  debounce,
  emptyState,
  pageHead,
  link
} from '../ui.js';
import { prompts, history, onChange, exportPrompts, failureMessage, LIMITS } from '../storage.js';

function tagsToText(tags) {
  return (tags || []).join(', ');
}

function normalizeTags(text) {
  return String(text)
    .split(',')
    .map((tag) => tag.trim().replace(/\s+/g, ' '))
    .filter(Boolean)
    .join(', ');
}

function matchesQuery(item, query) {
  if (!query) return true;
  const haystack = `${item.title} ${item.content} ${(item.tags || []).join(' ')}`.toLowerCase();
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => haystack.includes(word));
}

export function renderWorkspace(container, ctx) {
  const routeId = ctx.params[0] || null;
  const isNew = routeId === 'new';
  let saved = routeId && !isNew ? prompts.get(routeId) : null;
  let query = '';
  let onlyFavorites = false;
  let baseline = saved ? { title: saved.title, tags: tagsToText(saved.tags), content: saved.content } : { title: '', tags: '', content: '' };
  let dirty = false;

  const listEl = h('ul', { class: 'ws-items' });
  const listCount = h('p', { class: 'result-count', 'aria-live': 'polite' });
  const searchInput = h('input', {
    type: 'search',
    class: 'input',
    placeholder: 'Cari di Workspace',
    'aria-label': 'Cari prompt di Workspace',
    autocomplete: 'off',
    onInput: debounce((event) => {
      query = event.target.value.trim();
      renderList();
    }, 150)
  });
  const favoriteFilter = h(
    'button',
    {
      type: 'button',
      class: 'btn btn-quiet btn-compact',
      'aria-pressed': 'false',
      onClick: () => {
        onlyFavorites = !onlyFavorites;
        favoriteFilter.setAttribute('aria-pressed', String(onlyFavorites));
        renderList();
      }
    },
    icon('star'),
    'Hanya favorit'
  );
  const exportAllButton = h(
    'button',
    { type: 'button', class: 'btn btn-quiet btn-compact', onClick: exportAll },
    icon('download'),
    'Ekspor semua (JSON)'
  );

  function renderList() {
    const all = prompts.list();
    const shown = all.filter((item) => (!onlyFavorites || item.favorite) && matchesQuery(item, query));
    clear(listEl);

    listCount.textContent = all.length === 0 ? 'Belum ada prompt' : `${shown.length} dari ${all.length} prompt`;
    exportAllButton.disabled = all.length === 0;

    if (all.length === 0) return;
    if (shown.length === 0) {
      listEl.append(h('li', { class: 'hint' }, 'Tidak ada prompt yang cocok dengan filter.'));
      return;
    }

    shown.forEach((item) => {
      const selected = item.id === routeId;
      listEl.append(
        h(
          'li',
          {},
          h(
            'a',
            { href: `#/workspace/${item.id}`, class: 'ws-item', 'aria-current': selected ? 'true' : null },
            h('span', { class: 'ws-item-title' }, item.favorite ? icon('star') : null, h('span', { text: item.title })),
            h('span', { class: 'ws-item-text', text: snippet(item.content, 70) })
          )
        )
      );
    });
  }

  function exportAll() {
    const list = prompts.list();
    if (list.length === 0) return;
    downloadFile('promptforge-workspace.json', JSON.stringify(exportPrompts(list), null, 2), 'application/json');
    toast(`${list.length} prompt diekspor.`, 'success');
  }

  const editorEl = h('section', { class: 'ws-editor', 'aria-label': 'Editor prompt' });

  function buildEditor() {
    clear(editorEl);

    if (!routeId) {
      editorEl.append(
        emptyState({
          title: 'Pilih prompt untuk mulai mengedit',
          message: 'Pilih prompt dari daftar, atau buat yang baru. Prompt tersimpan di akunmu.',
          actions: [link('#/workspace/new', 'btn btn-primary', icon('plus'), 'Prompt baru')]
        })
      );
      return;
    }

    if (!isNew && !saved) {
      editorEl.append(
        emptyState({
          title: 'Prompt tidak ditemukan',
          message: 'Prompt ini mungkin sudah dihapus, atau dibuat di browser lain.',
          actions: [link('#/workspace', 'btn btn-quiet', 'Kembali ke daftar')]
        })
      );
      return;
    }

    const titleInput = h('input', { id: 'ws-title', class: 'input', maxlength: LIMITS.title, autocomplete: 'off', placeholder: 'Mis. Email tindak lanjut klien' });
    const tagsInput = h('input', { id: 'ws-tags', class: 'input', autocomplete: 'off', placeholder: 'email, kerja', 'aria-describedby': 'ws-tags-hint' });
    const contentInput = h('textarea', {
      id: 'ws-content',
      class: 'textarea',
      maxlength: LIMITS.content,
      spellcheck: 'false',
      placeholder: 'Tulis prompt di sini. Tandai bagian yang harus diisi nanti dengan [SLOT SEPERTI INI].',
      'aria-describedby': 'ws-meta'
    });
    titleInput.value = baseline.title;
    tagsInput.value = baseline.tags;
    contentInput.value = baseline.content;

    const wordCount = h('li');
    const charCount = h('li');
    const slotCount = h('li');
    const metaEl = h('ul', { class: 'ws-meta', id: 'ws-meta' }, wordCount, charCount, slotCount);
    const stateEl = h('div', { class: 'ws-state' });
    const errorEl = h('p', { class: 'form-error', role: 'alert' });
    errorEl.hidden = true;

    const favoriteButton = h(
      'button',
      {
        type: 'button',
        class: 'btn btn-quiet',
        'aria-pressed': saved && saved.favorite ? 'true' : 'false',
        onClick: toggleFavorite
      },
      icon('star'),
      'Favorit'
    );
    const saveButton = h('button', { type: 'submit', class: 'btn btn-primary' }, icon('save'), 'Simpan');

    function readForm() {
      return { title: titleInput.value.trim(), tags: normalizeTags(tagsInput.value), content: contentInput.value };
    }

    function refreshMeta() {
      const { words, characters } = countText(contentInput.value);
      const slots = countSlots(contentInput.value);
      wordCount.textContent = `${words.toLocaleString('id-ID')} kata`;
      charCount.textContent = `${characters.toLocaleString('id-ID')} dari ${LIMITS.content.toLocaleString('id-ID')} karakter`;
      slotCount.textContent = slots > 0 ? `${slots} slot belum diisi` : 'Tidak ada slot';
      slotCount.className = slots > 0 ? 'has-slots' : '';
    }

    function refreshState() {
      const form = readForm();
      dirty = form.title !== baseline.title.trim() || form.tags !== normalizeTags(baseline.tags) || form.content !== baseline.content;
      clear(stateEl);
      if (dirty) {
        stateEl.append(h('span', { class: 'badge badge-warn', text: 'Belum disimpan' }));
      } else if (saved) {
        stateEl.append(h('span', { class: 'badge', text: 'Tersimpan' }), h('span', { text: `Diubah ${formatDate(saved.updatedAt)}` }));
      } else {
        stateEl.append(h('span', { class: 'hint', text: 'Prompt baru. Belum ada yang disimpan.' }));
      }
    }

    function onEdit() {
      errorEl.hidden = true;
      refreshMeta();
      refreshState();
    }

    function showError(message) {
      errorEl.textContent = message;
      errorEl.hidden = false;
    }

    function currentPromptData() {
      const form = readForm();
      const base = saved || {};
      return {
        id: base.id || null,
        title: form.title || base.title || 'Prompt tanpa judul',
        content: form.content,
        tags: form.tags ? form.tags.split(', ') : [],
        favorite: Boolean(base.favorite),
        createdAt: base.createdAt || null,
        updatedAt: base.updatedAt || null
      };
    }

    function save() {
      const form = readForm();
      if (!form.content.trim()) {
        showError('Isi prompt tidak boleh kosong.');
        contentInput.focus();
        return;
      }

      const result = isNew
        ? prompts.create({ title: form.title, tags: form.tags, content: form.content, source: 'manual' })
        : prompts.update(saved.id, { title: form.title, tags: form.tags, content: form.content });

      if (!result.ok) {
        showError(failureMessage(result.reason));
        return;
      }

      saved = result.prompt;
      baseline = { title: saved.title, tags: tagsToText(saved.tags), content: saved.content };
      titleInput.value = saved.title;
      tagsInput.value = baseline.tags;
      contentInput.value = saved.content;
      dirty = false;
      history.add({ type: 'workspace', title: saved.title, content: saved.content, promptId: saved.id });
      toast('Prompt disimpan.', 'success');

      if (isNew) {
        ctx.navigate(`/workspace/${saved.id}`);
        return;
      }
      refreshMeta();
      refreshState();
      renderList();
    }

    function toggleFavorite() {
      if (!saved) {
        toast('Simpan prompt dulu sebelum menandainya sebagai favorit.', 'info');
        return;
      }
      const result = prompts.toggleFavorite(saved.id);
      if (!result.ok) {
        toast(failureMessage(result.reason), 'error');
        return;
      }
      saved = { ...saved, favorite: result.prompt.favorite, updatedAt: result.prompt.updatedAt };
      favoriteButton.setAttribute('aria-pressed', String(saved.favorite));
      toast(saved.favorite ? 'Ditambahkan ke favorit.' : 'Dihapus dari favorit.', 'success');
      refreshState();
      renderList();
    }

    function exportText() {
      const form = readForm();
      if (!form.content.trim()) {
        toast('Tidak ada isi untuk diekspor.', 'info');
        return;
      }
      downloadFile(`${safeFilename(form.title || (saved && saved.title))}.txt`, `${form.content.replace(/\s+$/, '')}\n`, 'text/plain');
      toast('File TXT diunduh.', 'success');
    }

    function exportJson() {
      const data = currentPromptData();
      if (!data.content.trim()) {
        toast('Tidak ada isi untuk diekspor.', 'info');
        return;
      }
      downloadFile(`${safeFilename(data.title)}.json`, JSON.stringify(exportPrompts([data]), null, 2), 'application/json');
      toast('File JSON diunduh.', 'success');
    }

    function duplicate() {
      if (!saved) return;
      const result = prompts.duplicate(saved.id);
      if (!result.ok) {
        toast(failureMessage(result.reason), 'error');
        return;
      }
      toast('Salinan dibuat.', 'success');
      ctx.navigate(`/workspace/${result.prompt.id}`);
    }

    async function remove() {
      if (!saved) return;
      const confirmed = await confirmDialog({
        title: 'Hapus prompt ini?',
        message: `"${saved.title}" akan dihapus permanen dari akunmu.`,
        confirmLabel: 'Hapus prompt',
        danger: true
      });
      if (!confirmed) return;
      const result = prompts.remove(saved.id);
      if (!result.ok) {
        toast(failureMessage(result.reason), 'error');
        return;
      }
      dirty = false;
      toast('Prompt dihapus.', 'success');
      ctx.navigate('/workspace');
    }

    const form = h(
      'form',
      {
        class: 'block',
        novalidate: true,
        onSubmit: (event) => {
          event.preventDefault();
          save();
        },
        onKeydown: (event) => {
          if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
            event.preventDefault();
            save();
          }
        }
      },
      h(
        'div',
        { class: 'ws-two' },
        h('div', { class: 'field' }, h('label', { for: 'ws-title', text: 'Judul' }), titleInput),
        h(
          'div',
          { class: 'field' },
          h('label', { for: 'ws-tags', text: 'Tag' }),
          tagsInput,
          h('p', { class: 'hint', id: 'ws-tags-hint', text: `Pisahkan dengan koma. Maksimal ${LIMITS.tags} tag.` })
        )
      ),
      h('div', { class: 'field' }, h('label', { for: 'ws-content', text: 'Isi prompt' }), contentInput, metaEl),
      errorEl,
      stateEl,
      h(
        'div',
        { class: 'ws-actions' },
        saveButton,
        favoriteButton,
        h('button', { type: 'button', class: 'btn btn-quiet', onClick: () => copyText(contentInput.value, 'Prompt disalin.') }, icon('copy'), 'Salin'),
        h('button', { type: 'button', class: 'btn btn-quiet', onClick: exportText }, icon('download'), 'TXT'),
        h('button', { type: 'button', class: 'btn btn-quiet', onClick: exportJson }, icon('download'), 'JSON'),
        h('span', { class: 'spacer' }),
        saved ? h('button', { type: 'button', class: 'btn btn-quiet', onClick: duplicate }, icon('layers'), 'Duplikat') : null,
        saved ? h('button', { type: 'button', class: 'btn btn-danger-quiet', onClick: remove }, icon('trash'), 'Hapus') : null
      )
    );

    [titleInput, tagsInput, contentInput].forEach((input) => input.addEventListener('input', onEdit));
    editorEl.append(form);
    refreshMeta();
    refreshState();
  }

  const beforeUnload = (event) => {
    if (dirty) {
      event.preventDefault();
      event.returnValue = '';
    }
  };

  ctx.setLeaveGuard(async () => {
    if (!dirty) return true;
    return confirmDialog({
      title: 'Buang perubahan?',
      message: 'Ada perubahan di editor yang belum disimpan. Kalau kamu pindah sekarang, perubahan itu hilang.',
      confirmLabel: 'Buang perubahan',
      cancelLabel: 'Tetap di sini',
      danger: true
    });
  });
  window.addEventListener('beforeunload', beforeUnload);
  const stopChanges = onChange(renderList);

  container.append(
    pageHead('Workspace', 'Edit, atur, dan ekspor prompt yang kamu simpan di akunmu.'),
    h(
      'div',
      { class: 'workspace' },
      h(
        'aside',
        { class: 'ws-list', 'aria-label': 'Daftar prompt' },
        h(
          'div',
          { class: 'ws-list-tools' },
          link('#/workspace/new', 'btn btn-primary', icon('plus'), 'Prompt baru'),
          searchInput,
          h('div', { class: 'toolbar' }, favoriteFilter, exportAllButton),
          listCount
        ),
        listEl
      ),
      editorEl
    )
  );

  renderList();
  buildEditor();

  return () => {
    window.removeEventListener('beforeunload', beforeUnload);
    stopChanges();
  };
}
