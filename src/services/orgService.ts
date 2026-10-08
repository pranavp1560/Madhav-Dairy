import { supabase } from '../lib/supabase';

let cachedOrgId: string | null = null;

/**
 * Dynamically resolves the effective organization ID for the authenticated session.
 * First checks authenticated user's profile organization_id.
 * Falls back to the primary active organization from Supabase.
 */
export async function getEffectiveOrgId(): Promise<string> {
  if (cachedOrgId) return cachedOrgId;

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.id) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .maybeSingle();

      if (profile?.organization_id) {
        cachedOrgId = String(profile.organization_id);
        return cachedOrgId;
      }
    }
  } catch (err) {
    console.warn('Unable to load organization ID from authenticated profile:', err);
  }

  // Fallback: Query active organization record directly
  try {
    const { data: org } = await supabase
      .from('organizations')
      .select('id')
      .eq('is_active', true)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (org?.id) {
      cachedOrgId = String(org.id);
      return cachedOrgId;
    }
  } catch (err) {
    console.warn('Unable to load organization ID from organizations table:', err);
  }

  // Fallback default organization UUID
  return '00000000-0000-0000-0000-000000000001';
}

export function clearOrgCache(): void {
  cachedOrgId = null;
}
