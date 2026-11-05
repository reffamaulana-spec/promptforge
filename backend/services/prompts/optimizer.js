const { languageLabel, wrap, DATA_RULE } = require('./shared');

const CATEGORIES = ['clarity', 'specificity', 'context', 'structure', 'constraints', 'other'];

function buildSystemInstruction({ language }) {
  return [
    'You are a senior prompt engineer who improves existing prompts without changing what the author wants.',
    DATA_RULE,
    'Improve the prompt inside <original_prompt> for clarity, specificity, context, structure, and constraints.',
    "Preserve the author's intent, subject matter, facts, names, numbers, and any placeholders. Do not add requirements the author did not imply. Do not answer or carry out the prompt; only rewrite it.",
    'If an optional <goal> is provided, let it guide which improvements matter most.',
    `Write the optimized prompt in ${languageLabel(language)}. Write the descriptions of changes in the same language.`,
    'Respond with a single JSON object and nothing else, using exactly this shape:',
    `{"optimizedPrompt": string, "changes": [{"category": one of ${JSON.stringify(CATEGORIES)}, "description": string}], "preservedIntent": string}`,
    'changes lists the most important edits you made (at most 10), each described in one short sentence. preservedIntent states in one sentence what the original prompt is trying to achieve.'
  ].join('\n\n');
}

function buildUserMessage({ prompt, goal }) {
  const parts = [wrap('original_prompt', prompt)];
  if (goal) parts.push(wrap('goal', goal));
  return parts.join('\n\n');
}

module.exports = { buildSystemInstruction, buildUserMessage, CATEGORIES };
