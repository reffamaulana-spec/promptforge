const express = require('express');
const { aiLimiter } = require('../middleware/rateLimit');
const { requireAi } = require('../middleware/requireAi');
const { requireAuth } = require('../middleware/requireAuth');
const { asyncHandler } = require('../utils/asyncHandler');
const { ensureObject, readText, readEnum } = require('../utils/validate');
const { TARGET_LABELS, TONE_LABELS } = require('../services/prompts/generator');
const { DIRECTIONS } = require('../services/prompts/translator');
const imagePrompt = require('../services/prompts/imagePrompt');
const { uploadSingleImage } = require('../middleware/upload');
const { AppError } = require('../utils/AppError');
const { detectImageType } = require('../utils/imageSignature');
const tasks = require('../services/promptTasks');

const router = express.Router();

const MAX_IDEA = 2000;
const MAX_EXTRA = 2000;
const MAX_PROMPT = 8000;
const MAX_TRANSLATE = 8000;
const MAX_CHAT_MESSAGES = 20;
const MAX_CHAT_MESSAGE = 24000;

const LANGUAGES = ['auto', 'id', 'en'];
const ANALYSIS_LANGUAGES = ['id', 'en'];

router.use(requireAuth, aiLimiter, requireAi);

router.post(
  '/generate',
  asyncHandler(async (req, res) => {
    const body = ensureObject(req.body);
    const input = {
      idea: readText(body, 'idea', { label: 'Ide', max: MAX_IDEA, min: 3 }),
      extra: readText(body, 'extra', { label: 'Konteks tambahan', max: MAX_EXTRA, required: false }),
      target: readEnum(body, 'target', Object.keys(TARGET_LABELS), { label: 'Target AI', fallback: 'general' }),
      tone: readEnum(body, 'tone', Object.keys(TONE_LABELS), { label: 'Nada', fallback: 'professional' }),
      language: readEnum(body, 'language', LANGUAGES, { label: 'Bahasa', fallback: 'auto' })
    };
    const { result, meta } = await tasks.generatePrompt(input);
    res.json({ ok: true, result, meta });
  })
);

router.post(
  '/optimize',
  asyncHandler(async (req, res) => {
    const body = ensureObject(req.body);
    const input = {
      prompt: readText(body, 'prompt', { label: 'Prompt', max: MAX_PROMPT, min: 5 }),
      goal: readText(body, 'goal', { label: 'Tujuan optimasi', max: 500, required: false }),
      language: readEnum(body, 'language', LANGUAGES, { label: 'Bahasa', fallback: 'auto' })
    };
    const { result, meta } = await tasks.optimizePrompt(input);
    res.json({ ok: true, result, meta });
  })
);

router.post(
  '/analyze',
  asyncHandler(async (req, res) => {
    const body = ensureObject(req.body);
    const input = {
      prompt: readText(body, 'prompt', { label: 'Prompt', max: MAX_PROMPT, min: 5 }),
      language: readEnum(body, 'language', ANALYSIS_LANGUAGES, { label: 'Bahasa penjelasan', fallback: 'id' })
    };
    const { result, meta } = await tasks.analyzePrompt(input);
    res.json({ ok: true, result, meta });
  })
);

router.post(
  '/expand',
  asyncHandler(async (req, res) => {
    const body = ensureObject(req.body);
    const input = {
      idea: readText(body, 'idea', { label: 'Ide', max: MAX_IDEA, min: 3 }),
      depth: readEnum(body, 'depth', ['moderate', 'comprehensive'], { label: 'Kedalaman', fallback: 'comprehensive' }),
      language: readEnum(body, 'language', LANGUAGES, { label: 'Bahasa', fallback: 'auto' })
    };
    const { result, meta } = await tasks.expandPrompt(input);
    res.json({ ok: true, result, meta });
  })
);

router.post(
  '/translate',
  asyncHandler(async (req, res) => {
    const body = ensureObject(req.body);
    const input = {
      text: readText(body, 'text', { label: 'Teks', max: MAX_TRANSLATE }),
      direction: readEnum(body, 'direction', Object.keys(DIRECTIONS), { label: 'Arah terjemahan', fallback: 'id-en' })
    };
    const { result, meta } = await tasks.translatePrompt(input);
    res.json({ ok: true, result, meta });
  })
);

router.post(
  '/chat',
  asyncHandler(async (req, res) => {
    const body = ensureObject(req.body);
    if (!Array.isArray(body.messages) || body.messages.length === 0) {
      throw new AppError(400, 'INVALID_INPUT', 'Percakapan wajib berisi minimal satu pesan.', { field: 'messages' });
    }
    if (body.messages.length > MAX_CHAT_MESSAGES) {
      throw new AppError(400, 'INVALID_INPUT', `Percakapan maksimal ${MAX_CHAT_MESSAGES} pesan. Mulai percakapan baru.`, { field: 'messages' });
    }
    const messages = body.messages.map((message, index) => {
      const item = ensureObject(message);
      const role = readEnum(item, 'role', ['user', 'assistant'], { label: 'Peran pesan', fallback: '' });
      if (!role) throw new AppError(400, 'INVALID_INPUT', 'Setiap pesan wajib punya peran user atau assistant.', { field: `messages[${index}].role` });
      return { role, content: readText(item, 'content', { label: 'Isi pesan', max: MAX_CHAT_MESSAGE }) };
    });
    if (messages[messages.length - 1].role !== 'user') {
      throw new AppError(400, 'INVALID_INPUT', 'Pesan terakhir harus dari user.', { field: 'messages' });
    }
    const language = readEnum(body, 'language', LANGUAGES, { label: 'Bahasa', fallback: 'auto' });
    const { result, meta } = await tasks.chatAssistant({ messages, language });
    res.json({ ok: true, result, meta });
  })
);

router.post(
  '/image-prompt',
  uploadSingleImage,
  asyncHandler(async (req, res) => {
    const file = req.file;
    if (!file || !file.buffer || file.buffer.length === 0) {
      throw new AppError(400, 'IMAGE_REQUIRED', 'Gambar wajib diunggah pada field bernama "image".', { field: 'image' });
    }

    const detectedType = detectImageType(file.buffer);
    if (!detectedType) {
      throw new AppError(
        400,
        'INVALID_IMAGE',
        'Isi file bukan gambar JPG, PNG, atau WEBP yang valid.',
        { field: 'image' }
      );
    }

    const body = ensureObject(req.body || {});
    const preferences = {
      target: readEnum(body, 'target', Object.keys(imagePrompt.TARGETS), { label: 'Target', fallback: 'general' }),
      visualStyle: readEnum(body, 'visualStyle', imagePrompt.STYLES, { label: 'Gaya visual', fallback: 'auto' }),
      lighting: readEnum(body, 'lighting', imagePrompt.LIGHTING, { label: 'Pencahayaan', fallback: 'auto' }),
      camera: readEnum(body, 'camera', imagePrompt.CAMERAS, { label: 'Kamera', fallback: 'auto' }),
      aspectRatio: readEnum(body, 'aspectRatio', imagePrompt.ASPECT_RATIOS, { label: 'Rasio aspek', fallback: 'auto' }),
      notes: readText(body, 'notes', { label: 'Catatan', max: 500, required: false })
    };
    const language = readEnum(body, 'language', imagePrompt.IMAGE_LANGUAGES, { label: 'Bahasa', fallback: 'en' });

    const { result, meta } = await tasks.imageToPrompt({
      image: { mimeType: detectedType, data: file.buffer },
      preferences,
      language
    });

    res.json({
      ok: true,
      result: { ...result, image: { mimeType: detectedType, sizeBytes: file.size } },
      meta
    });
  })
);

module.exports = router;
