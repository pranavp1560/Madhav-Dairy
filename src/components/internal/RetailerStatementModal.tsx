import React, { useState, useMemo } from 'react';
import { useDairy } from '../../context/DairyContext';
import { Modal } from '../common/Modal';
import { Retailer, LedgerEntry, Invoice, Payment } from '../../types/dairy';
import {
  Download,
  Printer,
  FileText,
  Calendar,
  CheckCircle2,
  Copy,
  CreditCard,
  Building,
  Phone,
  Mail,
  MapPin,
  Clock,
  ArrowUpRight,
  ArrowDownLeft,
  X
} from 'lucide-react';

interface RetailerStatementModalProps {
  retailer: Retailer;
  isOpen: boolean;
  onClose: () => void;
}

export type StatementPeriod = 'all' | '30days' | 'month' | 'fy';

interface StatementItem {
  id: string;
  date: string;
  particular: string;
  reference: string;
  type: 'invoice' | 'payment' | 'adjustment';
  debit: number;
  credit: number;
  runningBalance: number;
}

export const RetailerStatementModal: React.FC<RetailerStatementModalProps> = ({
  retailer,
  isOpen,
  onClose,
}) => {
  const { ledger, invoices, payments, addToast } = useDairy();

  const [period, setPeriod] = useState<StatementPeriod>('all');
  const [copiedSummary, setCopiedSummary] = useState(false);

  // 1. Gather all financial transactions for this retailer
  const retailerLedger = useMemo(() => {
    return ledger.filter(l => l.retailerId === retailer.id);
  }, [ledger, retailer.id]);

  const retailerInvoices = useMemo(() => {
    return invoices.filter(i => i.retailerId === retailer.id);
  }, [invoices, retailer.id]);

  const retailerPayments = useMemo(() => {
    return payments.filter(p => p.retailerId === retailer.id);
  }, [payments, retailer.id]);

  // 2. Build master chronological transaction history
  const allChronologicalTransactions = useMemo(() => {
    // If double-entry ledger entries exist, use them
    if (retailerLedger.length > 0) {
      const sorted = [...retailerLedger].sort((a, b) => {
        const t1 = new Date(a.date).getTime();
        const t2 = new Date(b.date).getTime();
        if (t1 !== t2) return t1 - t2;
        return a.id.localeCompare(b.id);
      });

      return sorted.map((entry): Omit<StatementItem, 'runningBalance'> => {
        const debit = entry.debit || 0;
        const credit = entry.credit || 0;
        let type: 'invoice' | 'payment' | 'adjustment' = 'adjustment';
        if (debit > 0) type = 'invoice';
        if (credit > 0) type = 'payment';

        return {
          id: entry.id,
          date: entry.date,
          particular: entry.particular,
          reference: entry.reference || (debit > 0 ? 'INV' : 'REC'),
          type,
          debit,
          credit,
        };
      });
    }

    // Fallback synthesis from invoices & payments if ledger entries are not yet populated
    const synthesized: Omit<StatementItem, 'runningBalance'>[] = [];

    retailerInvoices.forEach(inv => {
      synthesized.push({
        id: `inv-${inv.id}`,
        date: inv.date,
        particular: `Tax Invoice ${inv.invoiceNumber} (${inv.items?.length || 1} items)`,
        reference: inv.invoiceNumber,
        type: 'invoice',
        debit: inv.totalAmount,
        credit: 0,
      });
    });

    retailerPayments.forEach(p => {
      synthesized.push({
        id: `pay-${p.id}`,
        date: p.date,
        particular: `Payment Received - ${p.paymentMethod.toUpperCase()} (${p.reference || 'Direct'})`,
        reference: p.paymentNumber,
        type: 'payment',
        debit: 0,
        credit: p.amount,
      });
    });

    return synthesized.sort((a, b) => {
      const t1 = new Date(a.date).getTime();
      const t2 = new Date(b.date).getTime();
      if (t1 !== t2) return t1 - t2;
      return a.id.localeCompare(b.id);
    });
  }, [retailerLedger, retailerInvoices, retailerPayments]);

  // 3. Filter by selected statement period and compute running balances
  const { filteredTransactions, openingBalance, totalDebits, totalCredits, closingBalance, periodLabel } = useMemo(() => {
    const now = new Date();
    let startDate: Date | null = null;
    let label = 'All Transactions (Complete History)';

    if (period === '30days') {
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      label = 'Last 30 Days';
    } else if (period === 'month') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      label = `${now.toLocaleString('default', { month: 'long', year: 'numeric' })}`;
    } else if (period === 'fy') {
      const currentYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
      startDate = new Date(currentYear, 3, 1); // 1st April
      label = `FY ${currentYear}-${(currentYear + 1).toString().slice(2)}`;
    }

    let priorBalance = 0;
    const inPeriod: Omit<StatementItem, 'runningBalance'>[] = [];

    allChronologicalTransactions.forEach(tx => {
      const txDate = new Date(tx.date);
      if (startDate && txDate < startDate) {
        priorBalance += tx.debit - tx.credit;
      } else {
        inPeriod.push(tx);
      }
    });

    let running = Math.max(0, priorBalance);
    let debitsSum = 0;
    let creditsSum = 0;

    const computedItems: StatementItem[] = inPeriod.map(tx => {
      debitsSum += tx.debit;
      creditsSum += tx.credit;
      running = running + tx.debit - tx.credit;
      return {
        ...tx,
        runningBalance: running,
      };
    });

    const netClosing = Math.max(0, running);

    return {
      filteredTransactions: computedItems,
      openingBalance: Math.max(0, priorBalance),
      totalDebits: debitsSum,
      totalCredits: creditsSum,
      closingBalance: netClosing,
      periodLabel: label,
    };
  }, [allChronologicalTransactions, period]);

  // 4. Download CSV Statement handler
  const handleDownloadCSV = () => {
    let csv = `MADHAV DAIRY PRIVATE LIMITED\n`;
    csv += `Plot No. 42, Shirwal Industrial Dairy Zone, Pune-Satara Highway, Maharashtra - 412801\n`;
    csv += `GSTIN: 27AAACM4401N1Z2 | FSSAI: 11522036000492 | Phone: +91 20 2544 8800\n`;
    csv += `Official Customer Account Statement\n\n`;

    csv += `CUSTOMER DETAILS\n`;
    csv += `Business Name,"${retailer.businessName.replace(/"/g, '""')}"\n`;
    csv += `Customer Code,"${retailer.customerCode || 'CUST-' + retailer.id.slice(0, 6)}"\n`;
    csv += `Proprietor / Contact,"${retailer.ownerName.replace(/"/g, '""')}"\n`;
    csv += `Mobile,"+91 ${retailer.mobile}"\n`;
    csv += `Email,"${retailer.email || 'N/A'}"\n`;
    csv += `GSTIN,"${retailer.gstin || 'N/A'}"\n`;
    csv += `Sales Channel,"${retailer.salesChannelName || 'Wholesale'}"\n`;
    csv += `Delivery Address,"${(retailer.address || '').replace(/"/g, '""')}"\n`;
    csv += `Credit Limit,"INR ${retailer.creditLimit}"\n`;
    csv += `Statement Period,"${periodLabel}"\n`;
    csv += `Generated On,"${new Date().toLocaleString('en-IN')}"\n\n`;

    csv += `FINANCIAL SUMMARY\n`;
    csv += `Opening Balance (INR),Total Invoiced / Debits (INR),Total Paid / Credits (INR),Closing Outstanding Balance (INR)\n`;
    csv += `${openingBalance},${totalDebits},${totalCredits},${closingBalance}\n\n`;

    csv += `STATEMENT TRANSACTIONS\n`;
    csv += `Date,Type,Reference / Doc No,Particulars / Description,Debit (INR),Credit (INR),Running Balance (INR)\n`;

    if (openingBalance > 0) {
      csv += `-,Balance B/F,-,"Opening Balance As On Period Start",${openingBalance},0,${openingBalance}\n`;
    }

    filteredTransactions.forEach(t => {
      const safePart = `"${t.particular.replace(/"/g, '""')}"`;
      const safeRef = `"${t.reference.replace(/"/g, '""')}"`;
      const typeLabel = t.type === 'invoice' ? 'Invoice (Debit)' : t.type === 'payment' ? 'Payment (Credit)' : 'Adjustment';
      csv += `${t.date},${typeLabel},${safeRef},${safePart},${t.debit},${t.credit},${t.runningBalance}\n`;
    });

    csv += `\n`;
    csv += `TOTALS,,,"Period Totals",${totalDebits},${totalCredits},${closingBalance}\n\n`;
    csv += `BANK PAYMENT DETAILS FOR SETTLEMENT\n`;
    csv += `Account Name,Madhav Dairy Private Limited\n`;
    csv += `Bank Name,HDFC Bank\n`;
    csv += `Account Number,50200088991122\n`;
    csv += `IFSC Code,HDFC0001234\n`;
    csv += `UPI ID,madhavdairy@hdfcbank\n\n`;
    csv += `Note: This is a computer-generated account statement from Madhav Dairy Central ERP.\n`;

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const safeName = retailer.businessName.toLowerCase().replace(/[^a-z0-9]+/g, '_');
    const dateStr = new Date().toISOString().split('T')[0];
    link.setAttribute('href', url);
    link.setAttribute('download', `madhav_dairy_statement_${safeName}_${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    addToast(`Statement exported as CSV for ${retailer.businessName}`, 'success');
  };

  // 5. Print Statement handler
  const handlePrint = () => {
    window.print();
    addToast('Opening print dialog for account statement...', 'info');
  };

  // 6. Copy summary text for WhatsApp / SMS messaging
  const handleCopySummary = () => {
    const text = `*Madhav Dairy - Account Statement Update*\n\n` +
      `Dear ${retailer.businessName},\n` +
      `Your current statement summary as on ${new Date().toLocaleDateString('en-IN')}:\n\n` +
      `• Outstanding Due Balance: ₹${closingBalance.toLocaleString('en-IN')}\n` +
      `• Total Invoiced (${periodLabel}): ₹${totalDebits.toLocaleString('en-IN')}\n` +
      `• Total Payments Recorded: ₹${totalCredits.toLocaleString('en-IN')}\n\n` +
      `UPI ID for Direct Payment: madhavdairy@hdfcbank\n` +
      `Bank: HDFC Bank | A/C: 50200088991122 | IFSC: HDFC0001234\n\n` +
      `Please contact Madhav Dairy Accounts at +91 20 2544 8800 for any reconciliation queries.`;

    navigator.clipboard.writeText(text);
    setCopiedSummary(true);
    addToast('Statement summary copied to clipboard for WhatsApp/SMS', 'success');
    setTimeout(() => setCopiedSummary(false), 3000);
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Customer Account Statement: ${retailer.businessName}`}
      subtitle={`Statement Period: ${periodLabel} • Closing Outstanding: ₹${closingBalance.toLocaleString('en-IN')}`}
      maxWidth="5xl"
    >
      <div className="space-y-4 font-sans text-xs">
        {/* Top Control Bar (Hidden on Print) */}
        <div className="bg-slate-50 p-3 sm:p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 print:hidden">
          {/* Period Filter Buttons */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mr-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              <span>Period:</span>
            </span>
            {[
              { id: 'all', label: 'All History' },
              { id: '30days', label: 'Last 30 Days' },
              { id: 'month', label: 'This Month' },
              { id: 'fy', label: 'FY 2026-27' },
            ].map(p => (
              <button
                key={p.id}
                onClick={() => setPeriod(p.id as StatementPeriod)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  period === p.id
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Export Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopySummary}
              className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold border border-slate-300 transition-colors flex items-center gap-1.5 shadow-2xs"
              title="Copy summary for WhatsApp message"
            >
              {copiedSummary ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
              <span>{copiedSummary ? 'Copied!' : 'Copy Summary'}</span>
            </button>

            <button
              onClick={handleDownloadCSV}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
              title="Export complete statement as CSV spreadsheet"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>

            <button
              onClick={handlePrint}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
              title="Print formal statement or save as PDF"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / PDF</span>
            </button>
          </div>
        </div>

        {/* Printable Canvas */}
        <div className="bg-white border border-slate-300 p-5 sm:p-7 rounded-2xl shadow-sm text-xs font-sans text-slate-900 print:border-none print:shadow-none print:p-0 space-y-5">
          {/* Company Official Letterhead */}
          <div className="border-b-2 border-slate-900 pb-4 flex flex-col sm:flex-row justify-between items-start gap-4">
            <div>
              <div className="flex items-center gap-2.5 mb-1.5">
                <img src="/logo.png" alt="Madhav Dairy" className="h-9 w-auto object-contain" />
                <div>
                  <h1 className="text-lg sm:text-xl font-black uppercase tracking-tight text-slate-900">
                    Madhav Dairy Private Limited
                  </h1>
                  <span className="text-[10px] uppercase font-bold text-blue-700 tracking-wider">
                    Fresh Milk, Dairy Products & Wholesale Distribution
                  </span>
                </div>
              </div>
              <p className="text-slate-600 text-[11px]">
                Plot No. 42, Shirwal Industrial Dairy Zone, Pune-Satara Highway, Maharashtra - 412801
              </p>
              <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-slate-700 mt-1 font-mono-numbers">
                <span><strong>GSTIN:</strong> 27AAACM4401N1Z2</span>
                <span><strong>FSSAI:</strong> 11522036000492</span>
                <span><strong>Phone:</strong> +91 20 2544 8800</span>
              </div>
            </div>

            <div className="text-left sm:text-right sm:border-l sm:pl-5 border-slate-200 shrink-0">
              <span className="text-sm font-black tracking-wider text-blue-800 uppercase block">
                STATEMENT OF ACCOUNT
              </span>
              <span className="text-[11px] text-slate-500 font-mono-numbers block mt-0.5">
                Ref: STMT-{retailer.id.slice(0, 8).toUpperCase()}
              </span>
              <span className="text-[11px] text-slate-700 font-medium block mt-1">
                Period: <strong>{periodLabel}</strong>
              </span>
              <span className="text-[10px] text-slate-500 font-mono-numbers block mt-0.5">
                Date: {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
              </span>
            </div>
          </div>

          {/* Customer & Account Details Card */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50/80 p-3.5 rounded-xl border border-slate-200">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Customer Account</span>
              <h2 className="text-sm font-black text-slate-900 mt-0.5">{retailer.businessName}</h2>
              <div className="text-[11px] text-slate-600 space-y-0.5 mt-1">
                <p><strong>Contact Person:</strong> {retailer.ownerName}</p>
                <p><strong>Phone:</strong> +91 {retailer.mobile}</p>
                {retailer.email && <p><strong>Email:</strong> {retailer.email}</p>}
                <p><strong>GSTIN:</strong> <span className="font-mono">{retailer.gstin || 'Unregistered'}</span></p>
              </div>
            </div>

            <div className="sm:text-right">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Billing & Channel Profile</span>
              <div className="text-[11px] text-slate-600 space-y-0.5 mt-1 sm:text-right">
                <p><strong>Customer Code:</strong> <span className="font-mono font-bold text-slate-900">{retailer.customerCode || 'CUST-' + retailer.id.slice(0, 6)}</span></p>
                <p><strong>Sales Channel:</strong> {retailer.salesChannelName || 'Wholesale Distribution'}</p>
                <p><strong>Credit Limit:</strong> ₹{retailer.creditLimit.toLocaleString('en-IN')}</p>
                <p><strong>Payment Terms:</strong> {retailer.paymentTerms || 'Standard 7 Days'}</p>
                <p className="truncate max-w-xs sm:ml-auto"><strong>Address:</strong> {retailer.address || 'Maharashtra'}</p>
              </div>
            </div>
          </div>

          {/* Statement Financial KPI Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 font-mono-numbers">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-[10px] uppercase font-bold text-slate-500 block font-sans">Opening Balance</span>
              <span className="text-base font-bold text-slate-800 block mt-0.5">
                ₹{openingBalance.toLocaleString('en-IN')}
              </span>
            </div>

            <div className="p-3 bg-rose-50/60 rounded-xl border border-rose-200">
              <span className="text-[10px] uppercase font-bold text-rose-700 block font-sans">Total Invoiced (Debits)</span>
              <span className="text-base font-bold text-rose-700 block mt-0.5">
                ₹{totalDebits.toLocaleString('en-IN')}
              </span>
            </div>

            <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-200">
              <span className="text-[10px] uppercase font-bold text-emerald-700 block font-sans">Total Paid (Credits)</span>
              <span className="text-base font-bold text-emerald-700 block mt-0.5">
                ₹{totalCredits.toLocaleString('en-IN')}
              </span>
            </div>

            <div className="p-3 bg-blue-50/70 rounded-xl border border-blue-200">
              <span className="text-[10px] uppercase font-bold text-blue-800 block font-sans">Closing Outstanding</span>
              <span className="text-base font-black text-blue-900 block mt-0.5">
                ₹{closingBalance.toLocaleString('en-IN')} <span className="text-xs text-rose-600 font-bold">Dr</span>
              </span>
            </div>
          </div>

          {/* Statement Line Items Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/80 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-2.5">Date</th>
                  <th className="p-2.5">Type</th>
                  <th className="p-2.5">Doc / Ref #</th>
                  <th className="p-2.5">Particulars / Description</th>
                  <th className="p-2.5 text-right">Debit (₹)</th>
                  <th className="p-2.5 text-right">Credit (₹)</th>
                  <th className="p-2.5 text-right">Balance (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono-numbers">
                {/* Opening balance line */}
                {openingBalance > 0 && (
                  <tr className="bg-slate-50/40 font-semibold text-slate-600">
                    <td className="p-2.5">—</td>
                    <td className="p-2.5 font-sans">
                      <span className="px-1.5 py-0.5 bg-slate-200/70 rounded text-[10px]">Opening</span>
                    </td>
                    <td className="p-2.5">—</td>
                    <td className="p-2.5 font-sans">Opening Balance As On Period Start</td>
                    <td className="p-2.5 text-right">₹{openingBalance.toLocaleString('en-IN')}</td>
                    <td className="p-2.5 text-right">—</td>
                    <td className="p-2.5 text-right font-bold text-slate-900">₹{openingBalance.toLocaleString('en-IN')}</td>
                  </tr>
                )}

                {filteredTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-slate-400 font-sans">
                      No financial transactions recorded for this customer in the selected period.
                    </td>
                  </tr>
                ) : (
                  filteredTransactions.map(t => (
                    <tr key={t.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="p-2.5 text-slate-600 font-sans whitespace-nowrap">
                        {new Date(t.date).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </td>
                      <td className="p-2.5 font-sans">
                        {t.type === 'invoice' ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                            <ArrowUpRight className="w-2.5 h-2.5" />
                            <span>Invoice</span>
                          </span>
                        ) : t.type === 'payment' ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                            <ArrowDownLeft className="w-2.5 h-2.5" />
                            <span>Payment</span>
                          </span>
                        ) : (
                          <span className="text-[10px] font-medium text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                            Adjustment
                          </span>
                        )}
                      </td>
                      <td className="p-2.5 font-bold text-slate-900">
                        {t.reference}
                      </td>
                      <td className="p-2.5 font-sans text-slate-700">
                        {t.particular}
                      </td>
                      <td className="p-2.5 text-right font-bold text-rose-600">
                        {t.debit > 0 ? `₹${t.debit.toLocaleString('en-IN')}` : '—'}
                      </td>
                      <td className="p-2.5 text-right font-bold text-emerald-600">
                        {t.credit > 0 ? `₹${t.credit.toLocaleString('en-IN')}` : '—'}
                      </td>
                      <td className="p-2.5 text-right font-black text-slate-900">
                        ₹{t.runningBalance.toLocaleString('en-IN')}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot className="bg-slate-100/90 font-mono-numbers font-bold text-slate-900 border-t-2 border-slate-300">
                <tr>
                  <td colSpan={4} className="p-2.5 font-sans text-right">
                    Period Totals & Closing Balance:
                  </td>
                  <td className="p-2.5 text-right text-rose-600">
                    ₹{totalDebits.toLocaleString('en-IN')}
                  </td>
                  <td className="p-2.5 text-right text-emerald-600">
                    ₹{totalCredits.toLocaleString('en-IN')}
                  </td>
                  <td className="p-2.5 text-right text-base font-black text-blue-900">
                    ₹{closingBalance.toLocaleString('en-IN')} <span className="text-xs text-rose-600 font-bold">Dr</span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Payment Instructions & Official Bank Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-[11px] border-t border-slate-200">
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1">
              <span className="font-bold text-slate-900 block text-xs">Official Bank Settlement Details:</span>
              <p><strong>Bank:</strong> HDFC Bank Ltd • Branch: Shirwal Dairy Zone</p>
              <p><strong>A/C Name:</strong> Madhav Dairy Private Limited</p>
              <p><strong>A/C No:</strong> <span className="font-mono font-bold">50200088991122</span> • <strong>IFSC:</strong> <span className="font-mono font-bold">HDFC0001234</span></p>
              <p><strong>UPI ID:</strong> <span className="font-mono font-bold text-blue-700">madhavdairy@hdfcbank</span></p>
            </div>

            <div className="flex flex-col justify-between sm:text-right p-3 bg-slate-50/60 rounded-xl border border-slate-200">
              <p className="text-slate-500 italic text-[10px]">
                This is a computer-generated account statement issued by Madhav Dairy Central ERP. No physical signature is required.
              </p>
              <div className="pt-3">
                <span className="font-bold text-slate-900 block">For Madhav Dairy Private Limited</span>
                <span className="text-slate-500 text-[10px]">Finance & Accounts Department</span>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer (Hidden on Print) */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100 print:hidden text-xs">
          <span className="text-slate-500">
            Showing {filteredTransactions.length} transaction entries for {retailer.businessName}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold transition-colors"
            >
              Close
            </button>
            <button
              onClick={handleDownloadCSV}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition-all shadow-xs flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all shadow-xs flex items-center gap-1.5"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / PDF</span>
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
