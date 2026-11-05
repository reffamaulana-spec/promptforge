const { AppError } = require('../utils/AppError');
const { getProvider } = require('../services/ai/provider');

function requireAi(req, res, next) {
  try {
    const provider = getProvider();
    if (!provider.isConfigured) {
      return next(new AppError(503, 'AI_NOT_CONFIGURED', provider.setupMessage));
    }
    return next();
  } catch (error) {
    return next(error);
  }
}

module.exports = { requireAi };
