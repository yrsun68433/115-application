import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  // 在畫面上而非 console 提示，避免部署後忘記設定環境變數卻無感
  console.error(
    '缺少 VITE_SUPABASE_URL 或 VITE_SUPABASE_ANON_KEY，請確認 .env（本機）或 Netlify 環境變數（正式站台）已設定。'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
