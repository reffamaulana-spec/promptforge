const env = require('../config/env');

const baseUrl = (process.env.BASE_URL || `http://localhost:${env.port}`).replace(/\/$/, '');

const SAMPLES = {
  generate: {
    path: '/api/ai/generate',
    body: {
      idea: 'Buat caption Instagram untuk event lari 5K komunitas kampus',
      target: 'general',
      tone: 'friendly',
      language: 'id'
    }
  },
  optimize: {
    path: '/api/ai/optimize',
    body: {
      prompt: 'tulis artikel tentang manfaat lari pagi yang bagus dan menarik',
      goal: 'lebih spesifik dan terstruktur',
      language: 'id'
    }
  },
  analyze: {
    path: '/api/ai/analyze',
    body: {
      prompt: 'Jelaskan tentang JavaScript.',
      language: 'id'
    }
  },
  expand: {
    path: '/api/ai/expand',
    body: {
      idea: 'aplikasi pencatat jadwal latihan lari',
      depth: 'moderate',
      language: 'id'
    }
  },
  translate: {
    path: '/api/ai/translate',
    body: {
      text: 'Kamu adalah seorang editor senior.\n\n## Tugas\n- Perbaiki tata bahasa teks pada {{input}}\n- Pertahankan format JSON',
      direction: 'id-en'
    }
  }
};

function indent(text) {
  return String(text)
    .split('\n')
    .map((line) => `    ${line}`)
    .join('\n');
}

function show(name, payload) {
  const result = payload.result;
  if (name === 'generate') return indent(result.prompt);
  if (name === 'expand') return indent(result.expanded);
  if (name === 'translate') return indent(result.translation);
  if (name === 'optimize') {
    const changes = result.changes.map((item) => `- [${item.category}] ${item.description}`).join('\n');
    return `${indent(result.optimized)}\n\n  Perubahan:\n${indent(changes)}`;
  }
  const lines = Object.entries(result.scores).map(
    ([key, value]) => `${key.padEnd(12)} ${String(value.score).padStart(4)}  ${value.explanation}`
  );
  lines.push(`${'overall'.padEnd(12)} ${String(result.overall).padStart(4)}`);
  lines.push('', 'Saran:', ...result.suggestions.map((item) => `- (${item.priority}) ${item.text}`));
  lines.push('', result.disclaimer);
  return indent(lines.join('\n'));
}

async function run(name) {
  const sample = SAMPLES[name];
  const started = Date.now();
  let response;
  try {
    response = await fetch(`${baseUrl}${sample.path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sample.body)
    });
  } catch (error) {
    console.log(`[GAGAL] ${name}: server tidak bisa dihubungi di ${baseUrl}. Jalankan "npm run dev" di CMD lain dulu.`);
    return false;
  }

  const payload = await response.json().catch(() => null);
  const seconds = ((Date.now() - started) / 1000).toFixed(1);

  if (!response.ok || !payload || !payload.ok) {
    const error = payload && payload.error ? payload.error : { code: 'UNKNOWN', message: `HTTP ${response.status}` };
    console.log(`[GAGAL] ${name} (${response.status}, ${seconds}s) ${error.code}: ${error.message}`);
    return false;
  }

  console.log(`[OK  ] ${name} (${seconds}s, model ${payload.meta.model})`);
  console.log(show(name, payload));
  console.log('');
  return true;
}

async function main() {
  const requested = process.argv[2];
  const names = requested ? [requested] : Object.keys(SAMPLES);

  if (requested && !SAMPLES[requested]) {
    console.log(`Endpoint "${requested}" tidak dikenal. Pilihan: ${Object.keys(SAMPLES).join(', ')}`);
    process.exitCode = 1;
    return;
  }

  let failed = 0;
  for (const name of names) {
    const ok = await run(name);
    if (!ok) failed += 1;
  }

  console.log(failed === 0 ? 'Semua endpoint yang diuji berhasil.' : `${failed} endpoint gagal.`);
  if (failed > 0) process.exitCode = 1;
}

main();
