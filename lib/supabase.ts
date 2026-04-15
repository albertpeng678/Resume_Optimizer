import { createClient } from '@supabase/supabase-js'

function requireEnv(key: string): string {
  const val = process.env[key]
  if (!val) throw new Error(`Missing required environment variable: ${key}`)
  return val
}

/**
 * Server-side Supabase client with service role key.
 * Creates a fresh instance per call (intentional - no module-level singleton with elevated permissions).
 * Use in Next.js API routes and server components only.
 */
export function createServerClient() {
  return createClient(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv('SUPABASE_SERVICE_ROLE_KEY')
  )
}

/**
 * Client-side Supabase client with anon key.
 * Lazy singleton - safe to import in browser components.
 * Do NOT call before environment variables are loaded in test contexts.
 */
let _anonClient: ReturnType<typeof createClient> | null = null
export function getSupabaseClient() {
  if (!_anonClient) {
    _anonClient = createClient(
      requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
      requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY')
    )
  }
  return _anonClient
}
