# PROMPTFORGE - Craft Better Prompts

Studio prompt engineering berbasis web. Kamu bisa membuat, memperbaiki, menilai, mengembangkan, dan menerjemahkan prompt dengan bantuan AI, membuat prompt dari gambar, lalu menyimpannya di akunmu.

## Fitur

| Fitur | Fungsi |
|---|---|
| Generator | Ide singkat menjadi prompt terstruktur (Peran, Konteks, Tugas, Batasan, Format) |
| Image-to-Prompt | Gambar JPG/PNG/WEBP menjadi prompt; memisahkan yang terlihat, preferensimu, dan dugaan |
| Optimizer | Memperbaiki prompt tanpa mengubah maksud, dengan perbandingan sebelum dan sesudah |
| Analyzer | Skor heuristik lima aspek beserta saran |
| Expander | Mengembangkan ide pendek menjadi instruksi lengkap |
| Translator | Terjemahan prompt Indonesia dan Inggris |
| Assistant | Chat untuk menyusun prompt, hasilnya bisa dikirim ke Workspace |
| Library | 16 template siap pakai dengan slot `[SEPERTI INI]` |
| Workspace | Edit, tag, favorit, salin, ekspor TXT/JSON |
| Favorit, Riwayat, Dashboard | Koleksi dan ringkasan pemakaian |
| Akun | Daftar, masuk, lupa password; data tersimpan per pengguna |

## Teknologi

- Frontend: HTML5, CSS3, JavaScript murni (ES modules), tanpa framework
- Backend: Node.js 20+, Express
- AI: Google Gemini (teks dan gambar) lewat lapisan provider yang bisa diganti
- Login dan database: Supabase (Auth + PostgreSQL dengan Row Level Security)
- Keamanan: helmet (CSP ketat, tanpa script/style inline), batas permintaan, validasi input, verifikasi token di server

## Arsitektur

```
Browser ──(login, baca/tulis prompt, dilindungi RLS)──► Supabase
   │
   └──(fitur AI + token login)──► Express ──► Gemini
                                   └─ memverifikasi token ke Supabase
```

- Kunci Gemini hanya ada di server (`.env`), tidak pernah dikirim ke browser.
- Browser hanya menerima URL Supabase dan publishable/anon key, yang memang aman dipublikasikan selama RLS aktif.
- Semua endpoint AI wajib login dan dibatasi per pengguna.
- Perubahan data tampil langsung di layar, lalu disinkronkan ke Supabase di belakang layar. Jika gagal, muncul banner dengan tombol Coba lagi.

## Struktur folder

```
promptforge/
  backend/
    server.js            aplikasi Express dan header keamanan
    config/env.js        pembacaan dan validasi .env
    middleware/          requireAuth, requireAi, rateLimit, upload, errorHandler
    routes/              health, config, ai
    services/            promptTasks, auth, ai/ (provider Gemini), prompts/ (instruksi sistem)
    scripts/             checkModel, checkSupabase, tryAi, tryImage, vendorSupabase
    tests/               tes otomatis
  public/
    index.html
    css/style.css
    js/                  app, auth, storage, api, ui, builder, image-prompt, pages/
    vendor/supabase.js   pustaka login (disalin, bukan dari CDN)
  supabase/schema.sql    tabel dan aturan RLS
  api/index.js, vercel.json   opsional, untuk Vercel
  render.yaml            konfigurasi Render
  TESTING.md             checklist pengujian manual
  DEPLOYMENT.md          panduan deploy
```

## Menjalankan di komputer (Windows CMD)

Prasyarat: Node.js 20 atau lebih baru (`node -v`), API key Gemini dari Google AI Studio, dan proyek Supabase.

```
cd C:\project\promptforge
npm install
copy .env.example .env
```

Isi `.env`, lalu siapkan Supabase mengikuti `supabase/README.md`. Setelah itu:

```
npm run check:model
npm run check:supabase
npm test
npm run dev
```

Buka http://localhost:3000.

## Variabel lingkungan

| Nama | Wajib | Keterangan |
|---|---|---|
| `GEMINI_API_KEY` | ya | API key Gemini. Hanya di `.env` atau pengaturan hosting |
| `GEMINI_MODEL` | tidak | Default `gemini-3.1-flash-lite`. Cek yang tersedia di akunmu dengan `npm run check:model` |
| `SUPABASE_URL` | ya | Contoh `https://xxxx.supabase.co`, tanpa garis miring di akhir |
| `SUPABASE_ANON_KEY` | ya | Isi dengan Publishable key (`sb_publishable_...`) atau anon key lama. Jangan pernah memakai secret/service_role key |
| `PORT` | tidak | Default 3000 |
| `NODE_ENV` | tidak | Isi `production` saat deploy |
| `TRUST_PROXY` | tidak | Isi `1` jika di balik proxy hosting (Render, Railway), supaya IP pengguna terbaca benar |
| `ALLOWED_ORIGINS` | tidak | Daftar origin CORS, dipisah koma. Kosong berarti hanya satu origin |
| `MAX_IMAGE_MB` | tidak | Batas ukuran gambar, default 5 |
| `RATE_LIMIT_AI_MAX`, `RATE_LIMIT_AI_WINDOW_MS` | tidak | Batas permintaan AI per pengguna. Default 20 per menit |
| `RATE_LIMIT_API_MAX`, `RATE_LIMIT_API_WINDOW_MS` | tidak | Batas permintaan umum per IP. Default 120 per 15 menit |
| `GEMINI_TIMEOUT_MS`, `JSON_BODY_LIMIT` | tidak | Batas waktu AI dan ukuran body JSON |

## Perintah npm

| Perintah | Fungsi |
|---|---|
| `npm run dev` | Server dengan auto-restart |
| `npm start` | Server untuk produksi |
| `npm test` | Seluruh tes otomatis (tanpa memanggil Gemini atau Supabase asli) |
| `npm run check:model` | Mengecek API key Gemini dan model |
| `npm run check:supabase` | Mengecek koneksi Supabase, tabel, dan RLS |
| `npm run try:ai`, `npm run try:image` | Mencoba endpoint AI dengan panggilan sungguhan |
| `npm run vendor` | Menyalin ulang pustaka login ke `public/vendor/` |

## Endpoint API

| Metode | Path | Login | Keterangan |
|---|---|---|---|
| GET | `/api/health` | tidak | Status server, AI, dan login |
| GET | `/api/config` | tidak | URL dan key publik Supabase |
| POST | `/api/ai/generate` | ya | Generator |
| POST | `/api/ai/optimize` | ya | Optimizer |
| POST | `/api/ai/analyze` | ya | Analyzer |
| POST | `/api/ai/expand` | ya | Expander |
| POST | `/api/ai/translate` | ya | Translator |
| POST | `/api/ai/chat` | ya | Assistant (maksimal 20 pesan) |
| POST | `/api/ai/image-prompt` | ya | Image-to-Prompt (multipart, field `image`) |

Format error: `{ "ok": false, "error": { "code": "...", "message": "..." } }`. Kode yang umum: `UNAUTHENTICATED` (401), `INVALID_INPUT` (400), `INVALID_IMAGE` (400), `AI_NOT_CONFIGURED` dan `AUTH_NOT_CONFIGURED` (503), dan 429 untuk batas permintaan.

## Catatan keamanan

- Jangan pernah mengunggah `.env` ke Git. `.gitignore` sudah mengecualikannya; periksa dengan `git status` sebelum commit.
- Hanya Publishable/anon key yang dipakai aplikasi. Secret key Supabase memberi akses penuh ke database dan tidak dibutuhkan.
- Input pengguna dibungkus tag dan dipisahkan dari instruksi sistem untuk mengurangi prompt injection. Ini mengurangi risiko, bukan menghilangkannya.
- Gambar yang diunggah hanya dikirim ke Gemini untuk dianalisis dan tidak disimpan di server. Pengguna tetap sebaiknya tidak mengunggah gambar yang berisi data pribadi.
- Skor Analyzer bersifat heuristik, bukan ukuran mutlak kualitas prompt. Hasil AI perlu diperiksa sebelum dipakai.
- Batas permintaan disimpan di memori server. Pada hosting dengan banyak instance atau serverless, batas ini tidak dibagi antar instance.

## Pemecahan masalah

| Gejala | Penyebab dan solusi |
|---|---|
| `node` tidak dikenali | Pasang Node.js LTS dari nodejs.org, tutup lalu buka ulang CMD |
| Layar "Login belum diatur" | `SUPABASE_URL` atau `SUPABASE_ANON_KEY` kosong atau salah. Jalankan `npm run check:supabase`, lalu restart server |
| Layar "Data akun gagal dimuat" | `supabase/schema.sql` belum dijalankan di SQL Editor |
| "AI belum diatur" | `GEMINI_API_KEY` kosong. Isi, lalu restart server |
| Error 401 saat memakai alat AI | Sesi habis. Keluar lalu masuk lagi |
| Daftar berhasil tapi tidak bisa masuk | "Confirm email" menyala di Supabase: klik link di email, atau matikan saat uji lokal |
| Email konfirmasi/reset tidak datang | Cek folder spam. Email bawaan Supabase dibatasi jumlahnya; untuk pemakaian nyata pasang SMTP sendiri |
| Link reset password mengarah ke alamat salah | Atur Site URL dan Redirect URLs di Supabase, Authentication, URL Configuration |
| Port 3000 sudah dipakai | Ubah `PORT` di `.env` |
| Banner "belum tersimpan ke server" | Koneksi ke Supabase terputus atau sesi habis. Tekan Coba lagi |

## Lisensi dan atribusi

Pustaka login `@supabase/supabase-js` disertakan di `public/vendor/` dengan lisensi MIT.
