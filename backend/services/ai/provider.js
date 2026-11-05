const env = require('../../config/env');
const { AppError } = require('../../utils/AppError');
const { GeminiProvider } = require('./gemini');

const factories = {
  gemini: () => new GeminiProvider(env.gemini)
};

let instance = null;

function getProvider() {
  if (!instance) {
    const factory = factories[env.aiProvider];
    if (!factory) {
      throw new AppError(
        500,
        'AI_PROVIDER_UNKNOWN',
        `AI_PROVIDER "${env.aiProvider}" tidak dikenal. Provider tersedia: ${Object.keys(factories).join(', ')}.`
      );
    }
    instance = factory();
  }
  return instance;
}

function setProvider(provider) {
  instance = provider;
}

module.exports = { getProvider, setProvider };
