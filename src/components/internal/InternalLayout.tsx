import React, { useState } from 'react';
import { useDairy } from '../../context/DairyContext';
import { InternalSidebar } from './InternalSidebar';
import { InternalHeader } from './InternalHeader';

// View Screens
import { DashboardView } from './DashboardView';
import { ProductionView } from './ProductionView';
import { InventoryView } from './InventoryView';
import { RawMaterialsView } from './RawMaterialsView';
import { StockMovementsView } from './StockMovementsView';
import { OrdersView } from './OrdersView';
import { InvoicesView } from './InvoicesView';
import { RetailersView } from './RetailersView';
import { PaymentsView } from './PaymentsView';
import { LedgerView } from './LedgerView';
import { ExpensesView } from './ExpensesView';
import { ExpiryView } from './ExpiryView';
import { ReportsView } from './ReportsView';
import { UsersView } from './UsersView';
import { RolesPermissionsView } from './RolesPermissionsView';
import { ProductsAdminView } from './ProductsAdminView';
import { ProductCategoriesView } from './ProductCategoriesView';
import { SalesChannelsView } from './SalesChannelsView';
import { ProductPricingView } from './ProductPricingView';
import { PaymentDetailsView } from './PaymentDetailsView';
import { SettingsView } from './SettingsView';

// Modals & Full-Page Views
import { CreateBatchModal } from './CreateBatchModal';
import { BatchDetailModal } from './BatchDetailModal';
import { InvoicePrintModal } from './InvoicePrintModal';
import { Retailer360Modal } from './Retailer360Modal';
import { RecordPaymentView } from './RecordPaymentView';
import { CreateOrderView } from './CreateOrderView';
import { AddExpenseModal } from './AddExpenseModal';

export const InternalLayout: React.FC = () => {
  const {
    internalView,
    setInternalView,
    selectedBatchId,
    setSelectedBatchId,
    selectedRetailerId,
    setSelectedRetailerId,
    selectedInvoiceId,
    setSelectedInvoiceId,
    orderToEdit,
    setOrderToEdit,
  } = useDairy();

  // Sidebar collapse & responsive drawer state
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Modal visibility & full-page workflow states
  const [isCreateBatchOpen, setIsCreateBatchOpen] = useState(false);
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);
  const [recordPaymentCustomerId, setRecordPaymentCustomerId] = useState<string | null>(null);

  const handleOpenRecordPayment = (customerId?: string) => {
    setRecordPaymentCustomerId(customerId || null);
    setInternalView('record_payment');
  };

  const renderActiveView = () => {
    switch (internalView) {
      case 'dashboard':
        return (
          <DashboardView
            onOpenCreateBatch={() => setIsCreateBatchOpen(true)}
            onOpenRecordPayment={() => handleOpenRecordPayment()}
            onOpenAddExpense={() => setIsAddExpenseOpen(true)}
            onSelectBatch={id => setSelectedBatchId(id)}
            onSelectRetailer={id => setSelectedRetailerId(id)}
          />
        );
      case 'production':
      case 'batches':
        return (
          <ProductionView
            onOpenCreateBatch={() => setIsCreateBatchOpen(true)}
            onSelectBatch={id => setSelectedBatchId(id)}
          />
        );
      case 'inventory':
        return (
          <InventoryView
            initialTab="finished"
            onSelectBatch={id => setSelectedBatchId(id)}
          />
        );
      case 'raw_materials':
        return <RawMaterialsView />;
      case 'stock_movements':
        return (
          <StockMovementsView
            onSelectBatch={id => setSelectedBatchId(id)}
          />
        );
      case 'orders':
        return (
          <OrdersView
            onSelectRetailer={id => setSelectedRetailerId(id)}
          />
        );
      case 'create_order':
      case 'create-order':
        return (
          <CreateOrderView
            orderToEdit={orderToEdit}
            onBack={() => {
              setOrderToEdit(null);
              setInternalView('orders');
            }}
          />
        );
      case 'invoices':
        return (
          <InvoicesView
            onOpenPrintInvoice={id => setSelectedInvoiceId(id)}
            onOpenRecordPayment={() => handleOpenRecordPayment()}
          />
        );
      case 'customers':
      case 'retailers':
        return (
          <RetailersView
            onSelectRetailer={id => setSelectedRetailerId(id)}
            onOpenRecordPayment={() => handleOpenRecordPayment()}
          />
        );
      case 'payments':
        return (
          <PaymentsView
            onOpenRecordPayment={() => handleOpenRecordPayment()}
          />
        );
      case 'record_payment':
      case 'record-payment':
        return (
          <RecordPaymentView
            initialCustomerId={recordPaymentCustomerId || undefined}
            onBack={() => setInternalView('payments')}
            onNavigateToLedger={id => {
              setSelectedRetailerId(id);
              setInternalView('ledger');
            }}
          />
        );
      case 'ledger':
        return (
          <LedgerView
            onOpenRecordPayment={customerId => handleOpenRecordPayment(customerId)}
            onOpenCreateOrder={customerId => {
              if (customerId) setSelectedRetailerId(customerId);
              setInternalView('create_order');
            }}
          />
        );
      case 'expenses':
        return (
          <ExpensesView
            onOpenAddExpense={() => setIsAddExpenseOpen(true)}
          />
        );
      case 'expiry':
        return (
          <ExpiryView
            onSelectBatch={id => setSelectedBatchId(id)}
          />
        );
      case 'reports':
        return <ReportsView />;
      case 'users':
        return <UsersView />;
      case 'roles':
        return <RolesPermissionsView />;
      case 'products':
        return <ProductsAdminView />;
      case 'categories':
      case 'product-categories':
        return <ProductCategoriesView />;
      case 'channels':
      case 'sales-channels':
        return <SalesChannelsView />;
      case 'pricing':
      case 'product-pricing':
        return <ProductPricingView />;
      case 'payment_details':
      case 'payment-details':
      case 'payment_settings':
      case 'payment-settings':
        return <PaymentDetailsView />;
      case 'settings':
        return <SettingsView />;
      default:
        return (
          <DashboardView
            onOpenCreateBatch={() => setIsCreateBatchOpen(true)}
            onOpenRecordPayment={() => handleOpenRecordPayment()}
            onOpenAddExpense={() => setIsAddExpenseOpen(true)}
            onSelectBatch={id => setSelectedBatchId(id)}
            onSelectRetailer={id => setSelectedRetailerId(id)}
          />
        );
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans text-slate-900">
      {/* Collapsible / Responsive Sidebar */}
      <InternalSidebar
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Compact Header */}
        <InternalHeader
          onToggleSidebar={() => {
            if (window.innerWidth < 1024) {
              setIsMobileSidebarOpen(!isMobileSidebarOpen);
            } else {
              setIsSidebarCollapsed(!isSidebarCollapsed);
            }
          }}
          onOpenCreateBatch={() => setIsCreateBatchOpen(true)}
          onOpenRecordPayment={() => handleOpenRecordPayment()}
          onOpenAddExpense={() => setIsAddExpenseOpen(true)}
        />

        {/* Dynamic Screen Container */}
        <main className="flex-1 p-4 md:p-6 max-w-7xl w-full mx-auto pb-16">
          {renderActiveView()}
        </main>
      </div>

      {/* Shared Modals */}
      <CreateBatchModal
        isOpen={isCreateBatchOpen}
        onClose={() => setIsCreateBatchOpen(false)}
      />

      <AddExpenseModal
        isOpen={isAddExpenseOpen}
        onClose={() => setIsAddExpenseOpen(false)}
      />

      {/* Dynamic Entity Modals */}
      {selectedBatchId && (
        <BatchDetailModal
          batchId={selectedBatchId}
          onClose={() => setSelectedBatchId(null)}
        />
      )}

      {selectedInvoiceId && (
        <InvoicePrintModal
          invoiceId={selectedInvoiceId}
          onClose={() => setSelectedInvoiceId(null)}
        />
      )}

      {selectedRetailerId && (
        <Retailer360Modal
          retailerId={selectedRetailerId}
          onClose={() => setSelectedRetailerId(null)}
          onOpenRecordPayment={() => {
            const rid = selectedRetailerId;
            setSelectedRetailerId(null);
            handleOpenRecordPayment(rid);
          }}
        />
      )}
    </div>
  );
};
