import { h, icon, clear, toast, copyText, countSlots, renderWithSlots } from './ui.js';
import { postJson } from './api.js';
import {
  field,
  textareaControl,
  selectControl,
  counterFor,
  createTask,
  runButton,
  recordUse,
  promptResult,
  resultActions,
  aiLayout,
  titleFrom,
  describeError,
  blockedReason,
  sendToWorkspace
} from './ai-common.js';

const LANGUAGE_OPTIONS = [
  { value: 'auto', label: 'Ikuti bahasa input' },
  { value: 'id', label: 'Bahasa Indonesia' },
  { value: 'en', label: 'English' }
];

const DIMENSION_LABELS = {
  clarity: 'Kejelasan',
  context: 'Konteks',
  specificity: 'Kespesifikan',
  structure: 'Struktur',
  constraints: 'Batasan'
};

const CHANGE_LABELS = {
  clarity: 'Kejelasan',
  specificity: 'Kespesifikan',
  context: 'Konteks',
  structure: 'Struktur',
  constraints: 'Batasan',
  other: 'Lainnya'
};

const PRIORITY_LABELS = { high: 'Prioritas tinggi', medium: 'Prioritas sedang', low: 'Prioritas rendah' };

function mount(container, ctx, config) {
  const button = runButton(config.idleLabel);
  const output = h('div', { class: 'output-stack' });

  const task = createTask({
    ctx,
    button,
    output,
    idle: config.idle,
    idleLabel: config.idleLabel,
    busyLabel: config.busyLabel,
    perform: config.perform,
    render: (payload, attempt) => config.render(payload, attempt)
  });

  const form = h(
    'form',
    {
      class: 'ai-form-body',
      novalidate: true,
      onSubmit: (event) => {
        event.preventDefault();
        task.run();
      }
    },
    config.fields,
    h('div', { class: 'form-actions' }, button)
  );

  form.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey) && event.target.tagName === 'TEXTAREA') {
      event.preventDefault();
      form.requestSubmit();
    }
  });

  container.append(...aiLayout(config.title, config.description, form, output));
  return () => task.dispose();
}

function requireText(control, label, min = 1) {
  const value = control.value.trim();
  if (value.length < min) {
    return { ok: false, message: min > 1 ? `${label} minimal ${min} karakter.` : `${label} wajib diisi.`, focus: control };
  }
  return { ok: true, value };
}

function renderGenerator(container, ctx) {
  const idea = textareaControl({ rows: 5, maxLength: 2000, placeholder: 'Mis. caption Instagram untuk event lari pagi komunitas' });
  const extra = textareaControl({ rows: 3, maxLength: 2000, placeholder: 'Opsional: audiens, gaya bahasa, batasan, contoh' });
  const target = selectControl(
    [
      { value: 'general', label: 'AI umum' },
      { value: 'chatgpt', label: 'ChatGPT' },
      { value: 'claude', label: 'Claude' },
      { value: 'gemini', label: 'Gemini' },
      { value: 'coding', label: 'Asisten coding' },
      { value: 'image', label: 'Generator gambar' }
    ],
    'general'
  );
  const tone = selectControl(
    [
      { value: 'professional', label: 'Profesional' },
      { value: 'friendly', label: 'Ramah' },
      { value: 'concise', label: 'Singkat dan langsung' },
      { value: 'creative', label: 'Kreatif' }
    ],
    'professional'
  );
  const language = selectControl(LANGUAGE_OPTIONS, 'auto');

  return mount(container, ctx, {
    title: 'Prompt Generator',
    description: 'Ubah ide singkat menjadi prompt terstruktur: Peran, Konteks, Tugas, Batasan, dan Format Keluaran.',
    fields: [
      field('Ide kamu', idea, 'Tulis seadanya. Detail yang belum kamu sebut akan ditandai sebagai slot.'),
      counterFor(idea, 2000),
      field('Konteks tambahan', extra),
      h('div', { class: 'field-row' }, field('AI tujuan', target), field('Nada', tone)),
      field('Bahasa prompt', language)
    ],
    idle: { title: 'Belum ada hasil', text: 'Isi ide di kiri lalu tekan Buat prompt. Pintasan: Ctrl+Enter.' },
    idleLabel: 'Buat prompt',
    busyLabel: 'Membuat…',
    perform: {
      prepare() {
        const checked = requireText(idea, 'Ide', 3);
        if (!checked.ok) return checked;
        return {
          ok: true,
          body: { idea: checked.value, extra: extra.value.trim(), target: target.value, tone: tone.value, language: language.value }
        };
      },
      request: (attempt) => postJson('/api/ai/generate', attempt.body)
    },
    render(payload, attempt) {
      const title = titleFrom(attempt.body.idea);
      recordUse('generator', title, payload.result.prompt);
      container.querySelector('.output-stack').append(promptResult({ ctx, text: payload.result.prompt, title, featureId: 'generator', heading: 'Prompt hasil' }));
    }
  });
}

function renderOptimizer(container, ctx) {
  const prompt = textareaControl({ rows: 9, maxLength: 8000, placeholder: 'Tempel prompt yang ingin diperbaiki' });
  const goal = textareaControl({ rows: 2, maxLength: 500, placeholder: 'Opsional: mis. lebih singkat, lebih tegas soal format, cocok untuk pemula' });
  const language = selectControl(LANGUAGE_OPTIONS, 'auto');

  return mount(container, ctx, {
    title: 'Optimizer',
    description: 'Perbaiki prompt yang sudah ada tanpa mengubah maksudnya. Kamu bisa membandingkan versi asli dan hasilnya.',
    fields: [
      field('Prompt asli', prompt),
      counterFor(prompt, 8000),
      field('Fokus perbaikan', goal),
      field('Bahasa hasil', language)
    ],
    idle: { title: 'Belum ada hasil', text: 'Tempel prompt lalu tekan Optimalkan. Pintasan: Ctrl+Enter.' },
    idleLabel: 'Optimalkan',
    busyLabel: 'Mengoptimalkan…',
    perform: {
      prepare() {
        const checked = requireText(prompt, 'Prompt', 5);
        if (!checked.ok) return checked;
        return { ok: true, body: { prompt: checked.value, goal: goal.value.trim(), language: language.value } };
      },
      request: (attempt) => postJson('/api/ai/optimize', attempt.body)
    },
    render(payload) {
      const { original, optimized, changes, preservedIntent } = payload.result;
      const title = titleFrom(optimized, 'Optimasi');
      recordUse('optimizer', title, optimized);
      container.querySelector('.output-stack').append(
        h(
          'section',
          { class: 'block result', 'aria-label': 'Hasil optimasi' },
          h('h2', { class: 'section-title', text: 'Sebelum dan sesudah' }),
          h(
            'div',
            { class: 'compare' },
            h('div', { class: 'compare-col' }, h('h3', { class: 'compare-title', text: 'Asli' }), h('pre', { class: 'prompt-view', tabindex: '0' }, renderWithSlots(original))),
            h('div', { class: 'compare-col' }, h('h3', { class: 'compare-title is-new', text: 'Optimal' }), h('pre', { class: 'prompt-view', tabindex: '0' }, renderWithSlots(optimized)))
          ),
          resultActions({ ctx, getText: () => optimized, title, featureId: 'optimizer' }),
          preservedIntent ? h('p', { class: 'section-note' }, h('strong', { text: 'Maksud yang dijaga: ' }), preservedIntent) : null,
          changes.length > 0
            ? h(
                'div',
                { class: 'block' },
                h('h3', { class: 'section-title', text: 'Perubahan yang dilakukan' }),
                h(
                  'ul',
                  { class: 'change-list' },
                  changes.map((change) =>
                    h('li', {}, h('span', { class: 'badge badge-violet', text: CHANGE_LABELS[change.category] || 'Lainnya' }), h('span', { text: change.description }))
                  )
                )
              )
            : null,
          h('p', { class: 'hint', text: 'Periksa hasilnya sebelum dipakai. AI kadang menambahkan detail yang tidak kamu maksudkan.' })
        )
      );
    }
  });
}

function scoreTone(score) {
  if (score >= 7.5) return 'is-good';
  if (score >= 5) return 'is-mid';
  return 'is-low';
}

function renderAnalyzer(container, ctx) {
  const prompt = textareaControl({ rows: 9, maxLength: 8000, placeholder: 'Tempel prompt yang ingin dinilai' });
  const language = selectControl(
    [
      { value: 'id', label: 'Bahasa Indonesia' },
      { value: 'en', label: 'English' }
    ],
    'id'
  );

  return mount(container, ctx, {
    title: 'Analyzer',
    description: 'Nilai prompt di lima aspek, lengkap dengan alasan dan saran perbaikan.',
    fields: [field('Prompt', prompt), counterFor(prompt, 8000), field('Bahasa penjelasan', language)],
    idle: { title: 'Belum ada hasil', text: 'Tempel prompt lalu tekan Analisis. Pintasan: Ctrl+Enter.' },
    idleLabel: 'Analisis',
    busyLabel: 'Menganalisis…',
    perform: {
      prepare() {
        const checked = requireText(prompt, 'Prompt', 5);
        if (!checked.ok) return checked;
        return { ok: true, body: { prompt: checked.value, language: language.value } };
      },
      request: (attempt) => postJson('/api/ai/analyze', attempt.body)
    },
    render(payload, attempt) {
      const { scores, overall, strengths, suggestions, disclaimer } = payload.result;
      const summary = `Skor ${overall.toFixed(1)}/10. ${suggestions.map((item) => item.text).join(' ')}`.trim();
      recordUse('analyzer', titleFrom(attempt.body.prompt, 'Analisis'), summary);

      container.querySelector('.output-stack').append(
        h(
          'section',
          { class: 'block result', 'aria-label': 'Hasil analisis' },
          h(
            'div',
            { class: 'overall' },
            h('span', { class: `overall-score ${scoreTone(overall)}`, text: overall.toFixed(1) }),
            h('div', {}, h('h2', { class: 'section-title', text: 'Skor keseluruhan' }), h('p', { class: 'section-note', text: 'Dari 10, rata-rata lima aspek.' }))
          ),
          h(
            'ul',
            { class: 'score-list' },
            Object.keys(DIMENSION_LABELS).map((key) => {
              const entry = scores[key];
              const fill = h('span', { class: scoreTone(entry.score) });
              fill.style.setProperty('--w', `${Math.round(entry.score * 10)}%`);
              return h(
                'li',
                { class: 'score-item' },
                h(
                  'div',
                  { class: 'score-line' },
                  h('span', { class: 'score-name', text: DIMENSION_LABELS[key] }),
                  h('div', { class: 'bar', role: 'img', 'aria-label': `${DIMENSION_LABELS[key]}: ${entry.score} dari 10` }, fill),
                  h('span', { class: 'bar-value', text: entry.score.toFixed(1) })
                ),
                entry.explanation ? h('p', { class: 'score-why', text: entry.explanation }) : null
              );
            })
          ),
          strengths.length > 0
            ? h('div', { class: 'block' }, h('h3', { class: 'section-title', text: 'Sudah bagus' }), h('ul', { class: 'plain-list' }, strengths.map((text) => h('li', { text }))))
            : null,
          suggestions.length > 0
            ? h(
                'div',
                { class: 'block' },
                h('h3', { class: 'section-title', text: 'Saran perbaikan' }),
                h(
                  'ul',
                  { class: 'change-list' },
                  suggestions.map((item) =>
                    h('li', {}, h('span', { class: `badge ${item.priority === 'high' ? 'badge-warn' : 'badge-violet'}`, text: PRIORITY_LABELS[item.priority] }), h('span', { text: item.text }))
                  )
                )
              )
            : null,
          h('p', { class: 'disclaimer' }, icon('info'), h('span', { text: disclaimer }))
        )
      );
    }
  });
}

function renderExpander(container, ctx) {
  const idea = textareaControl({ rows: 4, maxLength: 2000, placeholder: 'Mis. buat rencana latihan lari 10K' });
  const depth = selectControl(
    [
      { value: 'comprehensive', label: 'Lengkap' },
      { value: 'moderate', label: 'Sedang' }
    ],
    'comprehensive'
  );
  const language = selectControl(LANGUAGE_OPTIONS, 'auto');

  return mount(container, ctx, {
    title: 'Expander',
    description: 'Kembangkan ide pendek menjadi instruksi yang lengkap. Bagian yang butuh datamu ditandai dengan slot.',
    fields: [field('Ide singkat', idea), counterFor(idea, 2000), h('div', { class: 'field-row' }, field('Kedalaman', depth), field('Bahasa', language))],
    idle: { title: 'Belum ada hasil', text: 'Tulis ide singkat lalu tekan Kembangkan. Pintasan: Ctrl+Enter.' },
    idleLabel: 'Kembangkan',
    busyLabel: 'Mengembangkan…',
    perform: {
      prepare() {
        const checked = requireText(idea, 'Ide', 3);
        if (!checked.ok) return checked;
        return { ok: true, body: { idea: checked.value, depth: depth.value, language: language.value } };
      },
      request: (attempt) => postJson('/api/ai/expand', attempt.body)
    },
    render(payload, attempt) {
      const title = titleFrom(attempt.body.idea, 'Ekspansi');
      recordUse('expander', title, payload.result.expanded);
      container.querySelector('.output-stack').append(promptResult({ ctx, text: payload.result.expanded, title, featureId: 'expander', heading: 'Prompt yang dikembangkan' }));
    }
  });
}

function renderTranslator(container, ctx) {
  const text = textareaControl({ rows: 9, maxLength: 8000, placeholder: 'Tempel prompt yang ingin diterjemahkan' });
  const direction = selectControl(
    [
      { value: 'id-en', label: 'Indonesia ke Inggris' },
      { value: 'en-id', label: 'Inggris ke Indonesia' }
    ],
    'id-en'
  );
  const swap = h(
    'button',
    {
      type: 'button',
      class: 'btn btn-quiet btn-compact',
      onClick: () => {
        direction.value = direction.value === 'id-en' ? 'en-id' : 'id-en';
      }
    },
    icon('languages'),
    'Balik arah'
  );

  return mount(container, ctx, {
    title: 'Translator',
    description: 'Terjemahkan prompt Indonesia dan Inggris. Struktur, kode, placeholder, dan istilah teknis tetap utuh.',
    fields: [field('Teks prompt', text), counterFor(text, 8000), h('div', { class: 'field-row field-row-end' }, field('Arah terjemahan', direction), swap)],
    idle: { title: 'Belum ada hasil', text: 'Tempel teks lalu tekan Terjemahkan. Pintasan: Ctrl+Enter.' },
    idleLabel: 'Terjemahkan',
    busyLabel: 'Menerjemahkan…',
    perform: {
      prepare() {
        const checked = requireText(text, 'Teks');
        if (!checked.ok) return checked;
        return { ok: true, body: { text: checked.value, direction: direction.value } };
      },
      request: (attempt) => postJson('/api/ai/translate', attempt.body)
    },
    render(payload, attempt) {
      const title = titleFrom(payload.result.translation, 'Terjemahan');
      recordUse('translator', title, payload.result.translation);
      container.querySelector('.output-stack').append(promptResult({ ctx, text: payload.result.translation, title, featureId: 'translator', heading: 'Terjemahan' }));
    }
  });
}

const MAX_TURNS = 20;

function renderAssistant(container, ctx) {
  const conversation = [];
  let busy = false;
  let disposed = false;
  let failed = false;

  const log = h('div', { class: 'chat-log', role: 'log', 'aria-live': 'polite', 'aria-label': 'Percakapan dengan asisten', tabindex: '0' });
  const input = textareaControl({ rows: 3, maxLength: 4000, placeholder: 'Ceritakan prompt apa yang kamu butuhkan' });
  input.classList.remove('textarea');
  input.classList.add('input', 'chat-input');
  input.setAttribute('aria-label', 'Pesan untuk asisten');
  const language = selectControl(LANGUAGE_OPTIONS, 'auto');
  language.setAttribute('aria-label', 'Bahasa balasan');
  const sendButton = h('button', { type: 'submit', class: 'btn btn-primary' }, icon('chat'), h('span', { class: 'btn-label', text: 'Kirim' }));
  const note = h('p', { class: 'hint run-note', 'aria-live': 'polite' });
  const resetButton = h(
    'button',
    {
      type: 'button',
      class: 'btn btn-quiet btn-compact',
      onClick: () => {
        if (busy) return;
        conversation.length = 0;
        failed = false;
        drawIntro();
        refresh();
        input.focus();
      }
    },
    'Percakapan baru'
  );

  function drawIntro() {
    clear(log);
    log.append(
      h(
        'div',
        { class: 'bubble bubble-assistant' },
        h('p', {
          text: 'Halo! Ceritakan prompt apa yang kamu butuhkan. Kalau masih kurang jelas, saya akan bertanya dulu. Kalau sudah cukup, saya tulis prompt-nya dan kamu bisa mengirimnya ke Workspace.'
        })
      )
    );
  }

  function bubble(role, text, prompt) {
    const node = h('div', { class: `bubble bubble-${role}` }, h('p', { class: 'bubble-text', text }));
    if (prompt) {
      const slots = countSlots(prompt);
      node.append(
        h(
          'div',
          { class: 'bubble-prompt' },
          h('div', { class: 'result-head' }, h('h2', { class: 'section-title', text: 'Prompt' }), slots > 0 ? h('span', { class: 'badge badge-violet', text: `${slots} slot` }) : null),
          h('pre', { class: 'prompt-view', tabindex: '0' }, renderWithSlots(prompt)),
          h(
            'div',
            { class: 'result-actions' },
            h('button', { type: 'button', class: 'btn btn-quiet btn-compact', onClick: () => copyText(prompt, 'Prompt disalin.') }, icon('copy'), 'Salin'),
            h(
              'button',
              {
                type: 'button',
                class: 'btn btn-primary btn-compact',
                onClick: () => sendToWorkspace(ctx, { title: titleFrom(prompt, 'Asisten'), content: prompt, featureId: 'assistant' })
              },
              icon('edit'),
              'Kirim ke Workspace'
            )
          )
        )
      );
    }
    log.append(node);
    log.scrollTop = log.scrollHeight;
    return node;
  }

  function refresh() {
    const reason = blockedReason(ctx.health);
    const full = conversation.length >= MAX_TURNS;
    sendButton.disabled = busy || Boolean(reason) || full;
    input.disabled = full;
    if (full) note.textContent = 'Percakapan sudah mencapai batas. Salin prompt yang kamu butuhkan lalu mulai percakapan baru.';
    else note.textContent = reason || '';
  }

  const stop = ctx.onHealth(refresh);

  async function send(retry = false) {
    if (busy) return;
    if (!retry) {
      const text = input.value.trim();
      if (!text) {
        toast('Tulis pesan dulu.', 'error');
        input.focus();
        return;
      }
      conversation.push({ role: 'user', content: text });
      bubble('user', text);
      input.value = '';
    }
    if (blockedReason(ctx.health) || conversation.length === 0) return;

    busy = true;
    failed = false;
    sendButton.setAttribute('aria-busy', 'true');
    sendButton.querySelector('.btn-label').textContent = 'Mengirim…';
    refresh();
    const typing = h('div', { class: 'bubble bubble-assistant', role: 'status' }, h('span', { class: 'spinner', 'aria-hidden': 'true' }), h('span', { class: 'bubble-text', text: 'Asisten sedang menulis…' }));
    log.append(typing);
    log.scrollTop = log.scrollHeight;

    try {
      const payload = await postJson('/api/ai/chat', { messages: conversation, language: language.value });
      if (disposed) return;
      typing.remove();
      const { reply, prompt } = payload.result;
      conversation.push({ role: 'assistant', content: prompt ? `${reply}\n\n${prompt}` : reply });
      bubble('assistant', reply, prompt);
      if (prompt) recordUse('assistant', titleFrom(prompt, 'Asisten'), prompt);
    } catch (error) {
      if (disposed) return;
      typing.remove();
      failed = true;
      const box = h(
        'div',
        { class: 'bubble bubble-error', role: 'alert' },
        h('p', { class: 'bubble-text', text: describeError(error) }),
        h('button', { type: 'button', class: 'btn btn-quiet btn-compact', onClick: () => { box.remove(); send(true); } }, 'Coba lagi')
      );
      log.append(box);
      log.scrollTop = log.scrollHeight;
    } finally {
      busy = false;
      if (!disposed) {
        sendButton.removeAttribute('aria-busy');
        sendButton.querySelector('.btn-label').textContent = 'Kirim';
        refresh();
        if (!failed) input.focus();
      }
    }
  }

  const form = h(
    'form',
    {
      class: 'chat-form',
      novalidate: true,
      onSubmit: (event) => {
        event.preventDefault();
        send();
      }
    },
    h('label', { class: 'visually-hidden', for: input.id, text: 'Pesan untuk asisten' }),
    input,
    h('div', { class: 'chat-controls' }, language, h('div', { class: 'chat-buttons' }, resetButton, sendButton)),
    note
  );

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      form.requestSubmit();
    }
  });

  drawIntro();
  refresh();

  container.append(
    h('header', { class: 'page-head' }, h('div', { class: 'page-head-text' }, h('h1', { tabindex: '-1', text: 'Assistant' }), h('p', { text: 'Susun prompt lewat percakapan. Enter untuk kirim, Shift+Enter untuk baris baru.' }))),
    h('div', { class: 'chat' }, log, form)
  );

  return () => {
    disposed = true;
    stop();
  };
}

export const views = {
  generator: renderGenerator,
  optimizer: renderOptimizer,
  analyzer: renderAnalyzer,
  expander: renderExpander,
  translator: renderTranslator,
  assistant: renderAssistant
};
