import { supabase } from './supabase';

// ─────────────────────────────────────────────────────────────
// Account self-service: change password / username, delete account.
// Used by the Settings screen.
// ─────────────────────────────────────────────────────────────

// Change the signed-in user's password. Supabase enforces its own minimum, but
// we guard a sane floor client-side for a friendlier message.
export async function updatePassword(newPassword: string): Promise<void> {
  if (newPassword.length < 6) throw new Error('Password must be at least 6 characters.');
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw new Error(error.message);
}

// Change the user's username (public.users row). Same rules as the initial
// UsernameScreen: 3+ chars, unique. Maps the unique-violation to a friendly
// message. Caller should refreshProfile() afterward so the UI updates.
export async function updateUsername(userId: string, username: string): Promise<void> {
  const clean = username.trim();
  if (clean.length < 3) throw new Error('Username must be at least 3 characters.');
  const { error } = await supabase
    .from('users')
    .update({ username: clean })
    .eq('id', userId);
  if (error) {
    throw new Error(error.code === '23505' ? 'That username is taken. Try another.' : error.message);
  }
}

// Delete the caller's own account via the security-definer RPC (migration
// 0014). Cascades remove all their data. The caller should sign out afterward.
export async function deleteOwnAccount(): Promise<void> {
  const { error } = await supabase.rpc('delete_own_account');
  if (error) throw new Error(error.message);
}
