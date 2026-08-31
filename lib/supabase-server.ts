import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://qnjudthpwswzvklokioi.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFuanVkdGhwd3N3enZrbG9raW9pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYwODAzNTEsImV4cCI6MjEwMTY1NjM1MX0.Eqpjs0gIC2pl6qFGl1i4AJy6Jgb9TXUwCqzD8fs_7Ck';

export function createSupabaseServerClient() {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    async accessToken() {
      return (await auth()).getToken();
    },
  });
}
