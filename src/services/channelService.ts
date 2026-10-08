import { supabase } from '../lib/supabase';
import { SalesChannel } from '../types/dairy';
import { getEffectiveOrgId } from './orgService';

export const channelService = {
  async fetchSalesChannels(): Promise<SalesChannel[]> {
    const { data: channels, error: cErr } = await supabase
      .from('sales_channels')
      .select('*')
      .order('name');

    if (cErr) throw cErr;

    // Fetch counts of associated customers and prices
    const { data: customerCounts } = await supabase
      .from('customers')
      .select('sales_channel_id');

    const { data: priceCounts } = await supabase
      .from('product_channel_prices')
      .select('channel_id');

    const custMap: Record<string, number> = {};
    if (customerCounts) {
      customerCounts.forEach((c: any) => {
        if (c.sales_channel_id) {
          custMap[c.sales_channel_id] = (custMap[c.sales_channel_id] || 0) + 1;
        }
      });
    }

    const priceMap: Record<string, number> = {};
    if (priceCounts) {
      priceCounts.forEach((p: any) => {
        if (p.channel_id) {
          priceMap[p.channel_id] = (priceMap[p.channel_id] || 0) + 1;
        }
      });
    }

    return (channels || []).map((ch: any): SalesChannel => ({
      id: ch.id,
      name: ch.name,
      code: ch.code,
      description: ch.description || '',
      isActive: ch.is_active,
      customerCount: custMap[ch.id] || 0,
      pricingCount: priceMap[ch.id] || 0,
      createdAt: ch.created_at,
      updatedAt: ch.updated_at,
    }));
  },

  async createSalesChannel(data: {
    name: string;
    code: string;
    description?: string;
  }): Promise<SalesChannel> {
    const cleanName = data.name.trim();
    const cleanCode = data.code.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_');

    if (!cleanName) throw new Error('Sales channel name is required');
    if (!cleanCode) throw new Error('Sales channel code is required');

    // Duplicate check
    const { data: existing } = await supabase
      .from('sales_channels')
      .select('id, name, code')
      .or(`name.ilike.${cleanName},code.ilike.${cleanCode}`)
      .maybeSingle();

    if (existing) {
      if (existing.code.toUpperCase() === cleanCode) {
        throw new Error(`A channel with code "${cleanCode}" already exists.`);
      }
      throw new Error(`A channel named "${cleanName}" already exists.`);
    }

    const orgId = await getEffectiveOrgId();

    const { data: newChannel, error } = await supabase
      .from('sales_channels')
      .insert({
        organization_id: orgId,
        name: cleanName,
        code: cleanCode,
        description: data.description?.trim() || null,
        is_active: true,
      })
      .select()
      .single();

    if (error) throw error;

    return {
      id: newChannel.id,
      name: newChannel.name,
      code: newChannel.code,
      description: newChannel.description || '',
      isActive: newChannel.is_active,
      customerCount: 0,
      pricingCount: 0,
      createdAt: newChannel.created_at,
      updatedAt: newChannel.updated_at,
    };
  },

  async updateSalesChannel(id: string, data: {
    name?: string;
    code?: string;
    description?: string;
    isActive?: boolean;
  }): Promise<void> {
    const updatePayload: Record<string, any> = {};

    if (data.name !== undefined) {
      const cleanName = data.name.trim();
      if (!cleanName) throw new Error('Channel name cannot be empty');
      updatePayload.name = cleanName;
    }

    if (data.code !== undefined) {
      const cleanCode = data.code.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_');
      if (!cleanCode) throw new Error('Channel code cannot be empty');
      updatePayload.code = cleanCode;
    }

    if (data.description !== undefined) {
      updatePayload.description = data.description.trim() || null;
    }

    if (data.isActive !== undefined) {
      updatePayload.is_active = data.isActive;
    }

    const { error } = await supabase
      .from('sales_channels')
      .update(updatePayload)
      .eq('id', id);

    if (error) throw error;
  },

  async toggleSalesChannelActive(id: string, isActive: boolean): Promise<void> {
    const { error } = await supabase
      .from('sales_channels')
      .update({ is_active: isActive })
      .eq('id', id);

    if (error) throw error;
  },

  async deleteSalesChannel(id: string): Promise<void> {
    // 1. Verify customer references
    const { count: custCount, error: custErr } = await supabase
      .from('customers')
      .select('*', { count: 'exact', head: true })
      .eq('sales_channel_id', id);

    if (custErr) throw custErr;

    // 2. Verify pricing references
    const { count: priceCount, error: priceErr } = await supabase
      .from('product_channel_prices')
      .select('*', { count: 'exact', head: true })
      .eq('channel_id', id);

    if (priceErr) throw priceErr;

    const totalRefs = (custCount || 0) + (priceCount || 0);
    if (totalRefs > 0) {
      const details = [];
      if (custCount && custCount > 0) details.push(`${custCount} customer(s)`);
      if (priceCount && priceCount > 0) details.push(`${priceCount} product price configuration(s)`);
      throw new Error(`This channel cannot be deleted because it is assigned to ${details.join(' and ')}. Deactivate it instead.`);
    }

    // Safe hard delete
    const { error: delErr } = await supabase
      .from('sales_channels')
      .delete()
      .eq('id', id);

    if (delErr) throw delErr;
  }
};
