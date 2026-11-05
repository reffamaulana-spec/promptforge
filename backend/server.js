const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');

const env = require('./config/env');
const { requestId } = require('./middleware/requestId');
const { apiLimiter } = require('./middleware/rateLimit');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const healthRouter = require('./routes/health');
const configRouter = require('./routes/config');
const aiRouter = require('./routes/ai');
const { getProvider } = require('./services/ai/provider');

const frontendDir = path.join(__dirname, '..', 'public');

function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', env.trustProxy);

  app.use(requestId);

  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          'default-src': ["'self'"],
          'script-src': ["'self'"],
          'style-src': ["'self'", 'https://fonts.googleapis.com'],
          'font-src': ["'self'", 'https://fonts.gstatic.com'],
          'img-src': ["'self'", 'data:', 'blob:'],
          'connect-src': ["'self'", ...(env.supabase.configured ? [env.supabase.url] : [])],
          'object-src': ["'none'"],
          'frame-ancestors': ["'none'"],
          'upgrade-insecure-requests': env.isProduction ? [] : null
        }
      }
    })
  );

  if (env.allowedOrigins.length > 0) {
    app.use(
      '/api',
      cors({
        origin(origin, callback) {
          if (!origin || env.allowedOrigins.includes(origin)) {
            return callback(null, true);
          }
          return callback(new Error('CORS_NOT_ALLOWED'));
        }
      })
    );
  }

  app.use(express.json({ limit: env.limits.jsonBody }));
  app.use('/api', apiLimiter);
  app.use('/api/health', healthRouter);
  app.use('/api/config', configRouter);
  app.use('/api/ai', aiRouter);

  app.use(express.static(frontendDir));

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

function start() {
  const app = createApp();
  const provider = getProvider();

  const server = app.listen(env.port, () => {
    console.log(`PROMPTFORGE berjalan di http://localhost:${env.port}`);
    if (provider.isConfigured) {
      console.log(`AI: ${provider.name} siap, model "${provider.model}".`);
    } else {
      console.warn(`AI: belum dikonfigurasi. ${provider.setupMessage}`);
      console.warn('Fitur non-AI tetap bisa dipakai.');
    }
  });

  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`Port ${env.port} sedang dipakai aplikasi lain. Ubah PORT di file .env atau hentikan aplikasi tersebut.`);
    } else {
      console.error(`Server gagal berjalan: ${error.message}`);
    }
    process.exit(1);
  });

  const shutdown = () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 5000).unref();
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  return server;
}

if (require.main === module) {
  start();
}

module.exports = { createApp };
