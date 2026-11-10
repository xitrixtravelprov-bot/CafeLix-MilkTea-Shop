import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://cqkeduifsqcjlqthlvbp.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_dpRn1H_a7HDLsDDehcyp3g_OQ9mfzCe";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
