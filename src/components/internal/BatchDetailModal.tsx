import React from 'react';
import { useDairy } from '../../context/DairyContext';
import { Modal } from '../common/Modal';
import { StatusBadge } from '../common/StatusBadge';
import {
  Layers,
  Calendar,
  Clock,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  AlertCircle,
  FileText,
  Store,
  CheckCircle2,
  PackageCheck
} from 'lucide-react';

interface BatchDetailModalProps {
  batchId: string | null;
  onClose: () => void;
}

export const BatchDetailModal: React.FC<BatchDetailModalProps> = ({ batchId, onClose }) => {
  const { batches, stockMovements, invoices, retailers } = useDairy();

  if (!batchId) return null;

  const batch = batches.find(b => b.id === batchId || b.batchNumber === batchId);
  if (!batch) return null;

  const batchMovements = stockMovements.filter(m => m.batchNumber === batch.batchNumber);
  const relatedInvoices = invoices.filter(inv =>
    inv.items.some(i => i.batchNumber === batch.batchNumber)
  );

  const today = new Date('2026-09-17').getTime();
  const exp = new Date(batch.expiryDate).getTime();
  const daysLeft = Math.ceil((exp - today) / 86400000);

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={`Batch 360° Traceability: ${batch.batchNumber}`}
      subtitle={`Product: ${batch.productName} (${batch.unit})`}
      maxWidth="3xl"
    >
      <div className="space-y-6 text-xs">
        {/* Top Header Card */}
        <div className="bg-gradient-to-r from-blue-50/70 via-slate-50 to-sky-50/30 p-4 rounded-2xl border border-slate-200">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-black text-slate-900 font-mono-numbers">
                  Batch #{batch.batchNumber}
                </span>
                <StatusBadge status={batch.status} type="batch" />
              </div>
              <p className="text-xs text-slate-600 mt-1">
                {batch.notes || 'Full chain batch tracking active from milk processing silo to retail counter.'}
              </p>
            </div>

            <div className="text-right">
              <span className="text-[10px] text-slate-500 uppercase font-bold block">
                Expiry Status
              </span>
              <span
                className={`text-xs font-bold px-2 py-1 rounded-md font-mono-numbers inline-flex items-center gap-1 ${
                  daysLeft <= 3
                    ? 'bg-red-100 text-red-800'
                    : daysLeft <= 7
                    ? 'bg-amber-100 text-amber-900'
                    : 'bg-green-100 text-green-900'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>{daysLeft > 0 ? `${daysLeft} days remaining` : 'Expired'}</span>
              </span>
              <p className="text-[10px] text-slate-500 mt-0.5">
                Expiry Date: <strong>{batch.expiryDate}</strong>
              </p>
            </div>
          </div>
        </div>

        {/* Traceability Metrics Cards */}
        <div>
          <h4 className="font-bold text-slate-800 mb-2 uppercase text-[11px] tracking-wider">
            Batch Stock Balance Breakdown
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-center">
            <div className="p-3.5 bg-white rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[10px] text-slate-500 block uppercase font-bold">Produced</span>
              <span className="text-base font-black text-slate-900 font-mono-numbers mt-1 block">
                {batch.producedQty}
              </span>
              <span className="text-[10px] text-slate-400">Total inward</span>
            </div>

            <div className="p-3.5 bg-white rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[10px] text-slate-500 block uppercase font-bold">Sold Outward</span>
              <span className="text-base font-black text-slate-900 font-mono-numbers mt-1 block">
                {batch.soldQty}
              </span>
              <span className="text-[10px] text-slate-400">To retailers</span>
            </div>

            <div className="p-3.5 bg-white rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[10px] text-slate-500 block uppercase font-bold">Returned</span>
              <span className="text-base font-black text-amber-700 font-mono-numbers mt-1 block">
                {batch.returnedQty}
              </span>
              <span className="text-[10px] text-slate-400">Customer returns</span>
            </div>

            <div className="p-3.5 bg-white rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[10px] text-slate-500 block uppercase font-bold">Damaged / QC</span>
              <span className="text-base font-black text-red-600 font-mono-numbers mt-1 block">
                {batch.damagedQty}
              </span>
              <span className="text-[10px] text-slate-400">Scrapped</span>
            </div>

            <div className="p-3.5 bg-blue-50 rounded-2xl border-2 border-blue-200 shadow-xs col-span-2 sm:col-span-1">
              <span className="text-[10px] text-blue-900 block uppercase font-bold">Available Now</span>
              <span className="text-lg font-black text-blue-950 font-mono-numbers mt-0.5 block">
                {batch.availableQty}
              </span>
              <span className="text-[10px] text-blue-700 font-bold">Ready in storage</span>
            </div>
          </div>
        </div>

        {/* Visual Stock Movement Timeline */}
        <div>
          <h4 className="font-bold text-slate-800 mb-2 uppercase text-[11px] tracking-wider">
            Audit Ledger: Batch Stock Movement Timeline
          </h4>
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-subtle space-y-4">
            {batchMovements.length > 0 ? (
              <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                {batchMovements.map((mov, idx) => {
                  const isPositive = mov.quantity > 0;

                  return (
                    <div key={mov.id || idx} className="relative group">
                      <div
                        className={`absolute -left-6 top-1 w-4 h-4 rounded-full border-2 border-white flex items-center justify-center ${
                          mov.type === 'production'
                            ? 'bg-blue-600'
                            : mov.type === 'sale'
                            ? 'bg-slate-700'
                            : mov.type === 'return'
                            ? 'bg-amber-500'
                            : 'bg-red-500'
                        }`}
                      ></div>
                      <div className="flex flex-wrap items-center justify-between gap-1">
                        <div className="flex items-center gap-2">
                          <StatusBadge status={mov.type} type="movement" size="sm" />
                          <span className="font-mono-numbers font-bold text-xs text-slate-900">
                            {isPositive ? `+${mov.quantity}` : mov.quantity} units
                          </span>
                          <span className="text-slate-500 text-[11px]">
                            ({mov.fromLocation} &rarr; {mov.toLocation})
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono-numbers">
                          {mov.date} {mov.time && `• ${mov.time}`} &bull; Ref: {mov.reference} &bull; {mov.user}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-4 text-slate-400">
                Initial batch creation recorded: +{batch.producedQty} units.
              </div>
            )}

            <div className="pt-3 border-t border-slate-200 flex justify-between items-center text-xs font-bold text-slate-900 bg-slate-50/80 p-3 rounded-xl">
              <span>Final Reconciled Available Stock:</span>
              <span className="text-blue-700 font-mono-numbers text-sm font-extrabold">
                {batch.availableQty} units
              </span>
            </div>
          </div>
        </div>

        {/* Related Invoices & Retailers */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Related Invoices */}
          <div>
            <h4 className="font-bold text-slate-800 mb-2 uppercase text-[11px] tracking-wider">
              Associated Invoices
            </h4>
            <div className="border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100 bg-white">
              {relatedInvoices.length > 0 ? (
                relatedInvoices.map(inv => (
                  <div key={inv.id} className="p-3 flex items-center justify-between hover:bg-blue-50/40">
                    <div>
                      <span className="font-mono-numbers font-bold text-slate-900 text-xs">
                        {inv.invoiceNumber}
                      </span>
                      <p className="text-[11px] text-slate-500 font-medium">{inv.retailerName}</p>
                    </div>
                    <div className="text-right">
                      <span className="font-mono-numbers font-bold text-slate-800">
                        ₹{inv.totalAmount.toLocaleString('en-IN')}
                      </span>
                      <p className="text-[10px] text-slate-400">{inv.date}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-3 text-center text-slate-400">No invoices billed yet</div>
              )}
            </div>
          </div>

          {/* Key Batch Dates */}
          <div>
            <h4 className="font-bold text-slate-800 mb-2 uppercase text-[11px] tracking-wider">
              Quality & Regulatory Attributes
            </h4>
            <div className="border border-slate-200 rounded-2xl p-3.5 bg-white space-y-2 text-xs">
              <div className="flex justify-between pb-1 border-b border-slate-100">
                <span className="text-slate-500">Manufactured Date:</span>
                <span className="font-semibold text-slate-900">{batch.productionDate}</span>
              </div>
              <div className="flex justify-between pb-1 border-b border-slate-100">
                <span className="text-slate-500">Expiry Date:</span>
                <span className="font-bold text-red-700">{batch.expiryDate}</span>
              </div>
              <div className="flex justify-between pb-1 border-b border-slate-100">
                <span className="text-slate-500">FSSAI Lab Status:</span>
                <span className="font-bold text-green-700 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Passed Standard
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Traceability Seal:</span>
                <span className="font-mono-numbers text-[10px] text-blue-900 bg-blue-50 px-2 py-0.5 rounded font-bold border border-blue-200">
                  QR-MD-{batch.batchNumber}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};
