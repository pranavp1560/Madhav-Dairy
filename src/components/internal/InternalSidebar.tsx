import React, { useState } from 'react';
import { useDairy } from '../../context/DairyContext';
import { useTranslation } from '../../i18n/LanguageContext';
import {
  LayoutDashboard,
  Factory,
  Layers,
  Boxes,
  Package,
  ScrollText,
  ShoppingCart,
  Receipt,
  Users,
  CreditCard,
  BookOpen,
  DollarSign,
  AlertTriangle,
  BarChart3,
  UserCheck,
  ShieldCheck,
  PackagePlus,
  Settings,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Milk,
  LogOut,
  X
} from 'lucide-react';

interface SidebarSubItem {
  id: string;
  label: string;
  icon: React.ElementType;
}

interface SidebarItem {
  id: string;
  label: string;
  icon: React.ElementType;
  badge?: number;
  badgeColor?: string;
  hasSubItems?: boolean;
  subItems?: SidebarSubItem[];
}

interface SidebarGroup {
  title: string;
  items: SidebarItem[];
  roles: string[];
}

interface InternalSidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
}

export const InternalSidebar: React.FC<InternalSidebarProps> = ({
  isCollapsed,
  onToggleCollapse,
  isMobileOpen,
  onCloseMobile,
}) => {
  const { internalRole, internalView, setInternalView, setPortal, expiryAlerts, orders } = useDairy();
  const { t } = useTranslation();

  const [isInventoryExpanded, setIsInventoryExpanded] = useState(
    ['inventory', 'raw_materials', 'stock_movements'].includes(internalView)
  );

  const urgentExpiryCount = expiryAlerts.filter(a => a.daysRemaining <= 5).length;
  const pendingOrdersCount = orders.filter(o => o.status === 'pending').length;

  const navigateTo = (viewId: string) => {
    setInternalView(viewId);
    onCloseMobile();
  };

  // Define the 7 functional navigation groups from Section 7
  const navGroups: SidebarGroup[] = [
    {
      title: t.internal.nav.overview,
      items: [
        { id: 'dashboard', label: t.internal.nav.dashboard, icon: LayoutDashboard },
      ],
      roles: ['admin', 'production_manager', 'warehouse_manager', 'accountant'],
    },
    {
      title: t.internal.nav.operations,
      items: [
        { id: 'production', label: t.internal.nav.production, icon: Factory },
        { id: 'batches', label: t.internal.nav.batches, icon: Layers },
        {
          id: 'inventory',
          label: t.internal.nav.inventory,
          icon: Boxes,
          hasSubItems: true,
          subItems: [
            { id: 'inventory', label: t.internal.nav.finishedGoods, icon: Package },
            { id: 'raw_materials', label: t.internal.nav.rawMaterials, icon: Boxes },
            { id: 'stock_movements', label: t.internal.nav.stockMovements, icon: ScrollText },
          ],
        },
      ],
      roles: ['admin', 'production_manager', 'warehouse_manager'],
    },
    {
      title: t.internal.nav.sales,
      items: [
        { id: 'orders', label: t.internal.nav.orders, icon: ShoppingCart, badge: pendingOrdersCount, badgeColor: 'bg-semanticAmber-600' },
        { id: 'invoices', label: t.internal.nav.invoices, icon: Receipt },
        { id: 'customers', label: t.internal.nav.customers, icon: Users },
      ],
      roles: ['admin', 'accountant'],
    },
    {
      title: t.internal.nav.finance,
      items: [
        { id: 'payments', label: t.internal.nav.payments, icon: CreditCard },
        { id: 'ledger', label: t.internal.nav.customerLedger, icon: BookOpen },
        { id: 'expenses', label: t.internal.nav.expenses, icon: DollarSign },
      ],
      roles: ['admin', 'accountant'],
    },
    {
      title: t.internal.nav.expiry,
      items: [
        { id: 'expiry', label: t.internal.nav.expiryManagement, icon: AlertTriangle, badge: urgentExpiryCount, badgeColor: 'bg-semanticRed-600' },
      ],
      roles: ['admin', 'production_manager', 'warehouse_manager'],
    },
    {
      title: t.internal.nav.reports,
      items: [
        { id: 'reports', label: t.internal.nav.reports, icon: BarChart3 },
      ],
      roles: ['admin', 'production_manager', 'warehouse_manager', 'accountant'],
    },
    {
      title: t.internal.nav.administration,
      items: [
        { id: 'users', label: t.internal.nav.users, icon: UserCheck },
        { id: 'roles', label: t.internal.nav.rolesPermissions, icon: ShieldCheck },
        { id: 'products', label: t.internal.nav.products, icon: PackagePlus },
        { id: 'settings', label: t.internal.nav.settings, icon: Settings },
      ],
      roles: ['admin'],
    },
  ];

  const sidebarContent = (
    <div className="flex flex-col h-full bg-white text-slate-900 select-none">
      {/* Brand Header */}
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-200 shrink-0">
        <div className="flex items-center gap-2.5 overflow-hidden">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shrink-0 shadow-sm text-white">
            <Milk className="w-4 h-4 text-white" />
          </div>
          {!isCollapsed && (
            <div className="truncate">
              <span className="font-bold text-sm text-slate-900 tracking-tight block truncate">
                {t.common.appTitle}
              </span>
              <span className="text-[10px] text-slate-500 font-medium block truncate">
                Enterprise Dairy ERP
              </span>
            </div>
          )}
        </div>

        {/* Mobile close button */}
        <button
          onClick={onCloseMobile}
          className="lg:hidden p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100"
          aria-label="Close sidebar"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Desktop collapse toggle */}
        <button
          onClick={onToggleCollapse}
          className="hidden lg:flex p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          aria-label={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Navigation Group Items */}
      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
        {navGroups
          .filter(group => group.roles.includes(internalRole))
          .map((group, gIdx) => (
            <div key={gIdx} className="space-y-0.5">
              {!isCollapsed && (
                <div className="px-2.5 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {group.title}
                </div>
              )}
              {group.items.map(item => {
                const Icon = item.icon;

                // Handle nested inventory subitems
                if (item.hasSubItems && item.subItems) {
                  const isAnySubActive = ['inventory', 'raw_materials', 'stock_movements'].includes(internalView);

                  return (
                    <div key={item.id} className="space-y-0.5">
                      <button
                        onClick={() => {
                          if (isCollapsed) {
                            onToggleCollapse();
                            setIsInventoryExpanded(true);
                          } else {
                            setIsInventoryExpanded(!isInventoryExpanded);
                          }
                        }}
                        className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium transition-all ${
                          isAnySubActive
                            ? 'bg-blue-50 text-blue-600 font-semibold'
                            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                        }`}
                        title={isCollapsed ? item.label : undefined}
                      >
                        <div className="flex items-center gap-2.5 truncate">
                          <Icon className={`w-4 h-4 shrink-0 ${isAnySubActive ? 'text-blue-600' : 'text-slate-400'}`} />
                          {!isCollapsed && <span className="truncate">{item.label}</span>}
                        </div>
                        {!isCollapsed && (
                          <ChevronDown
                            className={`w-3.5 h-3.5 transition-transform text-slate-400 ${
                              isInventoryExpanded ? 'rotate-180' : ''
                            }`}
                          />
                        )}
                      </button>

                      {/* Sub-item pills */}
                      {!isCollapsed && isInventoryExpanded && (
                        <div className="pl-4 pr-1 py-0.5 space-y-0.5 border-l border-slate-200 ml-4">
                          {item.subItems.map(sub => {
                            const SubIcon = sub.icon;
                            const isSubActive = internalView === sub.id;
                            return (
                              <button
                                key={sub.id}
                                onClick={() => navigateTo(sub.id)}
                                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[11px] font-medium transition-colors ${
                                  isSubActive
                                    ? 'bg-blue-50 text-blue-600 font-semibold'
                                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                                }`}
                              >
                                <SubIcon className={`w-3.5 h-3.5 shrink-0 ${isSubActive ? 'text-blue-600' : 'opacity-70 text-slate-400'}`} />
                                <span className="truncate">{sub.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                }

                // Normal top-level item
                const isActive = internalView === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => navigateTo(item.id)}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium transition-colors ${
                      isActive
                        ? 'bg-blue-50 text-blue-600 font-semibold'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                    title={isCollapsed ? item.label : undefined}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                      {!isCollapsed && <span className="truncate">{item.label}</span>}
                    </div>
                    {!isCollapsed && item.badge !== undefined && item.badge > 0 && (
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white ${
                          item.badgeColor || 'bg-blue-600'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
      </div>

      {/* Role / User Footer */}
      <div className="p-3 border-t border-slate-200 bg-slate-50/80 shrink-0">
        <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center gap-2 truncate">
            <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
              {internalRole.charAt(0).toUpperCase()}
            </div>
            {!isCollapsed && (
              <div className="truncate">
                <p className="text-xs font-semibold text-slate-900 capitalize truncate">
                  {internalRole.replace('_', ' ')}
                </p>
                <p className="text-[10px] text-slate-500">Head Office</p>
              </div>
            )}
          </div>
          {!isCollapsed && (
            <button
              onClick={() => setPortal('internal_login')}
              className="p-1 rounded text-slate-400 hover:text-red-600 transition-colors"
              title={t.common.logout}
              aria-label={t.common.logout}
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className={`hidden lg:flex flex-col shrink-0 border-r border-slate-200 bg-white transition-all duration-200 ${
          isCollapsed ? 'w-16' : 'w-60'
        }`}
      >
        {sidebarContent}
      </aside>

      {/* Mobile / Tablet Drawer */}
      {isMobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
          />
          {/* Drawer content */}
          <div className="relative w-64 max-w-[80vw] h-full shadow-xl z-10 bg-white animate-in slide-in-from-left duration-200">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};
