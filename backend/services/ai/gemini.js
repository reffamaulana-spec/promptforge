const { GoogleGenAI } = require('@google/genai');
const { AppError } = require('../../utils/AppError');

const SETUP_MESSAGE =
  'GEMINI_API_KEY belum diatur. Salin .env.example menjadi .env, isi GEMINI_API_KEY dengan API key dari Google AI Studio, lalu restart server.';

function mapGeminiError(error) {
  if (error instanceof AppError) return error;

  const status = Number(error && error.status) || 0;
  const rawMessage = String((error && error.message) || '');
  const lowered = rawMessage.toLowerCase();
  const name = String((error && error.name) || '');

  if (name === 'AbortError' || lowered.includes('timeout') || lowered.includes('timed out')) {
    return new AppError(504, 'AI_TIMEOUT', 'Permintaan ke Gemini melewati batas waktu. Coba lagi sebentar lagi.');
  }
  if (lowered.includes('api key not valid') || lowered.includes('api_key_invalid') || status === 401 || status === 403) {
    return new AppError(
      502,
      'AI_AUTH_FAILED',
      'API key Gemini ditolak. Periksa GEMINI_API_KEY di file .env dan pastikan key masih aktif.'
    );
  }
  if (status === 404) {
    return new AppError(
      502,
      'AI_MODEL_NOT_FOUND',
      'Model Gemini tidak ditemukan atau tidak tersedia. Periksa GEMINI_MODEL dan jalankan npm run check:model.'
    );
  }
  if (status === 429) {
    return new AppError(429, 'AI_QUOTA_EXCEEDED', 'Kuota atau batas permintaan Gemini tercapai. Tunggu sebentar lalu coba lagi.');
  }
  if (status === 400) {
    return new AppError(
      400,
      'AI_BAD_REQUEST',
      'Gemini menolak permintaan ini. Periksa isi input atau gambar yang dikirim.'
    );
  }
  if (status >= 500 && status <= 599) {
    return new AppError(503, 'AI_UNAVAILABLE', 'Layanan Gemini sedang bermasalah. Coba lagi beberapa saat lagi.');
  }
  return new AppError(502, 'AI_REQUEST_FAILED', 'Permintaan ke Gemini gagal. Coba lagi.');
}

function toBase64(data) {
  if (Buffer.isBuffer(data)) return data.toString('base64');
  if (typeof data === 'string') return data;
  throw new AppError(400, 'INVALID_IMAGE', 'Data gambar tidak valid.');
}

class GeminiProvider {
  constructor({ apiKey, model, timeoutMs }) {
    this.name = 'gemini';
    this.model = model;
    this.timeoutMs = timeoutMs;
    this.apiKey = apiKey;
    this.client = null;
  }

  get isConfigured() {
    return Boolean(this.apiKey);
  }

  get setupMessage() {
    return SETUP_MESSAGE;
  }

  getClient() {
    if (!this.isConfigured) {
      throw new AppError(503, 'AI_NOT_CONFIGURED', SETUP_MESSAGE);
    }
    if (!this.client) {
      this.client = new GoogleGenAI({
        apiKey: this.apiKey,
        httpOptions: { timeout: this.timeoutMs }
      });
    }
    return this.client;
  }

  buildConfig({ systemInstruction, temperature, maxOutputTokens, json }) {
    const config = {
      temperature: typeof temperature === 'number' ? temperature : 0.7,
      maxOutputTokens: maxOutputTokens || 4096
    };
    if (systemInstruction) config.systemInstruction = systemInstruction;
    if (json) config.responseMimeType = 'application/json';
    return config;
  }

  extractResult(response) {
    const blockReason = response && response.promptFeedback && response.promptFeedback.blockReason;
    if (blockReason) {
      throw new AppError(422, 'AI_BLOCKED', 'Gemini memblokir permintaan ini berdasarkan kebijakan keamanannya. Ubah isi input lalu coba lagi.');
    }

    const text = response && typeof response.text === 'string' ? response.text.trim() : '';
    if (!text) {
      const finishReason = response && response.candidates && response.candidates[0] && response.candidates[0].finishReason;
      if (finishReason === 'MAX_TOKENS') {
        throw new AppError(502, 'AI_TRUNCATED', 'Respons Gemini terpotong sebelum selesai. Coba persingkat input.');
      }
      if (finishReason === 'SAFETY' || finishReason === 'PROHIBITED_CONTENT') {
        throw new AppError(422, 'AI_BLOCKED', 'Gemini menolak menghasilkan jawaban untuk input ini. Ubah isi input lalu coba lagi.');
      }
      throw new AppError(502, 'AI_EMPTY_RESPONSE', 'Gemini tidak mengembalikan teks. Coba lagi.');
    }

    const finishReason =
      response.candidates && response.candidates[0] && response.candidates[0].finishReason
        ? String(response.candidates[0].finishReason)
        : null;
    const usage = response.usageMetadata || null;
    return {
      text,
      model: this.model,
      finishReason,
      truncated: finishReason === 'MAX_TOKENS',
      usage: usage
        ? {
            promptTokens: usage.promptTokenCount || 0,
            outputTokens: usage.candidatesTokenCount || 0,
            totalTokens: usage.totalTokenCount || 0
          }
        : null
    };
  }

  async generate(contents, options) {
    const client = this.getClient();
    try {
      const response = await client.models.generateContent({
        model: this.model,
        contents,
        config: this.buildConfig(options)
      });
      return this.extractResult(response);
    } catch (error) {
      throw mapGeminiError(error);
    }
  }

  async generateText({ prompt, messages, ...options }) {
    let contents;
    if (Array.isArray(messages) && messages.length > 0) {
      contents = messages.map((message) => ({
        role: message.role === 'model' ? 'model' : 'user',
        parts: [{ text: String(message.text) }]
      }));
    } else if (typeof prompt === 'string' && prompt.trim()) {
      contents = [{ role: 'user', parts: [{ text: prompt }] }];
    } else {
      throw new AppError(400, 'INVALID_INPUT', 'Input teks kosong.');
    }
    return this.generate(contents, options);
  }

  async generateWithImage({ prompt, image, ...options }) {
    if (!image || !image.mimeType || !image.data) {
      throw new AppError(400, 'INVALID_IMAGE', 'Gambar tidak ditemukan pada permintaan.');
    }
    const contents = [
      {
        role: 'user',
        parts: [
          { text: String(prompt || '') },
          { inlineData: { mimeType: image.mimeType, data: toBase64(image.data) } }
        ]
      }
    ];
    return this.generate(contents, options);
  }

  async listModels() {
    const client = this.getClient();
    try {
      const pager = await client.models.list({ config: { pageSize: 100 } });
      const models = [];
      for await (const model of pager) {
        models.push({
          name: String(model.name || '').replace(/^models\//, ''),
          displayName: model.displayName || null,
          supportedActions: model.supportedActions || []
        });
      }
      return models;
    } catch (error) {
      throw mapGeminiError(error);
    }
  }
}

module.exports = { GeminiProvider, mapGeminiError, SETUP_MESSAGE };
