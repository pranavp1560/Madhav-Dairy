import React, { useState, useEffect } from 'react';
import { useDairy } from '../../context/DairyContext';
import { Modal } from '../common/Modal';
import { Plus, Trash2, Check, FileText, Sparkles, Layers, AlertTriangle } from 'lucide-react';

interface CreateInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenPrintInvoice?: (invoiceId: string) => void;
}

interface ItemRow {
  productId: string;
  batchNumber: string;
  quantity: number;
  rate: number;
  taxPercent: number;
  discount: number;
}

export const CreateInvoiceModal: React.FC<CreateInvoiceModalProps> = ({
  isOpen,
  onClose,
  onOpenPrintInvoice,
}) => {
  const { retailers, products, batches, createInvoice, channelPrices, salesChannels, addToast } = useDairy();

  const [retailerId, setRetailerId] = useState<string>(retailers[0]?.id || '');
  const [rows, setRows] = useState<ItemRow[]>([
    {
      productId: products[0]?.id || '',
      batchNumber: batches.find(b => b.productId === products[0]?.id)?.batchNumber || batches[0]?.batchNumber || '',
      quantity: 10,
      rate: products[0]?.defaultPrice || 120,
      taxPercent: 5,
      discount: 0,
    },
  ]);

  const selectedRetailer = retailers.find(r => r.id === retailerId);
  const retailerChannelId = selectedRetailer?.salesChannelId || salesChannels.find(c => c.code === 'WHOLESALE')?.id;
  const retailerChannelName = selectedRetailer?.salesChannelName || (salesChannels.find(c => c.id === retailerChannelId)?.name) || 'Wholesale';

  const getProductPricing = (prodId: string) => {
    if (!retailerChannelId) return null;
    return channelPrices.find(
      cp => cp.productId === prodId && cp.channelId === retailerChannelId && cp.isActive
    );
  };

  // Sync rows rates with retailer channel when retailer changes
  useEffect(() => {
    if (!selectedRetailer || products.length === 0) return;
    setRows(prev =>
      prev.map(r => {
        const cp = getProductPricing(r.productId);
        const prod = products.find(p => p.id === r.productId);
        const effectiveRate = cp ? cp.standardPrice : (prod?.defaultPrice || r.rate);
        return {
          ...r,
          rate: effectiveRate,
        };
      })
    );
  }, [retailerId]);

  const handleProductChange = (index: number, newProdId: string) => {
    const prod = products.find(p => p.id === newProdId);
    const availableBatch = batches.find(b => b.productId === newProdId && b.availableQty > 0) || batches.find(b => b.productId === newProdId);
    const cp = getProductPricing(newProdId);

    const updated = [...rows];
    updated[index] = {
      ...updated[index],
      productId: newProdId,
      batchNumber: availableBatch?.batchNumber || 'GEN-01',
      rate: cp ? cp.standardPrice : (prod?.defaultPrice || 100),
    };
    setRows(updated);
  };

  const handleRowChange = (index: number, field: keyof ItemRow, val: any) => {
    const updated = [...rows];
    updated[index] = { ...updated[index], [field]: val };
    setRows(updated);
  };

  const addRow = () => {
    setRows([
      ...rows,
      {
        productId: products[0]?.id || '',
        batchNumber: batches[0]?.batchNumber || '',
        quantity: 5,
        rate: products[0]?.defaultPrice || 100,
        taxPercent: 5,
        discount: 0,
      },
    ]);
  };

  const removeRow = (index: number) => {
    if (rows.length === 1) return;
    setRows(rows.filter((_, idx) => idx !== index));
  };

  // Calculations
  const subtotal = rows.reduce((acc, row) => acc + (row.quantity * row.rate - (row.discount || 0)), 0);
  const taxAmount = rows.reduce((acc, row) => {
    const taxable = row.quantity * row.rate - (row.discount || 0);
    return acc + (taxable * row.taxPercent) / 100;
  }, 0);
  const totalAmount = Math.round(subtotal + taxAmount);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!retailerId || rows.length === 0) return;

    // Check floor pricing violations
    const floorViolation = rows.find(r => {
      const cp = getProductPricing(r.productId);
      return cp && r.rate < cp.minimumPrice;
    });

    if (floorViolation) {
      const cp = getProductPricing(floorViolation.productId);
      const prod = products.find(p => p.id === floorViolation.productId);
      addToast(
        `Cannot generate invoice: Rate for "${prod?.name || 'item'}" (₹${floorViolation.rate}) is below the ${retailerChannelName} minimum price (₹${cp?.minimumPrice}).`,
        'error'
      );
      return;
    }

    try {
      const newInv = await createInvoice({
        retailerId,
        items: rows.map(r => ({
          productId: r.productId,
          batchNumber: r.batchNumber,
          quantity: r.quantity,
          rate: r.rate,
          taxPercent: r.taxPercent,
          discount: r.discount,
        })),
      });

      onClose();
      if (onOpenPrintInvoice) {
        onOpenPrintInvoice(newInv.id);
      }
    } catch {
      // Toast displayed in context
    }
  };

  const hasFloorViolations = rows.some(r => {
    const cp = getProductPricing(r.productId);
    return cp && r.rate < cp.minimumPrice;
  });

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Generate Tax Invoice"
      subtitle="Creates GST B2B invoice with specific batch allocation for traceability"
      maxWidth="4xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        {hasFloorViolations && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-red-700 font-medium">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>One or more item rates are below the channel minimum floor price. Please adjust rates before submitting.</span>
          </div>
        )}

        {/* Retailer Select */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block font-semibold text-slate-700">
              Bill To Retailer / Customer <span className="text-red-500">*</span>
            </label>
            {selectedRetailer && (
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                Channel: {retailerChannelName}
              </span>
            )}
          </div>
          {retailers.length === 0 ? (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs">
              No registered customers found. Please add a customer first from the Retailers screen.
            </div>
          ) : (
            <select
              value={retailerId}
              onChange={e => setRetailerId(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50/50 border border-slate-300 rounded-lg text-xs text-slate-800 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 focus:outline-none"
              required
            >
              {retailers.map(r => (
                <option key={r.id} value={r.id}>
                  {r.businessName} ({r.area}) &bull; Channel: {r.salesChannelName || 'Wholesale'} &bull; Outstanding: ₹{r.outstandingAmount.toLocaleString('en-IN')} &bull; GST: {r.gstin}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Item Rows Table with Batch Selection Prominence */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-bold text-slate-800 uppercase text-[11px] tracking-wider">
              Billed Items & Batch Traceability Allocation
            </h4>
            <button
              type="button"
              onClick={addRow}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Product Row</span>
            </button>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-x-auto shadow-xs">
            <table className="w-full text-left text-xs min-w-[650px]">
              <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-2.5">Product</th>
                  <th className="p-2.5">Allocated Batch *</th>
                  <th className="p-2.5 w-20 text-right">Qty</th>
                  <th className="p-2.5 w-24 text-right">Rate (₹)</th>
                  <th className="p-2.5 w-20 text-right">GST %</th>
                  <th className="p-2.5 w-28 text-right">Line Total</th>
                  <th className="p-2.5 w-10 text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row, idx) => {
                  const productBatches = batches.filter(b => b.productId === row.productId);
                  const lineTotal = row.quantity * row.rate * (1 + row.taxPercent / 100);
                  const cp = getProductPricing(row.productId);
                  const minPrice = cp ? cp.minimumPrice : 0;
                  const isBelowFloor = minPrice > 0 && row.rate < minPrice;

                  return (
                    <tr key={idx} className={`hover:bg-blue-50/40 ${isBelowFloor ? 'bg-red-50/40' : ''}`}>
                      <td className="p-2">
                        <select
                          value={row.productId}
                          onChange={e => handleProductChange(idx, e.target.value)}
                          className="w-full p-1.5 bg-white border border-slate-300 rounded text-xs text-slate-800 focus:border-blue-600 focus:ring-1 focus:ring-blue-100 focus:outline-none"
                        >
                          {products.map(p => (
                            <option key={p.id} value={p.id}>
                              {p.name} ({p.unit})
                            </option>
                          ))}
                        </select>
                      </td>

                      <td className="p-2">
                        <select
                          value={row.batchNumber}
                          onChange={e => handleRowChange(idx, 'batchNumber', e.target.value)}
                          className="w-full p-1.5 bg-blue-50 border border-blue-200 rounded text-xs font-mono-numbers font-semibold text-blue-900 focus:border-blue-600 focus:ring-1 focus:ring-blue-100 focus:outline-none"
                        >
                          {productBatches.length > 0 ? (
                            productBatches.map(b => (
                              <option key={b.id} value={b.batchNumber}>
                                {b.batchNumber} (Avail: {b.availableQty}, Exp: {b.expiryDate})
                              </option>
                            ))
                          ) : (
                            <option value={batches[0]?.batchNumber || 'GEN-01'}>
                              {batches[0]?.batchNumber || 'GEN-01'}
                            </option>
                          )}
                        </select>
                      </td>

                      <td className="p-2 text-right">
                        <input
                          type="number"
                          min="1"
                          value={row.quantity}
                          onChange={e => handleRowChange(idx, 'quantity', parseInt(e.target.value) || 0)}
                          className="w-16 p-1.5 bg-white border border-slate-300 rounded text-xs font-mono-numbers text-right focus:border-blue-600 focus:ring-1 focus:ring-blue-100 focus:outline-none"
                        />
                      </td>

                      <td className="p-2 text-right">
                        <input
                          type="number"
                          value={row.rate}
                          onChange={e => handleRowChange(idx, 'rate', parseFloat(e.target.value) || 0)}
                          className={`w-20 p-1.5 bg-white border rounded text-xs font-mono-numbers text-right focus:outline-none ${
                            isBelowFloor
                              ? 'border-red-500 text-red-700 bg-red-50 focus:ring-1 focus:ring-red-200'
                              : 'border-slate-300 focus:border-blue-600 focus:ring-1 focus:ring-blue-100'
                          }`}
                        />
                        {minPrice > 0 && (
                          <div className={`text-[9px] mt-0.5 font-mono-numbers ${isBelowFloor ? 'text-red-600 font-bold' : 'text-slate-400'}`}>
                            {isBelowFloor ? `Floor: ₹${minPrice}` : `Min: ₹${minPrice}`}
                          </div>
                        )}
                      </td>

                      <td className="p-2 text-right">
                        <select
                          value={row.taxPercent}
                          onChange={e => handleRowChange(idx, 'taxPercent', parseInt(e.target.value))}
                          className="p-1.5 bg-white border border-slate-300 rounded text-xs text-right font-mono-numbers focus:border-blue-600 focus:ring-1 focus:ring-blue-100 focus:outline-none"
                        >
                          <option value="0">0%</option>
                          <option value="5">5%</option>
                          <option value="12">12%</option>
                          <option value="18">18%</option>
                        </select>
                      </td>

                      <td className="p-2 text-right font-bold text-slate-900 font-mono-numbers">
                        ₹{Math.round(lineTotal).toLocaleString('en-IN')}
                      </td>

                      <td className="p-2 text-center">
                        <button
                          type="button"
                          onClick={() => removeRow(idx)}
                          disabled={rows.length === 1}
                          className="text-slate-400 hover:text-red-600 disabled:opacity-30"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Invoice Summary */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-slate-50 p-4 rounded-xl border border-slate-200 gap-3">
          <div className="text-xs text-slate-600 space-y-1">
            <p>Payment Terms: <strong>Net 15 Days</strong> from invoice issue date.</p>
            <p className="text-[11px] text-slate-500">
              Allocated batches will immediately deduct available warehouse stock.
            </p>
          </div>

          <div className="text-right space-y-1">
            <div className="text-xs text-slate-600">
              Taxable Subtotal: <span className="font-mono-numbers font-semibold">₹{Math.round(subtotal).toLocaleString('en-IN')}</span>
            </div>
            <div className="text-xs text-slate-600">
              Total GST: <span className="font-mono-numbers font-semibold">₹{Math.round(taxAmount).toLocaleString('en-IN')}</span>
            </div>
            <div className="text-sm font-bold text-slate-900 pt-1 border-t border-slate-300">
              Invoice Total:{' '}
              <span className="text-blue-700 font-mono-numbers text-base font-extrabold">
                ₹{totalAmount.toLocaleString('en-IN')}
              </span>
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={retailers.length === 0 || products.length === 0 || hasFloorViolations}
            className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-xs flex items-center gap-1.5"
          >
            <Check className="w-4 h-4" />
            <span>Create & Generate Invoice</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};
