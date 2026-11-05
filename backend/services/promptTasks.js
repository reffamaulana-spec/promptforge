const { AppError } = require('../utils/AppError');
const { getProvider } = require('./ai/provider');
const generator = require('./prompts/generator');
const optimizer = require('./prompts/optimizer');
const analyzer = require('./prompts/analyzer');
const expander = require('./prompts/expander');
const translator = require('./prompts/translator');
const imagePrompt = require('./prompts/imagePrompt');
const assistant = require('./prompts/assistant');

const ANALYSIS_DISCLAIMER =
  'Skor ini bersifat heuristik: penilaian dari model AI berdasarkan kriteria umum, bukan pengukuran objektif yang berlaku universal. Hasilnya bisa berbeda antar-percobaan dan antar-model, jadi gunakan sebagai panduan perbaikan, bukan nilai mutlak.';

function stripCodeFence(text) {
  const match = String(text).trim().match(/^```[a-zA-Z0-9_-]*\s*\n([\s\S]*?)\n?```$/);
  return match ? match[1].trim() : String(text).trim();
}

function invalidResponse() {
  return new AppError(
    502,
    'AI_INVALID_RESPONSE',
    'AI mengembalikan format yang tidak bisa dibaca. Coba jalankan lagi.'
  );
}

function parseJsonObject(text) {
  const cleaned = stripCodeFence(text);
  try {
    const parsed = JSON.parse(cleaned);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
  } catch (error) {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start !== -1 && end > start) {
      try {
        const parsed = JSON.parse(cleaned.slice(start, end + 1));
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
      } catch (innerError) {
        throw invalidResponse();
      }
    }
  }
  throw invalidResponse();
}

function meta(result) {
  return { model: result.model, usage: result.usage };
}

function cleanString(value, max = 2000) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function cleanStringList(value, limit, max = 500) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => cleanString(item, max))
    .filter(Boolean)
    .slice(0, limit);
}

async function generatePrompt(input) {
  const result = await getProvider().generateText({
    prompt: generator.buildUserMessage(input),
    systemInstruction: generator.buildSystemInstruction(input),
    temperature: 0.7,
    maxOutputTokens: 4096
  });
  return {
    result: { prompt: stripCodeFence(result.text) },
    meta: meta(result)
  };
}

async function optimizePrompt(input) {
  const result = await getProvider().generateText({
    prompt: optimizer.buildUserMessage(input),
    systemInstruction: optimizer.buildSystemInstruction(input),
    temperature: 0.3,
    maxOutputTokens: 4096,
    json: true
  });

  const parsed = parseJsonObject(result.text);
  const optimized = cleanString(parsed.optimizedPrompt, 20000);
  if (!optimized) throw invalidResponse();

  const changes = (Array.isArray(parsed.changes) ? parsed.changes : [])
    .map((change) => {
      const description = cleanString(change && change.description, 400);
      if (!description) return null;
      const category = optimizer.CATEGORIES.includes(change.category) ? change.category : 'other';
      return { category, description };
    })
    .filter(Boolean)
    .slice(0, 10);

  return {
    result: {
      original: input.prompt,
      optimized,
      changes,
      preservedIntent: cleanString(parsed.preservedIntent, 500)
    },
    meta: meta(result)
  };
}

async function analyzePrompt(input) {
  const result = await getProvider().generateText({
    prompt: analyzer.buildUserMessage(input),
    systemInstruction: analyzer.buildSystemInstruction(input),
    temperature: 0.2,
    maxOutputTokens: 4096,
    json: true
  });

  const parsed = parseJsonObject(result.text);
  const rawScores = parsed.scores && typeof parsed.scores === 'object' ? parsed.scores : null;
  if (!rawScores) throw invalidResponse();

  const scores = {};
  let total = 0;
  for (const dimension of analyzer.DIMENSIONS) {
    const entry = rawScores[dimension];
    const value = Number(entry && entry.score);
    if (!entry || !Number.isFinite(value)) throw invalidResponse();
    const score = Math.round(Math.min(10, Math.max(0, value)) * 10) / 10;
    scores[dimension] = { score, explanation: cleanString(entry.explanation, 600) };
    total += score;
  }

  const suggestions = (Array.isArray(parsed.suggestions) ? parsed.suggestions : [])
    .map((item) => {
      const text = cleanString(item && item.text, 500);
      if (!text) return null;
      const priority = ['high', 'medium', 'low'].includes(item.priority) ? item.priority : 'medium';
      return { priority, text };
    })
    .filter(Boolean)
    .slice(0, 6);

  return {
    result: {
      scores,
      overall: Math.round((total / analyzer.DIMENSIONS.length) * 10) / 10,
      strengths: cleanStringList(parsed.strengths, 4),
      suggestions,
      disclaimer: ANALYSIS_DISCLAIMER
    },
    meta: meta(result)
  };
}

async function expandPrompt(input) {
  const result = await getProvider().generateText({
    prompt: expander.buildUserMessage(input),
    systemInstruction: expander.buildSystemInstruction(input),
    temperature: 0.7,
    maxOutputTokens: 4096
  });
  return {
    result: { expanded: stripCodeFence(result.text) },
    meta: meta(result)
  };
}

async function translatePrompt(input) {
  const result = await getProvider().generateText({
    prompt: translator.buildUserMessage(input),
    systemInstruction: translator.buildSystemInstruction(input),
    temperature: 0.2,
    maxOutputTokens: 8192
  });
  return {
    result: { translation: stripCodeFence(result.text), direction: input.direction },
    meta: meta(result)
  };
}

async function chatAssistant(input) {
  const result = await getProvider().generateText({
    prompt: assistant.buildUserMessage(input),
    systemInstruction: assistant.buildSystemInstruction(input),
    temperature: 0.6,
    maxOutputTokens: 4096,
    json: true
  });

  const parsed = parseJsonObject(result.text);
  const reply = cleanString(parsed.reply, 4000);
  const finalPrompt = cleanString(parsed.finalPrompt, 20000);
  if (!reply && !finalPrompt) throw invalidResponse();

  return {
    result: { reply: reply || 'Berikut prompt-nya.', prompt: finalPrompt },
    meta: meta(result)
  };
}

async function imageToPrompt({ image, preferences, language }) {
  const result = await getProvider().generateWithImage({
    prompt: imagePrompt.buildUserMessage({ preferences }),
    image,
    systemInstruction: imagePrompt.buildSystemInstruction({ target: preferences.target, language }),
    temperature: 0.4,
    maxOutputTokens: 4096,
    json: true
  });

  const parsed = parseJsonObject(result.text);
  const rawObserved = parsed.observed && typeof parsed.observed === 'object' ? parsed.observed : {};
  const finalPrompt = cleanString(parsed.finalPrompt, 8000);
  if (!finalPrompt) throw invalidResponse();

  const observed = {
    subject: cleanString(rawObserved.subject, 600),
    objects: cleanStringList(rawObserved.objects, 15, 200),
    scene: cleanString(rawObserved.scene, 600),
    composition: cleanString(rawObserved.composition, 600),
    cameraAngle: cleanString(rawObserved.cameraAngle, 300),
    lighting: cleanString(rawObserved.lighting, 400),
    colors: cleanStringList(rawObserved.colors, 12, 100),
    atmosphere: cleanString(rawObserved.atmosphere, 400),
    textures: cleanStringList(rawObserved.textures, 12, 150),
    visualStyle: cleanString(rawObserved.visualStyle, 400)
  };

  const inferences = (Array.isArray(parsed.inferences) ? parsed.inferences : [])
    .map((item) => {
      const detail = cleanString(item && item.detail, 400);
      if (!detail) return null;
      return {
        detail,
        confidence: item.confidence === 'medium' ? 'medium' : 'low',
        reason: cleanString(item.reason, 400)
      };
    })
    .filter(Boolean)
    .slice(0, 8);

  return {
    result: {
      observed,
      preferences: { ...preferences, language },
      inferences,
      prompt: finalPrompt,
      negativePrompt: cleanString(parsed.negativePrompt, 2000)
    },
    meta: meta(result)
  };
}

module.exports = {
  chatAssistant,
  imageToPrompt,
  generatePrompt,
  optimizePrompt,
  analyzePrompt,
  expandPrompt,
  translatePrompt,
  ANALYSIS_DISCLAIMER
};
