import { h, icon, clear, toast, copyText } from './ui.js';
import { postForm } from './api.js';
import { field, textareaControl, selectControl, counterFor, createTask, runButton, recordUse, resultActions, aiLayout, uid } from './ai-common.js';

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];
const DEFAULT_MAX_MB = 5;

const TARGET_OPTIONS = [
  { value: 'general', label: 'Model gambar umum' },
  { value: 'midjourney', label: 'Midjourney' },
  { value: 'stable-diffusion', label: 'Stable Diffusion' },
  { value: 'dalle', label: 'DALL-E' },
  { value: 'gemini', label: 'Pembuat gambar Gemini' }
];

const STYLE_OPTIONS = [
  { value: 'auto', label: 'Ikuti gambar' },
  { value: 'photorealistic', label: 'Fotorealistis' },
  { value: 'cinematic', label: 'Sinematik' },
  { value: 'anime', label: 'Anime' },
  { value: 'illustration', label: 'Ilustrasi' },
  { value: '3d-render', label: 'Render 3D' },
  { value: 'oil-painting', label: 'Lukisan cat minyak' },
  { value: 'watercolor', label: 'Cat air' },
  { value: 'minimalist', label: 'Minimalis' },
  { value: 'cyberpunk', label: 'Cyberpunk' }
];

const LIGHTING_OPTIONS = [
  { value: 'auto', label: 'Ikuti gambar' },
  { value: 'natural', label: 'Alami' },
  { value: 'golden-hour', label: 'Golden hour' },
  { value: 'studio', label: 'Studio' },
  { value: 'dramatic', label: 'Dramatis' },
  { value: 'neon', label: 'Neon' },
  { value: 'soft', label: 'Lembut' }
];

const CAMERA_OPTIONS = [
  { value: 'auto', label: 'Ikuti gambar' },
  { value: 'close-up', label: 'Close-up' },
  { value: 'wide', label: 'Sudut lebar' },
  { value: 'aerial', label: 'Dari udara' },
  { value: 'low-angle', label: 'Sudut rendah' },
  { value: 'eye-level', label: 'Setinggi mata' },
  { value: 'macro', label: 'Makro' }
];

const RATIO_OPTIONS = ['auto', '1:1', '16:9', '9:16', '4:3', '3:4', '21:9'].map((value) => ({ value, label: value === 'auto' ? 'Ikuti gambar' : value }));

const LANGUAGE_OPTIONS = [
  { value: 'en', label: 'English' },
  { value: 'id', label: 'Bahasa Indonesia' }
];

const OBSERVED_LABELS = [
  ['subject', 'Subjek'],
  ['objects', 'Objek'],
  ['scene', 'Latar dan adegan'],
  ['composition', 'Komposisi'],
  ['cameraAngle', 'Sudut kamera'],
  ['lighting', 'Pencahayaan'],
  ['colors', 'Warna'],
  ['atmosphere', 'Suasana'],
  ['textures', 'Tekstur'],
  ['visualStyle', 'Gaya visual']
];

const PREFERENCE_LABELS = [
  ['target', 'Target', TARGET_OPTIONS],
  ['visualStyle', 'Gaya visual', STYLE_OPTIONS],
  ['lighting', 'Pencahayaan', LIGHTING_OPTIONS],
  ['camera', 'Kamera', CAMERA_OPTIONS],
  ['aspectRatio', 'Rasio aspek', RATIO_OPTIONS],
  ['language', 'Bahasa prompt', LANGUAGE_OPTIONS]
];

const CONFIDENCE_LABELS = { medium: 'Cukup yakin', low: 'Kurang yakin' };

function formatSize(bytes) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function optionLabel(options, value) {
  const found = options.find((option) => option.value === value);
  return found ? found.label : value;
}

function renderImagePrompt(container, ctx) {
  let file = null;
  let previewUrl = null;

  const fileInput = h('input', { type: 'file', accept: ACCEPTED.join(','), hidden: true, tabindex: '-1' });
  const zoneError = h('p', { class: 'dropzone-error', role: 'alert' });
  const zoneId = uid('dz');
  const zone = h('div', { class: 'dropzone', id: zoneId });
  const target = selectControl(TARGET_OPTIONS, 'general');
  const style = selectControl(STYLE_OPTIONS, 'auto');
  const lighting = selectControl(LIGHTING_OPTIONS, 'auto');
  const camera = selectControl(CAMERA_OPTIONS, 'auto');
  const ratio = selectControl(RATIO_OPTIONS, 'auto');
  const language = selectControl(LANGUAGE_OPTIONS, 'en');
  const notes = textareaControl({ rows: 2, maxLength: 500, placeholder: 'Opsional: mis. ganti latar jadi malam hari' });

  function maxMb() {
    const limits = ctx.health && ctx.health.limits;
    return limits && limits.maxImageMb ? limits.maxImageMb : DEFAULT_MAX_MB;
  }

  function releasePreview() {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      previewUrl = null;
    }
  }

  function showError(message) {
    zoneError.textContent = message;
  }

  function drawZone() {
    clear(zone);
    zone.classList.toggle('has-file', Boolean(file));

    if (!file) {
      zone.append(
        icon('image', 'dropzone-icon'),
        h('p', { class: 'dropzone-title', text: 'Seret gambar ke sini' }),
        h('p', { class: 'hint', text: `JPG, PNG, atau WEBP. Maksimal ${maxMb()} MB.` }),
        h('button', { type: 'button', class: 'btn btn-quiet', onClick: () => fileInput.click() }, 'Pilih gambar')
      );
      return;
    }

    zone.append(
      h('img', { class: 'preview-img', src: previewUrl, alt: `Pratinjau gambar ${file.name}` }),
      h(
        'div',
        { class: 'preview-meta' },
        h('p', { class: 'preview-name', text: file.name }),
        h('p', { class: 'hint', text: formatSize(file.size) }),
        h(
          'div',
          { class: 'result-actions' },
          h('button', { type: 'button', class: 'btn btn-quiet btn-compact', onClick: () => fileInput.click() }, 'Ganti'),
          h(
            'button',
            {
              type: 'button',
              class: 'btn btn-danger-quiet btn-compact',
              onClick: () => {
                setFile(null);
                fileInput.value = '';
              }
            },
            icon('trash'),
            'Hapus gambar'
          )
        )
      )
    );
  }

  function setFile(next) {
    releasePreview();
    file = next;
    if (file) previewUrl = URL.createObjectURL(file);
    drawZone();
  }

  function accept(candidate, extraCount = 0) {
    showError('');
    if (!candidate) return;
    if (!ACCEPTED.includes(candidate.type)) {
      showError('Format tidak didukung. Pakai gambar JPG, PNG, atau WEBP.');
      return;
    }
    if (candidate.size === 0) {
      showError('File ini kosong.');
      return;
    }
    if (candidate.size > maxMb() * 1024 * 1024) {
      showError(`Ukuran gambar ${formatSize(candidate.size)} melebihi batas ${maxMb()} MB. Perkecil dulu gambarnya.`);
      return;
    }
    setFile(candidate);
    if (extraCount > 0) toast('Hanya satu gambar yang dipakai. Gambar pertama yang diambil.', 'info');
  }

  fileInput.addEventListener('change', () => {
    const picked = fileInput.files && fileInput.files[0];
    if (picked) accept(picked);
  });

  ['dragenter', 'dragover'].forEach((name) =>
    zone.addEventListener(name, (event) => {
      event.preventDefault();
      zone.classList.add('is-drag');
    })
  );
  ['dragleave', 'dragend'].forEach((name) =>
    zone.addEventListener(name, () => {
      zone.classList.remove('is-drag');
    })
  );
  zone.addEventListener('drop', (event) => {
    event.preventDefault();
    zone.classList.remove('is-drag');
    const dropped = event.dataTransfer && event.dataTransfer.files ? [...event.dataTransfer.files] : [];
    if (dropped.length === 0) return;
    accept(dropped[0], dropped.length - 1);
  });

  drawZone();

  const output = h('div', { class: 'output-stack' });
  const button = runButton('Buat prompt dari gambar');

  const task = createTask({
    ctx,
    button,
    output,
    idle: { title: 'Belum ada hasil', text: 'Unggah gambar lalu tekan Buat prompt dari gambar.' },
    idleLabel: 'Buat prompt dari gambar',
    busyLabel: 'Menganalisis gambar…',
    perform: {
      loadingText: 'AI sedang membaca gambar. Ini bisa butuh 10 sampai 30 detik.',
      prepare() {
        if (!file) {
          showError('Pilih gambar dulu.');
          return { ok: false, message: 'Pilih gambar dulu.' };
        }
        const data = new FormData();
        data.append('image', file, file.name);
        data.append('target', target.value);
        data.append('visualStyle', style.value);
        data.append('lighting', lighting.value);
        data.append('camera', camera.value);
        data.append('aspectRatio', ratio.value);
        data.append('language', language.value);
        data.append('notes', notes.value.trim());
        return { ok: true, data, fileName: file.name };
      },
      request: (attempt) => postForm('/api/ai/image-prompt', attempt.data)
    },
    render(payload, attempt) {
      const { observed, preferences, inferences, prompt, negativePrompt } = payload.result;
      const title = `Gambar: ${attempt.fileName}`.slice(0, 80);
      recordUse('image', title, prompt);

      const finalArea = textareaControl({ rows: 9, maxLength: 8000, value: prompt });
      finalArea.classList.add('textarea-final');

      const observedRows = OBSERVED_LABELS.map(([key, label]) => {
        const value = Array.isArray(observed[key]) ? observed[key].join(', ') : observed[key];
        return value ? h('div', { class: 'kv' }, h('dt', { text: label }), h('dd', { text: value })) : null;
      });

      const chosen = PREFERENCE_LABELS.filter(([key]) => preferences[key] && preferences[key] !== 'auto' && key !== 'language' && key !== 'target').map(([key, label, options]) =>
        h('div', { class: 'kv' }, h('dt', { text: label }), h('dd', { text: optionLabel(options, preferences[key]) }))
      );
      const base = PREFERENCE_LABELS.filter(([key]) => key === 'target' || key === 'language').map(([key, label, options]) =>
        h('div', { class: 'kv' }, h('dt', { text: label }), h('dd', { text: optionLabel(options, preferences[key]) }))
      );
      if (preferences.notes) chosen.push(h('div', { class: 'kv' }, h('dt', { text: 'Catatan' }), h('dd', { text: preferences.notes })));

      output.append(
        h(
          'section',
          { class: 'block result', 'aria-label': 'Hasil Image-to-Prompt' },
          h('h2', { class: 'section-title', text: 'Prompt dari gambar' }),
          h('div', { class: 'field' }, h('label', { for: finalArea.id, text: 'Prompt akhir (bisa kamu edit)' }), finalArea, counterFor(finalArea, 8000)),
          negativePrompt
            ? h(
                'div',
                { class: 'field' },
                h('p', { class: 'field-label', text: 'Negative prompt' }),
                h('pre', { class: 'prompt-view prompt-view-short', tabindex: '0' }, negativePrompt),
                h('div', { class: 'result-actions' }, h('button', { type: 'button', class: 'btn btn-quiet btn-compact', onClick: () => copyText(negativePrompt, 'Negative prompt disalin.') }, icon('copy'), 'Salin negative prompt'))
              )
            : null,
          resultActions({ ctx, getText: () => finalArea.value.trim() || prompt, title, featureId: 'image' }),
          h(
            'div',
            { class: 'evidence' },
            h(
              'section',
              { class: 'evidence-block', 'aria-labelledby': 'ev-observed' },
              h('h3', { class: 'section-title', id: 'ev-observed', text: 'Yang terlihat di gambar' }),
              h('p', { class: 'hint', text: 'Hanya hal yang jelas tampak.' }),
              observedRows.some(Boolean) ? h('dl', { class: 'kv-list' }, observedRows) : h('p', { class: 'hint', text: 'Tidak ada detail yang dilaporkan.' })
            ),
            h(
              'section',
              { class: 'evidence-block', 'aria-labelledby': 'ev-pref' },
              h('h3', { class: 'section-title', id: 'ev-pref', text: 'Preferensi kamu' }),
              h('p', { class: 'hint', text: chosen.length > 0 ? 'Diterapkan ke prompt akhir.' : 'Semua mengikuti gambar.' }),
              h('dl', { class: 'kv-list' }, base, chosen)
            ),
            h(
              'section',
              { class: 'evidence-block', 'aria-labelledby': 'ev-infer' },
              h('h3', { class: 'section-title', id: 'ev-infer', text: 'Dugaan yang belum pasti' }),
              h('p', { class: 'hint', text: 'Tebakan AI. Periksa sebelum dipakai.' }),
              inferences.length > 0
                ? h(
                    'ul',
                    { class: 'change-list' },
                    inferences.map((item) =>
                      h(
                        'li',
                        {},
                        h('span', { class: 'badge', text: CONFIDENCE_LABELS[item.confidence] || CONFIDENCE_LABELS.low }),
                        h('span', {}, item.detail, item.reason ? h('span', { class: 'hint infer-reason', text: ` Alasan: ${item.reason}` }) : null)
                      )
                    )
                  )
                : h('p', { class: 'hint', text: 'Tidak ada dugaan.' })
            )
          )
        )
      );
    }
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
    h('div', { class: 'field' }, h('p', { class: 'field-label', id: `${zoneId}-label`, text: 'Gambar referensi' }), zone, fileInput, zoneError),
    h('div', { class: 'field-row' }, field('Target AI', target), field('Bahasa prompt', language)),
    h('div', { class: 'field-row' }, field('Gaya visual', style), field('Pencahayaan', lighting)),
    h('div', { class: 'field-row' }, field('Kamera', camera), field('Rasio aspek', ratio)),
    field('Catatan', notes),
    h('p', { class: 'hint', text: 'Gambar dikirim ke server hanya untuk dianalisis, tidak disimpan. Jangan unggah gambar yang berisi data pribadi atau rahasia.' }),
    h('div', { class: 'form-actions' }, button)
  );

  container.append(...aiLayout('Image-to-Prompt', 'Ubah gambar menjadi prompt. Hasilnya memisahkan apa yang terlihat, preferensimu, dan dugaan yang belum pasti.', form, output));

  return () => {
    task.dispose();
    releasePreview();
  };
}

export const views = {
  'image-to-prompt': renderImagePrompt
};
