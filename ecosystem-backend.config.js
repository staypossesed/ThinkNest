/**
 * PM2 config для backend (Fastify) — полный стек с Google, Stripe, Supabase.
 * Использование: pm2 start ecosystem-backend.config.js
 */
module.exports = {
  apps: [
    {
      name: "thinknest-backend",
      script: "dist/index.js",
      cwd: __dirname + "/backend",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "500M",
      env: {
        NODE_ENV: "production"
      }
    }
  ]
};
