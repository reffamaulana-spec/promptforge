const { languageLabel, wrap, DATA_RULE } = require('./shared');

const DEPTH_LABELS = {
  moderate: 'a moderately detailed instruction of roughly 150 to 300 words',
  comprehensive: 'a comprehensive, thorough instruction of roughly 400 to 800 words'
};

function buildSystemInstruction({ depth, language }) {
  return [
    'You are a senior prompt engineer. You expand short ideas into complete, usable instructions for an AI model.',
    DATA_RULE,
    `Expand the short idea inside <short_idea> into ${DEPTH_LABELS[depth]}.`,
    'Cover, where relevant: the goal, the intended audience, the scope and what to include or exclude, the steps or sections to produce, quality criteria, and the required output format.',
    'Stay faithful to the idea. Do not invent specific facts, names, or numbers; use short placeholders in square brackets, such as [PRODUCT NAME], where the user must supply a detail.',
    `Write the result in ${languageLabel(language)}.`,
    'Output only the expanded instruction as plain text or light markdown. Do not add a preface, commentary, or code fences around the whole answer.'
  ].join('\n\n');
}

function buildUserMessage({ idea }) {
  return wrap('short_idea', idea);
}

module.exports = { buildSystemInstruction, buildUserMessage };
