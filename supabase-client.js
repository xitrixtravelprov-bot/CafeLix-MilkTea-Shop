import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://cqkeduifsqcjlqthlvbp.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_dpRn1H_a7HDLsDDehcyp3g_OQ9mfzCe";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const LOGIN_LOG_STORAGE_PREFIX = "cafelix-login-log-";

export async function recordLoginTimedate(user) {
  const { data, error } = await supabase.rpc("record_login_timedate");
  if (error) throw error;
  if (typeof data !== "string" || !data) {
    throw new Error("The database did not return a login log ID.");
  }
  sessionStorage.setItem(`${LOGIN_LOG_STORAGE_PREFIX}${user.id}`, data);
}

export async function ensureLoginTimedate(user) {
  if (sessionStorage.getItem(`${LOGIN_LOG_STORAGE_PREFIX}${user.id}`)) return;
  await recordLoginTimedate(user);
}

export async function recordLogoutTimedate(user) {
  const storageKey = `${LOGIN_LOG_STORAGE_PREFIX}${user.id}`;
  const loginLogId = sessionStorage.getItem(storageKey);
  if (!loginLogId) {
    throw new Error("No login log was found for this session.");
  }

  const { error } = await supabase.rpc("record_logout_timedate", {
    p_login_log_id: loginLogId,
  });
  if (error) throw error;
  sessionStorage.removeItem(storageKey);
}
