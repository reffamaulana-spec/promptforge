import { h, icon, clear, toast, copyText, downloadFile, safeFilename, renderWithSlots, countSlots, pageHead } from './ui.js';
import { prompts, history, stats, failureMessage } from './storage.js';
import { ApiError } from './api.js';

let counter = 0;

export function uid(prefix) {
  counter += 1;
  return `${prefix}-${counter}`;
}

export function textareaControl({ rows = 6, maxLength, placeholder = '', value = '', required = false }) {
  const id = uid('ta');
  const element = h('textarea', {
    id,
    class: 'textarea textarea-sm',
    rows: String(rows),
    maxlength: maxLength ? String(maxLength) : null,
    placeholder,
    required: required || null,
    spellcheck: 'false'
  });
  element.value = value;
  return element;
}

export function selectControl(options, value) {
  const element = h(
    'select',
    { id: uid('sel'), class: 'select' },
    options.map((option) => h('option', { value: option.value, text: option.label }))
  );
  if (value !== undefined) element.value = value;
  return element;
}

export function field(label, control, hint) {
  const hintId = hint ? `${control.id}-hint` : null;
  if (hintId) control.setAttribute('aria-describedby', hintId);
  return h(
    'div',
    { class: 'field' },
    h('label', { for: control.id, text: label }),
    control,
    hint ? h('p', { class: 'hint', id: hintId, text: hint }) : null
  );
}

export function counterFor(control, max) {
  const output = h('p', { class: 'hint field-count', 'aria-hidden': 'true' });
  const update = () => {
    output.textContent = `${control.value.length.toLocaleString('id-ID')} dari ${max.toLocaleString('id-ID')} karakter`;
  };
  control.addEventListener('input', update);
  update();
  return output;
}

export function describeError(error) {
  if (error instanceof ApiError) return error.message;
  return 'Terjadi kesalahan yang tidak terduga. Coba lagi.';
}

export function blockedReason(health) {
  if (!health || health.status === 'loading') return null;
  if (health.status === 'offline') return 'Server tidak terjangkau. Jalankan "npm run dev" lalu muat ulang halaman.';
  if (!health.ai || !health.ai.configured) return 'API key belum diatur di file .env, jadi alat AI belum bisa dipakai.';
  return null;
}

export function loadingBlock(text) {
  return h('div', { class: 'state state-loading', role: 'status' }, h('span', { class: 'spinner', 'aria-hidden': 'true' }), h('p', { text }));
}

export function idleBlock(title, text) {
  return h('div', { class: 'state state-idle' }, h('p', { class: 'state-title', text: title }), h('p', { text }));
}

export function errorBlock(message, onRetry) {
  return h(
    'div',
    { class: 'state state-error', role: 'alert' },
    icon('alert'),
    h('div', { class: 'state-body' }, h('p', { class: 'state-title', text: 'Gagal memproses' }), h('p', { text: message })),
    onRetry ? h('button', { type: 'button', class: 'btn btn-quiet btn-compact', onClick: onRetry }, 'Coba lagi') : null
  );
}

export function createTask({ ctx, button, output, idle, idleLabel, busyLabel, perform, render }) {
  let busy = false;
  let disposed = false;
  let blockedNote = null;

  const status = h('p', { class: 'hint run-note', 'aria-live': 'polite' });
  button.after(status);

  function applyAvailability() {
    const reason = blockedReason(ctx.health);
    blockedNote = reason;
    button.disabled = busy || Boolean(reason);
    status.textContent = reason || '';
  }

  const stop = ctx.onHealth(applyAvailability);

  function showIdle() {
    clear(output);
    output.append(idleBlock(idle.title, idle.text));
  }

  async function run() {
    if (busy || blockedNote) return;
    const attempt = perform.prepare ? perform.prepare() : { ok: true };
    if (!attempt.ok) {
      toast(attempt.message, 'error');
      if (attempt.focus) attempt.focus.focus();
      return;
    }

    busy = true;
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    button.querySelector('.btn-label').textContent = busyLabel;
    clear(output);
    output.append(loadingBlock(perform.loadingText || 'AI sedang bekerja. Biasanya butuh beberapa detik.'));

    try {
      const payload = await perform.request(attempt);
      if (disposed) return;
      clear(output);
      render(payload, attempt);
      const target = output.querySelector('.result');
      if (target) {
        target.setAttribute('tabindex', '-1');
        target.focus();
      }
    } catch (error) {
      if (disposed) return;
      clear(output);
      output.append(errorBlock(describeError(error), run));
    } finally {
      busy = false;
      if (!disposed) {
        button.removeAttribute('aria-busy');
        button.querySelector('.btn-label').textContent = idleLabel;
        applyAvailability();
      }
    }
  }

  applyAvailability();
  showIdle();

  return {
    run,
    showIdle,
    dispose() {
      disposed = true;
      stop();
    }
  };
}

export function runButton(label) {
  return h('button', { type: 'submit', class: 'btn btn-primary' }, icon('wand'), h('span', { class: 'btn-label', text: label }));
}

export function recordUse(featureId, title, content) {
  stats.record(featureId);
  history.add({ type: featureId, title, content });
}

export function sendToWorkspace(ctx, { title, content, featureId }) {
  const result = prompts.create({ title, content, source: featureId });
  if (!result.ok) {
    toast(failureMessage(result.reason), 'error');
    return;
  }
  toast('Prompt dikirim ke Workspace.', 'success');
  ctx.navigate(`/workspace/${result.prompt.id}`);
}

export function saveOnly({ title, content, featureId }) {
  const result = prompts.create({ title, content, source: featureId });
  toast(result.ok ? 'Disimpan ke Workspace.' : failureMessage(result.reason), result.ok ? 'success' : 'error');
}

export function resultActions({ ctx, getText, title, featureId }) {
  return h(
    'div',
    { class: 'result-actions' },
    h('button', { type: 'button', class: 'btn btn-quiet btn-compact', onClick: () => copyText(getText(), 'Hasil disalin.') }, icon('copy'), 'Salin'),
    h(
      'button',
      { type: 'button', class: 'btn btn-quiet btn-compact', onClick: () => downloadFile(`${safeFilename(title, featureId)}.txt`, getText(), 'text/plain') },
      icon('download'),
      'TXT'
    ),
    h(
      'button',
      { type: 'button', class: 'btn btn-quiet btn-compact', onClick: () => saveOnly({ title, content: getText(), featureId }) },
      icon('save'),
      'Simpan'
    ),
    h(
      'button',
      { type: 'button', class: 'btn btn-primary btn-compact', onClick: () => sendToWorkspace(ctx, { title, content: getText(), featureId }) },
      icon('edit'),
      'Kirim ke Workspace'
    )
  );
}

export function promptResult({ ctx, text, title, featureId, heading = 'Hasil' }) {
  const slots = countSlots(text);
  return h(
    'section',
    { class: 'block result', 'aria-label': heading },
    h('div', { class: 'result-head' }, h('h2', { class: 'section-title', text: heading }), slots > 0 ? h('span', { class: 'badge badge-violet', text: `${slots} slot` }) : null),
    h('pre', { class: 'prompt-view', tabindex: '0' }, renderWithSlots(text)),
    resultActions({ ctx, getText: () => text, title, featureId })
  );
}

export function aiLayout(title, description, form, output) {
  return [pageHead(title, description), h('div', { class: 'ai-layout' }, h('div', { class: 'ai-form' }, form), h('div', { class: 'ai-output' }, output))];
}

export function titleFrom(text, prefix) {
  const line = String(text).replace(/\s+/g, ' ').trim().slice(0, 60);
  return prefix ? `${prefix}: ${line}` : line;
}
