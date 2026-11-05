const fs = require('fs');
const path = require('path');
const env = require('../config/env');

const baseUrl = (process.env.BASE_URL || `http://localhost:${env.port}`).replace(/\/$/, '');

const MIME_BY_EXTENSION = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp'
};

const OPTION_KEYS = ['target', 'visualStyle', 'lighting', 'camera', 'aspectRatio', 'language', 'notes'];

function printUsage() {
  console.log('Cara pakai:');
  console.log('  npm run try:image -- "C:\\path\\ke\\foto.jpg"');
  console.log('  npm run try:image -- "C:\\path\\ke\\foto.jpg" target=midjourney visualStyle=cinematic aspectRatio=16:9 language=id');
  console.log('');
  console.log(`Opsi yang bisa diisi: ${OPTION_KEYS.join(', ')}`);
}

function list(title, items) {
  if (!items || items.length === 0) return;
  console.log(`  ${title}:`);
  items.forEach((item) => console.log(`    - ${item}`));
}

async function main() {
  const args = process.argv.slice(2);
  const filePath = args.find((arg) => !arg.includes('=') || fs.existsSync(arg));

  if (!filePath) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  const options = {};
  for (const arg of args) {
    if (arg === filePath) continue;
    const index = arg.indexOf('=');
    if (index === -1) continue;
    const key = arg.slice(0, index);
    if (!OPTION_KEYS.includes(key)) {
      console.log(`Opsi "${key}" tidak dikenal. Pilihan: ${OPTION_KEYS.join(', ')}`);
      process.exitCode = 1;
      return;
    }
    options[key] = arg.slice(index + 1);
  }

  if (!fs.existsSync(filePath)) {
    console.log(`File tidak ditemukan: ${filePath}`);
    process.exitCode = 1;
    return;
  }

  const extension = path.extname(filePath).toLowerCase();
  const mimeType = MIME_BY_EXTENSION[extension];
  if (!mimeType) {
    console.log('Format file harus .jpg, .jpeg, .png, atau .webp.');
    process.exitCode = 1;
    return;
  }

  const form = new FormData();
  form.append('image', new Blob([fs.readFileSync(filePath)], { type: mimeType }), path.basename(filePath));
  for (const [key, value] of Object.entries(options)) form.append(key, value);

  const started = Date.now();
  let response;
  try {
    response = await fetch(`${baseUrl}/api/ai/image-prompt`, { method: 'POST', body: form });
  } catch (error) {
    console.log(`[GAGAL] server tidak bisa dihubungi di ${baseUrl}. Jalankan "npm run dev" di CMD lain dulu.`);
    process.exitCode = 1;
    return;
  }

  const payload = await response.json().catch(() => null);
  const seconds = ((Date.now() - started) / 1000).toFixed(1);

  if (!response.ok || !payload || !payload.ok) {
    const error = payload && payload.error ? payload.error : { code: 'UNKNOWN', message: `HTTP ${response.status}` };
    console.log(`[GAGAL] image-prompt (${response.status}, ${seconds}s) ${error.code}: ${error.message}`);
    process.exitCode = 1;
    return;
  }

  const { observed, preferences, inferences, prompt, negativePrompt, image } = payload.result;
  console.log(`[OK  ] image-prompt (${seconds}s, model ${payload.meta.model}, ${image.mimeType}, ${image.sizeBytes} byte)`);
  console.log('');
  console.log('TERLIHAT DI GAMBAR');
  console.log(`  Subjek      : ${observed.subject}`);
  console.log(`  Latar       : ${observed.scene}`);
  console.log(`  Komposisi   : ${observed.composition}`);
  console.log(`  Sudut       : ${observed.cameraAngle}`);
  console.log(`  Cahaya      : ${observed.lighting}`);
  console.log(`  Suasana     : ${observed.atmosphere}`);
  console.log(`  Gaya visual : ${observed.visualStyle}`);
  list('Objek', observed.objects);
  list('Warna', observed.colors);
  list('Tekstur', observed.textures);
  console.log('');
  console.log('PREFERENSI PENGGUNA');
  Object.entries(preferences).forEach(([key, value]) => console.log(`  ${key.padEnd(12)}: ${value || '-'}`));
  console.log('');
  console.log('INFERENSI TIDAK PASTI');
  if (inferences.length === 0) console.log('  (tidak ada)');
  inferences.forEach((item) => console.log(`  - [${item.confidence}] ${item.detail} (${item.reason})`));
  console.log('');
  console.log('PROMPT');
  console.log(`  ${prompt}`);
  if (negativePrompt) {
    console.log('');
    console.log('NEGATIVE PROMPT');
    console.log(`  ${negativePrompt}`);
  }
}

main();
