# Panduan Deployment PROMPTFORGE

Pilihan yang disarankan: **Render** (server Node biasa, aplikasi ini jalan apa adanya). Railway mirip. Vercel bisa dipakai tapi ada batasan; baca bagian terakhir.

Sebelum mulai, pastikan di komputermu `npm test` lulus dan `npm run check:supabase` semua OK.

## 1. Taruh kode di GitHub

Buat repositori kosong di github.com (Private disarankan). Lalu di CMD:

```
cd C:\project\promptforge
git init
git add .
git status
```

Baca hasil `git status`. **File `.env` tidak boleh muncul di daftar.** Jika muncul, berhenti dan jangan lanjut. Pastikan `package-lock.json` ada di daftar (dibutuhkan Render).

```
git commit -m "PROMPTFORGE"
git branch -M main
git remote add origin https://github.com/USERNAME/promptforge.git
git push -u origin main
```

Ganti `USERNAME` dengan akun GitHub-mu. Jika Git meminta identitas, jalankan dulu `git config --global user.name "Nama"` dan `git config --global user.email "email@contoh.com"`.

## 2. Deploy ke Render

1. Daftar di render.com dan hubungkan akun GitHub.
2. New, Blueprint (memakai `render.yaml`), pilih repositori `promptforge`. Atau New, Web Service secara manual dengan: Runtime Node, Build Command `npm ci --omit=dev`, Start Command `npm start`, Health Check Path `/api/health`.
3. Isi variabel lingkungan yang bertanda rahasia:
   - `GEMINI_API_KEY`
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY` (Publishable key, bukan Secret key)
   - Pastikan `NODE_ENV=production` dan `TRUST_PROXY=1`. Keduanya sudah ada di `render.yaml`.
4. Deploy. Setelah selesai, Render memberi alamat seperti `https://promptforge-xxxx.onrender.com`.
5. Buka `https://alamatmu/api/health`. Hasilnya harus menunjukkan `"ok": true`.

Catatan paket gratis: layanan gratis Render dapat "tidur" saat lama tidak dipakai, jadi permintaan pertama setelah itu terasa lambat. Jam instance gratis juga dibatasi per bulan. Cek halaman harga dan dokumentasi Render untuk angka terbarunya, karena bisa berubah.

## 3. Sesuaikan Supabase untuk alamat produksi

Tanpa langkah ini, link konfirmasi dan reset password akan menuju alamat lokal.

1. Supabase, Authentication, URL Configuration: ubah **Site URL** menjadi alamat Render-mu.
2. Tambahkan `https://alamatmu/**` ke **Redirect URLs** (alamat `http://localhost:3000/**` boleh tetap ada untuk uji lokal).
3. Authentication, Providers, Email: nyalakan lagi **Confirm email**.
4. Email bawaan Supabase dibatasi jumlahnya dan ditujukan untuk uji coba. Jika pengguna nyata akan mendaftar, pasang SMTP sendiri di Authentication, SMTP Settings.

## 4. Uji setelah deploy

Ikuti `TESTING.md` pada alamat produksi, terutama bagian A2 (login dan database), lalu coba satu alat AI. Periksa juga:

- `https://alamatmu/api/ai/translate` dibuka tanpa login lewat curl harus menjawab 401, bukan hasil AI.
- Di DevTools Console tidak ada pelanggaran Content Security Policy.
- Buat akun kedua dan pastikan datanya terpisah dari akun pertama.

## 5. Pengamanan sebelum dibagikan

- Di Google AI Studio atau Google Cloud, pasang batas kuota atau peringatan biaya untuk key Gemini. Tiap pengguna yang login bisa memakai kuota key-mu.
- Jika key atau secret pernah terlanjur terlihat orang lain (screenshot, chat, Git), buat ulang key itu dan perbarui variabel di Render.
- Atur `RATE_LIMIT_AI_MAX` sesuai kebutuhan. Default 20 permintaan per menit per pengguna.
- Daftar pengguna bisa dilihat dan dikelola di Supabase, Authentication, Users.

## Railway (alternatif)

Langkahnya sama dengan Render: hubungkan repositori GitHub, isi variabel lingkungan yang sama (termasuk `NODE_ENV=production` dan `TRUST_PROXY=1`), Start Command `npm start`, lalu buat domain publik di pengaturan jaringan layanan. Bagian ini belum saya uji.

## Vercel (opsional, belum diuji, ada batasan)

Repositori sudah menyertakan `api/index.js` dan `vercel.json` yang membungkus aplikasi Express sebagai satu fungsi. Konfigurasi ini saya periksa sintaksnya saja; **saya belum men-deploy-nya ke Vercel**, jadi anggap sebagai titik awal yang mungkin perlu penyesuaian.

Hal yang perlu kamu ketahui:

- Dokumentasi Vercel (diperbarui Agustus 2026) menyebut batas durasi fungsi 300 detik untuk paket Hobby, jadi pemanggilan Gemini yang lambat tidak masalah. Batas isi permintaan dan respons adalah **4,5 MB**. Karena itu isi `MAX_IMAGE_MB=4` agar unggahan gambar tidak ditolak Vercel sebelum sampai ke aplikasi.
- Pada serverless, tiap instance punya memori sendiri. Batas permintaan di aplikasi ini disimpan di memori, jadi batasnya tidak berlaku utuh lintas instance. Batas per pengguna terhadap kuota Gemini menjadi lebih longgar dari yang dikonfigurasi.
- `TRUST_PROXY=1` tetap diperlukan.

Jika kamu ingin batas permintaan yang akurat di Vercel, perlu penyimpanan bersama (misalnya Redis). Itu belum ada di proyek ini. Karena itu, untuk penggunaan nyata, Render atau Railway lebih aman.

## Sumber

- [Batas Vercel Functions](https://vercel.com/docs/functions/limitations)
