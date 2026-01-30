import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://khrzhzeqdbizbmqdwebw.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocnpoemVxZGJpemJtcWR3ZWJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk3MDE0ODMsImV4cCI6MjA4NTI3NzQ4M30.au0_SWWVZMKtU7uokYgV4gI-KZMf45rEBOe_tm1WtDE';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);