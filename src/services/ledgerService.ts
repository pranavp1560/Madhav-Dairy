import { supabase } from '../lib/supabase';
import { LedgerEntry } from '../types/dairy';

export const ledgerService = {
  async fetchLedger(retailerId?: string): Promise<LedgerEntry[]> {
    let query = supabase
      .from('ledger_entries')
      .select('*')
      .order('entry_date', { ascending: true })
      .order('created_at', { ascending: true });

    if (retailerId) {
      query = query.eq('customer_id', retailerId);
    }

    const { data: entries, error } = await query;
    if (error) throw error;

    // Calculate dynamic running balances per retailer
    const customerBalances: Record<string, number> = {};

    return (entries || []).map((e: any): LedgerEntry => {
      const cid = e.customer_id;
      if (customerBalances[cid] === undefined) {
        customerBalances[cid] = 0;
      }

      const debit = e.debit ? Number(e.debit) : undefined;
      const credit = e.credit ? Number(e.credit) : undefined;

      customerBalances[cid] += (debit || 0) - (credit || 0);

      return {
        id: e.id,
        date: e.entry_date,
        retailerId: e.customer_id,
        particular: e.description,
        debit,
        credit,
        balance: customerBalances[cid],
        reference: e.reference_type || 'Ledger',
      };
    }).reverse(); // Return latest first for UI
  }
};
