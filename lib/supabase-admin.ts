import { createClient } from '@supabase/supabase-js'

// Server-side only — never imported by client components
export const supabaseAdmin = createClient(
  'https://nvsczfrljlovksrdyaix.supabase.co',
  process.env.SUPABASE_SERVICE_KEY!,
  {
    global: {
      fetch: (url, options = {}) =>
        fetch(url, { ...options, cache: 'no-store' }),
    },
  }
)
