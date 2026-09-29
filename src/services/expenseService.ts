import { supabase } from '../lib/supabase';
import { Expense, ExpenseCategory, PaymentMethod } from '../types/dairy';

export const expenseService = {
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

  async addExpense(params: {
    category: ExpenseCategory;
    description: string;
    amount: number;
    paymentMethod: PaymentMethod;
    paidTo: string;
    referenceNumber: string;
  }): Promise<Expense> {
    const orgId = '00000000-0000-0000-0000-000000000001';

    // Find category ID
    const { data: cat } = await supabase
      .from('expense_categories')
      .select('id')
      .ilike('name', `%${params.category}%`)
      .limit(1)
      .maybeSingle();

    const catId = cat?.id || 'e0000000-0000-0000-0000-000000000001';
    const expNum = `EXP-${Math.floor(1000 + Math.random() * 9000)}`;

    const { data: newExp, error } = await supabase
      .from('expenses')
      .insert({
        organization_id: orgId,
        expense_number: expNum,
        expense_date: new Date().toISOString().split('T')[0],
        category_id: catId,
        description: params.description,
        amount: params.amount,
        payment_method: params.paymentMethod,
        paid_to: params.paidTo,
        reference_number: params.referenceNumber,
      })
      .select()
      .single();

    if (error) throw error;

    return {
      id: newExp.id,
      date: newExp.expense_date,
      category: params.category,
      description: params.description,
      amount: params.amount,
      paymentMethod: params.paymentMethod,
      paidTo: params.paidTo,
      referenceNumber: params.referenceNumber,
    };
  }
};
