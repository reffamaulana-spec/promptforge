const { languageLabel, wrap, DATA_RULE } = require('./shared');

const TARGET_LABELS = {
  general: 'a general-purpose large language model',
  chatgpt: 'ChatGPT',
  claude: 'Claude',
  gemini: 'Gemini',
  coding: 'an AI coding assistant',
  image: 'a text-to-image model'
};

const TONE_LABELS = {
  professional: 'professional and precise',
  friendly: 'friendly and approachable',
  concise: 'direct and concise',
  creative: 'imaginative and expressive'
};

function buildSystemInstruction({ target, tone, language }) {
  return [
    "You are a senior prompt engineer. Your job is to turn a user's rough idea into a high-quality, ready-to-use prompt.",
    DATA_RULE,
    `The finished prompt will be given to ${TARGET_LABELS[target]}. Write it in a ${TONE_LABELS[tone]} tone.`,
    `Write the finished prompt in ${languageLabel(language)}.`,
    'Structure the prompt as a single block of markdown with exactly these five sections in this order: Role, Context, Task, Constraints, Output Format.',
    'Start each section with a level-2 markdown heading (for example "## Role"), and translate the heading words into the output language.',
    'Role: who the AI should act as. Context: the background and audience. Task: the concrete job, stated as clear steps when helpful. Constraints: a bulleted list of specific, checkable rules. Output Format: exactly how the answer must be structured.',
    'Do not invent facts about the user or their project. When a critical detail is missing, add a short placeholder in square brackets, such as [TARGET AUDIENCE], that the user can fill in.',
    'Output only the finished prompt. Do not add a preface, commentary, or code fences around the whole answer.'
  ].join('\n\n');
}

function buildUserMessage({ idea, extra }) {
  const parts = [wrap('user_idea', idea)];
  if (extra) parts.push(wrap('extra_context', extra));
  return parts.join('\n\n');
}

module.exports = { buildSystemInstruction, buildUserMessage, TARGET_LABELS, TONE_LABELS };
