import { supabase } from '../lib/supabase';
import { Expense, ExpenseCategory, PaymentMethod } from '../types/dairy';
import { getEffectiveOrgId } from './orgService';

export const expenseService = {
  /**
   * Fetches all recorded expenses with their category names, ordered by date descending.
   */
  async fetchExpenses(): Promise<Expense[]> {
    const { data: expList, error } = await supabase
      .from('expenses')
      .select(`
        id,
        expense_number,
        expense_date,
        amount,
        payment_method,
        paid_to,
        reference_number,
        description,
        expense_categories(name)
      `)
      .order('expense_date', { ascending: false });

    if (error) throw error;

    return (expList || []).map((e: any): Expense => ({
      id: e.id,
      date: e.expense_date,
      category: ((e as any).expense_categories?.name || 'Other') as ExpenseCategory,
      description: e.description,
      amount: Number(e.amount),
      paymentMethod: e.payment_method as PaymentMethod,
      paidTo: e.paid_to,
      referenceNumber: e.reference_number || e.expense_number,
    }));
  },

  /**
   * Fetches active expense categories configured for the organization.
   */
  async fetchCategories(): Promise<{ id: string; name: string }[]> {
    const { data, error } = await supabase
      .from('expense_categories')
      .select('id, name')
      .eq('is_active', true)
      .order('name');

    if (error) {
      console.warn('Failed to fetch expense categories from DB:', error);
      return [];
    }
    return data || [];
  },

  /**
   * Finds or creates a category by name so expense recording never fails due to missing category.
   */
  async getOrCreateCategory(categoryName: string): Promise<string> {
    const orgId = await getEffectiveOrgId();
    const cleanName = categoryName?.trim() || 'Other';

    // 1. Try case-insensitive lookup
    const { data: existing } = await supabase
      .from('expense_categories')
      .select('id')
      .eq('organization_id', orgId)
      .ilike('name', cleanName)
      .limit(1)
      .maybeSingle();

    if (existing?.id) {
      return existing.id;
    }

    // 2. Insert new category automatically if not found
    const { data: newCat, error: insertErr } = await supabase
      .from('expense_categories')
      .insert({
        organization_id: orgId,
        name: cleanName,
        is_active: true,
      })
      .select('id')
      .single();

    if (!insertErr && newCat?.id) {
      return newCat.id;
    }

    // 3. Fallback: return any available category ID
    const { data: fallbackCat } = await supabase
      .from('expense_categories')
      .select('id')
      .eq('organization_id', orgId)
      .limit(1)
      .maybeSingle();

    if (fallbackCat?.id) {
      return fallbackCat.id;
    }

    throw new Error(`Unable to resolve or create expense category "${cleanName}".`);
  },

  /**
   * Records a new expense entry.
   */
  async addExpense(params: {
    category: ExpenseCategory;
    description: string;
    amount: number;
    paymentMethod: PaymentMethod;
    paidTo: string;
    referenceNumber?: string;
    date?: string;
  }): Promise<Expense> {
    const orgId = await getEffectiveOrgId();
    const catId = await this.getOrCreateCategory(params.category);

    const expDate = params.date || new Date().toISOString().split('T')[0];
    const expNum = params.referenceNumber?.trim() || `EXP-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const { data: newExp, error } = await supabase
      .from('expenses')
      .insert({
        organization_id: orgId,
        expense_number: expNum,
        expense_date: expDate,
        category_id: catId,
        description: params.description.trim(),
        amount: Number(params.amount),
        payment_method: params.paymentMethod,
        paid_to: params.paidTo.trim(),
        reference_number: params.referenceNumber?.trim() || expNum,
      })
      .select(`
        id,
        expense_number,
        expense_date,
        amount,
        payment_method,
        paid_to,
        reference_number,
        description,
        expense_categories(name)
      `)
      .single();

    if (error) throw error;

    return {
      id: newExp.id,
      date: newExp.expense_date,
      category: ((newExp as any).expense_categories?.name || params.category) as ExpenseCategory,
      description: newExp.description,
      amount: Number(newExp.amount),
      paymentMethod: newExp.payment_method as PaymentMethod,
      paidTo: newExp.paid_to,
      referenceNumber: newExp.reference_number || newExp.expense_number,
    };
  },

  /**
   * Deletes an expense entry by ID.
   */
  async deleteExpense(id: string): Promise<void> {
    const { error } = await supabase
      .from('expenses')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  /**
   * Deletes all operating expense entries.
   */
  async clearAllExpenses(): Promise<void> {
    const { error } = await supabase
      .from('expenses')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (error) throw error;
  }
};
