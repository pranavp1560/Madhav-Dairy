import React, { useState, useMemo } from 'react';
import { useDairy } from '../../context/DairyContext';
import { DeliveryTrip } from '../../types/dairy';
import { deliveryService } from '../../services/deliveryService';
import { TripDetailsModal } from './TripDetailsModal';
import { StatusBadge } from '../common/StatusBadge';
import {
  Navigation,
  Search,
  Filter,
  Calendar,
  Clock,
  Truck,
  User,
  FileSpreadsheet,
  CheckCircle2,
  Eye,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  ShieldCheck,
  RotateCcw,
  AlertCircle,
  PackageCheck,
} from 'lucide-react';

export const DriverManagementView: React.FC = () => {
  const { deliveryTrips, completeDeliveryTrip, setInternalView, addToast } = useDairy();

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'dispatched' | 'completed'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Selected trip for details modal
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  // Fast inline download loading state
  const [downloadingTripId, setDownloadingTripId] = useState<string | null>(null);

  // Quick mark complete state
  const [completingTripId, setCompletingTripId] = useState<string | null>(null);

  // KPI Calculations
  const stats = useMemo(() => {
    const total = deliveryTrips.length;
    const dispatched = deliveryTrips.filter((t) => t.status === 'dispatched').length;
    const completed = deliveryTrips.filter((t) => t.status === 'completed').length;
    const totalInvoicesAssigned = deliveryTrips.reduce((acc, t) => acc + (t.assignedInvoiceCount || 0), 0);
    return { total, dispatched, completed, totalInvoicesAssigned };
  }, [deliveryTrips]);

  // Filtered trips
  const filteredTrips = useMemo(() => {
    return deliveryTrips.filter((trip) => {
      // Search
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        trip.tripNumber.toLowerCase().includes(q) ||
        (trip.deliveryUnitName && trip.deliveryUnitName.toLowerCase().includes(q)) ||
        trip.vehicleNumber.toLowerCase().includes(q) ||
        trip.driverName.toLowerCase().includes(q);

      // Status
      const matchesStatus =
        statusFilter === 'all' || trip.status === statusFilter;

      // Date filtering (by assignedAt or createdAt)
      let matchesDate = true;
      const tripDate = trip.assignedAt
        ? new Date(trip.assignedAt)
        : (trip.createdAt ? new Date(trip.createdAt) : new Date());
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        if (tripDate < start) matchesDate = false;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        if (tripDate > end) matchesDate = false;
      }

      return matchesSearch && matchesStatus && matchesDate;
    });
  }, [deliveryTrips, searchQuery, statusFilter, startDate, endDate]);

  // Pagination slicing
  const totalPages = Math.max(1, Math.ceil(filteredTrips.length / pageSize));
  const paginatedTrips = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredTrips.slice(start, start + pageSize);
  }, [filteredTrips, currentPage, pageSize]);

  // Handle direct Excel download
  const handleDownloadExcel = async (trip: DeliveryTrip) => {
    setDownloadingTripId(trip.id);
    try {
      await deliveryService.downloadDriverSheet(trip.id);
      addToast(`Driver Sheet for Trip ${trip.tripNumber} downloaded successfully.`, 'success');
    } catch (err: any) {
      addToast(err?.message || 'Failed to download Driver Sheet.', 'error');
    } finally {
      setDownloadingTripId(null);
    }
  };

  // Handle quick mark trip completed
  const handleMarkCompleted = async (trip: DeliveryTrip) => {
    if (!window.confirm(`Are you sure you want to mark Trip ${trip.tripNumber} as Completed? This will transition all ${trip.assignedInvoiceCount} assigned invoices to 'Delivered'.`)) {
      return;
    }

    setCompletingTripId(trip.id);
    try {
      await completeDeliveryTrip(trip.id);
      addToast(`Trip ${trip.tripNumber} marked as completed successfully!`, 'success');
    } catch (err: any) {
      addToast(err?.message || 'Failed to complete trip.', 'error');
    } finally {
      setCompletingTripId(null);
    }
  };

  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setStartDate('');
    setEndDate('');
    setCurrentPage(1);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-blue-100 p-2 text-blue-700">
              <Navigation className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Driver Management & Delivery Trips</h1>
              <p className="text-sm text-slate-500">
                Track delivery routes, monitor live dispatched vehicles, and download driver sheets.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setInternalView('delivery_units')}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <Truck className="h-4 w-4 text-slate-500" />
            Delivery Units
          </button>
          <button
            onClick={() => setInternalView('invoices')}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
          >
            <FileSpreadsheet className="h-4 w-4" />
            Assign New Trip (Invoices)
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Trips</span>
            <div className="rounded-lg bg-slate-100 p-2 text-slate-600">
              <Navigation className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">{stats.total}</span>
            <span className="text-xs text-slate-500">lifetime assignments</span>
          </div>
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-700">Dispatched / En Route</span>
            <div className="rounded-lg bg-amber-100 p-2 text-amber-700">
              <Truck className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-amber-900">{stats.dispatched}</span>
            <span className="text-xs text-amber-700">active on the road</span>
          </div>
        </div>

        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Completed Trips</span>
            <div className="rounded-lg bg-emerald-100 p-2 text-emerald-700">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-emerald-900">{stats.completed}</span>
            <span className="text-xs text-emerald-700">safely delivered</span>
          </div>
        </div>

        <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-blue-700">Assigned Invoices</span>
            <div className="rounded-lg bg-blue-100 p-2 text-blue-700">
              <PackageCheck className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-blue-900">{stats.totalInvoicesAssigned}</span>
            <span className="text-xs text-blue-700">retail orders delivered</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by Trip/Chalan #, Driver, Vehicle, or Unit..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full rounded-lg border border-slate-300 py-2 pl-10 pr-4 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Status Tabs */}
          <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
            <button
              onClick={() => {
                setStatusFilter('all');
                setCurrentPage(1);
              }}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                statusFilter === 'all'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Trips ({deliveryTrips.length})
            </button>
            <button
              onClick={() => {
                setStatusFilter('dispatched');
                setCurrentPage(1);
              }}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                statusFilter === 'dispatched'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Dispatched ({stats.dispatched})
            </button>
            <button
              onClick={() => {
                setStatusFilter('completed');
                setCurrentPage(1);
              }}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                statusFilter === 'completed'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Completed ({stats.completed})
            </button>
          </div>
        </div>

        {/* Date Filters */}
        <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-3 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-slate-400" />
            <span className="font-medium text-slate-700">Date Range:</span>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setCurrentPage(1);
              }}
              className="rounded-md border border-slate-300 px-2.5 py-1 text-xs text-slate-700 focus:border-blue-500 focus:outline-none"
            />
            <span className="text-slate-400">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setCurrentPage(1);
              }}
              className="rounded-md border border-slate-300 px-2.5 py-1 text-xs text-slate-700 focus:border-blue-500 focus:outline-none"
            />
          </div>

          {(searchQuery || statusFilter !== 'all' || startDate || endDate) && (
            <button
              onClick={clearFilters}
              className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800"
            >
              <RotateCcw className="h-3 w-3" />
              Reset filters
            </button>
          )}
        </div>
      </div>

      {/* Trips Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-3.5">Trip / Chalan #</th>
                <th className="px-5 py-3.5">Delivery Unit</th>
                <th className="px-5 py-3.5">Vehicle</th>
                <th className="px-5 py-3.5">Driver</th>
                <th className="px-5 py-3.5 text-center">Invoices</th>
                <th className="px-5 py-3.5">Out Time / Dispatched</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5">Completed At</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {paginatedTrips.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-5 py-12 text-center text-slate-500">
                    <Navigation className="mx-auto mb-3 h-8 w-8 text-slate-300" />
                    <p className="text-sm font-medium text-slate-800">No delivery trips found</p>
                    <p className="text-xs text-slate-500">
                      {deliveryTrips.length === 0
                        ? 'Go to Invoices, select ready invoices, and click "Generate Driver Sheet" to create your first trip.'
                        : 'No trips match the applied search and filter criteria.'}
                    </p>
                  </td>
                </tr>
              ) : (
                paginatedTrips.map((trip) => {
                  const isDispatched = trip.status === 'dispatched';
                  const isCompleted = trip.status === 'completed';

                  return (
                    <tr
                      key={trip.id}
                      className="transition-colors hover:bg-slate-50/80 cursor-pointer"
                      onClick={() => {
                        setSelectedTripId(trip.id);
                        setIsDetailsOpen(true);
                      }}
                    >
                      {/* Trip # */}
                      <td className="whitespace-nowrap px-5 py-4 font-semibold text-blue-600">
                        <div className="flex items-center gap-1.5">
                          <span>{trip.tripNumber}</span>
                        </div>
                      </td>

                      {/* Delivery Unit */}
                      <td className="whitespace-nowrap px-5 py-4 text-slate-900">
                        <span className="font-medium">{trip.deliveryUnitName || '—'}</span>
                      </td>

                      {/* Vehicle */}
                      <td className="whitespace-nowrap px-5 py-4 text-slate-700">
                        <div className="flex items-center gap-1.5">
                          <Truck className="h-3.5 w-3.5 text-slate-400" />
                          <span className="font-mono text-xs">{trip.vehicleNumber}</span>
                        </div>
                      </td>

                      {/* Driver */}
                      <td className="whitespace-nowrap px-5 py-4 text-slate-700">
                        <div className="flex items-center gap-1.5">
                          <User className="h-3.5 w-3.5 text-slate-400" />
                          <span>{trip.driverName}</span>
                        </div>
                        {trip.driverPhone && (
                          <span className="text-[11px] text-slate-400 pl-5">{trip.driverPhone}</span>
                        )}
                      </td>

                      {/* Invoices Count */}
                      <td className="whitespace-nowrap px-5 py-4 text-center">
                        <span className="inline-flex items-center justify-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
                          {trip.assignedInvoiceCount} {trip.assignedInvoiceCount === 1 ? 'inv' : 'invs'}
                        </span>
                      </td>

                      {/* Out Time / Dispatched */}
                      <td className="whitespace-nowrap px-5 py-4 text-xs text-slate-600">
                        {trip.outTime ? (
                          <div className="flex items-center gap-1 font-medium text-amber-800">
                            <Clock className="h-3 w-3 text-amber-600" />
                            {trip.outTime}
                          </div>
                        ) : null}
                        <div className="text-[11px] text-slate-400">
                          {trip.assignedAt
                            ? new Date(trip.assignedAt).toLocaleDateString('en-IN', {
                                day: '2-digit',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : trip.createdAt
                              ? new Date(trip.createdAt).toLocaleDateString('en-IN', {
                                  day: '2-digit',
                                  month: 'short',
                                })
                              : '—'}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="whitespace-nowrap px-5 py-4">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            isCompleted
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800 animate-pulse'
                          }`}
                        >
                          {isCompleted ? (
                            <>
                              <CheckCircle2 className="h-3 w-3" />
                              Completed
                            </>
                          ) : (
                            <>
                              <Truck className="h-3 w-3" />
                              Dispatched
                            </>
                          )}
                        </span>
                      </td>

                      {/* Completed At */}
                      <td className="whitespace-nowrap px-5 py-4 text-xs text-slate-500">
                        {trip.completedAt ? (
                          new Date(trip.completedAt).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td
                        className="whitespace-nowrap px-5 py-4 text-right text-xs"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Re-download Excel */}
                          <button
                            type="button"
                            onClick={() => handleDownloadExcel(trip)}
                            disabled={downloadingTripId === trip.id}
                            title="Download Driver Sheet (.xlsx)"
                            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white p-1.5 text-slate-600 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 disabled:opacity-50"
                          >
                            <FileSpreadsheet className="h-3.5 w-3.5" />
                          </button>

                          {/* Quick Mark Completed */}
                          {isDispatched && (
                            <button
                              type="button"
                              onClick={() => handleMarkCompleted(trip)}
                              disabled={completingTripId === trip.id}
                              title="Mark Trip Completed"
                              className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Complete
                            </button>
                          )}

                          {/* Open Details */}
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedTripId(trip.id);
                              setIsDetailsOpen(true);
                            }}
                            title="View Trip Details"
                            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white p-1.5 text-slate-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {filteredTrips.length > 0 && (
          <div className="flex flex-col gap-3 border-t border-slate-200 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-xs text-slate-500">
              Showing <span className="font-medium">{(currentPage - 1) * pageSize + 1}</span> to{' '}
              <span className="font-medium">
                {Math.min(currentPage * pageSize, filteredTrips.length)}
              </span>{' '}
              of <span className="font-medium">{filteredTrips.length}</span> delivery trips
            </span>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Previous
              </button>
              <span className="text-xs text-slate-600">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
              >
                Next
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Trip Details Modal */}
      <TripDetailsModal
        isOpen={isDetailsOpen}
        onClose={() => {
          setIsDetailsOpen(false);
          setSelectedTripId(null);
        }}
        tripId={selectedTripId}
        onTripCompleted={() => {
          // Context already refetches and updates deliveryTrips state
        }}
      />
    </div>
  );
};
