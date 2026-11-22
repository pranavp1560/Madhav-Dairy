import { supabase } from '../lib/supabase';
import { getEffectiveOrgId } from './orgService';

export interface BusinessSettings {
  companyName: string;
  gstin: string;
  fssai: string;
  address: string;
  bankAccount: string;
  phone?: string;
  email?: string;
}

export const DEFAULT_BUSINESS_SETTINGS: BusinessSettings = {
  companyName: 'Madhav Dairy Private Limited',
  gstin: '27AAACM4401N1Z2',
  fssai: '11522036000492',
  address: 'Plot No. 42, Shirwal Industrial Dairy Zone, Pune-Satara Highway, Maharashtra - 412801',
  bankAccount: '50200088912345 (HDFC Bank, Kothrud Branch, IFSC: HDFC0001234)',
  phone: '+91 20 2544 8800',
  email: 'contact@madhavdairy.com',
};

const STORAGE_KEY = 'madhav_dairy_business_settings_v1';

export const settingsService = {
  /**
   * Synchronously loads the cached settings from localStorage for instant initial rendering.
   */
  getInitialSettings(): BusinessSettings {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          ...DEFAULT_BUSINESS_SETTINGS,
          ...parsed,
        };
      }
    } catch (err) {
      console.warn('Failed to parse cached business settings:', err);
    }
    return DEFAULT_BUSINESS_SETTINGS;
  },

  /**
   * Loads settings from Supabase organizations table, merging with localStorage.
   */
  async fetchSettings(): Promise<BusinessSettings> {
    const cached = this.getInitialSettings();

    try {
      const orgId = await getEffectiveOrgId();
      const { data, error } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', orgId)
        .maybeSingle();

      if (data && !error) {
        const remoteSettings: Partial<BusinessSettings> = {};
        if (data.legal_name || data.name) remoteSettings.companyName = data.legal_name || data.name;
        if (data.gstin) remoteSettings.gstin = data.gstin;
        if (data.fssai_number) remoteSettings.fssai = data.fssai_number;
        if (data.address) remoteSettings.address = data.address;
        if (data.phone) remoteSettings.phone = data.phone;
        if (data.email) remoteSettings.email = data.email;

        const merged: BusinessSettings = {
          ...cached,
          ...remoteSettings,
        };

        // Update localStorage with merged source of truth
        localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
        return merged;
      }
    } catch (err) {
      console.warn('Failed to query organization record from Supabase, keeping cached values:', err);
    }

    return cached;
  },

  /**
   * Persists settings to localStorage and updates Supabase organizations table.
   */
  async saveSettings(updated: Partial<BusinessSettings>): Promise<BusinessSettings> {
    const current = this.getInitialSettings();
    const merged: BusinessSettings = {
      ...current,
      ...updated,
    };

    // 1. Immediately persist to localStorage for instant local durability across refreshes
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    } catch (err) {
      console.warn('Failed to write business settings to localStorage:', err);
    }

    // 2. Persist to Supabase organizations table
    try {
      const orgId = await getEffectiveOrgId();
      const payload: Record<string, any> = {
        name: merged.companyName,
        legal_name: merged.companyName,
        gstin: merged.gstin,
        fssai_number: merged.fssai,
        address: merged.address,
        updated_at: new Date().toISOString(),
      };
      if (merged.phone) payload.phone = merged.phone;
      if (merged.email) payload.email = merged.email;

      const { error } = await supabase
        .from('organizations')
        .update(payload)
        .eq('id', orgId);

      if (error) {
        console.warn('Supabase organization update notice:', error.message);
      }
    } catch (err) {
      console.warn('Supabase organization update error:', err);
    }

    return merged;
  },
};
