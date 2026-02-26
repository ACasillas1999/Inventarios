module.exports = {
  apps: [
    {
      name: 'inventarios-frontend',
      script: 'serve',
      env: {
        PM2_SERVE_PATH: './dist',
        PM2_SERVE_PORT: 5173,
        PM2_SERVE_SPA: 'true',
        PM2_SERVE_HOST: '0.0.0.0'
      }
    }
  ]
};
