import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const API_URL = 'http://127.0.0.1:8000';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/scraper': API_URL,
      '/fetch_attendance': API_URL,
      '/leaderboard': API_URL,
      '/supporters': API_URL,
      '/donations': API_URL,
      '/admin': API_URL,
    },
  },
})
