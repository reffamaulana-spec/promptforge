export const CATEGORIES = ['Menulis', 'Coding', 'Bisnis', 'Belajar', 'Riset', 'Gambar'];

export const TEMPLATES = [
  {
    id: 'tpl-artikel-seo',
    category: 'Menulis',
    title: 'Artikel blog yang SEO-friendly',
    description: 'Artikel lengkap dengan subjudul, kata kunci, dan meta description.',
    tags: ['blog', 'seo', 'artikel'],
    content: `## Peran
Kamu adalah penulis konten senior yang menguasai SEO.

## Konteks
Artikel ini untuk blog [NAMA BLOG] dengan pembaca [TARGET PEMBACA].

## Tugas
Tulis artikel tentang [TOPIK] dengan kata kunci utama [KATA KUNCI]. Mulai dengan pembuka yang langsung menjawab pertanyaan pembaca, lanjutkan dengan 4 sampai 6 subjudul, lalu tutup dengan ringkasan dan ajakan bertindak.

## Batasan
- Panjang sekitar [JUMLAH KATA] kata
- Gunakan bahasa [GAYA BAHASA]
- Jangan mengarang data atau kutipan; tandai bagian yang butuh sumber dengan [PERLU SUMBER]

## Format keluaran
Judul, meta description (maksimal 155 karakter), lalu isi artikel dengan subjudul H2.`
  },
  {
    id: 'tpl-email-tindak-lanjut',
    category: 'Menulis',
    title: 'Email tindak lanjut',
    description: 'Email singkat yang sopan untuk menanyakan kabar atau memajukan percakapan.',
    tags: ['email', 'profesional'],
    content: `## Peran
Kamu adalah asisten komunikasi profesional.

## Konteks
Saya pernah [KEJADIAN SEBELUMNYA] bersama [NAMA PENERIMA] dan belum mendapat kabar sejak [WAKTU].

## Tugas
Tulis email tindak lanjut yang mengingatkan konteks singkat, menyebut hal yang saya butuhkan ([PERMINTAAN]), dan memudahkan penerima untuk membalas.

## Batasan
- Maksimal 120 kata
- Nada sopan dan tidak mendesak
- Satu permintaan yang jelas di akhir

## Format keluaran
Baris subjek, lalu isi email. Berikan dua pilihan subjek.`
  },
  {
    id: 'tpl-caption-sosmed',
    category: 'Menulis',
    title: 'Caption media sosial',
    description: 'Beberapa pilihan caption dengan gaya berbeda untuk satu postingan.',
    tags: ['sosmed', 'caption', 'instagram'],
    content: `## Peran
Kamu adalah social media specialist.

## Konteks
Postingan di [PLATFORM] tentang [ISI POSTINGAN] untuk audiens [AUDIENS].

## Tugas
Buat 3 pilihan caption dengan gaya berbeda: informatif, santai, dan singkat.

## Batasan
- Maksimal [JUMLAH] kata per caption
- Sertakan 3 sampai 5 hashtag yang relevan
- Hindari klaim berlebihan

## Format keluaran
Tiga bagian berlabel Gaya 1, Gaya 2, dan Gaya 3.`
  },
  {
    id: 'tpl-code-review',
    category: 'Coding',
    title: 'Code review',
    description: 'Tinjau kode dari sisi bug, keterbacaan, keamanan, dan performa.',
    tags: ['review', 'kode', 'kualitas'],
    content: `## Peran
Kamu adalah senior software engineer yang teliti dalam code review.

## Konteks
Bahasa dan framework: [BAHASA / FRAMEWORK]. Tujuan kode: [TUJUAN KODE].

## Tugas
Tinjau kode berikut dan temukan bug, risiko keamanan, masalah performa, dan bagian yang sulit dibaca.

[TEMPEL KODE DI SINI]

## Batasan
- Jangan menulis ulang seluruh kode; tunjukkan perubahan yang perlu saja
- Urutkan temuan dari yang paling serius
- Jika tidak yakin, katakan apa yang perlu dicek

## Format keluaran
Tabel dengan kolom Tingkat, Lokasi, Masalah, dan Saran perbaikan.`
  },
  {
    id: 'tpl-debug-error',
    category: 'Coding',
    title: 'Cari penyebab error',
    description: 'Jelaskan pesan error, kemungkinan penyebab, dan langkah pengecekan.',
    tags: ['debug', 'error'],
    content: `## Peran
Kamu adalah engineer berpengalaman yang membantu men-debug masalah.

## Konteks
Lingkungan: [SISTEM OPERASI, VERSI RUNTIME]. Yang sedang saya lakukan: [LANGKAH YANG DILAKUKAN].

## Tugas
Jelaskan arti pesan error berikut, sebutkan 3 kemungkinan penyebab dari yang paling mungkin, dan beri langkah pengecekan untuk tiap penyebab.

[TEMPEL PESAN ERROR DI SINI]

## Batasan
- Jelaskan dengan bahasa sederhana
- Jangan menebak jika informasi kurang; ajukan pertanyaan yang kamu butuhkan

## Format keluaran
Daftar bernomor: penyebab, cara memeriksa, dan cara memperbaiki.`
  },
  {
    id: 'tpl-unit-test',
    category: 'Coding',
    title: 'Tulis unit test',
    description: 'Buat unit test dengan kasus normal, batas, dan gagal.',
    tags: ['test', 'kualitas'],
    content: `## Peran
Kamu adalah engineer yang fokus pada kualitas dan pengujian otomatis.

## Konteks
Bahasa: [BAHASA]. Framework test: [FRAMEWORK TEST].

## Tugas
Tulis unit test untuk fungsi berikut. Cakup kasus normal, kasus batas, input tidak valid, dan kondisi gagal.

[TEMPEL FUNGSI DI SINI]

## Batasan
- Nama test harus menjelaskan perilakunya
- Satu test menguji satu hal
- Jangan mengubah fungsi yang diuji

## Format keluaran
Satu blok kode berisi seluruh test, diikuti daftar singkat kasus yang belum tercakup.`
  },
  {
    id: 'tpl-deskripsi-produk',
    category: 'Bisnis',
    title: 'Deskripsi produk',
    description: 'Deskripsi yang menjual tanpa melebih-lebihkan, lengkap dengan poin utama.',
    tags: ['produk', 'marketing'],
    content: `## Peran
Kamu adalah copywriter e-commerce.

## Konteks
Produk: [NAMA PRODUK]. Fitur utama: [FITUR]. Pembeli yang dituju: [TARGET PEMBELI]. Platform: [MARKETPLACE].

## Tugas
Tulis deskripsi produk yang menjelaskan manfaat bagi pembeli, bukan hanya daftar fitur.

## Batasan
- Jangan menambahkan fitur atau klaim yang tidak saya berikan
- Maksimal [JUMLAH KATA] kata
- Gunakan bahasa [GAYA BAHASA]

## Format keluaran
Judul produk, paragraf pembuka, lima poin manfaat, dan satu kalimat penutup.`
  },
  {
    id: 'tpl-rencana-konten',
    category: 'Bisnis',
    title: 'Rencana konten mingguan',
    description: 'Jadwal konten tujuh hari dengan topik, format, dan tujuan tiap postingan.',
    tags: ['konten', 'perencanaan'],
    content: `## Peran
Kamu adalah content strategist.

## Konteks
Bisnis: [JENIS BISNIS]. Platform: [PLATFORM]. Tujuan minggu ini: [TUJUAN]. Waktu yang tersedia per hari: [WAKTU].

## Tugas
Susun rencana konten tujuh hari. Untuk tiap hari tentukan topik, format, ide pembuka, dan tujuan konten.

## Batasan
- Campuran konten edukasi, hiburan, dan penjualan; penjualan maksimal 2 dari 7 hari
- Sesuaikan dengan waktu produksi yang saya sebut

## Format keluaran
Tabel dengan kolom Hari, Topik, Format, Ide pembuka, dan Tujuan.`
  },
  {
    id: 'tpl-notulen-rapat',
    category: 'Bisnis',
    title: 'Notulen dan tindak lanjut rapat',
    description: 'Ubah catatan rapat mentah menjadi ringkasan, keputusan, dan daftar tugas.',
    tags: ['rapat', 'ringkasan'],
    content: `## Peran
Kamu adalah asisten administrasi yang rapi dan teliti.

## Konteks
Berikut catatan mentah rapat tentang [TOPIK RAPAT] pada [TANGGAL].

[TEMPEL CATATAN DI SINI]

## Tugas
Rangkum rapat, daftar keputusan yang diambil, dan buat daftar tindak lanjut.

## Batasan
- Jangan menambahkan informasi yang tidak ada di catatan
- Jika penanggung jawab atau tenggat tidak disebut, tulis [BELUM DITENTUKAN]

## Format keluaran
Ringkasan tiga kalimat, daftar keputusan, lalu tabel tindak lanjut dengan kolom Tugas, Penanggung jawab, dan Tenggat.`
  },
  {
    id: 'tpl-jelaskan-pemula',
    category: 'Belajar',
    title: 'Jelaskan konsep untuk pemula',
    description: 'Penjelasan bertahap dengan analogi dan contoh sederhana.',
    tags: ['belajar', 'penjelasan'],
    content: `## Peran
Kamu adalah pengajar sabar yang pandai membuat analogi.

## Konteks
Saya pemula di bidang [BIDANG] dan ingin memahami [KONSEP].

## Tugas
Jelaskan konsep tersebut dari dasar. Mulai dengan analogi dari kehidupan sehari-hari, lalu penjelasan teknis singkat, lalu satu contoh nyata.

## Batasan
- Hindari istilah yang belum dijelaskan
- Maksimal [JUMLAH KATA] kata

## Format keluaran
Tiga bagian: Analogi, Penjelasan, Contoh. Tutup dengan dua pertanyaan untuk menguji pemahaman saya.`
  },
  {
    id: 'tpl-rencana-belajar',
    category: 'Belajar',
    title: 'Rencana belajar mandiri',
    description: 'Rencana belajar bertahap sesuai waktu dan target yang kamu punya.',
    tags: ['belajar', 'rencana'],
    content: `## Peran
Kamu adalah mentor belajar yang realistis.

## Konteks
Target: menguasai [KEMAMPUAN] dalam [DURASI]. Level saya sekarang: [LEVEL SAAT INI]. Waktu belajar: [JAM PER MINGGU] jam per minggu.

## Tugas
Susun rencana belajar mingguan dengan topik, latihan, dan hasil yang bisa diukur di akhir tiap minggu.

## Batasan
- Sertakan satu minggu pengulangan setiap [JUMLAH] minggu
- Utamakan latihan praktik daripada teori
- Sebutkan jenis sumber belajar, bukan nama situs tertentu

## Format keluaran
Tabel dengan kolom Minggu, Topik, Latihan, dan Penanda berhasil.`
  },
  {
    id: 'tpl-kuis',
    category: 'Belajar',
    title: 'Latihan soal dan kuis',
    description: 'Soal pilihan ganda dan esai singkat lengkap dengan pembahasan.',
    tags: ['kuis', 'latihan'],
    content: `## Peran
Kamu adalah pembuat soal yang berpengalaman.

## Konteks
Materi: [MATERI]. Level: [LEVEL SISWA].

## Tugas
Buat [JUMLAH] soal pilihan ganda dan 2 soal esai singkat dari materi tersebut.

## Batasan
- Pilihan jawaban yang salah harus masuk akal
- Variasikan tingkat kesulitan dari mudah sampai sulit
- Jangan memakai materi di luar yang saya sebutkan

## Format keluaran
Soal bernomor, kunci jawaban, lalu pembahasan singkat untuk tiap soal.`
  },
  {
    id: 'tpl-ringkas-dokumen',
    category: 'Riset',
    title: 'Ringkas dokumen panjang',
    description: 'Ringkasan bertingkat: satu kalimat, satu paragraf, dan poin penting.',
    tags: ['ringkasan', 'dokumen'],
    content: `## Peran
Kamu adalah analis yang ahli meringkas dokumen.

## Konteks
Dokumen berikut berjenis [JENIS DOKUMEN] dan akan dibaca oleh [PEMBACA].

[TEMPEL TEKS DI SINI]

## Tugas
Ringkas dokumen tersebut dalam tiga tingkat: satu kalimat, satu paragraf, dan lima poin penting.

## Batasan
- Hanya gunakan informasi dari dokumen
- Tandai bagian yang ambigu dengan [PERLU DIPERIKSA]

## Format keluaran
Tiga bagian berlabel Satu kalimat, Satu paragraf, dan Poin penting.`
  },
  {
    id: 'tpl-bandingkan-opsi',
    category: 'Riset',
    title: 'Bandingkan beberapa opsi',
    description: 'Perbandingan dalam tabel dengan kriteria yang kamu tentukan.',
    tags: ['perbandingan', 'keputusan'],
    content: `## Peran
Kamu adalah analis yang objektif.

## Konteks
Saya memilih antara [OPSI 1], [OPSI 2], dan [OPSI 3] untuk [TUJUAN]. Hal yang paling penting bagi saya: [KRITERIA UTAMA].

## Tugas
Bandingkan ketiga opsi berdasarkan kriteria tersebut, lalu beri rekomendasi disertai alasannya.

## Batasan
- Jangan menyebut angka atau fakta yang tidak yakin; tulis perlu dicek
- Sebutkan kapan rekomendasi akan berubah

## Format keluaran
Tabel perbandingan, lalu rekomendasi dalam satu paragraf.`
  },
  {
    id: 'tpl-foto-produk',
    category: 'Gambar',
    title: 'Foto produk bergaya studio',
    description: 'Prompt gambar untuk foto produk dengan pencahayaan dan latar terkontrol.',
    tags: ['gambar', 'produk', 'foto'],
    content: `Foto produk [NAMA PRODUK] di atas [PERMUKAAN], latar [WARNA LATAR] polos, pencahayaan softbox dari sisi kiri dengan bayangan lembut, sudut kamera setinggi mata, fokus tajam pada [BAGIAN UTAMA PRODUK], warna dominan [PALET WARNA], gaya fotografi komersial yang bersih, resolusi tinggi --ar 4:5`
  },
  {
    id: 'tpl-ilustrasi-karakter',
    category: 'Gambar',
    title: 'Ilustrasi karakter orisinal',
    description: 'Prompt untuk karakter buatanmu sendiri dengan gaya dan suasana yang jelas.',
    tags: ['gambar', 'karakter', 'ilustrasi'],
    content: `Ilustrasi karakter orisinal: [DESKRIPSI KARAKTER], mengenakan [PAKAIAN], ekspresi [EKSPRESI], pose [POSE], di latar [LATAR TEMPAT], gaya [GAYA ILUSTRASI], palet warna [PALET WARNA], pencahayaan [JENIS CAHAYA], detail tekstur pada [BAGIAN DETAIL], komposisi [KOMPOSISI] --ar 3:4`
  }
];
