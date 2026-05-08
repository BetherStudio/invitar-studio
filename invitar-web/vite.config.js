import { defineConfig } from 'vite'
export default defineConfig({
  build: {
    rollupOptions: {
      external: ['@supabase/supabase-js']
    }
  }
})
