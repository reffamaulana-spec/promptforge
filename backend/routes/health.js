const express = require('express');
const env = require('../config/env');
const { getProvider } = require('../services/ai/provider');

const router = express.Router();

router.get('/', (req, res, next) => {
  try {
    const provider = getProvider();
    const configured = provider.isConfigured;

    res.json({
      status: 'ok',
      time: new Date().toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
      ai: {
        provider: provider.name,
        configured,
        model: configured ? provider.model : null,
        setupMessage: configured ? null : provider.setupMessage
      },
      auth: { configured: env.supabase.configured },
      limits: {
        maxImageMb: Math.round(env.limits.maxImageBytes / (1024 * 1024)),
        aiRequestsPerWindow: env.limits.aiMax,
        aiWindowSeconds: Math.round(env.limits.aiWindowMs / 1000)
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
