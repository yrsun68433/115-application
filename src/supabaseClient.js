import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

if (!isSupabaseConfigured) {
  // 不要在這裡 throw：createClient 遇到空字串會直接丟例外，
  // 若在 module 載入階段就丟出去，React 連掛載都還沒開始，畫面只會變成一片空白、
  // 使用者完全看不出原因。改成給一個安全的假網址，讓 App.jsx 可以在畫面上
  // 顯示清楚的中文提示，而不是靜默地變成空白頁。
  console.error(
    '缺少 VITE_SUPABASE_URL 或 VITE_SUPABASE_ANON_KEY，請確認 .env（本機）或 Vercel / Netlify 專案的環境變數已設定，並記得重新部署（Redeploy）。'
  )
}

export const supabase = createClient(
  isSupabaseConfigured ? supabaseUrl : 'https://placeholder.invalid',
  isSupabaseConfigured ? supabaseAnonKey : 'placeholder-anon-key'
)
