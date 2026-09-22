import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const API_URL = 'https://jatracker-api.foo.ng';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/scraper': API_URL,
      '/fetch_attendance': API_URL,
      '/leaderboard': API_URL,
    },
  },
})
