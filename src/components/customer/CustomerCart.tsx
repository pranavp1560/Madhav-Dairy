import React, { useState } from 'react';
import { useDairy } from '../../context/DairyContext';
import { useTranslation } from '../../i18n/LanguageContext';
import { Order } from '../../types/dairy';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import {
  Trash2,
  Plus,
  Minus,
  CheckCircle,
  ShoppingBag,
  ArrowRight,
  MapPin,
  Calendar,
  AlertCircle,
  Check,
  Truck
} from 'lucide-react';

interface CustomerCartProps {
  onNavigate: (tab: string) => void;
}

export const CustomerCart: React.FC<CustomerCartProps> = ({ onNavigate }) => {
  const { cart, updateCartQty, removeFromCart, clearCart, placeOrder, currentRetailer } = useDairy();
  const { t } = useTranslation();

  const getTodayDate = () => {
    return new Date().toISOString().split('T')[0];
  };

  const getTomorrowDate = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  };

  const getDayAfterTomorrowDate = () => {
    const d = new Date();
    d.setDate(d.getDate() + 2);
    return d.toISOString().split('T')[0];
  };

  const formatDisplayDate = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        return d.toLocaleDateString(undefined, {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        });
      }
      return dateStr;
    } catch {
      return dateStr;
    }
  };

  const [orderNotes, setOrderNotes] = useState('');
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState<string>(getTomorrowDate());
  const [deliveryDateError, setDeliveryDateError] = useState<string | null>(null);
  const [placedOrder, setPlacedOrder] = useState<Order | null>(null);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const subtotal = cart.reduce((acc, item) => acc + item.quantity * (item.unitPrice ?? item.product.defaultPrice), 0);
  const deliveryCharge = 0; // Free delivery for registered retailers
  const grandTotal = subtotal + deliveryCharge;

  const handleOpenConfirmModal = () => {
    if (!expectedDeliveryDate) {
      setDeliveryDateError('Please choose an expected date of delivery before placing your order.');
      return;
    }
    if (expectedDeliveryDate < getTodayDate()) {
      setDeliveryDateError('Expected delivery date cannot be in the past. Please select today or a future date.');
      return;
    }
    setDeliveryDateError(null);
    setIsConfirmModalOpen(true);
  };

  const handleConfirmOrder = async () => {
    if (!expectedDeliveryDate) {
      setDeliveryDateError('Please choose an expected delivery date');
      return;
    }
    setIsSubmitting(true);
    try {
      const newOrder = await placeOrder(orderNotes, expectedDeliveryDate);
      setPlacedOrder(newOrder);
      setIsConfirmModalOpen(false);
    } catch {
      // Toast error displayed by placeOrder
    } finally {
      setIsSubmitting(false);
    }
  };

  // 1. Order Placed Success Confirmation Screen
  if (placedOrder) {
    return (
      <div className="p-4 max-w-lg mx-auto my-8 animate-in fade-in zoom-in-95 duration-200 font-sans">
        <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 text-center space-y-5 shadow-xl">
          <div className="w-16 h-16 bg-emerald-50 border-2 border-emerald-200 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
            <CheckCircle className="w-10 h-10 stroke-[2.5]" />
          </div>

          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              {t.customer.checkout.successTitle}
            </h1>
            <p className="text-sm sm:text-base text-slate-600 mt-1 max-w-sm mx-auto leading-relaxed">
              {t.customer.checkout.successMsg}
            </p>
          </div>

          {/* Key Order Details Summary Card */}
          <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 text-left space-y-3 text-sm font-sans">
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-200">
              <span className="text-slate-500 font-medium">{t.customer.checkout.orderId}:</span>
              <span className="font-bold text-slate-900 font-mono-numbers text-base">
                {placedOrder.orderNumber}
              </span>
            </div>

            <div className="flex items-center justify-between pb-2.5 border-b border-slate-200">
              <span className="text-slate-500 font-medium">Destination:</span>
              <span className="font-bold text-slate-900 truncate max-w-[220px]">
                {currentRetailer?.businessName || 'Your Store'}
              </span>
            </div>

            <div className="flex items-center justify-between pb-2.5 border-b border-slate-200">
              <span className="text-slate-500 font-medium">Expected Delivery:</span>
              <span className="font-bold text-emerald-800 font-mono-numbers flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-emerald-600" />
                {placedOrder.deliveryDate ? formatDisplayDate(placedOrder.deliveryDate) : formatDisplayDate(expectedDeliveryDate)}
              </span>
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-slate-700 font-bold text-base">Total Bill:</span>
              <span className="font-black text-blue-700 text-xl font-mono-numbers">
                ₹{placedOrder.totalAmount.toLocaleString()}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-3 pt-2">
            <button
              onClick={() => onNavigate('orders')}
              className="w-full min-h-[50px] px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-base shadow-sm transition-all flex items-center justify-center gap-2"
            >
              <span>{t.customer.checkout.viewOrder}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                setPlacedOrder(null);
                onNavigate('home');
              }}
              className="w-full min-h-[50px] px-5 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-base transition-all"
            >
              {t.customer.checkout.continueShopping}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 2. Empty Cart View
  if (cart.length === 0) {
    return (
      <div className="max-w-md mx-auto my-16 p-6 text-center space-y-4 font-sans">
        <div className="w-20 h-20 rounded-full bg-blue-50 border-2 border-blue-200 flex items-center justify-center text-blue-600 mx-auto shadow-sm">
          <ShoppingBag className="w-10 h-10 stroke-[2]" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900">{t.customer.cart.emptyTitle}</h1>
        <p className="text-base text-slate-600 leading-relaxed">
          {t.customer.cart.emptyDesc}
        </p>
        <div className="pt-2">
          <button
            onClick={() => onNavigate('products')}
            className="w-full min-h-[52px] px-6 py-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-base font-bold rounded-2xl shadow-sm transition-all"
          >
            {t.customer.cart.browseProducts}
          </button>
        </div>
      </div>
    );
  }

  // 3. Cart Items & Checkout View
  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-36 font-sans">
      {/* Header */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            {t.customer.cart.title}
          </h1>
          <p className="text-sm sm:text-base text-slate-600 mt-0.5">
            {cart.length} {cart.length === 1 ? 'product' : 'products'} in your wholesale order
          </p>
        </div>
        <button
          onClick={clearCart}
          className="min-h-[44px] text-sm text-red-600 hover:text-red-700 font-bold px-3.5 py-2 rounded-xl hover:bg-red-50 border border-transparent hover:border-red-200 transition-colors flex items-center gap-1.5"
        >
          <Trash2 className="w-4 h-4" />
          <span>Clear All</span>
        </button>
      </div>

      {/* Cart Items List */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs divide-y divide-slate-100 overflow-hidden">
        {cart.map(item => {
          const itemPrice = item.unitPrice ?? item.product.defaultPrice;
          const itemTotal = item.quantity * itemPrice;
          const skuLabel = item.sku?.variantName || item.sku?.packSize;
          const key = `${item.product.id}_${item.sku?.id || 'default'}`;

          return (
            <div
              key={key}
              className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="flex-1 min-w-0 space-y-1">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 leading-snug">
                  {item.product.name}
                </h2>
                {skuLabel && (
                  <div>
                    <span className="inline-flex items-center text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-md border border-blue-200">
                      {skuLabel}
                    </span>
                  </div>
                )}
                <div className="text-sm text-slate-600 pt-0.5 flex items-center gap-1.5">
                  <span className="font-mono-numbers font-medium text-slate-700">
                    {item.quantity} × ₹{itemPrice}
                  </span>
                  <span className="text-slate-400">=</span>
                  <span className="font-mono-numbers font-black text-slate-900">
                    ₹{itemTotal.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Stepper Controls & Item Total */}
              <div className="flex items-center justify-between sm:justify-end gap-5 shrink-0 pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                {/* Touch-Friendly Stepper (Min 44px Buttons) */}
                <div className="flex items-center bg-blue-50/80 border border-blue-200 rounded-xl overflow-hidden shadow-2xs">
                  <button
                    onClick={() => updateCartQty(item.product.id, item.quantity - 1, item.sku?.id)}
                    className="min-w-[44px] min-h-[44px] w-11 h-11 flex items-center justify-center text-slate-800 hover:bg-blue-100 active:bg-blue-200 transition-colors"
                    aria-label="Decrease quantity"
                  >
                    <Minus className="w-4 h-4 stroke-[2.5]" />
                  </button>
                  <span className="min-w-[40px] text-center font-black text-base sm:text-lg text-blue-950 font-mono-numbers px-1">
                    {item.quantity}
                  </span>
                  <button
                    onClick={() => updateCartQty(item.product.id, item.quantity + 1, item.sku?.id)}
                    className="min-w-[44px] min-h-[44px] w-11 h-11 flex items-center justify-center text-slate-800 hover:bg-blue-100 active:bg-blue-200 transition-colors"
                    aria-label="Increase quantity"
                  >
                    <Plus className="w-4 h-4 stroke-[2.5]" />
                  </button>
                </div>

                <div className="text-right min-w-[90px]">
                  <span className="text-lg sm:text-xl font-black text-slate-900 font-mono-numbers block">
                    ₹{itemTotal.toLocaleString()}
                  </span>
                  <button
                    onClick={() => removeFromCart(item.product.id, item.sku?.id)}
                    className="min-h-[44px] text-xs font-bold text-red-600 hover:text-red-700 transition-colors inline-flex items-center"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Delivery Destination Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-2">
        <div className="flex items-center gap-2 font-bold text-slate-900 text-base">
          <MapPin className="w-5 h-5 text-blue-600 shrink-0" />
          <span>{t.customer.cart.deliveringTo}</span>
        </div>
        <p className="text-slate-700 pl-7 leading-relaxed text-sm sm:text-base">
          <strong className="text-slate-900">{currentRetailer?.businessName || 'Your Registered Store'}</strong>
          {currentRetailer?.address ? `, ${currentRetailer.address}` : ''}
        </p>
      </div>

      {/* Expected Date of Delivery (Required before order placement) */}
      <div className={`bg-white rounded-2xl border p-5 sm:p-6 shadow-2xs space-y-4 transition-all ${
        deliveryDateError ? 'border-red-300 ring-2 ring-red-100' : 'border-slate-200'
      }`}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700 shrink-0">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-slate-900 text-base sm:text-lg">
                {t.customer.cart.expectedDeliveryDate}
              </h2>
              <p className="text-xs sm:text-sm text-slate-500">
                {t.customer.cart.deliveryDateHelp}
              </p>
            </div>
          </div>
          <span className="px-3 py-1 text-xs font-bold rounded-full bg-blue-100 text-blue-800 uppercase tracking-wide shrink-0">
            Required *
          </span>
        </div>

        {/* Quick Date Presets (Min 44px Touch Targets) */}
        <div className="flex flex-wrap gap-2.5 pt-1">
          <button
            type="button"
            onClick={() => {
              setExpectedDeliveryDate(getTomorrowDate());
              setDeliveryDateError(null);
            }}
            className={`min-h-[44px] px-4 py-2.5 rounded-xl text-sm font-bold border transition-all flex items-center gap-2 ${
              expectedDeliveryDate === getTomorrowDate()
                ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
            }`}
          >
            <span>{t.customer.cart.quickTomorrow}</span>
            <span className={`text-xs ${expectedDeliveryDate === getTomorrowDate() ? 'text-blue-100' : 'text-slate-500 font-mono-numbers'}`}>
              ({formatDisplayDate(getTomorrowDate())})
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setExpectedDeliveryDate(getDayAfterTomorrowDate());
              setDeliveryDateError(null);
            }}
            className={`min-h-[44px] px-4 py-2.5 rounded-xl text-sm font-bold border transition-all flex items-center gap-2 ${
              expectedDeliveryDate === getDayAfterTomorrowDate()
                ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
            }`}
          >
            <span>{t.customer.cart.quickDayAfter}</span>
            <span className={`text-xs ${expectedDeliveryDate === getDayAfterTomorrowDate() ? 'text-blue-100' : 'text-slate-500 font-mono-numbers'}`}>
              ({formatDisplayDate(getDayAfterTomorrowDate())})
            </span>
          </button>
        </div>

        {/* Specific Date Picker Input */}
        <div className="pt-1">
          <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5">
            {t.customer.cart.selectDeliveryDate}
          </label>
          <input
            type="date"
            required
            min={getTodayDate()}
            value={expectedDeliveryDate}
            onChange={e => {
              setExpectedDeliveryDate(e.target.value);
              if (e.target.value) setDeliveryDateError(null);
            }}
            className="w-full h-12 min-h-[48px] px-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-mono-numbers text-base focus:outline-none focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-100 transition-all"
          />

          {deliveryDateError && (
            <p className="text-sm text-red-600 flex items-center gap-1.5 mt-2 font-semibold">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{deliveryDateError}</span>
            </p>
          )}

          {expectedDeliveryDate && !deliveryDateError && (
            <p className="text-sm text-emerald-800 font-bold flex items-center gap-1.5 mt-2">
              <Check className="w-4 h-4 text-emerald-600 shrink-0 stroke-[2.5]" />
              <span>
                Dispatch planned for: <strong>{formatDisplayDate(expectedDeliveryDate)}</strong>
              </span>
            </p>
          )}
        </div>
      </div>

      {/* Delivery Instructions (Optional) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-2">
        <label className="block font-bold text-slate-900 text-sm sm:text-base">
          {t.customer.cart.orderNotes}
        </label>
        <input
          type="text"
          value={orderNotes}
          onChange={e => setOrderNotes(e.target.value)}
          placeholder={t.customer.cart.notesPlaceholder}
          className="w-full h-12 min-h-[48px] px-4 bg-slate-50 border border-slate-200 rounded-xl placeholder:text-slate-400 text-sm sm:text-base focus:outline-none focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-100 transition-all"
        />
      </div>

      {/* Bill Summary Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-2xs space-y-3">
        <div className="flex justify-between text-sm sm:text-base text-slate-600">
          <span>{t.customer.cart.itemTotal}</span>
          <span className="font-mono-numbers font-bold text-slate-900">
            ₹{subtotal.toLocaleString()}
          </span>
        </div>

        <div className="flex justify-between text-sm sm:text-base text-slate-600">
          <span className="flex items-center gap-1.5">
            <Truck className="w-4 h-4 text-emerald-600" />
            <span>{t.customer.cart.deliveryCharges}</span>
          </span>
          <span className="text-emerald-800 font-bold">{t.customer.cart.freeDelivery}</span>
        </div>

        <div className="pt-3 border-t border-slate-100 flex items-baseline justify-between text-slate-900">
          <span className="font-bold text-base sm:text-lg">{t.customer.cart.finalAmount}</span>
          <span className="text-2xl sm:text-3xl font-black text-blue-700 font-mono-numbers">
            ₹{grandTotal.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Place Order Primary Action Button */}
      <div className="pt-2">
        <button
          onClick={handleOpenConfirmModal}
          className="w-full min-h-[56px] px-6 py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-extrabold text-base sm:text-lg shadow-sm flex items-center justify-center gap-3 transition-all active:scale-[0.99]"
        >
          <span>{t.customer.cart.placeOrder}</span>
          <span>•</span>
          <span className="font-mono-numbers">₹{grandTotal.toLocaleString()}</span>
        </button>
      </div>

      {/* Order Confirmation Modal */}
      <Modal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        title={t.customer.checkout.confirmTitle}
        subtitle={`Dispatch destination: ${currentRetailer?.businessName || 'Your Store'}`}
      >
        <div className="space-y-4 text-sm font-sans">
          <p className="text-slate-600 leading-relaxed">
            {t.customer.checkout.confirmMsg}
          </p>

          {/* Delivery Date Highlight */}
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-slate-700 flex items-center gap-2 font-bold text-sm">
                <Calendar className="w-4 h-4 text-blue-600" />
                {t.customer.cart.expectedDeliveryDate}:
              </span>
              <span className="font-extrabold text-blue-900 font-mono-numbers text-sm sm:text-base">
                {formatDisplayDate(expectedDeliveryDate)}
              </span>
            </div>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 font-mono-numbers">
            <div className="flex justify-between">
              <span className="text-slate-500 font-sans">Products:</span>
              <span className="font-bold text-slate-900">{cart.length} items</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 font-sans">Total Quantity:</span>
              <span className="font-bold text-slate-900">
                {cart.reduce((s, i) => s + i.quantity, 0)} units
              </span>
            </div>
            <div className="flex justify-between pt-2 border-t border-slate-200 text-base">
              <span className="font-bold text-slate-900 font-sans">Total Bill:</span>
              <span className="font-black text-blue-700">₹{grandTotal.toLocaleString()}</span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
            <Button
              variant="secondary"
              size="md"
              className="min-h-[44px] text-sm font-bold"
              onClick={() => setIsConfirmModalOpen(false)}
            >
              Review Again
            </Button>
            <Button
              variant="primary"
              size="md"
              className="min-h-[44px] text-sm font-bold"
              isLoading={isSubmitting}
              onClick={handleConfirmOrder}
            >
              {t.customer.checkout.confirmButton}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
