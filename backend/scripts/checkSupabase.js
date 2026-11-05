const env = require('../config/env');

const tables = ['prompts', 'history', 'usage_stats'];
let failed = false;

function ok(message) {
  console.log(`OK     ${message}`);
}

function fail(message) {
  failed = true;
  console.log(`GAGAL  ${message}`);
}

async function call(path) {
  return fetch(`${env.supabase.url}${path}`, {
    headers: { apikey: env.supabase.anonKey },
    signal: AbortSignal.timeout(10000)
  });
}

async function main() {
  if (!env.supabase.configured) {
    fail('SUPABASE_URL atau SUPABASE_ANON_KEY di file .env belum diisi dengan benar.');
    console.log('       URL harus diawali https:// dan berakhir .supabase.co, tanpa garis miring di akhir.');
    process.exit(1);
  }
  ok(`Pengaturan .env terbaca (${env.supabase.url}).`);

  try {
    const response = await call('/auth/v1/settings');
    if (response.status === 200) {
      const settings = await response.json();
      ok('Layanan login Supabase bisa dihubungi.');
      if (settings && settings.external && settings.external.email === false) {
        fail('Login email di Supabase sedang nonaktif. Aktifkan di Authentication, Providers, Email.');
      }
      if (settings && settings.mailer_autoconfirm === false) {
        console.log('INFO   "Confirm email" menyala: pengguna baru harus klik link di email sebelum bisa masuk.');
      } else if (settings && settings.mailer_autoconfirm === true) {
        console.log('INFO   "Confirm email" mati: pengguna baru langsung bisa masuk (cocok untuk uji lokal).');
      }
    } else if (response.status === 401 || response.status === 403) {
      fail('Kunci anon ditolak. Salin ulang "anon public" key dari Project Settings, API.');
    } else {
      fail(`Layanan login menjawab HTTP ${response.status}. Periksa SUPABASE_URL.`);
    }
  } catch (error) {
    fail(`Tidak bisa menghubungi Supabase: ${error.message}. Periksa internet dan SUPABASE_URL.`);
    process.exit(1);
  }

  for (const table of tables) {
    try {
      const response = await call(`/rest/v1/${table}?select=*&limit=1`);
      if (response.status === 200) {
        const rows = await response.json();
        if (Array.isArray(rows) && rows.length === 0) {
          ok(`Tabel ${table} ada dan kosong untuk pengguna anonim (aturan RLS bekerja).`);
        } else {
          fail(`Tabel ${table} mengembalikan data tanpa login. RLS belum aktif: jalankan ulang supabase/schema.sql.`);
        }
      } else if (response.status === 404) {
        fail(`Tabel ${table} belum ada. Jalankan isi supabase/schema.sql di SQL Editor.`);
      } else if (response.status === 401 || response.status === 403) {
        ok(`Tabel ${table} menolak akses anonim (hak akses sudah dibatasi).`);
      } else {
        fail(`Tabel ${table} menjawab HTTP ${response.status}.`);
      }
    } catch (error) {
      fail(`Tabel ${table}: ${error.message}`);
    }
  }

  console.log(failed ? '\nAda yang perlu diperbaiki, lihat baris GAGAL di atas.' : '\nSemua pemeriksaan lulus.');
  process.exit(failed ? 1 : 0);
}

main();
