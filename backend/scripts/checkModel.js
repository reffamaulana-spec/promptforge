const zlib = require('zlib');
const env = require('../config/env');
const { getProvider } = require('../services/ai/provider');

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) {
    crc = CRC_TABLE[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeBuffer = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function createTestPng(size = 64) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 2;
  header[10] = 0;
  header[11] = 0;
  header[12] = 0;

  const rowLength = 1 + size * 3;
  const raw = Buffer.alloc(rowLength * size);
  for (let y = 0; y < size; y += 1) {
    const offset = y * rowLength;
    raw[offset] = 0;
    for (let x = 0; x < size; x += 1) {
      const pixel = offset + 1 + x * 3;
      const insideSquare = x > size / 4 && x < (size * 3) / 4 && y > size / 4 && y < (size * 3) / 4;
      raw[pixel] = insideSquare ? 220 : 30;
      raw[pixel + 1] = insideSquare ? 40 : 30;
      raw[pixel + 2] = insideSquare ? 40 : 200;
    }
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', zlib.deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0))
  ]);
}

function printStep(ok, label, detail) {
  const mark = ok ? 'OK  ' : 'GAGAL';
  console.log(`[${mark}] ${label}${detail ? ` - ${detail}` : ''}`);
}

async function main() {
  const listOnly = process.argv.includes('--list');
  const provider = getProvider();

  console.log(`Provider : ${provider.name}`);
  console.log(`Model    : ${provider.model}`);
  console.log('');

  if (!provider.isConfigured) {
    printStep(false, 'API key', provider.setupMessage);
    process.exitCode = 1;
    return;
  }
  printStep(true, 'API key terdeteksi di environment');

  let models;
  try {
    models = await provider.listModels();
  } catch (error) {
    printStep(false, 'Mengambil daftar model', `${error.code || 'ERROR'}: ${error.message}`);
    process.exitCode = 1;
    return;
  }
  printStep(true, 'Mengambil daftar model', `${models.length} model`);

  const generators = models.filter(
    (model) => model.name.startsWith('gemini') && model.supportedActions.includes('generateContent')
  );

  if (listOnly) {
    console.log('\nModel Gemini yang mendukung generateContent untuk API key ini:');
    generators.forEach((model) => console.log(`  - ${model.name}`));
    return;
  }

  const found = models.find((model) => model.name === provider.model);
  if (!found) {
    printStep(false, `Model "${provider.model}" ada di daftar`, 'tidak ditemukan untuk API key ini');
    console.log('\nPilih salah satu model berikut lalu isi GEMINI_MODEL di file .env:');
    generators.slice(0, 15).forEach((model) => console.log(`  - ${model.name}`));
    console.log('\nDaftar lengkap: npm run check:model -- --list');
    process.exitCode = 1;
    return;
  }
  printStep(true, `Model "${provider.model}" ada di daftar`);

  const supportsGenerate = found.supportedActions.includes('generateContent');
  printStep(supportsGenerate, 'Mendukung generateContent');
  if (!supportsGenerate) {
    process.exitCode = 1;
    return;
  }

  try {
    const textResult = await provider.generateText({
      prompt: 'Balas hanya dengan satu kata: siap',
      temperature: 0,
      maxOutputTokens: 256
    });
    printStep(true, 'Uji input teks', `respons: "${textResult.text.slice(0, 60)}"`);
  } catch (error) {
    printStep(false, 'Uji input teks', `${error.code || 'ERROR'}: ${error.message}`);
    process.exitCode = 1;
    return;
  }

  try {
    const imageResult = await provider.generateWithImage({
      prompt: 'Sebutkan warna dominan pada gambar ini dalam satu kalimat pendek.',
      image: { mimeType: 'image/png', data: createTestPng() },
      temperature: 0,
      maxOutputTokens: 512
    });
    printStep(true, 'Uji input gambar (vision)', `respons: "${imageResult.text.slice(0, 80)}"`);
  } catch (error) {
    printStep(false, 'Uji input gambar (vision)', `${error.code || 'ERROR'}: ${error.message}`);
    process.exitCode = 1;
    return;
  }

  console.log('\nSemua pemeriksaan lulus. Model ini bisa dipakai untuk teks dan gambar.');
}

main().catch((error) => {
  console.error(`Skrip gagal: ${error.message}`);
  process.exitCode = 1;
});
