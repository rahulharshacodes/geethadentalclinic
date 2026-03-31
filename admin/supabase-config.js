import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const supabaseUrl = "https://njxoxiirdpfhxxtmrkci.supabase.co";
const supabaseKey = "sb_publishable_yKryW-vuqCcOUx2ULTO4XA_ErDKBCCx";

const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
        storage: window.sessionStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
    }
});

export { supabase };
