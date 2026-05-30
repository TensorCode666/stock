import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const EM_HEADERS = {
  Referer: 'https://quote.eastmoney.com/',
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
};

const emProxy = {
  '/api/em': {
    target: 'https://push2.eastmoney.com',
    changeOrigin: true,
    secure: false,
    headers: EM_HEADERS,
    rewrite: (path: string) => path.replace(/^\/api\/em/, ''),
  },
  '/api/smartbox': {
    target: 'https://smartbox.gtimg.cn',
    changeOrigin: true,
    secure: false,
    rewrite: (path: string) => path.replace(/^\/api\/smartbox/, ''),
  },
  '/api/em-search': {
    target: 'https://searchapi.eastmoney.com',
    changeOrigin: true,
    secure: false,
    headers: EM_HEADERS,
    rewrite: (path: string) => path.replace(/^\/api\/em-search/, ''),
  },
  '/api/em-his': {
    target: 'https://push2his.eastmoney.com',
    changeOrigin: true,
    secure: false,
    headers: EM_HEADERS,
    rewrite: (path: string) => path.replace(/^\/api\/em-his/, ''),
  },
  '/api/qt': {
    target: 'https://qt.gtimg.cn',
    changeOrigin: true,
    secure: false,
    rewrite: (path: string) => path.replace(/^\/api\/qt/, ''),
  },
  '/api/qq': {
    target: 'https://web.ifzq.gtimg.cn',
    changeOrigin: true,
    secure: false,
    rewrite: (path: string) => path.replace(/^\/api\/qq/, ''),
  },
  '/api/sina': {
    target: 'https://vip.stock.finance.sina.com.cn',
    changeOrigin: true,
    secure: false,
    headers: {
      Referer: 'https://finance.sina.com.cn',
      'User-Agent': EM_HEADERS['User-Agent'],
    },
    rewrite: (path: string) => path.replace(/^\/api\/sina/, ''),
  },
}

// https://vite.dev/config/
export default defineConfig({
  /** GitHub Pages 部署时设为 /stock/；本地开发默认 / */
  base: process.env.VITE_BASE || '/',
  plugins: [react()],
  server: { proxy: emProxy },
  preview: { proxy: emProxy },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('lightweight-charts')) return 'lightweight-charts';
          if (id.includes('node_modules/react-router')) return 'router';
        },
      },
    },
  },
})
