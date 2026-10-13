import React, { useState } from 'react';
import { useDairy } from '../../context/DairyContext';
import { DeliveryUnit } from '../../types/dairy';
import { DeliveryUnitModal } from './DeliveryUnitModal';
import { Modal } from '../common/Modal';
import {
  Truck,
  Plus,
  Search,
  Filter,
  Pencil,
  Trash2,
  Phone,
  Clock,
  Hash,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RotateCcw,
  ShieldAlert,
} from 'lucide-react';

export const DeliveryUnitsView: React.FC = () => {
  const {
    deliveryUnits,
    createDeliveryUnit,
    updateDeliveryUnit,
    deleteDeliveryUnit,
    toggleDeliveryUnitActive,
    setInternalView,
    addToast,
  } = useDairy();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [unitToEdit, setUnitToEdit] = useState<DeliveryUnit | null>(null);

  // Deletion modal state
  const [unitToDelete, setUnitToDelete] = useState<DeliveryUnit | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const filteredUnits = deliveryUnits.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.vehicleNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.driverName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.chalanNumber.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' && u.isActive) ||
      (statusFilter === 'inactive' && !u.isActive);

    return matchesSearch && matchesStatus;
  });

  const activeCount = deliveryUnits.filter((u) => u.isActive).length;
  const inactiveCount = deliveryUnits.filter((u) => !u.isActive).length;
  const totalTrips = deliveryUnits.reduce((acc, u) => acc + (u.tripsCount || 0), 0);

  const handleOpenAdd = () => {
    setUnitToEdit(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (unit: DeliveryUnit) => {
    setUnitToEdit(unit);
    setIsModalOpen(true);
  };

  const handleSaveUnit = async (data: {
    name: string;
    vehicleNumber: string;
    driverName: string;
    driverPhone?: string;
    outTime?: string;
    isActive?: boolean;
  }) => {
    if (unitToEdit) {
      await updateDeliveryUnit(unitToEdit.id, data);
    } else {
      await createDeliveryUnit(data);
    }
  };

  const handleConfirmDelete = async () => {
    if (!unitToDelete) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await deleteDeliveryUnit(unitToDelete.id);
      setUnitToDelete(null);
    } catch (err: any) {
      setDeleteError(err.message || 'Cannot delete delivery unit.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-blue-600 uppercase tracking-wider">
            <Truck className="w-4 h-4 text-blue-600" />
            <span>Delivery Unit & Fleet Management</span>
          </div>
          <h1 className="text-xl font-black text-slate-900 mt-1">
            Delivery Units & Chalan Registers
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage dispatch vehicles, assigned drivers, system-generated unique chalan numbering, and route units.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setInternalView('driver_management')}
            className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
          >
            View Driver Trips
          </button>
          <button
            onClick={handleOpenAdd}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Add Delivery Unit</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[10px] uppercase font-bold text-slate-500 block">Total Units</span>
          <span className="text-xl font-black text-slate-900 font-mono-numbers mt-1 block">
            {deliveryUnits.length}
          </span>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[10px] uppercase font-bold text-emerald-700 block">Active Units</span>
          <span className="text-xl font-black text-emerald-600 font-mono-numbers mt-1 block">
            {activeCount}
          </span>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[10px] uppercase font-bold text-slate-400 block">Deactivated</span>
          <span className="text-xl font-black text-slate-500 font-mono-numbers mt-1 block">
            {inactiveCount}
          </span>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[10px] uppercase font-bold text-blue-700 block">Total Trips Handled</span>
          <span className="text-xl font-black text-blue-600 font-mono-numbers mt-1 block">
            {totalTrips}
          </span>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between text-xs">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search Chalan #, Unit Name, Vehicle, Driver..."
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-100 focus:border-blue-600 focus:bg-white focus:outline-none transition-colors"
          />
        </div>

        <div className="flex items-center gap-1">
          {(['all', 'active', 'inactive'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${
                statusFilter === tab
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {tab === 'all' ? 'All Units' : tab}
            </button>
          ))}
        </div>
      </div>

      {/* Units Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[800px]">
            <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200 text-[11px] uppercase tracking-wider">
              <tr>
                <th className="p-3.5">Chalan Number</th>
                <th className="p-3.5">Unit Name</th>
                <th className="p-3.5">Vehicle Number</th>
                <th className="p-3.5">Driver & Contact</th>
                <th className="p-3.5">Departure / Out Time</th>
                <th className="p-3.5 text-center">Trips Handled</th>
                <th className="p-3.5 text-center">Status</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUnits.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <Truck className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="font-medium">No delivery units match your search or filter.</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Click "Add Delivery Unit" to register a new vehicle and driver.</p>
                  </td>
                </tr>
              ) : (
                filteredUnits.map((unit) => (
                  <tr key={unit.id} className="hover:bg-blue-50/20 transition-colors">
                    {/* Chalan Number */}
                    <td className="p-3.5">
                      <span className="font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 text-[11px]">
                        {unit.chalanNumber}
                      </span>
                    </td>

                    {/* Unit Name */}
                    <td className="p-3.5 font-bold text-slate-900">
                      {unit.name}
                    </td>

                    {/* Vehicle Number */}
                    <td className="p-3.5">
                      <span className="font-mono uppercase font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 text-[11px]">
                        {unit.vehicleNumber}
                      </span>
                    </td>

                    {/* Driver & Contact */}
                    <td className="p-3.5 text-slate-700">
                      <div className="font-semibold text-slate-900">{unit.driverName}</div>
                      {unit.driverPhone ? (
                        <div className="text-[10px] text-slate-500 font-mono-numbers flex items-center gap-1 mt-0.5">
                          <Phone className="w-3 h-3 text-slate-400" />
                          <span>{unit.driverPhone}</span>
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-400 italic">No phone recorded</span>
                      )}
                    </td>

                    {/* Out Time */}
                    <td className="p-3.5 text-slate-600 font-mono-numbers">
                      {unit.outTime ? (
                        <div className="flex items-center gap-1 text-[11px] text-slate-700">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>{unit.outTime}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic text-[11px]">—</span>
                      )}
                    </td>

                    {/* Trips Handled */}
                    <td className="p-3.5 text-center font-mono-numbers font-bold text-slate-700">
                      {unit.tripsCount || 0}
                    </td>

                    {/* Status Badge & Toggle */}
                    <td className="p-3.5 text-center">
                      <button
                        onClick={() => toggleDeliveryUnitActive(unit.id, !unit.isActive)}
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border transition-colors ${
                          unit.isActive
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                            : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                        }`}
                        title="Click to toggle active status"
                      >
                        {unit.isActive ? (
                          <>
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>Active</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3 h-3 text-slate-400" />
                            <span>Inactive</span>
                          </>
                        )}
                      </button>
                    </td>

                    {/* Actions */}
                    <td className="p-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenEdit(unit)}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-blue-50 hover:text-blue-600 text-slate-700 rounded-lg text-xs font-semibold border border-slate-200 transition-colors inline-flex items-center gap-1"
                          title="Edit unit details"
                        >
                          <Pencil className="w-3 h-3" />
                          <span>Edit</span>
                        </button>

                        <button
                          onClick={() => {
                            setDeleteError(null);
                            setUnitToDelete(unit);
                          }}
                          className="px-2 py-1 bg-slate-100 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 text-slate-500 rounded-lg text-xs font-semibold border border-slate-200 transition-colors"
                          title="Delete unit"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Delivery Unit Modal */}
      <DeliveryUnitModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveUnit}
        unitToEdit={unitToEdit}
      />

      {/* Safe Delete Confirmation Modal */}
      {unitToDelete && (
        <Modal
          isOpen={Boolean(unitToDelete)}
          onClose={() => setUnitToDelete(null)}
          title="Delete Delivery Unit"
          subtitle={`Unit: ${unitToDelete.name} (${unitToDelete.chalanNumber})`}
          maxWidth="sm"
        >
          <div className="space-y-4 text-xs">
            {deleteError ? (
              <div className="p-3.5 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl space-y-2">
                <div className="flex items-center gap-2 font-bold text-amber-900">
                  <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Deletion Restricted</span>
                </div>
                <p className="text-[11px] leading-relaxed">{deleteError}</p>
                <div className="pt-2 flex justify-end">
                  <button
                    onClick={async () => {
                      await toggleDeliveryUnitActive(unitToDelete.id, false);
                      setUnitToDelete(null);
                    }}
                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors"
                  >
                    Deactivate Unit Instead
                  </button>
                </div>
              </div>
            ) : unitToDelete.tripsCount && unitToDelete.tripsCount > 0 ? (
              <div className="p-3.5 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl space-y-2">
                <div className="flex items-center gap-2 font-bold text-amber-900">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Historical Records Linked</span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  This delivery unit has <strong>{unitToDelete.tripsCount} delivery trip(s)</strong> assigned to it.
                  Hard-deleting this record would break historical delivery logs and driver sheets.
                </p>
                <p className="text-[11px] text-amber-700">
                  We recommend deactivating the unit instead, which will hide it from future trip assignments while preserving historical compliance.
                </p>
                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setUnitToDelete(null)}
                    className="px-3 py-1.5 border border-slate-200 bg-white rounded-lg text-xs font-semibold text-slate-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await toggleDeliveryUnitActive(unitToDelete.id, false);
                      setUnitToDelete(null);
                    }}
                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors"
                  >
                    Deactivate Unit
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-slate-700 text-xs">
                  Are you sure you want to permanently delete delivery unit <strong>{unitToDelete.name}</strong> ({unitToDelete.vehicleNumber})?
                  This action cannot be undone.
                </p>
                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setUnitToDelete(null)}
                    disabled={isDeleting}
                    className="px-3.5 py-1.5 border border-slate-200 text-slate-600 hover:bg-slate-100 rounded-xl font-semibold transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmDelete}
                    disabled={isDeleting}
                    className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl font-bold shadow-xs transition-colors flex items-center gap-1.5"
                  >
                    {isDeleting ? 'Deleting...' : 'Confirm Delete'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
};
