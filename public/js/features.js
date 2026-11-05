export const AI_FEATURES = [
  {
    id: 'generator',
    path: 'generator',
    label: 'Prompt Generator',
    icon: 'wand',
    summary: 'Ubah ide singkat menjadi prompt terstruktur.',
    detail: 'Tulis ide kasar, pilih AI tujuan dan nada. Hasilnya prompt dengan Peran, Konteks, Tugas, Batasan, dan Format Keluaran.',
    backend: 'POST /api/ai/generate',
    backendReady: true
  },
  {
    id: 'image',
    path: 'image-to-prompt',
    label: 'Image-to-Prompt',
    icon: 'image',
    summary: 'Ubah gambar menjadi prompt yang detail.',
    detail: 'Unggah JPG, PNG, atau WEBP. Hasilnya memisahkan apa yang terlihat, preferensimu, dan dugaan yang tidak pasti.',
    backend: 'POST /api/ai/image-prompt',
    backendReady: true
  },
  {
    id: 'optimizer',
    path: 'optimizer',
    label: 'Optimizer',
    icon: 'sliders',
    summary: 'Perbaiki prompt tanpa mengubah maksudnya.',
    detail: 'Tempel prompt lama, lihat versi sebelum dan sesudah, lalu baca daftar perubahan yang dilakukan.',
    backend: 'POST /api/ai/optimize',
    backendReady: true
  },
  {
    id: 'analyzer',
    path: 'analyzer',
    label: 'Analyzer',
    icon: 'gauge',
    summary: 'Nilai kualitas prompt di lima aspek.',
    detail: 'Skor kejelasan, konteks, kespesifikan, struktur, dan batasan, lengkap dengan alasan dan saran perbaikan.',
    backend: 'POST /api/ai/analyze',
    backendReady: true
  },
  {
    id: 'expander',
    path: 'expander',
    label: 'Expander',
    icon: 'expand',
    summary: 'Kembangkan ide pendek menjadi instruksi lengkap.',
    detail: 'Pilih tingkat kedalaman dan bahasa. Bagian yang butuh datamu ditandai dengan slot.',
    backend: 'POST /api/ai/expand',
    backendReady: true
  },
  {
    id: 'translator',
    path: 'translator',
    label: 'Translator',
    icon: 'languages',
    summary: 'Terjemahkan prompt Indonesia dan Inggris.',
    detail: 'Struktur, kode, dan istilah teknis tetap utuh. Arah terjemahan bisa dibalik.',
    backend: 'POST /api/ai/translate',
    backendReady: true
  },
  {
    id: 'assistant',
    path: 'assistant',
    label: 'Assistant',
    icon: 'chat',
    summary: 'Susun prompt lewat percakapan.',
    detail: 'Asisten bertanya balik sampai kebutuhanmu jelas, lalu mengirim prompt final ke Workspace.',
    backend: 'POST /api/ai/chat',
    backendReady: true
  }
];

export const USAGE_LABELS = {
  generator: 'Prompt Generator',
  image: 'Image-to-Prompt',
  optimizer: 'Optimizer',
  analyzer: 'Analyzer',
  expander: 'Expander',
  translator: 'Translator',
  assistant: 'Assistant',
  library: 'Template Library'
};

export const HISTORY_LABELS = {
  library: 'Template',
  workspace: 'Workspace',
  generator: 'Generator',
  image: 'Image-to-Prompt',
  optimizer: 'Optimizer',
  analyzer: 'Analyzer',
  expander: 'Expander',
  translator: 'Translator',
  assistant: 'Assistant'
};

export function featureByPath(path) {
  return AI_FEATURES.find((feature) => feature.path === path) || null;
}
