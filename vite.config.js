import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => {
  const envDir = path.resolve(__dirname, './server');
  
  const env = loadEnv(mode, envDir, '');
  
  const backendPort = env.PORT ?? 3001;

  return {
    plugins: [react()],
    
    envDir: envDir,

    envPrefix: ['VITE_', 'OPENWEATHER_'],

    server: {
      proxy: {
        '/api': {
          target: `http://localhost:${backendPort}`,
          changeOrigin: true,
        },
      },
    },
  };
});