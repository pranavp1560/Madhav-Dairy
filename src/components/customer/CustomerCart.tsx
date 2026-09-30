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
  Check
} from 'lucide-react';

interface CustomerCartProps {
  onNavigate: (tab: string) => void;
}

export const CustomerCart: React.FC<CustomerCartProps> = ({ onNavigate }) => {
  const { cart, updateCartQty, removeFromCart, clearCart, placeOrder, currentRetailer } = useDairy();
  const { t, getProductName } = useTranslation();

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

  const subtotal = cart.reduce((acc, item) => acc + item.quantity * item.product.defaultPrice, 0);
  const deliveryCharge = 0; // Free delivery for registered retailers
  const grandTotal = subtotal + deliveryCharge;

  const handleOpenConfirmModal = () => {
    if (!expectedDeliveryDate) {
      setDeliveryDateError('Please enter an expected date of delivery before placing your order.');
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
      // Toast displayed by placeOrder
    } finally {
      setIsSubmitting(false);
    }
  };

  // 1. Order Placed Success Confirmation Screen
  if (placedOrder) {
    return (
      <div className="p-4 max-w-md mx-auto my-6 animate-in fade-in zoom-in-95 duration-200 font-sans">
        <div className="bg-white rounded-2xl border border-slate-200 p-6 text-center space-y-4 shadow-xl">
          <div className="w-13 h-13 bg-emerald-50 border border-emerald-200 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
            <CheckCircle className="w-8 h-8" />
          </div>

          <div>
            <h2 className="text-xl font-bold text-slate-900">
              {t.customer.checkout.successTitle}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {t.customer.checkout.successMsg}
            </p>
          </div>

          {/* Key Order Details Summary */}
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 text-left space-y-2 text-xs sm:text-sm">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <span className="text-slate-500">{t.customer.checkout.orderId}:</span>
              <span className="font-bold text-slate-900 font-mono-numbers">
                {placedOrder.orderNumber}
              </span>
            </div>
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <span className="text-slate-500">Destination:</span>
              <span className="font-semibold text-slate-900 truncate max-w-[200px]">
                {currentRetailer?.businessName || 'Your Store'}
              </span>
            </div>
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <span className="text-slate-500">Expected Delivery:</span>
              <span className="font-bold text-emerald-700 font-mono-numbers flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                {placedOrder.deliveryDate ? formatDisplayDate(placedOrder.deliveryDate) : formatDisplayDate(expectedDeliveryDate)}
              </span>
            </div>
            <div className="flex items-center justify-between pt-0.5">
              <span className="text-slate-600 font-semibold">Total Bill:</span>
              <span className="font-bold text-blue-700 text-base font-mono-numbers">
                ₹{placedOrder.totalAmount.toLocaleString()}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-2 pt-1">
            <Button
              variant="primary"
              size="md"
              className="w-full text-sm font-bold"
              onClick={() => onNavigate('orders')}
            >
              {t.customer.checkout.viewOrder}
            </Button>
            <Button
              variant="secondary"
              size="md"
              className="w-full text-sm font-semibold"
              onClick={() => {
                setPlacedOrder(null);
                onNavigate('home');
              }}
            >
              {t.customer.checkout.continueShopping}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // 2. Empty Cart View
  if (cart.length === 0) {
    return (
      <div className="max-w-md mx-auto my-12 p-6 text-center space-y-3 font-sans">
        <div className="w-16 h-16 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 mx-auto">
          <ShoppingBag className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-slate-900">{t.customer.cart.emptyTitle}</h3>
        <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
          {t.customer.cart.emptyDesc}
        </p>
        <div className="pt-2">
          <Button
            variant="primary"
            size="md"
            className="w-full text-sm font-bold"
            onClick={() => onNavigate('products')}
          >
            {t.customer.cart.browseProducts}
          </Button>
        </div>
      </div>
    );
  }

  // 3. Simple, Readable Review Cart View
  return (
    <div className="max-w-4xl mx-auto space-y-4 pb-28 font-sans">
      {/* Header */}
      <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-slate-900">{t.customer.cart.title}</h1>
          <p className="text-xs text-slate-500 mt-0.5">{cart.length} {cart.length === 1 ? 'product' : 'products'} in your order</p>
        </div>
        <button
          onClick={clearCart}
          className="text-xs text-red-600 hover:text-red-700 font-semibold px-2.5 py-1 rounded-lg hover:bg-red-50 transition-colors flex items-center gap-1"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Clear All</span>
        </button>
      </div>

      {/* Cart Items List */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs divide-y divide-slate-100 overflow-hidden">
        {cart.map(item => {
          const itemTotal = item.quantity * item.product.defaultPrice;
          const localizedName = getProductName(item.product);

          return (
            <div key={item.product.id} className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <h4 className="text-sm sm:text-base font-bold text-slate-900 leading-snug">
                  {localizedName}
                </h4>
                <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                  <span className="font-semibold text-slate-700 bg-slate-100 px-1.5 py-0.2 rounded">
                    {item.product.unit}
                  </span>
                  <span>•</span>
                  <span className="font-mono-numbers">₹{item.product.defaultPrice} / pack</span>
                </div>
              </div>

              {/* Stepper & Total */}
              <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                <div className="flex items-center bg-blue-50/80 border border-blue-200 rounded-lg overflow-hidden shadow-2xs">
                  <button
                    onClick={() => updateCartQty(item.product.id, item.quantity - 1)}
                    className="w-8 h-8 flex items-center justify-center text-slate-800 hover:bg-blue-100 active:bg-blue-200 transition-colors"
                    aria-label="Decrease quantity"
                  >
                    <Minus className="w-3.5 h-3.5 stroke-[2.5]" />
                  </button>
                  <span className="w-8 text-center font-bold text-sm text-blue-900 font-mono-numbers">
                    {item.quantity}
                  </span>
                  <button
                    onClick={() => updateCartQty(item.product.id, item.quantity + 1)}
                    className="w-8 h-8 flex items-center justify-center text-slate-800 hover:bg-blue-100 active:bg-blue-200 transition-colors"
                    aria-label="Increase quantity"
                  >
                    <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                  </button>
                </div>

                <div className="text-right min-w-[75px]">
                  <span className="text-base font-bold text-slate-900 font-mono-numbers block">
                    ₹{itemTotal.toLocaleString()}
                  </span>
                  <button
                    onClick={() => removeFromCart(item.product.id)}
                    className="text-[11px] text-red-500 hover:text-red-700 font-medium"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Delivery Destination */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-1.5 text-xs sm:text-sm">
        <div className="flex items-center gap-1.5 font-bold text-slate-900">
          <MapPin className="w-4 h-4 text-blue-600 shrink-0" />
          <span>{t.customer.cart.deliveringTo}</span>
        </div>
        <p className="text-slate-600 pl-5 leading-relaxed text-xs sm:text-sm">
          <strong className="text-slate-900">{currentRetailer?.businessName || 'Your Registered Store'}</strong>, {currentRetailer?.address || 'Default Delivery Location'}
        </p>
      </div>

      {/* Expected Date of Delivery (Required before order placement) */}
      <div className={`bg-white rounded-xl border p-4 shadow-2xs space-y-3 text-xs sm:text-sm transition-all ${
        deliveryDateError ? 'border-red-300 ring-1 ring-red-100' : 'border-slate-200'
      }`}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700 shrink-0">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-slate-900 block text-xs sm:text-sm">
                {t.customer.cart.expectedDeliveryDate}
              </span>
              <span className="text-[11px] text-slate-500 block">
                {t.customer.cart.deliveryDateHelp}
              </span>
            </div>
          </div>
          <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-blue-100 text-blue-800 uppercase tracking-wide shrink-0">
            Required *
          </span>
        </div>

        {/* Quick Date Presets */}
        <div className="flex flex-wrap gap-2 pt-0.5">
          <button
            type="button"
            onClick={() => {
              setExpectedDeliveryDate(getTomorrowDate());
              setDeliveryDateError(null);
            }}
            className={`h-8 px-3 rounded-lg text-xs font-semibold border transition-all flex items-center gap-1.5 ${
              expectedDeliveryDate === getTomorrowDate()
                ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
            }`}
          >
            <span>{t.customer.cart.quickTomorrow}</span>
            <span className={`text-[11px] ${expectedDeliveryDate === getTomorrowDate() ? 'text-blue-100' : 'text-slate-400'}`}>
              ({formatDisplayDate(getTomorrowDate())})
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setExpectedDeliveryDate(getDayAfterTomorrowDate());
              setDeliveryDateError(null);
            }}
            className={`h-8 px-3 rounded-lg text-xs font-semibold border transition-all flex items-center gap-1.5 ${
              expectedDeliveryDate === getDayAfterTomorrowDate()
                ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
            }`}
          >
            <span>{t.customer.cart.quickDayAfter}</span>
            <span className={`text-[11px] ${expectedDeliveryDate === getDayAfterTomorrowDate() ? 'text-blue-100' : 'text-slate-400'}`}>
              ({formatDisplayDate(getDayAfterTomorrowDate())})
            </span>
          </button>
        </div>

        {/* Specific Date Picker Input */}
        <div>
          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
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
            className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-mono-numbers text-xs sm:text-sm focus:outline-none focus:border-blue-600 focus:bg-white transition-all"
          />
          {deliveryDateError && (
            <p className="text-xs text-red-600 flex items-center gap-1 mt-1.5 font-medium">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{deliveryDateError}</span>
            </p>
          )}
          {expectedDeliveryDate && !deliveryDateError && (
            <p className="text-xs text-emerald-700 font-semibold flex items-center gap-1 mt-1.5">
              <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 stroke-[2.5]" />
              <span>
                Dispatch planned for: <strong>{formatDisplayDate(expectedDeliveryDate)}</strong>
              </span>
            </p>
          )}
        </div>
      </div>

      {/* Delivery Instructions (Optional) */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-1.5 text-xs sm:text-sm">
        <label className="block font-semibold text-slate-800">
          {t.customer.cart.orderNotes}
        </label>
        <input
          type="text"
          value={orderNotes}
          onChange={e => setOrderNotes(e.target.value)}
          placeholder={t.customer.cart.notesPlaceholder}
          className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg placeholder:text-slate-400 text-xs sm:text-sm focus:outline-none focus:border-blue-600 focus:bg-white transition-all"
        />
      </div>

      {/* Bill Summary */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-2xs space-y-2.5 text-xs sm:text-sm">
        <div className="flex justify-between text-slate-600">
          <span>{t.customer.cart.itemTotal}</span>
          <span className="font-mono-numbers font-bold text-slate-900">
            ₹{subtotal.toLocaleString()}
          </span>
        </div>
        <div className="flex justify-between text-slate-600">
          <span>{t.customer.cart.deliveryCharges}</span>
          <span className="text-emerald-700 font-bold">{t.customer.cart.freeDelivery}</span>
        </div>
        <div className="pt-2.5 border-t border-slate-100 flex items-baseline justify-between text-slate-900">
          <span className="font-bold text-sm sm:text-base">{t.customer.cart.finalAmount}</span>
          <span className="text-xl sm:text-2xl font-black text-blue-700 font-mono-numbers">
            ₹{grandTotal.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Place Order Primary Action Button */}
      <div className="pt-1">
        <button
          onClick={handleOpenConfirmModal}
          className="w-full h-12 px-5 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-sm sm:text-base shadow-xs flex items-center justify-center gap-2 transition-all active:scale-[0.99]"
        >
          <span>{t.customer.cart.placeOrder}</span>
          <span>•</span>
          <span className="font-mono-numbers">₹{grandTotal.toLocaleString()}</span>
        </button>
      </div>

      {/* Confirmation Modal */}
      <Modal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        title={t.customer.checkout.confirmTitle}
        subtitle={`Dispatch destination: ${currentRetailer?.businessName || 'Your Store'}`}
      >
        <div className="space-y-3.5 text-xs sm:text-sm font-sans">
          <p className="text-slate-600 leading-relaxed">
            {t.customer.checkout.confirmMsg}
          </p>

          {/* Expected Delivery Date Highlight */}
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-slate-700 flex items-center gap-1.5 font-semibold text-xs">
                <Calendar className="w-3.5 h-3.5 text-blue-600" />
                {t.customer.cart.expectedDeliveryDate}:
              </span>
              <span className="font-bold text-blue-900 font-mono-numbers text-xs sm:text-sm">
                {formatDisplayDate(expectedDeliveryDate)}
              </span>
            </div>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-xs sm:text-sm font-mono-numbers">
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
            <div className="flex justify-between pt-1.5 border-t border-slate-200 text-sm">
              <span className="font-bold text-slate-900 font-sans">Total Bill:</span>
              <span className="font-black text-blue-700">₹{grandTotal.toLocaleString()}</span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
            <Button
              variant="secondary"
              size="sm"
              className="text-xs font-semibold"
              onClick={() => setIsConfirmModalOpen(false)}
            >
              Review Again
            </Button>
            <Button
              variant="primary"
              size="sm"
              className="text-xs font-bold"
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
