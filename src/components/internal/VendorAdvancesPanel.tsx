import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowLeftRight, CheckCircle2, History, Plus, RefreshCw, Wallet } from 'lucide-react';
import { useDairy } from '../../context/DairyContext';
import { vendorAdvanceService, VendorAdvance, VendorAdvanceAdjustment, AdvancePaymentMethod } from '../../services';

interface VendorAdvancesPanelProps {
  onBack: () => void;
}

const money = (value: number) => `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const todayLocal = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
const normalizeVendor = (value: string) => value.trim().toLocaleLowerCase();

export const VendorAdvancesPanel: React.FC<VendorAdvancesPanelProps> = ({ onBack }) => {
  const { expenses, addToast } = useDairy();
  const [advances, setAdvances] = useState<VendorAdvance[]>([]);
  const [adjustments, setAdjustments] = useState<VendorAdvanceAdjustment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [vendorName, setVendorName] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(todayLocal());
  const [paymentMethod, setPaymentMethod] = useState<AdvancePaymentMethod>('bank_transfer');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedAdvanceId, setSelectedAdvanceId] = useState('');
  const [selectedExpenseId, setSelectedExpenseId] = useState('');
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustNotes, setAdjustNotes] = useState('');

  const reload = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [advanceRows, adjustmentRows] = await Promise.all([
        vendorAdvanceService.fetchAdvances(),
        vendorAdvanceService.fetchAdjustments(),
      ]);
      setAdvances(advanceRows);
      setAdjustments(adjustmentRows);
    } catch (err: any) {
      setError(err?.message || 'Could not load vendor advances.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  const appliedToAdvance = useMemo(() => {
    const totals = new Map<string, number>();
    adjustments.forEach(row => totals.set(row.advanceId, (totals.get(row.advanceId) || 0) + row.amount));
    return totals;
  }, [adjustments]);

  const appliedToExpense = useMemo(() => {
    const totals = new Map<string, number>();
    adjustments.forEach(row => totals.set(row.expenseId, (totals.get(row.expenseId) || 0) + row.amount));
    return totals;
  }, [adjustments]);

  const selectedAdvance = advances.find(row => row.id === selectedAdvanceId);
  const availableAdvance = selectedAdvance ? Math.max(0, selectedAdvance.amount - (appliedToAdvance.get(selectedAdvance.id) || 0)) : 0;
  const eligibleExpenses = useMemo(() => {
    if (!selectedAdvance) return [];
    return expenses
      .filter(exp => normalizeVendor(exp.paidTo) === normalizeVendor(selectedAdvance.vendorName))
      .map(exp => ({ ...exp, remaining: Math.max(0, exp.amount - (appliedToExpense.get(exp.id) || 0)) }))
      .filter(exp => exp.remaining > 0)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [expenses, selectedAdvance, appliedToExpense]);
  const selectedExpense = eligibleExpenses.find(exp => exp.id === selectedExpenseId);
  const totalAdvance = advances.reduce((sum, row) => sum + row.amount, 0);
  const totalApplied = adjustments.reduce((sum, row) => sum + row.amount, 0);
  const totalAvailable = Math.max(0, totalAdvance - totalApplied);

  const submitAdvance = async (event: React.FormEvent) => {
    event.preventDefault();
    const parsedAmount = Number(amount);
    if (!vendorName.trim() || !Number.isFinite(parsedAmount) || parsedAmount <= 0 || !paymentDate) {
      setError('Enter a vendor/farmer name, a valid positive amount and a payment date.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await vendorAdvanceService.createAdvance({
        vendorName, amount: parsedAmount, paymentDate, paymentMethod,
        referenceNumber: referenceNumber.trim(), notes: notes.trim(),
      });
      setVendorName('');
      setAmount('');
      setReferenceNumber('');
      setNotes('');
      await reload();
      addToast('Advance payment recorded. It has not been added to expenses.', 'success');
    } catch (err: any) {
      setError(err?.message || 'Could not record advance payment.');
    } finally {
      setSaving(false);
    }
  };

  const submitAdjustment = async (event: React.FormEvent) => {
    event.preventDefault();
    const parsedAmount = Number(adjustAmount);
    if (!selectedAdvance || !selectedExpense || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError('Select an eligible bill and enter a valid adjustment amount.');
      return;
    }
    if (parsedAmount > availableAdvance || parsedAmount > selectedExpense.remaining) {
      setError('The adjustment cannot exceed either the available advance or the bill balance.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await vendorAdvanceService.adjustAdvance({
        advanceId: selectedAdvance.id,
        expenseId: selectedExpense.id,
        amount: parsedAmount,
        notes: adjustNotes.trim(),
      });
      setSelectedAdvanceId('');
      setSelectedExpenseId('');
      setAdjustAmount('');
      setAdjustNotes('');
      await reload();
      addToast('Advance adjusted against the selected bill. Adjustment history saved.', 'success');
    } catch (err: any) {
      setError(err?.message || 'Could not adjust advance.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <button onClick={onBack} className="mb-2 inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-900">
            <ArrowLeft className="w-4 h-4" /> Back to Expenses
          </button>
          <div className="flex items-center gap-2 text-blue-700 text-xs font-bold uppercase tracking-wider">
            <Wallet className="w-4 h-4" /> Vendor & Farmer Advances
          </div>
          <h1 className="mt-1 text-xl font-black text-slate-900">Advance Ledger</h1>
          <p className="mt-1 text-xs text-slate-500">Record advances separately and manually apply them to the vendor's expense bills.</p>
        </div>
        <button onClick={() => void reload()} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">{error}</div>}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-[10px] font-bold uppercase text-slate-500">Advances Paid</div>
          <div className="mt-1 text-xl font-black text-slate-900">{money(totalAdvance)}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-[10px] font-bold uppercase text-slate-500">Adjusted Against Bills</div>
          <div className="mt-1 text-xl font-black text-blue-700">{money(totalApplied)}</div>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <div className="text-[10px] font-bold uppercase text-emerald-700">Available Advance</div>
          <div className="mt-1 text-xl font-black text-emerald-800">{money(totalAvailable)}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <form onSubmit={submitAdvance} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-blue-700" />
            <h2 className="font-black text-slate-900">Record Advance Payment</h2>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">Vendor / Farmer Name *</label>
            <input list="advance-vendor-suggestions" value={vendorName} onChange={e => setVendorName(e.target.value)} required maxLength={160} placeholder="Enter the same name used on the expense bill" className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100" />
            <datalist id="advance-vendor-suggestions">
              {[...new Set([...expenses.map(exp => exp.paidTo), ...advances.map(adv => adv.vendorName)].filter(Boolean))].sort().map(name => <option key={name} value={name} />)}
            </datalist>
            <p className="mt-1 text-[11px] text-slate-500">Use the same vendor name as the bill so it can be matched for adjustment.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">Advance Amount (₹) *</label>
              <input type="number" min="0.01" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} required className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">Payment Date *</label>
              <input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} required className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">Payment Method *</label>
              <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value as AdvancePaymentMethod)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100">
                <option value="bank_transfer">Bank Transfer</option><option value="upi">UPI</option><option value="cash">Cash</option><option value="cheque">Cheque</option><option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">Reference / Transaction ID</label>
              <input value={referenceNumber} onChange={e => setReferenceNumber(e.target.value)} maxLength={120} placeholder="Optional" className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100" />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} maxLength={1000} rows={2} placeholder="Optional reason or details" className="w-full resize-y rounded-lg border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100" />
          </div>
          <button type="submit" disabled={saving} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50">
            <CheckCircle2 className="h-4 w-4" /> {saving ? 'Saving...' : 'Record Advance'}
          </button>
        </form>

        <form onSubmit={submitAdjustment} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <ArrowLeftRight className="h-5 w-5 text-blue-700" />
            <h2 className="font-black text-slate-900">Adjust Advance Against Bill</h2>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">Select Advance *</label>
            <select value={selectedAdvanceId} onChange={e => { setSelectedAdvanceId(e.target.value); setSelectedExpenseId(''); setAdjustAmount(''); }} required className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100">
              <option value="">Choose vendor/farmer advance</option>
              {advances.filter(adv => adv.amount - (appliedToAdvance.get(adv.id) || 0) > 0).map(adv => <option key={adv.id} value={adv.id}>{adv.advanceNumber} · {adv.vendorName} · balance {money(adv.amount - (appliedToAdvance.get(adv.id) || 0))}</option>)}
            </select>
          </div>
          {selectedAdvance && <div className="rounded-lg bg-blue-50 p-3 text-xs text-blue-900">Available for {selectedAdvance.vendorName}: <strong>{money(availableAdvance)}</strong></div>}
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">Select Vendor Bill / Expense *</label>
            <select value={selectedExpenseId} onChange={e => { setSelectedExpenseId(e.target.value); setAdjustAmount(''); }} required disabled={!selectedAdvance} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100">
              <option value="">Choose an outstanding bill</option>
              {eligibleExpenses.map(exp => <option key={exp.id} value={exp.id}>{exp.referenceNumber || exp.id.slice(0, 8)} · {exp.date} · bill {money(exp.amount)} · due {money(exp.remaining)} — {exp.description}</option>)}
            </select>
            {selectedAdvance && eligibleExpenses.length === 0 && <p className="mt-1 text-[11px] text-amber-700">No outstanding bills found with the same vendor name. Check that the bill's Paid To / Vendor field matches.</p>}
          </div>
          {selectedExpense && <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-700">Bill total: <strong>{money(selectedExpense.amount)}</strong> · Already adjusted: <strong>{money(appliedToExpense.get(selectedExpense.id) || 0)}</strong> · Remaining: <strong>{money(selectedExpense.remaining)}</strong></div>}
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">Amount to Adjust (₹) *</label>
            <input type="number" min="0.01" max={selectedExpense ? Math.min(availableAdvance, selectedExpense.remaining) : availableAdvance} step="0.01" value={adjustAmount} onChange={e => setAdjustAmount(e.target.value)} required disabled={!selectedExpense} className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100" />
            <p className="mt-1 text-[11px] text-slate-500">Cannot exceed the available advance or the remaining bill amount.</p>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">Adjustment Notes</label>
            <textarea value={adjustNotes} onChange={e => setAdjustNotes(e.target.value)} maxLength={1000} rows={2} placeholder="Optional" className="w-full resize-y rounded-lg border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100" />
          </div>
          <button type="submit" disabled={saving || !selectedExpense || !selectedAdvance || !adjustAmount || Number(adjustAmount) <= 0 || Number(adjustAmount) > availableAdvance || Number(adjustAmount) > (selectedExpense?.remaining || 0)} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50">
            <ArrowLeftRight className="h-4 w-4" /> {saving ? 'Saving...' : 'Apply Advance to Bill'}
          </button>
        </form>
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-slate-200 p-4"><Wallet className="h-5 w-5 text-blue-700" /><h2 className="font-black text-slate-900">Advance Ledger</h2></div>
        {loading ? <div className="p-8 text-center text-sm text-slate-500">Loading advance ledger...</div> : advances.length === 0 ? <div className="p-8 text-center text-sm text-slate-500">No advance payments recorded yet.</div> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left text-xs">
              <thead className="bg-slate-50 text-slate-600"><tr><th className="p-3">Date</th><th className="p-3">Advance #</th><th className="p-3">Vendor / Farmer</th><th className="p-3 text-right">Paid (₹)</th><th className="p-3 text-right">Adjusted (₹)</th><th className="p-3 text-right">Balance (₹)</th><th className="p-3">Method / Reference</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {advances.map(adv => {
                  const applied = appliedToAdvance.get(adv.id) || 0;
                  return <tr key={adv.id} className="hover:bg-slate-50"><td className="p-3 text-slate-600">{adv.paymentDate}</td><td className="p-3 font-semibold text-slate-800">{adv.advanceNumber}</td><td className="p-3 font-semibold text-slate-900">{adv.vendorName}</td><td className="p-3 text-right font-mono-numbers">{money(adv.amount)}</td><td className="p-3 text-right font-mono-numbers text-blue-700">{money(applied)}</td><td className="p-3 text-right font-mono-numbers font-bold text-emerald-700">{money(Math.max(0, adv.amount - applied))}</td><td className="p-3 text-slate-600">{adv.paymentMethod.replace('_', ' ')}{adv.referenceNumber ? ` · ${adv.referenceNumber}` : ''}</td></tr>;
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-slate-200 p-4"><History className="h-5 w-5 text-blue-700" /><h2 className="font-black text-slate-900">Adjustment Audit History</h2></div>
        {loading ? <div className="p-8 text-center text-sm text-slate-500">Loading adjustment history...</div> : adjustments.length === 0 ? <div className="p-8 text-center text-sm text-slate-500">No advance adjustments recorded yet.</div> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left text-xs">
              <thead className="bg-slate-50 text-slate-600"><tr><th className="p-3">Applied At</th><th className="p-3">Advance #</th><th className="p-3">Vendor / Farmer</th><th className="p-3">Bill Reference</th><th className="p-3 text-right">Amount (₹)</th><th className="p-3">Notes</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {adjustments.map(row => {
                  const adv = advances.find(item => item.id === row.advanceId);
                  const expense = expenses.find(item => item.id === row.expenseId);
                  return <tr key={row.id}><td className="p-3 text-slate-600">{new Date(row.createdAt).toLocaleString('en-IN')}</td><td className="p-3 font-semibold">{adv?.advanceNumber || 'Advance'}</td><td className="p-3">{adv?.vendorName || expense?.paidTo || '—'}</td><td className="p-3">{expense?.referenceNumber || expense?.description || row.expenseId.slice(0, 8)}</td><td className="p-3 text-right font-mono-numbers font-bold">{money(row.amount)}</td><td className="p-3 text-slate-500">{row.notes || '—'}</td></tr>;
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <p className="text-[11px] text-slate-500">Advance payments and adjustments are stored separately from operating expenses. Adjustment records are retained as audit history; the original bill amount is never overwritten.</p>
    </div>
  );
};
