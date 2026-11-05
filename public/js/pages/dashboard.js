import { h, icon, snippet, formatDate, copyText, emptyState, pageHead, link, clear } from '../ui.js';
import { prompts, history, stats } from '../storage.js';
import { AI_FEATURES, USAGE_LABELS } from '../features.js';

function statItem(label, value) {
  return h('div', { class: 'stat' }, h('dt', { text: label }), h('dd', { text: String(value) }));
}

function renderStatus(target, health) {
  clear(target);
  target.hidden = false;

  if (!health || health.status === 'loading') {
    target.className = 'status-panel';
    target.append(h('p', { class: 'status-title', text: 'Memeriksa server…' }));
    return;
  }

  if (health.status === 'offline') {
    target.className = 'status-panel is-bad';
    target.append(
      h('p', { class: 'status-title', text: 'Server tidak terjangkau' }),
      h('p', {
        text: 'Prompt di Workspace tetap bisa dibuka dan diedit. Fitur AI baru bisa dipakai setelah server berjalan lagi.'
      }),
      h('p', {}, 'Jalankan ', h('code', { text: 'npm run dev' }), ' di folder proyek, lalu muat ulang halaman ini.')
    );
    return;
  }

  if (!health.ai || !health.ai.configured) {
    target.className = 'status-panel is-warn';
    target.append(
      h('p', { class: 'status-title', text: 'API key Gemini belum diatur' }),
      h('p', { text: 'Workspace, Library, Favorit, dan Riwayat tetap bisa dipakai. Untuk mengaktifkan alat AI:' }),
      h(
        'ol',
        {},
        h('li', {}, 'Buat API key di Google AI Studio.'),
        h('li', {}, 'Salin ', h('code', { text: '.env.example' }), ' menjadi ', h('code', { text: '.env' }), '.'),
        h('li', {}, 'Isi ', h('code', { text: 'GEMINI_API_KEY' }), ', lalu restart server.')
      )
    );
    return;
  }

  target.className = 'status-panel';
  target.hidden = true;
}

function recentRow(item, onCopy) {
  return h(
    'li',
    { class: 'row' },
    h(
      'div',
      { class: 'row-main' },
      link(`#/workspace/${item.id}`, 'row-title', item.title),
      h('p', { class: 'row-text', text: snippet(item.content, 140) }),
      h('div', { class: 'row-meta' }, h('span', { text: formatDate(item.updatedAt) }))
    ),
    h(
      'div',
      { class: 'row-actions' },
      h(
        'button',
        { type: 'button', class: 'icon-btn', 'aria-label': `Salin ${item.title}`, title: 'Salin', onClick: () => onCopy(item) },
        icon('copy')
      )
    )
  );
}

function toolRow(feature, ready) {
  return h(
    'li',
    {},
    h(
      'a',
      { href: `#/${feature.path}`, class: 'row tool-row' },
      h('span', { class: 'row-lead' }, icon(feature.icon)),
      h('span', { class: 'row-main' }, h('span', { class: 'row-title', text: feature.label }), h('span', { class: 'row-text', text: feature.summary })),
      ready ? null : h('span', { class: 'badge badge-warn', text: 'Segera' })
    )
  );
}

export function renderDashboard(container, ctx) {
  const savedPrompts = prompts.list();
  const favoriteCount = savedPrompts.filter((item) => item.favorite).length;
  const uses = stats.uses();
  const usageEntries = Object.entries(uses)
    .filter(([key]) => USAGE_LABELS[key])
    .sort((a, b) => b[1] - a[1]);
  const maxUse = usageEntries.length > 0 ? usageEntries[0][1] : 1;

  const statusPanel = h('div', { class: 'status-panel', 'aria-live': 'polite' });
  renderStatus(statusPanel, ctx.health);
  const stopHealth = ctx.onHealth((health) => renderStatus(statusPanel, health));

  const recentList =
    savedPrompts.length === 0
      ? emptyState({
          level: 'h3',
          title: 'Belum ada prompt tersimpan',
          message: 'Mulai dari prompt kosong, atau pakai template dari Library lalu sesuaikan slot-nya.',
          actions: [
            link('#/workspace/new', 'btn btn-primary', icon('plus'), 'Buat prompt'),
            link('#/library', 'btn btn-quiet', icon('book'), 'Buka Library')
          ]
        })
      : h(
          'ul',
          { class: 'rows' },
          savedPrompts.slice(0, 5).map((item) => recentRow(item, (selected) => copyText(selected.content, 'Prompt disalin.')))
        );

  const usageBlock =
    usageEntries.length === 0
      ? h('p', { class: 'section-note', text: 'Belum ada penggunaan. Angka muncul di sini setelah kamu memakai template atau alat AI.' })
      : h(
          'div',
          { class: 'bars' },
          usageEntries.map(([key, value]) => {
            const fill = h('span');
            fill.style.setProperty('--w', `${Math.max(6, Math.round((value / maxUse) * 100))}%`);
            return h(
              'div',
              { class: 'bar-line' },
              h('span', { text: USAGE_LABELS[key] }),
              h('div', { class: 'bar', role: 'img', 'aria-label': `${USAGE_LABELS[key]}: ${value} kali` }, fill),
              h('span', { class: 'bar-value', text: String(value) })
            );
          })
        );

  container.append(
    pageHead('Dashboard', 'Ringkasan prompt yang kamu simpan dan alat yang sering dipakai.'),
    h(
      'dl',
      { class: 'stats' },
      statItem('Prompt tersimpan', savedPrompts.length),
      statItem('Favorit', favoriteCount),
      statItem('Riwayat', history.list().length),
      statItem('Penggunaan alat', stats.total())
    ),
    statusPanel,
    h(
      'div',
      { class: 'split' },
      h(
        'section',
        { class: 'block', 'aria-labelledby': 'dash-recent' },
        h('div', {}, h('h2', { class: 'section-title', id: 'dash-recent', text: 'Prompt terbaru' })),
        recentList
      ),
      h(
        'section',
        { class: 'block', 'aria-labelledby': 'dash-tools' },
        h(
          'div',
          {},
          h('h2', { class: 'section-title', id: 'dash-tools', text: 'Alat AI' })
        ),
        h('ul', { class: 'rows' }, AI_FEATURES.map((feature) => toolRow(feature, ctx.isReady(feature.path))))
      )
    ),
    h(
      'section',
      { class: 'block', 'aria-labelledby': 'dash-usage' },
      h('h2', { class: 'section-title', id: 'dash-usage', text: 'Penggunaan per fitur' }),
      usageBlock
    )
  );

  return () => stopHealth();
}
