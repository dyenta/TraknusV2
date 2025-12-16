import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!

// Tanda seru (!) di akhir variable env memberitahu TS bahwa variable ini PASTI ada.
export const supabase = createClient(supabaseUrl, supabaseKey)