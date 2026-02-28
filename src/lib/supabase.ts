import { createClient } from '@supabase/supabase-js';

const DEFAULT_URL = 'https://rwlpgrdrqahgovqpprzn.supabase.co';
const DEFAULT_KEY = 'sb_publishable_09KK_ds3brpe-QELRXum8A_Bikt5rEo';

// Helper to validate URL
const isValidUrl = (url: string) => {
  try {
    new URL(url);
    return url.startsWith('http');
  } catch {
    return false;
  }
};

const envUrl = import.meta.env.VITE_SUPABASE_URL;
const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Use env if valid, otherwise fallback to hardcoded defaults
const supabaseUrl = (envUrl && isValidUrl(envUrl)) ? envUrl : DEFAULT_URL;
const supabaseAnonKey = (envKey && envKey.length > 10) ? envKey : DEFAULT_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
