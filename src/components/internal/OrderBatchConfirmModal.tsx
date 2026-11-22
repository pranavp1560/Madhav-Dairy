import React, { useState, useEffect, useMemo } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { CheckCircle2, AlertTriangle, Layers, Calendar, PackageCheck, User, Store } from 'lucide-react';
import { Order, Batch, OrderItem } from '../../types/dairy';

interface OrderBatchConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
  batches: Batch[];
  onConfirm: (orderId: string, itemBatches: Record<string, string>) => Promise<void>;
}

export const OrderBatchConfirmModal: React.FC<OrderBatchConfirmModalProps> = ({
  isOpen,
  onClose,
  order,
  batches,
  onConfirm,
}) => {
  // Map of (item.id || item.skuId || item.productId) -> selected batchId
  const [selectedBatches, setSelectedBatches] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Group active batches by SKU or Product with FIFO sorting (earliest mfg / expiry date)
  const getSortedFifoBatches = (item: OrderItem): Batch[] => {
    const matching = batches.filter(b => {
      if (b.status !== 'active') return false;
      if (item.skuId && b.skuId) {
        return b.skuId === item.skuId;
      }
      return b.productId === item.productId;
    });

    return [...matching].sort((a, b) => {
      // Prioritize batches with stock available
      if (a.availableQty > 0 && b.availableQty <= 0) return -1;
      if (b.availableQty > 0 && a.availableQty <= 0) return 1;

      // FIFO: First In, First Out (earliest production date, fallback earliest expiry date)
      const dateA = a.productionDate || a.expiryDate || '9999-99-99';
      const dateB = b.productionDate || b.expiryDate || '9999-99-99';
      return dateA.localeCompare(dateB);
    });
  };

  // Initialize FIFO defaults whenever the modal opens or order changes
  useEffect(() => {
    if (!isOpen || !order) {
      setSelectedBatches({});
      setErrorMsg(null);
      return;
    }

    const initialSelections: Record<string, string> = {};
    (order.items || []).forEach(item => {
      const key = item.id || item.skuId || item.productId;
      if (!key) return;

      // If item already has a batch allocated, preserve it
      if (item.batchId) {
        initialSelections[key] = item.batchId;
      } else {
        // Auto-select earliest FIFO batch
        const fifoBatches = getSortedFifoBatches(item);
        if (fifoBatches.length > 0) {
          initialSelections[key] = fifoBatches[0].id;
        }
      }
    });

    setSelectedBatches(initialSelections);
    setErrorMsg(null);
  }, [isOpen, order, batches]);

  if (!order) return null;

  const isDirect = order.orderType === 'direct_customer' || (!order.retailerId && Boolean(order.directCustomerName));
  const customerName = isDirect
    ? (order.directCustomerName || 'Direct Customer')
    : (order.retailerName || 'Retail Partner');

  const handleBatchChange = (itemKey: string, batchId: string) => {
    setSelectedBatches(prev => ({
      ...prev,
      [itemKey]: batchId,
    }));
  };

  const handleConfirm = async () => {
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      await onConfirm(order.id, selectedBatches);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to allocate batches and confirm order.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        if (!isSubmitting) onClose();
      }}
      title={`Confirm Order ${order.orderNumber}`}
      subtitle="Select inventory batches on FIFO basis before confirming order"
      maxWidth="xl"
    >
      <div className="space-y-5 font-sans text-sm">
        {/* Order Header Summary Banner */}
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {isDirect ? (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-700 border border-purple-200 inline-flex items-center gap-1">
                  <User className="w-3 h-3" />
                  Direct Customer
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-700 border border-blue-200 inline-flex items-center gap-1">
                  <Store className="w-3 h-3" />
                  Retail Partner
                </span>
              )}
              <span className="font-extrabold text-slate-900 text-base">{customerName}</span>
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-500 block">Total Bill</span>
              <span className="font-black text-slate-900 font-mono-numbers text-base">
                ₹{order.totalAmount.toLocaleString('en-IN')}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 pt-1 border-t border-slate-200/60 font-mono-numbers">
            <div>
              <span className="text-slate-400">Order Date:</span> {order.orderDate}
            </div>
            {order.deliveryDate && (
              <div>
                <span className="text-slate-400">Delivery Date:</span> {order.deliveryDate}
              </div>
            )}
            <div>
              <span className="text-slate-400">Items:</span> {order.items?.length || 0} Products
            </div>
          </div>
        </div>

        {/* Informational FIFO note */}
        <div className="p-3 bg-blue-50/80 border border-blue-200 rounded-xl flex items-start gap-2.5 text-xs text-blue-900">
          <PackageCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <strong className="font-bold">FIFO Auto-Allocation:</strong> By default, the system pre-selects the oldest active batch with available stock to ensure First-In, First-Out rotation. You can verify or choose an alternate batch below.
          </p>
        </div>

        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-xs font-semibold text-rose-700">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Order Items Batch Allocation List */}
        <div className="space-y-3">
          <h4 className="text-xs font-black uppercase tracking-wider text-slate-500">
            Line Items & Batch Allocation
          </h4>

          <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-hidden">
            {(order.items || []).map((item, idx) => {
              const itemKey = item.id || item.skuId || item.productId || `item-${idx}`;
              const availableBatches = getSortedFifoBatches(item);
              const selectedBatchId = selectedBatches[itemKey] || '';
              const chosenBatch = batches.find(b => b.id === selectedBatchId);
              const fifoBatch = availableBatches[0];
              const isFifoSelected = chosenBatch && fifoBatch && chosenBatch.id === fifoBatch.id;

              return (
                <div key={itemKey} className="p-3.5 bg-white hover:bg-slate-50/50 transition-colors space-y-2.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                    <div>
                      <h5 className="font-bold text-slate-900 text-sm">
                        {item.productName}
                      </h5>
                      {item.variantName && (
                        <span className="inline-block mt-0.5 px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[11px] font-semibold border border-slate-200">
                          {item.variantName}
                        </span>
                      )}
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-bold text-slate-800 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200 inline-block font-mono-numbers">
                        Qty: {item.quantity} {item.unit}
                      </span>
                    </div>
                  </div>

                  {/* Batch Selection Dropdown */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-700 flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <Layers className="w-3.5 h-3.5 text-blue-600" />
                        <span>Select Batch (Shows Batch Number & Stock):</span>
                      </span>
                      {isFifoSelected && (
                        <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          ✓ FIFO Earliest Batch
                        </span>
                      )}
                    </label>

                    <select
                      value={selectedBatchId}
                      onChange={e => handleBatchChange(itemKey, e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 font-mono-numbers"
                    >
                      {availableBatches.length === 0 ? (
                        <option value="">⚠️ No active batch currently in inventory (Auto-allocate later)</option>
                      ) : (
                        availableBatches.map((b, bIdx) => {
                          const isFirst = bIdx === 0;
                          return (
                            <option key={b.id} value={b.id}>
                              Batch #{b.batchNumber} — Stock: {b.availableQty} {b.unit} | Mfg: {b.productionDate} | Exp: {b.expiryDate} {isFirst ? '⭐ (FIFO Recommended)' : ''}
                            </option>
                          );
                        })
                      )}
                    </select>

                    {/* Batch Details pill */}
                    {chosenBatch && (
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-600 pt-0.5 font-mono-numbers">
                        <span className="font-semibold text-slate-800">
                          Batch Number: <strong className="font-extrabold text-blue-700">#{chosenBatch.batchNumber}</strong>
                        </span>
                        <span>•</span>
                        <span className={`${chosenBatch.availableQty >= item.quantity ? 'text-emerald-700 font-bold' : 'text-amber-700 font-bold'}`}>
                          Available Stock: {chosenBatch.availableQty} {chosenBatch.unit}
                        </span>
                        <span>•</span>
                        <span className="text-slate-500">
                          Mfg: {chosenBatch.productionDate}
                        </span>
                        <span>•</span>
                        <span className="text-slate-500">
                          Expiry: {chosenBatch.expiryDate}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
          <Button
            type="button"
            variant="secondary"
            size="md"
            disabled={isSubmitting}
            onClick={onClose}
          >
            Cancel
          </Button>

          <Button
            type="button"
            variant="primary"
            size="md"
            isLoading={isSubmitting}
            icon={<CheckCircle2 className="w-4 h-4" />}
            onClick={handleConfirm}
          >
            Confirm Order & Assign Batches
          </Button>
        </div>
      </div>
    </Modal>
  );
};
