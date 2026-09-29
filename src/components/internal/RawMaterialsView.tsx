import React, { useState } from 'react';
import { useDairy } from '../../context/DairyContext';
import { RawMaterial } from '../../types/dairy';
import { StatusBadge } from '../ui/StatusBadge';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { Drawer } from '../ui/Drawer';
import { Input } from '../ui/Input';
import {
  Boxes,
  Plus,
  Minus,
  AlertTriangle,
  History,
  Search,
  Filter,
  PackageCheck,
  ShoppingCart,
  Flame,
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  Layers,
  Sparkles,
  Info
} from 'lucide-react';

export const RawMaterialsView: React.FC = () => {
  const { rawMaterials, rawMaterialMovements, addRawMaterialPurchase, recordRawMaterialUsage } = useDairy();

  // Navigation tab
  const [activeTab, setActiveTab] = useState<'inventory' | 'purchases' | 'usage'>('inventory');

  // Filter & search
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [selectedMaterial, setSelectedMaterial] = useState<RawMaterial | null>(null);

  // --- Purchase Modal State ---
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
  const [purchaseMaterialId, setPurchaseMaterialId] = useState<string>(rawMaterials[0]?.id || '');
  const [isNewMaterialMode, setIsNewMaterialMode] = useState(false);
  const [newMaterialName, setNewMaterialName] = useState('');
  const [newMaterialCategory, setNewMaterialCategory] = useState('Dairy Inward');
  const [newMaterialUnit, setNewMaterialUnit] = useState('Litres');
  const [purchaseQty, setPurchaseQty] = useState<number>(100);
  const [purchaseCost, setPurchaseCost] = useState<number>(36);
  const [purchaseSupplier, setPurchaseSupplier] = useState('');
  const [purchaseRef, setPurchaseRef] = useState('');
  const [purchaseNotes, setPurchaseNotes] = useState('');

  // --- Usage Modal State ---
  const [isUsageModalOpen, setIsUsageModalOpen] = useState(false);
  const [usageMaterialId, setUsageMaterialId] = useState<string>(rawMaterials[0]?.id || '');
  const [usageQty, setUsageQty] = useState<number>(50);
  const [usagePurpose, setUsagePurpose] = useState('Production Run (Basundi / Pedha / Paneer / Shrikhand)');
  const [usageBatch, setUsageBatch] = useState('Batch BAS-2026-081');
  const [usageNotes, setUsageNotes] = useState('');
  const [usageError, setUsageError] = useState('');

  // Summary counts
  const totalCount = rawMaterials.length;
  const lowStockCount = rawMaterials.filter(m => m.status === 'low_stock').length;
  const outOfStockCount = rawMaterials.filter(m => m.status === 'out_of_stock').length;
  const healthyCount = rawMaterials.filter(m => m.status === 'healthy').length;

  const categories = ['All', ...Array.from(new Set(rawMaterials.map(m => m.category)))];

  const filteredMaterials = rawMaterials.filter(m => {
    const matchesSearch = m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          m.supplier.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (m.nameMr && m.nameMr.includes(searchQuery));
    const matchesCategory = categoryFilter === 'All' || m.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const materialMovements = selectedMaterial
    ? rawMaterialMovements.filter(mov => mov.materialId === selectedMaterial.id)
    : [];

  const purchaseMovements = rawMaterialMovements.filter(mov => mov.type === 'purchase');
  const usageMovements = rawMaterialMovements.filter(mov => mov.type === 'production_consumption');

  // Open Purchase Modal
  const openPurchaseModal = (matId?: string) => {
    const target = matId ? rawMaterials.find(m => m.id === matId) : (rawMaterials.find(m => m.id === purchaseMaterialId) || rawMaterials[0]);
    if (matId) {
      setPurchaseMaterialId(matId);
      setIsNewMaterialMode(false);
    }
    if (target) {
      setPurchaseCost(target.costPerUnit || 35);
      setPurchaseSupplier(target.supplier || 'Farmer Co-op / Supplier');
    }
    setPurchaseQty(target && target.unit === 'Litres' ? 500 : 50);
    setPurchaseRef(`PO-2026-${Math.floor(100 + Math.random() * 900)}`);
    setPurchaseNotes('');
    setIsPurchaseModalOpen(true);
  };

  // Open Usage Modal
  const openUsageModal = (matId?: string) => {
    const idToUse = matId || usageMaterialId || rawMaterials[0]?.id;
    setUsageMaterialId(idToUse);
    const target = rawMaterials.find(m => m.id === idToUse);
    const defaultQty = target && target.currentStock > 100 ? (target.unit === 'Litres' ? 200 : 25) : Math.min(10, target?.currentStock || 0);
    setUsageQty(defaultQty);
    setUsageError('');
    setUsageBatch(`Batch-${new Date().toISOString().slice(5, 10).replace('-', '')}-${Math.floor(10 + Math.random() * 90)}`);
    setUsageNotes('');
    setIsUsageModalOpen(true);
  };

  // Handle Purchase Submit
  const handlePurchaseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isNewMaterialMode) {
      if (!newMaterialName.trim() || purchaseQty <= 0) return;
      addRawMaterialPurchase({
        newMaterialName: newMaterialName.trim(),
        category: newMaterialCategory,
        unit: newMaterialUnit,
        qty: Number(purchaseQty),
        costPerUnit: Number(purchaseCost),
        supplier: purchaseSupplier.trim() || 'General Supplier',
        reference: purchaseRef || `PO-2026-${Math.floor(100 + Math.random() * 900)}`,
        notes: purchaseNotes,
      });
    } else {
      if (!purchaseMaterialId || purchaseQty <= 0) return;
      addRawMaterialPurchase({
        materialId: purchaseMaterialId,
        qty: Number(purchaseQty),
        costPerUnit: Number(purchaseCost),
        supplier: purchaseSupplier.trim(),
        reference: purchaseRef || `PO-2026-${Math.floor(100 + Math.random() * 900)}`,
        notes: purchaseNotes,
      });
    }
    setIsPurchaseModalOpen(false);
    setIsNewMaterialMode(false);
    setNewMaterialName('');
  };

  // Handle Usage Submit
  const handleUsageSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!usageMaterialId || usageQty <= 0) return;
    const target = rawMaterials.find(m => m.id === usageMaterialId);
    if (!target) return;

    if (usageQty > target.currentStock) {
      setUsageError(`Cannot use ${usageQty} ${target.unit}. Only ${target.currentStock.toLocaleString()} ${target.unit} currently available!`);
      return;
    }

    const success = recordRawMaterialUsage({
      materialId: usageMaterialId,
      qty: Number(usageQty),
      purpose: usagePurpose,
      batchNumber: usageBatch,
      notes: usageNotes,
    });

    if (success) {
      setIsUsageModalOpen(false);
      setUsageError('');
    }
  };

  const currentUsageTarget = rawMaterials.find(m => m.id === usageMaterialId);
  const currentPurchaseTarget = rawMaterials.find(m => m.id === purchaseMaterialId);

  return (
    <div className="space-y-5">
      {/* Header bar with primary action buttons */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-blue-600 uppercase tracking-wider">
            <Boxes className="w-4 h-4" />
            <span>Inventory & Supply Chain</span>
          </div>
          <h1 className="text-xl font-black text-slate-900 mt-1">
            Raw Material Management
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Add raw material purchases to increase inventory, or record material usage as items are consumed in production.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
          <Button
            variant="outline"
            size="sm"
            icon={<Flame className="w-4 h-4 text-amber-600" />}
            onClick={() => openUsageModal()}
            className="border-amber-300 text-amber-700 hover:bg-amber-50 hover:border-amber-400"
          >
            Record Material Used
          </Button>

          <Button
            variant="primary"
            size="sm"
            icon={<Plus className="w-4 h-4" />}
            onClick={() => openPurchaseModal()}
          >
            Add New Purchase
          </Button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">Tracked Materials</p>
            <p className="text-xl font-bold text-slate-900 mt-0.5 font-mono-numbers">{totalCount}</p>
            <span className="text-[11px] text-blue-600 font-medium">In master catalog</span>
          </div>
          <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
            <Boxes className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">Adequate Stock</p>
            <p className="text-xl font-bold text-green-700 mt-0.5 font-mono-numbers">{healthyCount}</p>
            <span className="text-[11px] text-green-600 font-medium">Healthy inventory</span>
          </div>
          <div className="w-9 h-9 rounded-lg bg-green-50 text-green-600 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-amber-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">Low Stock Alert</p>
            <p className="text-xl font-bold text-amber-700 mt-0.5 font-mono-numbers">{lowStockCount}</p>
            <span className="text-[11px] text-amber-600 font-medium">Reorder required</span>
          </div>
          <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">Depleted / Zero</p>
            <p className="text-xl font-bold text-slate-900 mt-0.5 font-mono-numbers">{outOfStockCount}</p>
            <span className="text-[11px] text-slate-500 font-medium">Needs procurement</span>
          </div>
          <div className="w-9 h-9 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center">
            <PackageCheck className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white p-1.5 rounded-xl border border-slate-200 shadow-sm flex gap-1 overflow-x-auto text-xs">
        <button
          onClick={() => setActiveTab('inventory')}
          className={`px-3.5 py-2 rounded-lg font-semibold whitespace-nowrap transition-all flex items-center gap-2 ${
            activeTab === 'inventory'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <Boxes className="w-4 h-4" />
          <span>Materials & Current Stock ({rawMaterials.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('purchases')}
          className={`px-3.5 py-2 rounded-lg font-semibold whitespace-nowrap transition-all flex items-center gap-2 ${
            activeTab === 'purchases'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <ArrowDownLeft className="w-4 h-4 text-green-500" />
          <span>Purchases Log (Inward) ({purchaseMovements.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('usage')}
          className={`px-3.5 py-2 rounded-lg font-semibold whitespace-nowrap transition-all flex items-center gap-2 ${
            activeTab === 'usage'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <ArrowUpRight className="w-4 h-4 text-amber-500" />
          <span>Usage Log (Consumed) ({usageMovements.length})</span>
        </button>
      </div>

      {/* Tab 1: Materials & Current Stock */}
      {activeTab === 'inventory' && (
        <div className="space-y-4">
          {/* Search and Category Filter Bar */}
          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search raw material or supplier..."
                className="w-full text-xs pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600 focus:bg-white text-slate-900 transition-colors"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-xs text-slate-500 font-medium">Category:</span>
              <select
                value={categoryFilter}
                onChange={e => setCategoryFilter(e.target.value)}
                className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600 cursor-pointer"
              >
                {categories.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Raw Materials Main Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[10px] tracking-wider font-semibold">
                  <tr>
                    <th className="py-3 px-4">Raw Material</th>
                    <th className="py-3 px-3">Category</th>
                    <th className="py-3 px-3 text-right">Current Available Stock</th>
                    <th className="py-3 px-3 text-right">Min Safety Stock</th>
                    <th className="py-3 px-3 text-right">Est. Cost / Unit</th>
                    <th className="py-3 px-3">Primary Supplier</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800">
                  {filteredMaterials.map(m => (
                    <tr key={m.id} className="hover:bg-blue-50/30 transition-colors">
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs shrink-0">
                            {m.name.charAt(0)}
                          </div>
                          <div>
                            <div>{m.name}</div>
                            {m.nameMr && <div className="text-[10px] text-slate-400 font-normal">{m.nameMr}</div>}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-slate-600">
                        <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-600 font-medium">
                          {m.category}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right font-mono-numbers">
                        <span className="font-extrabold text-sm text-slate-900">
                          {m.currentStock.toLocaleString()}
                        </span>{' '}
                        <span className="text-[11px] text-slate-500 font-medium">{m.unit}</span>
                      </td>
                      <td className="py-3 px-3 text-right font-mono-numbers text-slate-500">
                        {m.minStockThreshold.toLocaleString()} {m.unit}
                      </td>
                      <td className="py-3 px-3 text-right font-mono-numbers font-medium text-slate-800">
                        ₹{m.costPerUnit}
                      </td>
                      <td className="py-3 px-3 text-slate-600 truncate max-w-[140px]" title={m.supplier}>
                        {m.supplier}
                      </td>
                      <td className="py-3 px-3">
                        <StatusBadge
                          status={m.status}
                          label={m.status === 'healthy' ? 'Adequate' : m.status === 'low_stock' ? 'Low Stock' : 'Depleted'}
                        />
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Quick Purchase */}
                          <button
                            onClick={() => openPurchaseModal(m.id)}
                            className="px-2.5 py-1 rounded-md bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-[11px] transition-colors flex items-center gap-1"
                            title="Add purchase (increase stock)"
                          >
                            <Plus className="w-3 h-3" />
                            <span>Purchase</span>
                          </button>

                          {/* Quick Use */}
                          <button
                            onClick={() => openUsageModal(m.id)}
                            className="px-2.5 py-1 rounded-md bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold text-[11px] transition-colors flex items-center gap-1"
                            title="Record material usage (decrease stock)"
                          >
                            <Flame className="w-3 h-3 text-amber-600" />
                            <span>Use</span>
                          </button>

                          {/* Full Ledger */}
                          <button
                            onClick={() => setSelectedMaterial(m)}
                            className="p-1.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-600 text-[11px] transition-colors"
                            title="View Stock Ledger"
                          >
                            <History className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Purchases Log (Inward) */}
      {activeTab === 'purchases' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div>
              <h3 className="font-bold text-sm text-slate-900">Raw Material Purchase Receipts</h3>
              <p className="text-xs text-slate-500">Record of milk inward tankers, sugar, packing materials and procurement receipts</p>
            </div>
            <Button
              variant="primary"
              size="sm"
              icon={<Plus className="w-4 h-4" />}
              onClick={() => openPurchaseModal()}
            >
              Add New Purchase
            </Button>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[10px] tracking-wider font-semibold">
                  <tr>
                    <th className="py-3 px-4">Date & Time</th>
                    <th className="py-3 px-3">Material Name</th>
                    <th className="py-3 px-3 text-right">Quantity Inward</th>
                    <th className="py-3 px-3">PO / Challan Ref</th>
                    <th className="py-3 px-3">Supplier / Notes</th>
                    <th className="py-3 px-3">Logged By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800">
                  {purchaseMovements.map(mov => (
                    <tr key={mov.id} className="hover:bg-blue-50/30 transition-colors">
                      <td className="py-3 px-4 font-mono-numbers">
                        <div className="font-medium text-slate-900">{mov.date}</div>
                        <div className="text-[10px] text-slate-400">{mov.time}</div>
                      </td>
                      <td className="py-3 px-3 font-bold text-slate-900">
                        {mov.materialName}
                      </td>
                      <td className="py-3 px-3 text-right font-mono-numbers font-bold text-green-700">
                        +{mov.quantity.toLocaleString()} {mov.unit}
                      </td>
                      <td className="py-3 px-3 font-mono-numbers font-medium text-blue-700">
                        {mov.reference}
                      </td>
                      <td className="py-3 px-3 text-slate-600">
                        {mov.notes || 'Purchased from registered supplier'}
                      </td>
                      <td className="py-3 px-3 text-slate-500 text-[11px]">
                        {mov.user}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Usage Log (Outward) */}
      {activeTab === 'usage' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div>
              <h3 className="font-bold text-sm text-slate-900">Material Consumption & Usage Log</h3>
              <p className="text-xs text-slate-500">Record of raw materials used in production batches, boiling, sweet making, or packaging</p>
            </div>
            <Button
              variant="primary"
              size="sm"
              icon={<Flame className="w-4 h-4 text-amber-300" />}
              onClick={() => openUsageModal()}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              Record Material Used
            </Button>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[10px] tracking-wider font-semibold">
                  <tr>
                    <th className="py-3 px-4">Date & Time</th>
                    <th className="py-3 px-3">Material Used</th>
                    <th className="py-3 px-3 text-right">Quantity Consumed</th>
                    <th className="py-3 px-3">Batch / Reference</th>
                    <th className="py-3 px-3">Purpose & Details</th>
                    <th className="py-3 px-3">Logged By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800">
                  {usageMovements.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-500">
                        No material usage logged yet. Click "Record Material Used" above to log consumption.
                      </td>
                    </tr>
                  ) : (
                    usageMovements.map(mov => (
                      <tr key={mov.id} className="hover:bg-blue-50/30 transition-colors">
                        <td className="py-3 px-4 font-mono-numbers">
                          <div className="font-medium text-slate-900">{mov.date}</div>
                          <div className="text-[10px] text-slate-400">{mov.time}</div>
                        </td>
                        <td className="py-3 px-3 font-bold text-slate-900">
                          {mov.materialName}
                        </td>
                        <td className="py-3 px-3 text-right font-mono-numbers font-bold text-rose-600">
                          {Math.abs(mov.quantity).toLocaleString()} {mov.unit}
                        </td>
                        <td className="py-3 px-3 font-mono-numbers font-medium text-slate-800">
                          {mov.reference}
                        </td>
                        <td className="py-3 px-3 text-slate-600">
                          {mov.notes || 'Production run'}
                        </td>
                        <td className="py-3 px-3 text-slate-500 text-[11px]">
                          {mov.user}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 1: ADD RAW MATERIAL PURCHASE                       */}
      {/* ======================================================== */}
      <Modal
        isOpen={isPurchaseModalOpen}
        onClose={() => {
          setIsPurchaseModalOpen(false);
          setIsNewMaterialMode(false);
        }}
        title="Add Raw Material Purchase"
        subtitle="Record newly purchased raw materials to increase available stock"
        maxWidth="lg"
      >
        <form onSubmit={handlePurchaseSubmit} className="space-y-4 text-xs">
          {/* Material Selection Mode */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-bold text-slate-800">Select Raw Material</label>
              <button
                type="button"
                onClick={() => setIsNewMaterialMode(!isNewMaterialMode)}
                className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 transition-colors"
              >
                {isNewMaterialMode ? '← Pick from existing materials' : '+ Add brand new material to catalog'}
              </button>
            </div>

            {!isNewMaterialMode ? (
              <select
                value={purchaseMaterialId}
                onChange={e => {
                  setPurchaseMaterialId(e.target.value);
                  const mat = rawMaterials.find(m => m.id === e.target.value);
                  if (mat) {
                    setPurchaseCost(mat.costPerUnit);
                    setPurchaseSupplier(mat.supplier);
                  }
                }}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-blue-100 focus:border-blue-600 focus:bg-white focus:outline-none"
              >
                {rawMaterials.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.currentStock.toLocaleString()} {m.unit} in stock) — ₹{m.costPerUnit}/{m.unit}
                  </option>
                ))}
              </select>
            ) : (
              <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-100 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">New Material Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Pure Ghee Essence, Pista Nuts"
                      value={newMaterialName}
                      onChange={e => setNewMaterialName(e.target.value)}
                      required
                      className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:ring-2 focus:ring-blue-100 focus:border-blue-600 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Unit of Measure</label>
                    <select
                      value={newMaterialUnit}
                      onChange={e => setNewMaterialUnit(e.target.value)}
                      className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:ring-2 focus:ring-blue-100 focus:border-blue-600 focus:outline-none"
                    >
                      <option value="Litres">Litres</option>
                      <option value="kg">kg</option>
                      <option value="Grams">Grams</option>
                      <option value="Units">Units</option>
                      <option value="Packets">Packets</option>
                      <option value="Boxes">Boxes</option>
                      <option value="Bags">Bags</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Category</label>
                  <select
                    value={newMaterialCategory}
                    onChange={e => setNewMaterialCategory(e.target.value)}
                    className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:ring-2 focus:ring-blue-100 focus:border-blue-600 focus:outline-none"
                  >
                    <option value="Dairy Inward">Dairy Inward</option>
                    <option value="Sweeteners">Sweeteners</option>
                    <option value="Spices & Flavours">Spices & Flavours</option>
                    <option value="Packaging">Packaging</option>
                    <option value="Culture & Additives">Culture & Additives</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Quantity & Unit Cost */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Quantity Purchased ({isNewMaterialMode ? newMaterialUnit : (currentPurchaseTarget?.unit || 'Units')})
              </label>
              <input
                type="number"
                min={1}
                step="any"
                value={purchaseQty}
                onChange={e => setPurchaseQty(Number(e.target.value))}
                required
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono-numbers font-bold text-slate-900 focus:ring-2 focus:ring-blue-100 focus:border-blue-600 focus:bg-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Purchase Rate (₹ per unit)</label>
              <input
                type="number"
                min={0}
                step="any"
                value={purchaseCost}
                onChange={e => setPurchaseCost(Number(e.target.value))}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono-numbers font-bold text-slate-900 focus:ring-2 focus:ring-blue-100 focus:border-blue-600 focus:bg-white focus:outline-none"
              />
            </div>
          </div>

          {/* Bill Calculation Card */}
          <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-200 flex items-center justify-between text-xs">
            <span className="font-medium text-slate-700">Estimated Total Purchase Amount:</span>
            <span className="text-base font-extrabold font-mono-numbers text-blue-700">
              ₹{(purchaseQty * purchaseCost).toLocaleString('en-IN')}
            </span>
          </div>

          {/* Supplier & PO Reference */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Supplier / Farmer / Dairy Society</label>
              <input
                type="text"
                placeholder="e.g. Shirwal Farmers Co-operative"
                value={purchaseSupplier}
                onChange={e => setPurchaseSupplier(e.target.value)}
                required
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:ring-2 focus:ring-blue-100 focus:border-blue-600 focus:bg-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">PO / Inward Challan Number</label>
              <input
                type="text"
                value={purchaseRef}
                onChange={e => setPurchaseRef(e.target.value)}
                required
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono-numbers text-slate-900 focus:ring-2 focus:ring-blue-100 focus:border-blue-600 focus:bg-white focus:outline-none"
              />
            </div>
          </div>

          {/* Quality Test / Gate Entry Notes */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Gate Notes / Quality Test (Optional)</label>
            <input
              type="text"
              placeholder="e.g. Tanker 2, FAT: 6.8%, SNF: 9.1%, Temp: 3.5°C"
              value={purchaseNotes}
              onChange={e => setPurchaseNotes(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:ring-2 focus:ring-blue-100 focus:border-blue-600 focus:bg-white focus:outline-none"
            />
          </div>

          {/* Modal Footer Buttons */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                setIsPurchaseModalOpen(false);
                setIsNewMaterialMode(false);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm">
              Confirm Purchase & Add Stock
            </Button>
          </div>
        </form>
      </Modal>

      {/* ======================================================== */}
      {/* MODAL 2: RECORD MATERIAL USAGE (USED MATERIAL)           */}
      {/* ======================================================== */}
      <Modal
        isOpen={isUsageModalOpen}
        onClose={() => {
          setIsUsageModalOpen(false);
          setUsageError('');
        }}
        title="Record Raw Material Usage"
        subtitle="Log material used or consumed in dairy production, boiling, or processing"
        maxWidth="lg"
      >
        <form onSubmit={handleUsageSubmit} className="space-y-4 text-xs">
          {/* Material Selection */}
          <div>
            <label className="block font-bold text-slate-800 mb-1">Select Raw Material Used</label>
            <select
              value={usageMaterialId}
              onChange={e => {
                setUsageMaterialId(e.target.value);
                setUsageError('');
              }}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-blue-100 focus:border-blue-600 focus:bg-white focus:outline-none"
            >
              {rawMaterials.map(m => (
                <option key={m.id} value={m.id}>
                  {m.name} — Current Available: {m.currentStock.toLocaleString()} {m.unit}
                </option>
              ))}
            </select>
          </div>

          {/* Current Available Stock Indicator */}
          {currentUsageTarget && (
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
              <div>
                <span className="text-[11px] text-slate-500 font-medium">Currently Available in Silo / Store:</span>
                <div className="text-sm font-black text-slate-900 font-mono-numbers mt-0.5">
                  {currentUsageTarget.currentStock.toLocaleString()} {currentUsageTarget.unit}
                </div>
              </div>

              <div className="text-right">
                <span className="text-[11px] text-slate-500 font-medium">Safety Minimum:</span>
                <div className="text-xs font-bold text-slate-700 font-mono-numbers">
                  {currentUsageTarget.minStockThreshold.toLocaleString()} {currentUsageTarget.unit}
                </div>
              </div>
            </div>
          )}

          {/* Quantity Used with Quick Preset Chips */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-semibold text-slate-700">
                Quantity Consumed / Used ({currentUsageTarget?.unit || 'Units'})
              </label>
              {currentUsageTarget && currentUsageTarget.currentStock > 0 && (
                <div className="flex items-center gap-1.5 text-[10px]">
                  <span className="text-slate-400">Quick set:</span>
                  {[50, 100, 250, 500].filter(q => q <= currentUsageTarget.currentStock).map(preset => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => {
                        setUsageQty(preset);
                        setUsageError('');
                      }}
                      className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-700 font-semibold"
                    >
                      {preset}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      setUsageQty(currentUsageTarget.currentStock);
                      setUsageError('');
                    }}
                    className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-700 font-semibold"
                  >
                    All ({currentUsageTarget.currentStock})
                  </button>
                </div>
              )}
            </div>

            <input
              type="number"
              min={1}
              step="any"
              max={currentUsageTarget?.currentStock || 999999}
              value={usageQty}
              onChange={e => {
                setUsageQty(Number(e.target.value));
                setUsageError('');
              }}
              required
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono-numbers font-bold text-slate-900 focus:ring-2 focus:ring-blue-100 focus:border-blue-600 focus:bg-white focus:outline-none"
            />

            {usageError && (
              <p className="mt-1.5 text-xs text-rose-600 font-bold flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>{usageError}</span>
              </p>
            )}
          </div>

          {/* Used For / Purpose */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Purpose / Process</label>
              <select
                value={usagePurpose}
                onChange={e => setUsagePurpose(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:ring-2 focus:ring-blue-100 focus:border-blue-600 focus:bg-white focus:outline-none"
              >
                <option value="Production Run (Basundi / Pedha / Paneer / Shrikhand)">Production Run (Basundi / Pedha / Paneer / Shrikhand)</option>
                <option value="Daily Milk Pasteurization & Pouch Packing">Daily Milk Pasteurization & Pouch Packing</option>
                <option value="Boiling & Sweet Preparation">Boiling & Sweet Preparation</option>
                <option value="Curd & Buttermilk Setting">Curd & Buttermilk Setting</option>
                <option value="Packaging & Dispatch">Packaging & Dispatch</option>
                <option value="Quality Testing & Lab Sample">Quality Testing & Lab Sample</option>
                <option value="Spillage / Plant Washing">Spillage / Plant Washing</option>
                <option value="Other Processing">Other Processing</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Production Batch Ref (Optional)</label>
              <input
                type="text"
                placeholder="e.g. Batch BAS-2026-081"
                value={usageBatch}
                onChange={e => setUsageBatch(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono-numbers text-slate-900 focus:ring-2 focus:ring-blue-100 focus:border-blue-600 focus:bg-white focus:outline-none"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Shift / Pan / Machine Notes (Optional)</label>
            <input
              type="text"
              placeholder="e.g. Boiled in Pan 2 for Basundi, morning shift"
              value={usageNotes}
              onChange={e => setUsageNotes(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:ring-2 focus:ring-blue-100 focus:border-blue-600 focus:bg-white focus:outline-none"
            />
          </div>

          {/* Stock Balance After Usage Preview */}
          {currentUsageTarget && (
            <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-200 flex items-center justify-between text-xs">
              <span className="font-medium text-amber-900">Remaining Balance After This Usage:</span>
              <span className="text-base font-extrabold font-mono-numbers text-amber-900">
                {Math.max(0, currentUsageTarget.currentStock - usageQty).toLocaleString()}{' '}
                {currentUsageTarget.unit}
              </span>
            </div>
          )}

          {/* Modal Footer Buttons */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                setIsUsageModalOpen(false);
                setUsageError('');
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              Confirm Usage & Deduct Stock
            </Button>
          </div>
        </form>
      </Modal>

      {/* ======================================================== */}
      {/* DRAWER: DETAILED STOCK LEDGER FOR SELECTED MATERIAL      */}
      {/* ======================================================== */}
      <Drawer
        isOpen={Boolean(selectedMaterial)}
        onClose={() => setSelectedMaterial(null)}
        title={selectedMaterial ? `${selectedMaterial.name} — Full Stock Ledger` : 'Stock Ledger'}
        subtitle={selectedMaterial ? `Current Balance: ${selectedMaterial.currentStock.toLocaleString()} ${selectedMaterial.unit} • Minimum: ${selectedMaterial.minStockThreshold} ${selectedMaterial.unit}` : ''}
        width="lg"
      >
        {selectedMaterial && (
          <div className="space-y-4 text-xs">
            {/* Summary details */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div>
                <span className="text-slate-500 block text-[10px]">Material</span>
                <span className="font-bold text-slate-900">{selectedMaterial.name}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">Category</span>
                <span className="font-bold text-slate-900">{selectedMaterial.category}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">Current Stock</span>
                <span className="font-extrabold text-blue-700 font-mono-numbers">
                  {selectedMaterial.currentStock.toLocaleString()} {selectedMaterial.unit}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">Est. Cost / Unit</span>
                <span className="font-bold text-slate-900 font-mono-numbers">₹{selectedMaterial.costPerUnit}</span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Audit Trail (Inward & Outward)
              </h4>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    openPurchaseModal(selectedMaterial.id);
                  }}
                  className="px-2 py-1 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold text-[10px]"
                >
                  + Add Purchase
                </button>
                <button
                  onClick={() => {
                    openUsageModal(selectedMaterial.id);
                  }}
                  className="px-2 py-1 rounded bg-amber-50 text-amber-800 hover:bg-amber-100 font-bold text-[10px]"
                >
                  - Record Usage
                </button>
              </div>
            </div>

            {materialMovements.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center">No movement transactions recorded for this material yet.</p>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 border-b border-slate-200 text-[10px] text-slate-600 font-semibold uppercase">
                    <tr>
                      <th className="p-2.5">Date & Time</th>
                      <th className="p-2.5">Type</th>
                      <th className="p-2.5 text-right">Quantity</th>
                      <th className="p-2.5">Reference / Notes</th>
                      <th className="p-2.5">User</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {materialMovements.map(mov => {
                      const isPurchase = mov.quantity > 0;
                      return (
                        <tr key={mov.id} className="hover:bg-blue-50/30 transition-colors">
                          <td className="p-2.5 font-mono-numbers">
                            <div className="font-medium text-slate-900">{mov.date}</div>
                            <div className="text-[10px] text-slate-400">{mov.time}</div>
                          </td>
                          <td className="p-2.5">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              isPurchase
                                ? 'bg-green-100 text-green-700'
                                : 'bg-amber-100 text-amber-700'
                            }`}>
                              {isPurchase ? 'Inward Purchase' : 'Consumption / Used'}
                            </span>
                          </td>
                          <td className={`p-2.5 text-right font-mono-numbers font-bold ${
                            isPurchase ? 'text-green-700' : 'text-rose-600'
                          }`}>
                            {isPurchase ? `+${mov.quantity.toLocaleString()}` : `${mov.quantity.toLocaleString()}`} {mov.unit}
                          </td>
                          <td className="p-2.5 text-slate-700">
                            <div className="font-mono-numbers font-semibold text-slate-900">{mov.reference}</div>
                            {mov.notes && <div className="text-[10px] text-slate-500">{mov.notes}</div>}
                          </td>
                          <td className="p-2.5 text-slate-500 text-[11px]">{mov.user}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
};
