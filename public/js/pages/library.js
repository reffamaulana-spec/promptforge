import { h, icon, toast, copyText, openModal, renderWithSlots, countSlots, debounce, emptyState, pageHead, clear } from '../ui.js';
import { prompts, history, stats, failureMessage } from '../storage.js';
import { CATEGORIES, TEMPLATES } from '../library-data.js';

function matches(template, query, category) {
  if (category !== 'Semua' && template.category !== category) return false;
  if (!query) return true;
  const haystack = [template.title, template.description, template.category, template.tags.join(' '), template.content]
    .join(' ')
    .toLowerCase();
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => haystack.includes(word));
}

export function renderLibrary(container, ctx) {
  let query = '';
  let category = 'Semua';

  function useTemplate(template) {
    const created = prompts.create({
      title: template.title,
      content: template.content,
      tags: template.tags,
      source: 'library'
    });
    if (!created.ok) {
      toast(failureMessage(created.reason), 'error');
      return;
    }
    history.add({ type: 'library', title: template.title, content: template.content, promptId: created.prompt.id });
    stats.record('library');
    toast('Template ditambahkan ke Workspace.', 'success');
    ctx.navigate(`/workspace/${created.prompt.id}`);
  }

  function previewTemplate(template) {
    const slots = countSlots(template.content);
    const copyButton = h(
      'button',
      { type: 'button', class: 'btn btn-quiet', onClick: () => copyText(template.content, 'Template disalin.') },
      icon('copy'),
      'Salin'
    );
    const useButton = h(
      'button',
      {
        type: 'button',
        class: 'btn btn-primary',
        onClick: () => {
          modal.close('use');
          useTemplate(template);
        }
      },
      icon('edit'),
      'Gunakan di Workspace'
    );
    const modal = openModal({
      title: template.title,
      wide: true,
      content: h(
        'div',
        { class: 'block' },
        h('p', { class: 'section-note', text: slots > 0 ? `Bagian bertanda ungu adalah ${slots} slot yang perlu kamu isi.` : 'Template ini tidak punya slot.' }),
        h('pre', { class: 'prompt-view', tabindex: '0' }, renderWithSlots(template.content))
      ),
      actions: [copyButton, useButton]
    });
  }

  function templateCard(template) {
    const slots = countSlots(template.content);
    return h(
      'article',
      { class: 'tpl' },
      h('div', {}, h('span', { class: 'badge badge-violet', text: template.category })),
      h('h2', { text: template.title }),
      h('p', { class: 'tpl-desc', text: template.description }),
      h('ul', { class: 'tags' }, template.tags.map((tag) => h('li', { text: `#${tag}` }))),
      h(
        'div',
        { class: 'tpl-foot' },
        h('span', { class: 'tpl-slots', text: slots > 0 ? `${slots} slot` : 'Tanpa slot' }),
        h(
          'div',
          { class: 'tpl-actions' },
          h(
            'button',
            { type: 'button', class: 'btn btn-quiet btn-compact', 'aria-label': `Pratinjau ${template.title}`, onClick: () => previewTemplate(template) },
            icon('eye'),
            'Pratinjau'
          ),
          h(
            'button',
            { type: 'button', class: 'btn btn-primary btn-compact', 'aria-label': `Gunakan ${template.title}`, onClick: () => useTemplate(template) },
            'Gunakan'
          )
        )
      )
    );
  }

  const grid = h('div', { class: 'tpl-grid' });
  const count = h('p', { class: 'result-count', 'aria-live': 'polite' });

  function update() {
    const found = TEMPLATES.filter((template) => matches(template, query, category));
    count.textContent = found.length === 1 ? '1 template' : `${found.length} template`;
    clear(grid);
    if (found.length === 0) {
      grid.append(
        emptyState({
          title: 'Tidak ada template yang cocok',
          message: 'Coba kata kunci yang lebih umum, atau pilih kategori Semua.',
          actions: [
            h(
              'button',
              {
                type: 'button',
                class: 'btn btn-quiet',
                onClick: () => {
                  query = '';
                  category = 'Semua';
                  search.value = '';
                  renderChips();
                  update();
                }
              },
              'Reset pencarian'
            )
          ]
        })
      );
      return;
    }
    found.forEach((template) => grid.append(templateCard(template)));
  }

  const search = h('input', {
    type: 'search',
    id: 'library-search',
    class: 'input',
    placeholder: 'Cari template, tag, atau kata di dalam prompt',
    'aria-label': 'Cari template',
    autocomplete: 'off',
    onInput: debounce((event) => {
      query = event.target.value.trim();
      update();
    }, 150)
  });

  const chips = h('div', { class: 'chips', role: 'group', 'aria-label': 'Filter kategori' });

  function renderChips() {
    clear(chips);
    ['Semua', ...CATEGORIES].forEach((name) => {
      chips.append(
        h(
          'button',
          {
            type: 'button',
            class: 'chip',
            'aria-pressed': String(name === category),
            onClick: () => {
              category = name;
              renderChips();
              update();
            }
          },
          name
        )
      );
    });
  }

  renderChips();
  update();

  container.append(
    pageHead('Library', 'Template prompt siap pakai. Pilih satu, isi slot-nya, lalu simpan ke Workspace.'),
    h('div', { class: 'block' }, h('div', { class: 'toolbar' }, search), chips, count),
    grid
  );
}
