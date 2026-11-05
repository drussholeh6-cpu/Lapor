const { createClient } = require('@supabase/supabase-js');

function getSupabaseConfig() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    const error = new Error('SUPABASE_URL is required.');
    error.code = 'SUPABASE_CONFIG_MISSING';
    throw error;
  }

  if (!supabaseAnonKey && !supabaseServiceRoleKey) {
    const error = new Error('Set SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY in environment.');
    error.code = 'SUPABASE_CONFIG_MISSING';
    throw error;
  }

  return { supabaseUrl, supabaseAnonKey, supabaseServiceRoleKey };
}

function createSupabaseClient({ serviceRole = false, requireServiceRole = false } = {}) {
  const { supabaseUrl, supabaseAnonKey, supabaseServiceRoleKey } = getSupabaseConfig();
  
  const key = serviceRole 
    ? (supabaseServiceRoleKey || supabaseAnonKey) 
    : (supabaseAnonKey || supabaseServiceRoleKey);

  if (!key) {
    const error = new Error('Supabase key is missing. Set SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY.');
    error.code = 'SUPABASE_CONFIG_MISSING';
    throw error;
  }

  if (requireServiceRole && !supabaseServiceRoleKey) {
    const error = new Error('SUPABASE_SERVICE_ROLE_KEY is required for service-role operations.');
    error.code = 'SUPABASE_CONFIG_MISSING';
    throw error;
  }

  return createClient(supabaseUrl, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

// Caching instance untuk mencegah pembuatan client berulang (Singleton Pattern)
let cachedSupabaseAuth = null;
let cachedSupabaseAdmin = null;

function supabaseAuth() {
  if (!cachedSupabaseAuth) {
    cachedSupabaseAuth = createSupabaseClient({ serviceRole: false });
  }
  return cachedSupabaseAuth;
}

function supabaseAdmin() {
  if (!cachedSupabaseAdmin) {
    cachedSupabaseAdmin = createSupabaseClient({ serviceRole: true, requireServiceRole: true });
  }
  return cachedSupabaseAdmin;
}

module.exports = {
  createSupabaseClient,
  supabaseAuth,
  supabaseAdmin,
};
