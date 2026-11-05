# Checklist Pengujian PROMPTFORGE

Centang setelah kamu coba sendiri di browser. Jalankan dulu:

```
cd C:\project\promptforge
npm test
npm run dev
```

Buka http://localhost:3000.

## A. Setup dan server
- [ ] `npm test` lulus semua (65 tes)
- [ ] Dengan `GEMINI_API_KEY` terisi: pil status di topbar tidak muncul, tidak ada banner
- [ ] Hapus key dari `.env`, restart: pil "AI belum diatur" dan banner muncul, tombol alat AI nonaktif dengan alasan
- [ ] Matikan server, muat ulang: banner "Server offline" dan tombol "Coba lagi" muncul; Workspace tetap bisa dibuka

## A2. Login dan database (Supabase)
- [ ] `npm run check:supabase` menampilkan semua OK
- [ ] Buka http://localhost:3000 saat belum login: yang tampil halaman Masuk
- [ ] Daftar akun baru; masuk ke Dashboard (atau cek email konfirmasi jika "Confirm email" menyala)
- [ ] Buat prompt, simpan, muat ulang browser: prompt masih ada
- [ ] Di Supabase, Table Editor, tabel `prompts`: barisnya muncul dengan `user_id` milikmu
- [ ] Keluar lalu masuk dengan akun kedua: data akun pertama tidak terlihat
- [ ] Buka dari browser atau perangkat lain dengan akun yang sama: datanya sama
- [ ] "Lupa password?": email reset terkirim, link membuka form password baru
- [ ] Putuskan internet lalu simpan prompt: banner "belum tersimpan" muncul; sambungkan lagi lalu tekan Coba lagi
- [ ] Tanpa login, kirim permintaan ke `/api/ai/translate` (mis. lewat curl): jawabannya 401
- [ ] Jika ada data lama dari Tahap 1-6 di browser: tawaran impor muncul saat masuk pertama kali

## B. Library, Workspace, Favorit, Riwayat
- [ ] Library: cari kata, filter kategori, Pratinjau menampilkan slot yang disorot
- [ ] Gunakan template: masuk ke Workspace dengan isi yang benar
- [ ] Workspace: ubah judul, tag, isi; Ctrl+S menyimpan; counter kata dan karakter berubah
- [ ] Pindah halaman saat ada perubahan belum tersimpan: muncul konfirmasi
- [ ] Favorit: tandai dan lepas tanda, halaman Favorit ikut berubah
- [ ] Salin, unduh TXT (isi prompt saja), unduh JSON, duplikat, hapus (dengan konfirmasi)
- [ ] Riwayat: filter jenis, Lihat, Simpan ke Workspace, Hapus semua
- [ ] Muat ulang browser: semua data masih ada

## C. Alat AI (butuh API key)
- [ ] Generator: ide singkat menghasilkan 5 bagian; slot `[SEPERTI INI]` disorot
- [ ] Optimizer: sebelum dan sesudah, daftar perubahan; periksa hasil tidak menambah hal di luar maksudmu
- [ ] Analyzer: 5 skor, saran, disclaimer heuristik
- [ ] Expander: kedalaman Sedang dan Lengkap
- [ ] Translator: ID ke EN, balik arah; kode dan `[SLOT]` tidak berubah
- [ ] Assistant: permintaan samar dijawab pertanyaan; setelah jelas keluar prompt; Kirim ke Workspace
- [ ] Image-to-Prompt: file `.txt` ditolak; gambar lebih dari batas MB ditolak; pratinjau, hapus, ganti
- [ ] Image-to-Prompt: hasil memisahkan terlihat, preferensi, dugaan; tidak menyebut ras/etnis; nomor dada tidak disalin
- [ ] Setiap hasil: Salin, TXT, Simpan, Kirim ke Workspace berfungsi
- [ ] Hasil AI tercatat di Riwayat dan angka di Dashboard bertambah
- [ ] Error (mis. cabut internet saat memproses): pesan jelas dan "Coba lagi" berfungsi

## D. Responsif
- [ ] Lebar sekitar 1280, 768, dan 390 px: tidak ada scroll horizontal
- [ ] Mobile: menu hamburger membuka dan menutup (tombol Esc dan area gelap)
- [ ] Teks tombol "Buat prompt", "Optimalkan", dan lainnya tetap terlihat di mobile

## E. Aksesibilitas dasar
- [ ] Tab dari awal halaman: tombol "Lewati ke konten" muncul lebih dulu
- [ ] Semua tombol dan field bisa dicapai dengan keyboard; fokus selalu terlihat
- [ ] Dialog: fokus masuk ke dialog, Esc menutup, fokus kembali ke tombol pembuka
- [ ] Ctrl+Enter mengirim form di halaman alat AI; Enter mengirim di Assistant
- [ ] Zoom browser 200%: konten tetap bisa dipakai
- [ ] Setelan sistem "kurangi animasi" aktif: animasi nyaris hilang

## F. Keamanan
- [ ] `.env` tidak ikut ke Git (`git status` tidak menampilkannya)
- [ ] Kirim 25 permintaan AI cepat: kamu mendapat pesan batas permintaan, server tetap hidup
- [ ] Di DevTools Console tidak ada pelanggaran Content Security Policy
