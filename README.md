# Madhav Dairy (माधव डेअरी) 🥛

A modern Dairy Business Management System and Retailer Ordering Platform built with React, TypeScript, Tailwind CSS, and Vite.

## 🚀 Overview

Madhav Dairy is a full-featured dairy manufacturing and distribution application providing:

1. **Customer Portal (Mobile-First for Retailers)**:
   - Self-registration and login for retail store owners.
   - Catalog browsing with multilingual names (English, मराठी, हिंदी).
   - Quantity steppers (`[-] qty [+]`), MRP strikethrough, and wholesale retailer pricing.
   - 1-click **Repeat Order** and **New Order** square action cards.
   - 3-step checkout with delivery date selection and order tracking.
   - Real-time order status, ledger statement, and expiry alerts.

2. **Enterprise Operations & ERP (Desktop & Tablet)**:
   - **Operations & Manufacturing**: Milk procurement, silos tracking, batch creation, production runs, and expiration calculators.
   - **Raw Materials Management**: Log new purchases (inward) and record raw material consumption (outward) with live stock deduction.
   - **Finished Goods Inventory & Movements**: Real-time warehouse balances and inward/outward ledger audit trail.
   - **Sales & Dispatch**: Order fulfillment, batch allocation, and route-based dispatches.
   - **Tax Invoices & Billing**: Printable GST invoices with FSSAI, GSTIN, and batch tracking.
   - **Customer Ledger & Collections**: Retailer 360° profile, credit terms, payment receipts (Cash/Cheque/UPI/NEFT), and customer balance statements.
   - **Expenses & Profitability**: Daily dairy operating expense logging and category reports.
   - **Quality & Expiry Radar**: 5-tier freshness alert radar with batch return logs and warning rules.
   - **Staff & RBAC**: Granular permission matrix across Admin, Production, Warehouse, and Accounts.

---

## 🛠️ Tech Stack

- **Frontend**: React 18, TypeScript, Vite
- **Styling**: Tailwind CSS (Modern Blue SaaS Design System `#2563EB`)
- **Icons**: Lucide React
- **Internationalization (i18n)**: Centralized multilingual support (English, मराठी, हिंदी)

---

## 📦 Installation & Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/pranavp1560/Madhav-Dairy.git
   cd Madhav-Dairy
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start development server**:
   ```bash
   npm run dev
   ```

4. **Build for production**:
   ```bash
   npm run build
   ```

---

## 📁 Project Structure

```text
├── src/
│   ├── components/
│   │   ├── customer/        # Mobile-first customer ordering portal
│   │   ├── internal/        # Enterprise ERP views & operations modals
│   │   ├── layout/          # Shells, headers, and sidebars
│   │   └── ui/              # Reusable design system primitives
│   ├── context/             # Global Dairy business logic & state
│   ├── data/                # Initial seed and mock dairy master data
│   ├── i18n/                # Multilingual translations (EN, MR, HI)
│   ├── types/               # TypeScript interfaces & domain models
│   ├── App.tsx              # Root component & switcher
│   └── main.tsx             # Entry point
├── index.html
├── tailwind.config.js
├── tsconfig.json
└── vite.config.ts
```
