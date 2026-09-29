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
  Truck,
  ArrowRight,
  MapPin,
  FileText
} from 'lucide-react';

interface CustomerCartProps {
  onNavigate: (tab: string) => void;
}

export const CustomerCart: React.FC<CustomerCartProps> = ({ onNavigate }) => {
  const { cart, updateCartQty, removeFromCart, clearCart, placeOrder, currentRetailer } = useDairy();
  const { t, getProductName } = useTranslation();

  const [orderNotes, setOrderNotes] = useState('');
  const [placedOrder, setPlacedOrder] = useState<Order | null>(null);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const subtotal = cart.reduce((acc, item) => acc + item.quantity * item.product.defaultPrice, 0);
  const deliveryCharge = 0; // Free delivery for registered retailers
  const grandTotal = subtotal + deliveryCharge;

  const handleConfirmOrder = () => {
    setIsSubmitting(true);
    setTimeout(() => {
      const newOrder = placeOrder(orderNotes);
      setPlacedOrder(newOrder);
      setIsConfirmModalOpen(false);
      setIsSubmitting(false);
    }, 300);
  };

  // 1. Order Placed Success Confirmation (Section 35)
  if (placedOrder) {
    return (
      <div className="p-4 max-w-md mx-auto my-6 animate-in fade-in zoom-in-95 duration-200">
        <div className="bg-white rounded-2xl border border-slate-200 p-6 text-center space-y-4 shadow-xl">
          <div className="w-14 h-14 bg-green-50 border border-green-200 text-green-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
            <CheckCircle className="w-8 h-8" />
          </div>

          <div>
            <h2 className="text-base font-bold text-slate-900">
              {t.customer.checkout.successTitle}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {t.customer.checkout.successMsg}
            </p>
          </div>

          {/* Order Details Brief */}
          <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 text-left space-y-2 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <span className="text-slate-500">{t.customer.checkout.orderId}:</span>
              <span className="font-bold text-slate-900 font-mono-numbers">
                {placedOrder.orderNumber}
              </span>
            </div>
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <span className="text-slate-500">Delivery To:</span>
              <span className="font-semibold text-slate-900 truncate max-w-[200px]">
                {currentRetailer.businessName}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Bill Total:</span>
              <span className="font-bold text-blue-700 text-sm font-mono-numbers">
                ₹{placedOrder.totalAmount.toLocaleString()}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-2 pt-2">
            <Button
              variant="primary"
              size="md"
              className="w-full"
              onClick={() => onNavigate('orders')}
            >
              {t.customer.checkout.viewOrder}
            </Button>
            <Button
              variant="secondary"
              size="md"
              className="w-full"
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
      <div className="p-4 max-w-md mx-auto my-12 text-center">
        <div className="w-16 h-16 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 mx-auto mb-3">
          <ShoppingBag className="w-8 h-8" />
        </div>
        <h3 className="text-base font-bold text-slate-900">{t.customer.cart.emptyTitle}</h3>
        <p className="text-xs text-slate-500 max-w-xs mx-auto mt-1 leading-relaxed">
          {t.customer.cart.emptyDesc}
        </p>
        <div className="mt-4">
          <Button
            variant="primary"
            size="md"
            onClick={() => onNavigate('products')}
          >
            {t.customer.cart.browseProducts}
          </Button>
        </div>
      </div>
    );
  }

  // 3. Simple Review Cart View (Section 34)
  return (
    <div className="p-4 space-y-4 pb-28">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-900">{t.customer.cart.title}</h2>
          <p className="text-xs text-slate-500">{cart.length} unique dairy products</p>
        </div>
        <button
          onClick={clearCart}
          className="text-xs text-red-600 hover:text-red-700 font-medium"
        >
          Clear All
        </button>
      </div>

      {/* Cart Items List with Direct Quantity Editing */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs divide-y divide-slate-100 overflow-hidden">
        {cart.map(item => {
          const itemTotal = item.quantity * item.product.defaultPrice;
          const localizedName = getProductName(item.product);

          return (
            <div key={item.product.id} className="p-3.5 flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <h4 className="text-xs font-bold text-slate-900 truncate">
                  {localizedName}
                </h4>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  <span>{item.product.unit}</span>
                  <span className="mx-1.5">•</span>
                  <span className="font-mono-numbers">₹{item.product.defaultPrice} / pack</span>
                </div>
                <div className="text-xs font-bold text-blue-600 font-mono-numbers mt-1">
                  ₹{itemTotal.toLocaleString()}
                </div>
              </div>

              {/* Quantity Stepper */}
              <div className="flex items-center bg-blue-50 border border-blue-200 rounded-lg overflow-hidden shrink-0 shadow-xs">
                <button
                  onClick={() => updateCartQty(item.product.id, item.quantity - 1)}
                  className="w-8 h-8 flex items-center justify-center text-slate-700 hover:bg-blue-100 active:bg-blue-200 transition-colors"
                  aria-label="Decrease quantity"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="w-7 text-center font-bold text-xs text-blue-900 font-mono-numbers">
                  {item.quantity}
                </span>
                <button
                  onClick={() => updateCartQty(item.product.id, item.quantity + 1)}
                  className="w-8 h-8 flex items-center justify-center text-slate-700 hover:bg-blue-100 active:bg-blue-200 transition-colors"
                  aria-label="Increase quantity"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Delivery Address (Saved default, no re-entering) */}
      <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-xs space-y-1.5 text-xs">
        <div className="flex items-center gap-1.5 font-bold text-slate-900">
          <MapPin className="w-4 h-4 text-blue-600" />
          <span>{t.customer.cart.deliveringTo}</span>
        </div>
        <p className="text-slate-600 pl-5 leading-relaxed">
          <strong>{currentRetailer.businessName}</strong>, {currentRetailer.address}
        </p>
      </div>

      {/* Delivery Instructions (Optional) */}
      <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-xs space-y-1.5 text-xs">
        <label className="block font-semibold text-slate-800">
          {t.customer.cart.orderNotes}
        </label>
        <input
          type="text"
          value={orderNotes}
          onChange={e => setOrderNotes(e.target.value)}
          placeholder={t.customer.cart.notesPlaceholder}
          className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:bg-white"
        />
      </div>

      {/* Bill Summary */}
      <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-xs space-y-2 text-xs">
        <div className="flex justify-between text-slate-600">
          <span>{t.customer.cart.itemTotal}</span>
          <span className="font-mono-numbers font-medium text-slate-900">
            ₹{subtotal.toLocaleString()}
          </span>
        </div>
        <div className="flex justify-between text-slate-600">
          <span>{t.customer.cart.deliveryCharges}</span>
          <span className="text-green-700 font-semibold">{t.customer.cart.freeDelivery}</span>
        </div>
        <div className="pt-2 border-t border-slate-100 flex justify-between font-bold text-sm text-slate-900">
          <span>{t.customer.cart.finalAmount}</span>
          <span className="text-blue-700 font-mono-numbers">₹{grandTotal.toLocaleString()}</span>
        </div>
      </div>

      {/* Place Order Primary Action */}
      <div className="pt-2">
        <Button
          variant="primary"
          size="lg"
          className="w-full"
          onClick={() => setIsConfirmModalOpen(true)}
        >
          {t.customer.cart.placeOrder} &bull; ₹{grandTotal.toLocaleString()}
        </Button>
      </div>

      {/* Confirmation Modal (Cart -> Confirm -> Done) */}
      <Modal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        title={t.customer.checkout.confirmTitle}
        subtitle={`Dispatch destination: ${currentRetailer.businessName}`}
      >
        <div className="space-y-3 text-xs">
          <p className="text-slate-600 leading-relaxed">
            {t.customer.checkout.confirmMsg}
          </p>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1 font-mono-numbers text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">Products:</span>
              <span className="font-bold text-slate-900">{cart.length} items</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Total Quantity:</span>
              <span className="font-bold text-slate-900">
                {cart.reduce((s, i) => s + i.quantity, 0)} units
              </span>
            </div>
            <div className="flex justify-between pt-1 border-t border-slate-200 text-sm">
              <span className="font-bold text-slate-900">Total Bill:</span>
              <span className="font-bold text-blue-700">₹{grandTotal.toLocaleString()}</span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsConfirmModalOpen(false)}
            >
              Review Again
            </Button>
            <Button
              variant="primary"
              size="sm"
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
