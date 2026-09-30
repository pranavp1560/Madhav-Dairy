import { Language } from '../types/dairy';

export interface Translations {
  common: {
    appTitle: string;
    tagline: string;
    login: string;
    logout: string;
    save: string;
    cancel: string;
    confirm: string;
    submit: string;
    back: string;
    search: string;
    filter: string;
    apply: string;
    reset: string;
    actions: string;
    status: string;
    date: string;
    quantity: string;
    total: string;
    amount: string;
    notes: string;
    loading: string;
    noData: string;
    view: string;
    edit: string;
    delete: string;
    success: string;
    error: string;
    rupee: string;
  };
  customer: {
    nav: {
      home: string;
      products: string;
      orders: string;
      alerts: string;
      profile: string;
    };
    home: {
      greeting: string;
      orderProducts: string;
      repeatLastOrder: string;
      quickActions: string;
      myRecentOrders: string;
      pendingAlerts: string;
      outstandingBalance: string;
      payNow: string;
      viewAll: string;
      noRecentOrders: string;
    };
    products: {
      title: string;
      searchPlaceholder: string;
      allCategories: string;
      inStock: string;
      outOfStock: string;
      mrp: string;
      ourPrice: string;
      add: string;
      added: string;
      pack: string;
    };
    cart: {
      title: string;
      emptyTitle: string;
      emptyDesc: string;
      browseProducts: string;
      itemsInCart: string;
      itemTotal: string;
      deliveryCharges: string;
      freeDelivery: string;
      finalAmount: string;
      placeOrder: string;
      deliveringTo: string;
      orderNotes: string;
      notesPlaceholder: string;
      expectedDeliveryDate: string;
      selectDeliveryDate: string;
      deliveryDateHelp: string;
      quickTomorrow: string;
      quickDayAfter: string;
    };
    checkout: {
      confirmTitle: string;
      confirmMsg: string;
      confirmButton: string;
      successTitle: string;
      successMsg: string;
      orderId: string;
      viewOrder: string;
      continueShopping: string;
    };
    orders: {
      title: string;
      searchPlaceholder: string;
      reorder: string;
      orderPlaced: string;
      expectedDelivery: string;
      items: string;
      totalBill: string;
      emptyDesc: string;
      status: {
        pending: string;
        confirmed: string;
        preparing: string;
        dispatched: string;
        delivered: string;
        cancelled: string;
      };
    };
    alerts: {
      title: string;
      all: string;
      unread: string;
      markAllRead: string;
      emptyDesc: string;
      expiryWarning: string;
      orderUpdate: string;
      paymentUpdate: string;
    };
    profile: {
      title: string;
      retailerProfile: string;
      shopName: string;
      ownerName: string;
      mobile: string;
      address: string;
      outstandingBalance: string;
      creditLimit: string;
      paymentTerms: string;
      appLanguage: string;
      changePassword: string;
      contactMadhavDairy: string;
      supportHotline: string;
      logoutConfirm: string;
    };
    auth: {
      loginTitle: string;
      loginSubtitle: string;
      mobileLabel: string;
      mobilePlaceholder: string;
      passwordLabel: string;
      passwordPlaceholder: string;
      loginButton: string;
      noAccount: string;
      createAccount: string;
      registerTitle: string;
      registerSubtitle: string;
      shopNameLabel: string;
      ownerNameLabel: string;
      addressLabel: string;
      registerButton: string;
      alreadyHaveAccount: string;
    };
  };
  internal: {
    nav: {
      overview: string;
      dashboard: string;
      operations: string;
      production: string;
      batches: string;
      inventory: string;
      finishedGoods: string;
      rawMaterials: string;
      stockMovements: string;
      sales: string;
      orders: string;
      invoices: string;
      customers: string;
      finance: string;
      payments: string;
      customerLedger: string;
      expenses: string;
      expiry: string;
      expiryManagement: string;
      reports: string;
      administration: string;
      users: string;
      rolesPermissions: string;
      products: string;
      settings: string;
    };
    dashboard: {
      title: string;
      subtitle: string;
      todaysSales: string;
      todaysOrders: string;
      todaysProduction: string;
      lowStockMaterials: string;
      expiringSoon: string;
      outstandingAmount: string;
      todaysProductionList: string;
      recentOrders: string;
      lowRawMaterials: string;
      expiringBatches: string;
      viewAll: string;
    };
    header: {
      searchPlaceholder: string;
      roleAdmin: string;
      roleProduction: string;
      roleWarehouse: string;
      roleAccountant: string;
      myProfile: string;
      changePassword: string;
      selectLanguage: string;
      logout: string;
      switchPortal: string;
    };
  };
}

export const TRANSLATIONS: Record<Language, Translations> = {
  en: {
    common: {
      appTitle: 'Madhav Dairy',
      tagline: 'Fresh Pure Dairy Products',
      login: 'Login',
      logout: 'Logout',
      save: 'Save',
      cancel: 'Cancel',
      confirm: 'Confirm',
      submit: 'Submit',
      back: 'Back',
      search: 'Search...',
      filter: 'Filter',
      apply: 'Apply',
      reset: 'Reset',
      actions: 'Actions',
      status: 'Status',
      date: 'Date',
      quantity: 'Quantity',
      total: 'Total',
      amount: 'Amount',
      notes: 'Notes',
      loading: 'Loading...',
      noData: 'No records found',
      view: 'View',
      edit: 'Edit',
      delete: 'Delete',
      success: 'Success',
      error: 'Error',
      rupee: '₹',
    },
    customer: {
      nav: {
        home: 'Home',
        products: 'Products',
        orders: 'Orders',
        alerts: 'Alerts',
        profile: 'Profile',
      },
      home: {
        greeting: 'Good Day,',
        orderProducts: 'Order Products',
        repeatLastOrder: 'Repeat Last Order',
        quickActions: 'Quick Actions',
        myRecentOrders: 'Recent Orders',
        pendingAlerts: 'Important Alerts',
        outstandingBalance: 'Current Outstanding',
        payNow: 'Pay Statement',
        viewAll: 'View All',
        noRecentOrders: 'No orders placed recently.',
      },
      products: {
        title: 'Dairy Catalog',
        searchPlaceholder: 'Search products by name...',
        allCategories: 'All Products',
        inStock: 'In Stock',
        outOfStock: 'Out of Stock',
        mrp: 'MRP',
        ourPrice: 'Rate',
        add: 'Add to Cart',
        added: 'In Cart',
        pack: 'Pack',
      },
      cart: {
        title: 'Review Cart',
        emptyTitle: 'Your Cart is Empty',
        emptyDesc: 'Add fresh dairy products to your cart to place an order.',
        browseProducts: 'Browse Products',
        itemsInCart: 'Items',
        itemTotal: 'Items Total',
        deliveryCharges: 'Delivery Charges',
        freeDelivery: 'Free Delivery',
        finalAmount: 'Payable Amount',
        placeOrder: 'Place Order Now',
        deliveringTo: 'Delivery Address',
        orderNotes: 'Delivery Instructions (Optional)',
        notesPlaceholder: 'e.g. Please deliver before 8:00 AM',
        expectedDeliveryDate: 'Expected Date of Delivery',
        selectDeliveryDate: 'Select Expected Delivery Date',
        deliveryDateHelp: 'Select when your retail store requires this fresh dairy delivery.',
        quickTomorrow: 'Tomorrow',
        quickDayAfter: 'Day After Tomorrow',
      },
      checkout: {
        confirmTitle: 'Confirm Dairy Order',
        confirmMsg: 'Do you want to confirm and send this order to Madhav Dairy Dispatch?',
        confirmButton: 'Confirm & Place Order',
        successTitle: 'Order Placed Successfully!',
        successMsg: 'Your order has been recorded. Our dispatch team will process your fresh delivery shortly.',
        orderId: 'Order ID',
        viewOrder: 'View My Order',
        continueShopping: 'Back to Home',
      },
      orders: {
        title: 'Order History',
        searchPlaceholder: 'Search order number...',
        reorder: 'Repeat Order',
        orderPlaced: 'Placed on',
        expectedDelivery: 'Delivery Date',
        items: 'Items',
        totalBill: 'Bill Amount',
        emptyDesc: 'When you place dairy orders, they will show up here.',
        status: {
          pending: 'Pending Approval',
          confirmed: 'Order Confirmed',
          preparing: 'Packing',
          dispatched: 'Out for Delivery',
          delivered: 'Delivered',
          cancelled: 'Cancelled',
        },
      },
      alerts: {
        title: 'Alerts & Updates',
        all: 'All',
        unread: 'Unread',
        markAllRead: 'Mark all as read',
        emptyDesc: 'You have no pending alerts or notifications.',
        expiryWarning: 'Expiry Warning',
        orderUpdate: 'Order Status',
        paymentUpdate: 'Payment Received',
      },
      profile: {
        title: 'Retailer Account',
        retailerProfile: 'Business Details',
        shopName: 'Shop Name',
        ownerName: 'Proprietor Name',
        mobile: 'Contact Number',
        address: 'Delivery Location',
        outstandingBalance: 'Pending Outstanding',
        creditLimit: 'Approved Credit Limit',
        paymentTerms: 'Payment Terms',
        appLanguage: 'App Language / भाषा',
        changePassword: 'Change Password',
        contactMadhavDairy: 'Contact Madhav Dairy Helpdesk',
        supportHotline: '+91 98220 12345 (7 AM - 9 PM)',
        logoutConfirm: 'Are you sure you want to log out?',
      },
      auth: {
        loginTitle: 'Retailer Login',
        loginSubtitle: 'Enter your registered mobile number to order dairy products',
        mobileLabel: 'Mobile Number',
        mobilePlaceholder: 'Enter 10-digit mobile number',
        passwordLabel: 'Password / PIN',
        passwordPlaceholder: 'Enter your password',
        loginButton: 'Login to Order',
        noAccount: 'New Retailer?',
        createAccount: 'Register Shop',
        registerTitle: 'Retailer Registration',
        registerSubtitle: 'Register your shop with Madhav Dairy for daily deliveries',
        shopNameLabel: 'Shop / Business Name',
        ownerNameLabel: 'Owner Full Name',
        addressLabel: 'Full Shop Address',
        registerButton: 'Submit Registration',
        alreadyHaveAccount: 'Already registered? Login',
      },
    },
    internal: {
      nav: {
        overview: 'Overview',
        dashboard: 'Dashboard',
        operations: 'Operations',
        production: 'Production',
        batches: 'Batches',
        inventory: 'Inventory',
        finishedGoods: 'Finished Goods',
        rawMaterials: 'Raw Materials',
        stockMovements: 'Stock Movements',
        sales: 'Sales',
        orders: 'Orders',
        invoices: 'Invoices',
        customers: 'Customers',
        finance: 'Finance',
        payments: 'Payments',
        customerLedger: 'Customer Ledger',
        expenses: 'Expenses',
        expiry: 'Expiry',
        expiryManagement: 'Expiry Management',
        reports: 'Reports',
        administration: 'Administration',
        users: 'Users',
        rolesPermissions: 'Roles & Permissions',
        products: 'Products Catalog',
        settings: 'Settings',
      },
      dashboard: {
        title: 'Daily Operations Overview',
        subtitle: 'What is happening in the business today?',
        todaysSales: "Today's Sales",
        todaysOrders: "Today's Orders",
        todaysProduction: "Today's Production",
        lowStockMaterials: 'Low Stock Alert',
        expiringSoon: 'Expiring Soon (≤5d)',
        outstandingAmount: 'Total Outstanding',
        todaysProductionList: "Today's Production Runs",
        recentOrders: 'Recent Retailer Orders',
        lowRawMaterials: 'Low Raw Material Stock',
        expiringBatches: 'Expiring Batches (Priority Dispatch)',
        viewAll: 'View Details',
      },
      header: {
        searchPlaceholder: 'Search batches, orders, retailers...',
        roleAdmin: 'Owner / Admin',
        roleProduction: 'Production Manager',
        roleWarehouse: 'Warehouse Manager',
        roleAccountant: 'Accountant',
        myProfile: 'My Profile',
        changePassword: 'Change Password',
        selectLanguage: 'Language / भाषा',
        logout: 'Sign Out',
        switchPortal: 'Customer View',
      },
    },
  },
  mr: {
    common: {
      appTitle: 'माधव डेअरी',
      tagline: 'ताजे आणि शुद्ध दुग्धजन्य पदार्थ',
      login: 'लॉगिन करा',
      logout: 'बाहेर पडा',
      save: 'जतन करा',
      cancel: 'रद्द करा',
      confirm: 'नक्की करा',
      submit: 'सादर करा',
      back: 'मागे',
      search: 'शोधा...',
      filter: 'फिल्टर',
      apply: 'लागू करा',
      reset: 'रीसेट',
      actions: 'कृती',
      status: 'स्थिती',
      date: 'तारीख',
      quantity: 'नग / प्रमाण',
      total: 'एकूण',
      amount: 'रक्कम',
      notes: 'नोंद',
      loading: 'लोड होत आहे...',
      noData: 'माहिती उपलब्ध नाही',
      view: 'पहा',
      edit: 'बदला',
      delete: 'हटवा',
      success: 'यशस्वी',
      error: 'त्रुटी',
      rupee: '₹',
    },
    customer: {
      nav: {
        home: 'मुख्य पान',
        products: 'उत्पादने',
        orders: 'ऑर्डर्स',
        alerts: 'सूचना',
        profile: 'खाते',
      },
      home: {
        greeting: 'नमस्कार,',
        orderProducts: 'उत्पादने मागवा',
        repeatLastOrder: 'मागील ऑर्डर पुन्हा करा',
        quickActions: 'त्वरित कृती',
        myRecentOrders: 'नुकत्याच दिलेल्या ऑर्डर्स',
        pendingAlerts: 'महत्त्वाच्या सूचना',
        outstandingBalance: 'सध्याची थकबाकी',
        payNow: 'रक्कम जमा करा',
        viewAll: 'सर्व पहा',
        noRecentOrders: 'नुकतीच कोणतीही ऑर्डर दिलेली नाही.',
      },
      products: {
        title: 'डेअरी उत्पादने',
        searchPlaceholder: 'उत्पादन शोधा...',
        allCategories: 'सर्व उत्पादने',
        inStock: 'उपलब्ध',
        outOfStock: 'संपले आहे',
        mrp: 'एम.आर.पी.',
        ourPrice: 'विक्री दर',
        add: 'ऑर्डरमध्ये जोडा',
        added: 'जोडले आहे',
        pack: 'पॅक',
      },
      cart: {
        title: 'ऑर्डर तपासा',
        emptyTitle: 'तुमची ट्रॉली रिकामी आहे',
        emptyDesc: 'नवीन ऑर्डर देण्यासाठी उत्पादनांमधून निवडा.',
        browseProducts: 'उत्पादने निवडा',
        itemsInCart: 'एकूण वस्तू',
        itemTotal: 'मालाची एकूण किंमत',
        deliveryCharges: 'वितरण शुल्क',
        freeDelivery: 'मोफत डिलिव्हरी',
        finalAmount: 'देय रक्कम',
        placeOrder: 'ऑर्डर नक्की करा',
        deliveringTo: 'डिलिव्हरी पत्ता',
        orderNotes: 'काही सूचना (पर्यायी)',
        notesPlaceholder: 'उदा. सकाळी ८ च्या आधी पोहोचवा',
        expectedDeliveryDate: 'अपेक्षित डिलिव्हरी तारीख',
        selectDeliveryDate: 'डिलिव्हरीची तारीख निवडा',
        deliveryDateHelp: 'तुमच्या दुकानाला ताजे डेअरी पदार्थ कोणत्या तारखेला हवे आहेत ते निवडा.',
        quickTomorrow: 'उद्या',
        quickDayAfter: 'परवा',
      },
      checkout: {
        confirmTitle: 'ऑर्डरची खात्री करा',
        confirmMsg: 'तुम्हाला ही ऑर्डर माधव डेअरीकडे पाठवायची आहे का?',
        confirmButton: 'होय, ऑर्डर नोंदवा',
        successTitle: 'ऑर्डर यशस्वीपणे नोंदवली गेली!',
        successMsg: 'तुमची ऑर्डर नोंदवली गेली आहे. आमची टीम लवकरच ताजी उत्पादने पाठवेल.',
        orderId: 'ऑर्डर क्रमांक',
        viewOrder: 'ऑर्डर पहा',
        continueShopping: 'मुख्य पानावर जा',
      },
      orders: {
        title: 'मागील ऑर्डर्स',
        searchPlaceholder: 'ऑर्डर क्रमांक शोधा...',
        reorder: 'पुन्हा मागवा',
        orderPlaced: 'दिलेली तारीख',
        expectedDelivery: 'डिलिव्हरी तारीख',
        items: 'वस्तू',
        totalBill: 'एकूण बिल',
        emptyDesc: 'तुम्ही दिलेल्या सर्व ऑर्डर्स येथे दिसतील.',
        status: {
          pending: 'मंजुरी प्रलंबित',
          confirmed: 'ऑर्डर निश्चित',
          preparing: 'पॅकिंग चालू',
          dispatched: 'रस्त्यात आहे',
          delivered: 'पोहोचले',
          cancelled: 'रद्द',
        },
      },
      alerts: {
        title: 'सूचना आणि अपडेट्स',
        all: 'सर्व',
        unread: 'न वाचलेले',
        markAllRead: 'सर्व वाचले म्हणून चिन्हांकित करा',
        emptyDesc: 'कोणतीही नवीन सूचना नाही.',
        expiryWarning: 'मुदत समाप्ती सूचना',
        orderUpdate: 'ऑर्डर अपडेट',
        paymentUpdate: 'रक्कम जमा अपडेट',
      },
      profile: {
        title: 'दुकानदार खाते',
        retailerProfile: 'व्यवसाय माहिती',
        shopName: 'दुकानाचे नाव',
        ownerName: 'मालकाचे नाव',
        mobile: 'मोबाईल नंबर',
        address: 'पत्ता',
        outstandingBalance: 'बाकी रक्कम',
        creditLimit: 'क्रेडिट मर्यादा',
        paymentTerms: 'पेमेंट अटी',
        appLanguage: 'अ‍ॅप भाषा / Language',
        changePassword: 'पासवर्ड बदला',
        contactMadhavDairy: 'माधव डेअरी ग्राहक सेवा',
        supportHotline: '+९१ ९८२२० १२३४५ (सकाळी ७ ते रात्री ९)',
        logoutConfirm: 'तुम्हाला बाहेर पडायचे आहे का?',
      },
      auth: {
        loginTitle: 'दुकानदार लॉगिन',
        loginSubtitle: 'डेअरी उत्पादने मागवण्यासाठी नोंदणीकृत मोबाईल नंबर टाका',
        mobileLabel: 'मोबाईल नंबर',
        mobilePlaceholder: '१० अंकी मोबाईल नंबर टाका',
        passwordLabel: 'पासवर्ड / पिन',
        passwordPlaceholder: 'पासवर्ड टाका',
        loginButton: 'लॉगिन करा',
        noAccount: 'नवीन दुकानदार?',
        createAccount: 'नवीन नोंदणी करा',
        registerTitle: 'दुकानदार नोंदणी',
        registerSubtitle: 'दररोजच्या ताज्या दुग्धजन्य उत्पादनांसाठी दुकानाची नोंदणी करा',
        shopNameLabel: 'दुकानाचे नाव',
        ownerNameLabel: 'मालकाचे पूर्ण नाव',
        addressLabel: 'दुकानाचा संपूर्ण पत्ता',
        registerButton: 'नोंदणी सादर करा',
        alreadyHaveAccount: 'आधीच खाते आहे? लॉगिन करा',
      },
    },
    internal: {
      nav: {
        overview: 'एकूण आढावा',
        dashboard: 'डॅशबोर्ड',
        operations: 'उत्पादन व प्रक्रिया',
        production: 'उत्पादन',
        batches: 'बॅच व्यवस्थापन',
        inventory: 'गोदाम साठा',
        finishedGoods: 'तयार माल साठा',
        rawMaterials: 'कच्चा माल',
        stockMovements: 'साठा हालचाली (लेजर)',
        sales: 'विक्री',
        orders: 'ऑर्डर्स',
        invoices: 'इनव्हॉइस / बिले',
        customers: 'ग्राहक (दुकानदार)',
        finance: 'हिशोब व वित्त',
        payments: 'जमा रकमा',
        customerLedger: 'ग्राहक खातेवही',
        expenses: 'खर्च',
        expiry: 'मुदत व्यवस्थापन',
        expiryManagement: 'मुदत संपणारा माल',
        reports: 'अहवाल',
        administration: 'प्रशासन',
        users: 'वापरकर्ते',
        rolesPermissions: 'अधिकार व परवानग्या',
        products: 'उत्पादने कॅटलॉग',
        settings: 'सेटिंग्ज',
      },
      dashboard: {
        title: 'दैनिक व्यवसाय आढावा',
        subtitle: 'आज व्यवसायात काय घडत आहे?',
        todaysSales: 'आजची एकूण विक्री',
        todaysOrders: 'आजच्या ऑर्डर्स',
        todaysProduction: 'आजचे उत्पादन',
        lowStockMaterials: 'कमी साठा इशारा',
        expiringSoon: 'लवकर मुदत संपणारा माल (≤५ दिवस)',
        outstandingAmount: 'एकूण येणे थकबाकी',
        todaysProductionList: 'आजची उत्पादन बॅचेस',
        recentOrders: 'नुकत्याच आलेल्या ग्राहक ऑर्डर्स',
        lowRawMaterials: 'कच्चा माल तुटवडा',
        expiringBatches: 'तातडीने पाठवायच्या बॅचेस',
        viewAll: 'सविस्तर पहा',
      },
      header: {
        searchPlaceholder: 'बॅच, ऑर्डर, दुकानदार शोधा...',
        roleAdmin: 'मालक / मुख्य ॲडमिन',
        roleProduction: 'उत्पादन व्यवस्थापक',
        roleWarehouse: 'गोदाम व्यवस्थापक',
        roleAccountant: 'हिशोब तपासनीस (अकाउंटंट)',
        myProfile: 'माझे प्रोफाइल',
        changePassword: 'पासवर्ड बदला',
        selectLanguage: 'भाषा निवडा',
        logout: 'बाहेर पडा',
        switchPortal: 'दुकानदार दृश्य',
      },
    },
  },
  hi: {
    common: {
      appTitle: 'माधव डेयरी',
      tagline: 'ताज़ा और शुद्ध डेयरी उत्पाद',
      login: 'लॉग इन करें',
      logout: 'लॉग आउट',
      save: 'सुरक्षित करें',
      cancel: 'रद्द करें',
      confirm: 'पुष्टि करें',
      submit: 'जमा करें',
      back: 'वापस',
      search: 'खोजें...',
      filter: 'फ़िल्टर',
      apply: 'लागू करें',
      reset: 'रीसेट',
      actions: 'कार्रवाई',
      status: 'स्थिति',
      date: 'तारीख',
      quantity: 'मात्रा',
      total: 'कुल',
      amount: 'राशि',
      notes: 'विवरण',
      loading: 'लोड हो रहा है...',
      noData: 'कोई रिकॉर्ड नहीं मिला',
      view: 'देखें',
      edit: 'संपादित करें',
      delete: 'हटाएं',
      success: 'सफल',
      error: 'त्रुटि',
      rupee: '₹',
    },
    customer: {
      nav: {
        home: 'मुख्य पृष्ठ',
        products: 'उत्पाद',
        orders: 'ऑर्डर्स',
        alerts: 'सूचनाएं',
        profile: 'प्रोफ़ाइल',
      },
      home: {
        greeting: 'नमस्ते,',
        orderProducts: 'उत्पाद ऑर्डर करें',
        repeatLastOrder: 'पिछला ऑर्डर दोहराएं',
        quickActions: 'त्वरित कार्य',
        myRecentOrders: 'हाल के ऑर्डर्स',
        pendingAlerts: 'महत्वपूर्ण सूचनाएं',
        outstandingBalance: 'मौजूदा बकाया',
        payNow: 'भुगतान करें',
        viewAll: 'सभी देखें',
        noRecentOrders: 'हाल में कोई ऑर्डर नहीं दिया गया।',
      },
      products: {
        title: 'डेयरी कैटलॉग',
        searchPlaceholder: 'उत्पाद खोजें...',
        allCategories: 'सभी उत्पाद',
        inStock: 'उपलब्ध',
        outOfStock: 'स्टॉक समाप्त',
        mrp: 'एम.आर.पी.',
        ourPrice: 'बिक्री दर',
        add: 'ऑर्डर में जोड़ें',
        added: 'जोड़ा गया',
        pack: 'पैक',
      },
      cart: {
        title: 'ऑर्डर की समीक्षा',
        emptyTitle: 'आपकी कार्ट खाली है',
        emptyDesc: 'ताज़ा डेयरी उत्पाद ऑर्डर करने के लिए सूची से चुनें।',
        browseProducts: 'उत्पाद चुनें',
        itemsInCart: 'कुल वस्तुएं',
        itemTotal: 'सामान का मूल्य',
        deliveryCharges: 'डिलिवरी शुल्क',
        freeDelivery: 'मुफ़्त डिलिवरी',
        finalAmount: 'कुल देय राशि',
        placeOrder: 'ऑर्डर पक्का करें',
        deliveringTo: 'डिलिवरी का पता',
        orderNotes: 'डिलिवरी निर्देश (वैकल्पिक)',
        notesPlaceholder: 'उदा. सुबह 8 बजे से पहले पहुंचाएं',
        expectedDeliveryDate: 'अपेक्षित डिलिवरी तिथि',
        selectDeliveryDate: 'डिलिवरी की तारीख चुनें',
        deliveryDateHelp: 'अपनी दुकान के लिए ताज़ा डेयरी उत्पादों की अपेक्षित डिलिवरी तिथि चुनें।',
        quickTomorrow: 'कल',
        quickDayAfter: 'परसों',
      },
      checkout: {
        confirmTitle: 'ऑर्डर की पुष्टि करें',
        confirmMsg: 'क्या आप इस ऑर्डर को माधव डेयरी डिस्पेच टीम को भेजना चाहते हैं?',
        confirmButton: 'हां, ऑर्डर दर्ज करें',
        successTitle: 'ऑर्डर सफलतापूर्वक दर्ज हुआ!',
        successMsg: 'आपका ऑर्डर दर्ज कर लिया गया है। हमारी टीम जल्द ही ताज़ा आपूर्ति पहुंचाएगी।',
        orderId: 'ऑर्डर संख्या',
        viewOrder: 'ऑर्डर देखें',
        continueShopping: 'मुख्य पृष्ठ पर लौटें',
      },
      orders: {
        title: 'ऑर्डर इतिहास',
        searchPlaceholder: 'ऑर्डर संख्या खोजें...',
        reorder: 'दोबारा मंगाएं',
        orderPlaced: 'ऑर्डर की तारीख',
        expectedDelivery: 'डिलिवरी तारीख',
        items: 'सामान',
        totalBill: 'बिल राशि',
        emptyDesc: 'आपके द्वारा दिए गए सभी ऑर्डर्स यहां दिखाई देंगे।',
        status: {
          pending: 'स्वीकृति लंबित',
          confirmed: 'ऑर्डर कन्फ़र्म',
          preparing: 'पैकिंग जारी',
          dispatched: 'रास्ते में है',
          delivered: 'डिलिवर हो गया',
          cancelled: 'रद्द हुआ',
        },
      },
      alerts: {
        title: 'सूचनाएं और अपडेट',
        all: 'सभी',
        unread: 'अपठित',
        markAllRead: 'सभी को पढ़ा हुआ चिन्हित करें',
        emptyDesc: 'आपके पास कोई नई सूचना नहीं है।',
        expiryWarning: 'एक्सपायरी चेतावनी',
        orderUpdate: 'ऑर्डर स्थिति अपडेट',
        paymentUpdate: 'भुगतान प्राप्ति अपडेट',
      },
      profile: {
        title: 'दुकानदार प्रोफ़ाइल',
        retailerProfile: 'व्यापार विवरण',
        shopName: 'दुकान का नाम',
        ownerName: 'मालिक का नाम',
        mobile: 'मोबाइल नंबर',
        address: 'पता',
        outstandingBalance: 'बकाया राशि',
        creditLimit: 'क्रेडिट सीमा',
        paymentTerms: 'भुगतान शर्तें',
        appLanguage: 'ऐप की भाषा / Language',
        changePassword: 'पासवर्ड बदलें',
        contactMadhavDairy: 'माधव डेयरी हेल्पडेस्क',
        supportHotline: '+91 98220 12345 (सुबह 7 से रात 9)',
        logoutConfirm: 'क्या आप लॉग आउट करना चाहते हैं?',
      },
      auth: {
        loginTitle: 'दुकानदार लॉगिन',
        loginSubtitle: 'डेयरी उत्पाद ऑर्डर करने के लिए पंजीकृत मोबाइल नंबर दर्ज करें',
        mobileLabel: 'मोबाइल नंबर',
        mobilePlaceholder: '10 अंकों का मोबाइल नंबर दर्ज करें',
        passwordLabel: 'पासवर्ड / पिन',
        passwordPlaceholder: 'अपना पासवर्ड दर्ज करें',
        loginButton: 'लॉग इन करें',
        noAccount: 'नए दुकानदार?',
        createAccount: 'दुकान पंजीकृत करें',
        registerTitle: 'दुकानदार पंजीकरण',
        registerSubtitle: 'ताज़ा डेयरी आपूर्ति के लिए अपनी दुकान पंजीकृत करें',
        shopNameLabel: 'दुकान का नाम',
        ownerNameLabel: 'मालिक का पूरा नाम',
        addressLabel: 'दुकान का पूरा पता',
        registerButton: 'पंजीकरण सबमिट करें',
        alreadyHaveAccount: 'पहले से पंजीकृत हैं? लॉगिन करें',
      },
    },
    internal: {
      nav: {
        overview: 'अवलोकन',
        dashboard: 'डैशबोर्ड',
        operations: 'उत्पादन संचालन',
        production: 'उत्पादन',
        batches: 'बैच प्रबंधन',
        inventory: 'स्टॉक इन्वेंटरी',
        finishedGoods: 'तैयार उत्पाद स्टॉक',
        rawMaterials: 'कच्चा माल',
        stockMovements: 'स्टॉक मूवमेंट लेज़र',
        sales: 'बिक्री',
        orders: 'ऑर्डर्स',
        invoices: 'इनवॉइस / बिल',
        customers: 'ग्राहक (दुकानदार)',
        finance: 'वित्त व लेखा',
        payments: 'भुगतान प्रविष्टियां',
        customerLedger: 'ग्राहक खाता बही',
        expenses: 'खर्च',
        expiry: 'एक्सपायरी प्रबंधन',
        expiryManagement: 'एक्सपायरी मॉनिटर',
        reports: 'रिपोर्ट्स',
        administration: 'प्रशासन',
        users: 'उपयोगकर्ता',
        rolesPermissions: 'भूमिका व अनुमतियां',
        products: 'उत्पाद सूची',
        settings: 'सेटिंग्स',
      },
      dashboard: {
        title: 'दैनिक व्यवसाय डैशबोर्ड',
        subtitle: 'आज के प्रमुख व्यापारिक आंकड़े व संचालन',
        todaysSales: 'आज की बिक्री',
        todaysOrders: 'आज के ऑर्डर्स',
        todaysProduction: 'आज का उत्पादन',
        lowStockMaterials: 'कम स्टॉक चेतावनी',
        expiringSoon: 'शीघ्र एक्सपायर होने वाला माल (≤5 दिन)',
        outstandingAmount: 'कुल बकाया राशि',
        todaysProductionList: 'आज के उत्पादन बैच',
        recentOrders: 'हाल के ग्राहक ऑर्डर्स',
        lowRawMaterials: 'कच्चे माल की कमी',
        expiringBatches: 'प्राथमिकता पर भेजने वाले बैच',
        viewAll: 'विस्तार से देखें',
      },
      header: {
        searchPlaceholder: 'बैच, ऑर्डर, दुकानदार खोजें...',
        roleAdmin: 'मालिक / मुख्य एडमिन',
        roleProduction: 'उत्पादन प्रबंधक',
        roleWarehouse: 'गोदाम प्रबंधक',
        roleAccountant: 'लेखाकार (अकाउंटेंट)',
        myProfile: 'मेरी प्रोफ़ाइल',
        changePassword: 'पासवर्ड बदलें',
        selectLanguage: 'भाषा चुनें',
        logout: 'लॉग आउट',
        switchPortal: 'ग्राहक दृश्य',
      },
    },
  },
};
