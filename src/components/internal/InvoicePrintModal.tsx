import React from 'react';
import { useDairy } from '../../context/DairyContext';
import { Modal } from '../common/Modal';
import { Printer, Download, Milk, CheckCircle2 } from 'lucide-react';

interface InvoicePrintModalProps {
  invoiceId: string | null;
  onClose: () => void;
}

export const InvoicePrintModal: React.FC<InvoicePrintModalProps> = ({ invoiceId, onClose }) => {
  const { invoices, addToast } = useDairy();

  if (!invoiceId) return null;

  const invoice = invoices.find(i => i.id === invoiceId || i.invoiceNumber === invoiceId);
  if (!invoice) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = () => {
    window.print();
    addToast(`Tax Invoice ${invoice.invoiceNumber} ready for export`, 'success');
  };

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={`Tax Invoice: ${invoice.invoiceNumber}`}
      subtitle="Printable GST B2B Invoice format"
      maxWidth="4xl"
    >
      <div className="space-y-4">
        {/* Printable Paper Canvas */}
        <div className="bg-white border border-slate-300 p-6 sm:p-8 rounded-xl shadow-sm text-xs font-sans text-slate-900 print:border-none print:shadow-none print:p-0">
          {/* Company Header */}
          <div className="border-b-2 border-slate-900 pb-4 flex flex-col sm:flex-row justify-between items-start gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold">
                  <Milk className="w-5 h-5" />
                </div>
                <h1 className="text-xl font-black uppercase tracking-tight text-slate-900">
                  Madhav Dairy Private Limited
                </h1>
              </div>
              <p className="text-slate-600 text-[11px]">
                Plot No. 42, Shirwal Industrial Dairy Zone, Pune-Satara Highway, Maharashtra - 412801
              </p>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-700 mt-1 font-mono-numbers">
                <span><strong>GSTIN:</strong> 27AAACM4401N1Z2</span>
                <span><strong>FSSAI Lic No:</strong> 11522036000492</span>
                <span><strong>Phone:</strong> +91 20 2544 8800</span>
              </div>
            </div>

            <div className="text-right sm:border-l sm:pl-6 border-slate-200">
              <span className="text-base font-black tracking-wider text-blue-700 uppercase block">
                TAX INVOICE
              </span>
              <p className="font-mono-numbers font-bold text-sm text-slate-900 mt-0.5">
                {invoice.invoiceNumber}
              </p>
              <p className="text-[11px] text-slate-600 mt-1">
                Date: <strong className="text-slate-900">{invoice.date}</strong>
              </p>
              <p className="text-[11px] text-slate-600">
                Payment Due: <strong className="text-slate-900">{invoice.dueDate}</strong>
              </p>
            </div>
          </div>

          {/* Bill To & Dispatch */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4 border-b border-slate-200 text-xs">
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">
                Billed & Dispatched To:
              </span>
              <h3 className="font-bold text-slate-900 text-sm">{invoice.retailerName}</h3>
              <p className="text-slate-600 mt-0.5">{invoice.retailerAddress}</p>
              <p className="text-slate-800 font-mono-numbers mt-1">
                <strong>GSTIN:</strong> {invoice.retailerGstin || '27AABCU9603R1ZM'}
              </p>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1 text-[11px]">
              <div className="flex justify-between">
                <span className="text-slate-500">Mode of Transport:</span>
                <span className="font-medium text-slate-800">Insulated Refrigerated Van</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Vehicle No:</span>
                <span className="font-mono-numbers font-medium text-slate-800">MH-12-DT-4421</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Payment Status:</span>
                <span className="font-bold uppercase text-green-700">{invoice.status}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Cold Chain Storage Spec:</span>
                <span className="font-medium text-slate-800">Maintain below 4°C</span>
              </div>
            </div>
          </div>

          {/* Line Items Table with Explicit Batch Numbers */}
          <div className="py-4">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b-2 border-slate-900 bg-slate-100 text-slate-800 font-bold">
                  <th className="p-2 w-8">#</th>
                  <th className="p-2">Description of Goods</th>
                  <th className="p-2">Allocated Batch</th>
                  <th className="p-2 text-right">Qty</th>
                  <th className="p-2 text-right">Unit Rate (₹)</th>
                  <th className="p-2 text-right">Taxable (₹)</th>
                  <th className="p-2 text-right">GST %</th>
                  <th className="p-2 text-right">Total (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-mono-numbers">
                {invoice.items.map((item, idx) => {
                  const taxable = item.quantity * item.rate;

                  return (
                    <tr key={idx} className="hover:bg-slate-50/50">
                      <td className="p-2 text-slate-500">{idx + 1}</td>
                      <td className="p-2 font-sans font-medium text-slate-900">
                        {item.productName}
                        <span className="text-[10px] text-slate-500 block font-normal">{item.unit}</span>
                      </td>
                      <td className="p-2">
                        <span className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded text-[11px] font-bold border border-blue-200">
                          {item.batchNumber}
                        </span>
                      </td>
                      <td className="p-2 text-right font-bold text-slate-900">{item.quantity}</td>
                      <td className="p-2 text-right">{item.rate.toFixed(2)}</td>
                      <td className="p-2 text-right">{taxable.toFixed(2)}</td>
                      <td className="p-2 text-right">{item.taxPercent}%</td>
                      <td className="p-2 text-right font-bold text-slate-900">{item.amount.toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Totals & Tax Breakdown */}
          <div className="border-t-2 border-slate-900 pt-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2 text-[11px] text-slate-600">
              <p><strong>Bank Details for NEFT / RTGS:</strong></p>
              <p className="font-mono-numbers">
                HDFC Bank &bull; A/c: 50200088912345 &bull; IFSC: HDFC0001234 &bull; Kothrud Branch
              </p>
              <p className="italic text-[10px] text-slate-500">
                Goods once sold will only be accepted for return within 48 hours in original refrigerated seal.
              </p>
            </div>

            <div className="space-y-1.5 text-xs text-right font-mono-numbers">
              <div className="flex justify-between text-slate-600">
                <span className="font-sans">Subtotal (Taxable Value):</span>
                <span>₹{invoice.subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span className="font-sans">CGST (2.5%):</span>
                <span>₹{(invoice.taxAmount / 2).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span className="font-sans">SGST (2.5%):</span>
                <span>₹{(invoice.taxAmount / 2).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between text-base font-bold text-slate-900 pt-2 border-t border-slate-300">
                <span className="font-sans">Invoice Total:</span>
                <span className="text-blue-700 font-extrabold">
                  ₹{invoice.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>

          {/* Signature Box */}
          <div className="mt-8 pt-6 border-t border-dashed border-slate-300 flex justify-between items-end">
            <div className="text-[10px] text-slate-400">
              Generated digitally by Madhav Dairy ERP System &bull; Batch Traceability Certified
            </div>
            <div className="text-center">
              <div className="w-40 border-b border-slate-900 pb-8 text-xs font-bold text-slate-900">
                For Madhav Dairy Pvt Ltd
              </div>
              <span className="text-[10px] text-slate-500 mt-1 block">Authorized Signatory</span>
            </div>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg"
          >
            Close
          </button>
          <button
            onClick={handleDownload}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg flex items-center gap-1.5"
          >
            <Download className="w-4 h-4" />
            <span>Download PDF</span>
          </button>
          <button
            onClick={handlePrint}
            className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm flex items-center gap-1.5"
          >
            <Printer className="w-4 h-4" />
            <span>Print Invoice</span>
          </button>
        </div>
      </div>
    </Modal>
  );
};
