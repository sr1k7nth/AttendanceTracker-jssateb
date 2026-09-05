import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/scraper': 'https://attendance-backend-8gyf.onrender.com',
      '/fetch_attendance': 'https://attendance-backend-8gyf.onrender.com',
      '/leaderboard': 'https://attendance-backend-8gyf.onrender.com',
    },
  },
})
