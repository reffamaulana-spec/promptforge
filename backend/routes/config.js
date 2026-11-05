const express = require('express');
const env = require('../config/env');

const router = express.Router();

router.get('/', (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({
    supabase: env.supabase.configured ? { url: env.supabase.url, anonKey: env.supabase.anonKey } : null
  });
});

module.exports = router;
