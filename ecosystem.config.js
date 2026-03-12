module.exports = {
  apps: [
    {
      name: "thinknest",
      script: "server/index.js",
      cwd: __dirname,
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
