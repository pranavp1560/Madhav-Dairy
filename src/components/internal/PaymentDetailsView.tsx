import React, { useState } from 'react';
import { useDairy } from '../../context/DairyContext';
import { BusinessPaymentMethod } from '../../types/dairy';
import { paymentMethodService } from '../../services/paymentMethodService';
import {
  CreditCard,
  QrCode,
  Building2,
  Plus,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Star,
  Edit2,
  Trash2,
  Power,
  Upload,
  X,
  Eye,
  ShieldCheck,
  Info,
  Loader2
} from 'lucide-react';

export const PaymentDetailsView: React.FC = () => {
  const {
    paymentMethods,
    createPaymentMethod,
    updatePaymentMethod,
    togglePaymentMethodStatus,
    deletePaymentMethod,
    internalRole,
    addToast
  } = useDairy();

  const [activeTab, setActiveTab] = useState<'all' | 'bank' | 'upi'>('all');
  const [modalType, setModalType] = useState<'bank' | 'upi' | null>(null);
  const [editingMethod, setEditingMethod] = useState<BusinessPaymentMethod | null>(null);

  // Bank Form State
  const [bankDisplayName, setBankDisplayName] = useState('');
  const [bankHolderName, setBankHolderName] = useState('');
  const [bankName, setBankName] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [bankIfscCode, setBankIfscCode] = useState('');
  const [bankBranchName, setBankBranchName] = useState('');
  const [bankInstructions, setBankInstructions] = useState('');
  const [bankIsActive, setBankIsActive] = useState(true);
  const [bankIsDefault, setBankIsDefault] = useState(false);

  // UPI Form State
  const [upiDisplayName, setUpiDisplayName] = useState('');
  const [upiPayeeName, setUpiPayeeName] = useState('');
  const [upiId, setUpiId] = useState('');
  const [upiQrUrl, setUpiQrUrl] = useState('');
  const [upiInstructions, setUpiInstructions] = useState('');
  const [upiIsActive, setUpiIsActive] = useState(true);
  const [upiIsDefault, setUpiIsDefault] = useState(false);

  // Upload & Form Loading
  const [isUploadingQr, setIsUploadingQr] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const isAdmin = internalRole === 'admin';

  const filteredMethods = paymentMethods.filter(m => {
    if (activeTab === 'bank') return m.methodType === 'bank_account';
    if (activeTab === 'upi') return m.methodType === 'upi';
    return true;
  });

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    addToast('Copied to clipboard!', 'info');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const openBankModal = (method?: BusinessPaymentMethod) => {
    setFormErrors({});
    if (method) {
      setEditingMethod(method);
      setBankDisplayName(method.displayName);
      setBankHolderName(method.accountHolderName || '');
      setBankName(method.bankName || '');
      setBankAccountNumber(method.accountNumber || '');
      setBankIfscCode(method.ifscCode || '');
      setBankBranchName(method.branchName || '');
      setBankInstructions(method.instructions || '');
      setBankIsActive(method.isActive);
      setBankIsDefault(method.isDefault);
    } else {
      setEditingMethod(null);
      setBankDisplayName('');
      setBankHolderName('Madhav Dairy Products Pvt. Ltd.');
      setBankName('');
      setBankAccountNumber('');
      setBankIfscCode('');
      setBankBranchName('');
      setBankInstructions('Please mention Invoice Number in the transfer remarks.');
      setBankIsActive(true);
      setBankIsDefault(paymentMethods.filter(m => m.methodType === 'bank_account').length === 0);
    }
    setModalType('bank');
  };

  const openUpiModal = (method?: BusinessPaymentMethod) => {
    setFormErrors({});
    if (method) {
      setEditingMethod(method);
      setUpiDisplayName(method.displayName);
      setUpiPayeeName(method.accountHolderName || '');
      setUpiId(method.upiId || '');
      setUpiQrUrl(method.qrCodeUrl || '');
      setUpiInstructions(method.instructions || '');
      setUpiIsActive(method.isActive);
      setUpiIsDefault(method.isDefault);
    } else {
      setEditingMethod(null);
      setUpiDisplayName('Official Dairy UPI');
      setUpiPayeeName('Madhav Dairy');
      setUpiId('');
      setUpiQrUrl('');
      setUpiInstructions('Scan QR code or pay to UPI ID. Provide UTR reference after payment.');
      setUpiIsActive(true);
      setUpiIsDefault(paymentMethods.filter(m => m.methodType === 'upi').length === 0);
    }
    setModalType('upi');
  };

  const handleQrUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploadingQr(true);
      const url = await paymentMethodService.uploadQrCode(file);
      setUpiQrUrl(url);
      addToast('QR Code uploaded successfully', 'success');
    } catch (err: any) {
      addToast(err.message || 'QR upload failed', 'error');
    } finally {
      setIsUploadingQr(false);
    }
  };

  const validateBankForm = () => {
    const errors: Record<string, string> = {};
    if (!bankDisplayName.trim()) errors.displayName = 'Display Name is required';
    if (!bankHolderName.trim()) errors.holderName = 'Account Holder Name is required';
    if (!bankName.trim()) errors.bankName = 'Bank Name is required';
    
    const accNum = bankAccountNumber.trim();
    if (!accNum) {
      errors.accountNumber = 'Account Number is required';
    } else if (!/^\d{9,18}$/.test(accNum)) {
      errors.accountNumber = 'Indian bank account numbers are typically 9-18 digits';
    }

    const ifsc = bankIfscCode.trim().toUpperCase();
    if (!ifsc) {
      errors.ifscCode = 'IFSC Code is required';
    } else if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) {
      errors.ifscCode = 'Invalid IFSC format (e.g., HDFC0001234 — 4 letters, 0, 6 characters)';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const validateUpiForm = () => {
    const errors: Record<string, string> = {};
    if (!upiDisplayName.trim()) errors.displayName = 'Display Name is required';
    if (!upiPayeeName.trim()) errors.payeeName = 'Payee/Business Name is required';

    const cleanUpi = upiId.trim();
    if (!cleanUpi) {
      errors.upiId = 'UPI ID is required';
    } else if (!/^[\w.-]+@[\w.-]+$/.test(cleanUpi)) {
      errors.upiId = 'Invalid UPI ID format (e.g. username@bank)';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSaveBank = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateBankForm()) return;

    try {
      setIsSaving(true);
      if (editingMethod) {
        await updatePaymentMethod(editingMethod.id, {
          methodType: 'bank_account',
          displayName: bankDisplayName,
          accountHolderName: bankHolderName,
          bankName,
          accountNumber: bankAccountNumber,
          ifscCode: bankIfscCode.toUpperCase(),
          branchName: bankBranchName,
          instructions: bankInstructions,
          isActive: bankIsActive,
          isDefault: bankIsDefault,
        });
      } else {
        await createPaymentMethod({
          methodType: 'bank_account',
          displayName: bankDisplayName,
          accountHolderName: bankHolderName,
          bankName,
          accountNumber: bankAccountNumber,
          ifscCode: bankIfscCode.toUpperCase(),
          branchName: bankBranchName,
          instructions: bankInstructions,
          isActive: bankIsActive,
          isDefault: bankIsDefault,
        });
      }
      setModalType(null);
    } catch (err) {
      // Toast already triggered in context
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveUpi = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateUpiForm()) return;

    try {
      setIsSaving(true);
      if (editingMethod) {
        await updatePaymentMethod(editingMethod.id, {
          methodType: 'upi',
          displayName: upiDisplayName,
          accountHolderName: upiPayeeName,
          upiId,
          qrCodeUrl: upiQrUrl,
          instructions: upiInstructions,
          isActive: upiIsActive,
          isDefault: upiIsDefault,
        });
      } else {
        await createPaymentMethod({
          methodType: 'upi',
          displayName: upiDisplayName,
          accountHolderName: upiPayeeName,
          upiId,
          qrCodeUrl: upiQrUrl,
          instructions: upiInstructions,
          isActive: upiIsActive,
          isDefault: upiIsDefault,
        });
      }
      setModalType(null);
    } catch (err) {
      // Toast already triggered in context
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (method: BusinessPaymentMethod) => {
    if (!window.confirm(`Are you sure you want to delete "${method.displayName}"?`)) return;
    try {
      await deletePaymentMethod(method.id);
    } catch (err) {
      // Toast triggered in context
    }
  };

  if (!isAdmin) {
    return (
      <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center max-w-lg mx-auto my-12 space-y-4">
        <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto">
          <ShieldCheck className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">Restricted Access</h2>
        <p className="text-sm text-slate-600">
          Only authorized Owner / Admin users have permission to configure official business payment methods.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 1. Header Banner */}
      <div className="bg-white p-5 md:p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-blue-600 uppercase tracking-wider">
            <Building2 className="w-4 h-4" />
            <span>Treasury & Banking Configuration</span>
          </div>
          <h1 className="text-xl md:text-2xl font-black text-slate-900 mt-1">
            Official Business Payment Details
          </h1>
          <p className="text-xs md:text-sm text-slate-500 mt-0.5">
            Manage official bank accounts and UPI IDs presented to customers on invoice payment screens.
          </p>
        </div>

        <div className="flex items-center gap-2.5 w-full md:w-auto">
          <button
            onClick={() => openBankModal()}
            className="flex-1 md:flex-none px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold border border-slate-300 transition-colors flex items-center justify-center gap-1.5"
          >
            <Building2 className="w-4 h-4 text-slate-700" />
            <span>+ Add Bank Account</span>
          </button>
          <button
            onClick={() => openUpiModal()}
            className="flex-1 md:flex-none px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors flex items-center justify-center gap-1.5"
          >
            <QrCode className="w-4 h-4" />
            <span>+ Add UPI & QR</span>
          </button>
        </div>
      </div>

      {/* 2. Security Notice Alert */}
      <div className="bg-blue-50/70 border border-blue-200 rounded-2xl p-4 text-xs text-blue-900 flex items-start gap-3">
        <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <span className="font-bold block">Enterprise Banking Protection</span>
          <p className="text-blue-800 leading-relaxed">
            Bank login credentials, net banking passwords, and card CVVs are strictly forbidden and never stored. Customers only see read-only public deposit information (Account Number, IFSC, and UPI ID). Format validations conform to NPCI/RBI syntax standards.
          </p>
        </div>
      </div>

      {/* 3. Filter Tabs */}
      <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-xl border border-slate-200 w-fit">
        <button
          onClick={() => setActiveTab('all')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
            activeTab === 'all'
              ? 'bg-white text-blue-700 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          All Methods ({paymentMethods.length})
        </button>
        <button
          onClick={() => setActiveTab('bank')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
            activeTab === 'bank'
              ? 'bg-white text-blue-700 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Bank Accounts ({paymentMethods.filter(m => m.methodType === 'bank_account').length})
        </button>
        <button
          onClick={() => setActiveTab('upi')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
            activeTab === 'upi'
              ? 'bg-white text-blue-700 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          UPI & QR ({paymentMethods.filter(m => m.methodType === 'upi').length})
        </button>
      </div>

      {/* 4. Payment Methods Grid */}
      {filteredMethods.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
          <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto">
            <CreditCard className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900">No payment methods configured</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Configure official bank accounts or UPI identifiers to enable customers to settle outstanding dairy invoices.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredMethods.map(method => (
            <div
              key={method.id}
              className={`bg-white rounded-2xl border ${
                method.isDefault ? 'border-blue-400 shadow-sm ring-1 ring-blue-100' : 'border-slate-200'
              } p-5 flex flex-col justify-between space-y-4 transition-all hover:border-blue-300`}
            >
              {/* Card Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    method.methodType === 'bank_account'
                      ? 'bg-slate-100 text-slate-700'
                      : 'bg-blue-50 text-blue-700'
                  }`}>
                    {method.methodType === 'bank_account' ? (
                      <Building2 className="w-5 h-5" />
                    ) : (
                      <QrCode className="w-5 h-5" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <span>{method.displayName}</span>
                      {method.isDefault && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                          <Star className="w-2.5 h-2.5 fill-amber-500 text-amber-500" />
                          Default
                        </span>
                      )}
                    </h3>
                    <span className="text-[11px] font-semibold text-slate-400 uppercase">
                      {method.methodType === 'bank_account' ? 'Direct Bank Transfer (NEFT/RTGS/IMPS)' : 'UPI Transfer'}
                    </span>
                  </div>
                </div>

                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase border ${
                  method.isActive
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-slate-100 text-slate-500 border-slate-200'
                }`}>
                  {method.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>

              {/* Card Details Body */}
              <div className="bg-slate-50 rounded-xl p-3.5 space-y-2.5 text-xs text-slate-700 font-mono-numbers">
                {method.methodType === 'bank_account' ? (
                  <>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 font-sans">Bank Name:</span>
                      <span className="font-bold text-slate-900 font-sans">{method.bankName}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 font-sans">Account Holder:</span>
                      <span className="font-bold text-slate-900 font-sans">{method.accountHolderName}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 font-sans">Account Number:</span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-900">{method.accountNumber}</span>
                        <button
                          onClick={() => handleCopy(method.accountNumber || '', `${method.id}-acc`)}
                          className="p-1 rounded text-slate-400 hover:text-blue-600 hover:bg-white"
                          title="Copy Account Number"
                        >
                          {copiedId === `${method.id}-acc` ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 font-sans">IFSC Code:</span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-900">{method.ifscCode}</span>
                        <button
                          onClick={() => handleCopy(method.ifscCode || '', `${method.id}-ifsc`)}
                          className="p-1 rounded text-slate-400 hover:text-blue-600 hover:bg-white"
                          title="Copy IFSC Code"
                        >
                          {copiedId === `${method.id}-ifsc` ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                    {method.branchName && (
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500 font-sans">Branch:</span>
                        <span className="font-sans text-slate-600">{method.branchName}</span>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 font-sans">Payee / Business:</span>
                      <span className="font-bold text-slate-900 font-sans">{method.accountHolderName}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 font-sans">Official UPI ID:</span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-900">{method.upiId}</span>
                        <button
                          onClick={() => handleCopy(method.upiId || '', `${method.id}-upi`)}
                          className="p-1 rounded text-slate-400 hover:text-blue-600 hover:bg-white"
                          title="Copy UPI ID"
                        >
                          {copiedId === `${method.id}-upi` ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                    {method.qrCodeUrl && (
                      <div className="pt-2 flex items-center justify-between border-t border-slate-200">
                        <span className="text-slate-500 font-sans">QR Code:</span>
                        <a
                          href={method.qrCodeUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs font-semibold text-blue-600 hover:underline flex items-center gap-1 font-sans"
                        >
                          <Eye className="w-3 h-3" />
                          View QR Image
                        </a>
                      </div>
                    )}
                  </>
                )}

                {method.instructions && (
                  <div className="pt-2 border-t border-slate-200 font-sans">
                    <span className="text-[11px] text-slate-500 block">Instructions:</span>
                    <p className="text-xs text-slate-700 italic mt-0.5">{method.instructions}</p>
                  </div>
                )}
              </div>

              {/* Card Footer Actions */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => togglePaymentMethodStatus(method.id, !method.isActive)}
                    className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-colors ${
                      method.isActive
                        ? 'text-amber-700 hover:bg-amber-50'
                        : 'text-emerald-700 hover:bg-emerald-50'
                    }`}
                  >
                    <Power className="w-3.5 h-3.5" />
                    <span>{method.isActive ? 'Deactivate' : 'Activate'}</span>
                  </button>

                  {!method.isDefault && method.isActive && (
                    <button
                      onClick={() => updatePaymentMethod(method.id, { isDefault: true, methodType: method.methodType })}
                      className="px-3 py-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg font-semibold"
                    >
                      Make Default
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => method.methodType === 'bank_account' ? openBankModal(method) : openUpiModal(method)}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                    title="Edit Method"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(method)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                    title="Delete Method"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 5. Bank Account Modal */}
      {modalType === 'bank' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto border border-slate-200 shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-lg">
                <Building2 className="w-5 h-5 text-blue-600" />
                <span>{editingMethod ? 'Edit Bank Account' : 'Add Official Bank Account'}</span>
              </div>
              <button
                onClick={() => setModalType(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveBank} className="space-y-4 text-xs font-sans">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Account Display Name *</label>
                <input
                  type="text"
                  value={bankDisplayName}
                  onChange={e => setBankDisplayName(e.target.value)}
                  placeholder="e.g. HDFC Main Operations Account"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white"
                />
                {formErrors.displayName && (
                  <p className="text-red-600 text-[11px] mt-1">{formErrors.displayName}</p>
                )}
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Account Holder Name *</label>
                <input
                  type="text"
                  value={bankHolderName}
                  onChange={e => setBankHolderName(e.target.value)}
                  placeholder="e.g. Madhav Dairy Products Pvt. Ltd."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white"
                />
                {formErrors.holderName && (
                  <p className="text-red-600 text-[11px] mt-1">{formErrors.holderName}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Bank Name *</label>
                  <input
                    type="text"
                    value={bankName}
                    onChange={e => setBankName(e.target.value)}
                    placeholder="e.g. HDFC Bank"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white"
                  />
                  {formErrors.bankName && (
                    <p className="text-red-600 text-[11px] mt-1">{formErrors.bankName}</p>
                  )}
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Branch Name</label>
                  <input
                    type="text"
                    value={bankBranchName}
                    onChange={e => setBankBranchName(e.target.value)}
                    placeholder="e.g. Shirwal Branch"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 font-mono-numbers">
                <div>
                  <label className="block font-bold text-slate-700 mb-1 font-sans">Account Number *</label>
                  <input
                    type="text"
                    value={bankAccountNumber}
                    onChange={e => setBankAccountNumber(e.target.value)}
                    placeholder="50200012345678"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white"
                  />
                  {formErrors.accountNumber && (
                    <p className="text-red-600 text-[11px] mt-1 font-sans">{formErrors.accountNumber}</p>
                  )}
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1 font-sans">IFSC Code *</label>
                  <input
                    type="text"
                    value={bankIfscCode}
                    onChange={e => setBankIfscCode(e.target.value.toUpperCase())}
                    placeholder="HDFC0001234"
                    maxLength={11}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 uppercase focus:outline-none focus:border-blue-600 focus:bg-white"
                  />
                  {formErrors.ifscCode && (
                    <p className="text-red-600 text-[11px] mt-1 font-sans">{formErrors.ifscCode}</p>
                  )}
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Payment Instructions</label>
                <textarea
                  value={bankInstructions}
                  onChange={e => setBankInstructions(e.target.value)}
                  rows={2}
                  placeholder="Instructions shown to retailers when initiating payment..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white"
                />
              </div>

              <div className="pt-2 flex items-center justify-between border-t border-slate-100">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={bankIsActive}
                    onChange={e => setBankIsActive(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600"
                  />
                  <span className="font-semibold text-slate-800">Active (Visible to customers)</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={bankIsDefault}
                    onChange={e => setBankIsDefault(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600"
                  />
                  <span className="font-semibold text-slate-800">Default Bank Method</span>
                </label>
              </div>

              <div className="pt-4 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setModalType(null)}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-sm flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>{editingMethod ? 'Save Changes' : 'Create Bank Method'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. UPI & QR Modal */}
      {modalType === 'upi' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto border border-slate-200 shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-lg">
                <QrCode className="w-5 h-5 text-blue-600" />
                <span>{editingMethod ? 'Edit UPI & QR Method' : 'Add Official UPI & QR'}</span>
              </div>
              <button
                onClick={() => setModalType(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveUpi} className="space-y-4 text-xs font-sans">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Display Name *</label>
                <input
                  type="text"
                  value={upiDisplayName}
                  onChange={e => setUpiDisplayName(e.target.value)}
                  placeholder="e.g. Madhav Dairy Official UPI"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white"
                />
                {formErrors.displayName && (
                  <p className="text-red-600 text-[11px] mt-1">{formErrors.displayName}</p>
                )}
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Payee / Business Name *</label>
                <input
                  type="text"
                  value={upiPayeeName}
                  onChange={e => setUpiPayeeName(e.target.value)}
                  placeholder="e.g. Madhav Dairy Products"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white"
                />
                {formErrors.payeeName && (
                  <p className="text-red-600 text-[11px] mt-1">{formErrors.payeeName}</p>
                )}
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Official UPI ID (VPA) *</label>
                <input
                  type="text"
                  value={upiId}
                  onChange={e => setUpiId(e.target.value.toLowerCase())}
                  placeholder="e.g. madhavdairy@hdfcbank"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-mono-numbers focus:outline-none focus:border-blue-600 focus:bg-white"
                />
                {formErrors.upiId && (
                  <p className="text-red-600 text-[11px] mt-1">{formErrors.upiId}</p>
                )}
              </div>

              {/* QR Upload & Preview */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">QR Code Image (PNG / JPG / WEBP ≤ 2MB)</label>
                <div className="flex items-center gap-3">
                  <label className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-semibold border border-slate-300 cursor-pointer flex items-center gap-1.5 transition-colors">
                    {isUploadingQr ? (
                      <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                    ) : (
                      <Upload className="w-4 h-4" />
                    )}
                    <span>{isUploadingQr ? 'Uploading...' : 'Upload QR Image'}</span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={handleQrUpload}
                      disabled={isUploadingQr}
                      className="hidden"
                    />
                  </label>

                  {upiQrUrl && (
                    <button
                      type="button"
                      onClick={() => setUpiQrUrl('')}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-xl border border-red-200"
                      title="Remove QR code"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {upiQrUrl && (
                  <div className="mt-3 p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center gap-4">
                    <img
                      src={upiQrUrl}
                      alt="QR Preview"
                      className="w-20 h-20 object-contain bg-white rounded-lg border border-slate-200 shadow-2xs"
                    />
                    <div className="space-y-1">
                      <span className="font-bold text-slate-800 block text-xs">QR Preview Loaded</span>
                      <p className="text-[11px] text-slate-500">
                        Retailers will be able to scan this QR code directly from their invoice payment screen.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Payment Instructions</label>
                <textarea
                  value={upiInstructions}
                  onChange={e => setUpiInstructions(e.target.value)}
                  rows={2}
                  placeholder="e.g. Scan QR code or pay to UPI ID. Copy the 12-digit UTR reference number..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white"
                />
              </div>

              <div className="pt-2 flex items-center justify-between border-t border-slate-100">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={upiIsActive}
                    onChange={e => setUpiIsActive(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600"
                  />
                  <span className="font-semibold text-slate-800">Active (Visible to customers)</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={upiIsDefault}
                    onChange={e => setUpiIsDefault(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600"
                  />
                  <span className="font-semibold text-slate-800">Default UPI Method</span>
                </label>
              </div>

              <div className="pt-4 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setModalType(null)}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving || isUploadingQr}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-sm flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>{editingMethod ? 'Save Changes' : 'Create UPI Method'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
