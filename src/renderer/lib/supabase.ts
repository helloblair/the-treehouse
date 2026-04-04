import { createClient } from '@supabase/supabase-js'

// @ts-ignore - import.meta.env is a Vite feature, resolved at build time
const supabaseUrl = (import.meta.env?.VITE_SUPABASE_URL as string) ?? ''
// @ts-ignore - import.meta.env is a Vite feature, resolved at build time
const supabaseAnonKey = (import.meta.env?.VITE_SUPABASE_ANON_KEY as string) ?? ''

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null
