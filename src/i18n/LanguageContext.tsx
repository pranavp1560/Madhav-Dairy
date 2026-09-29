import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Language, Product } from '../types/dairy';
import { TRANSLATIONS, Translations } from './translations';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: Translations;
  getProductName: (product: { name: string; nameMr?: string; nameHi?: string }) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem('madhav_language');
    if (saved === 'mr' || saved === 'hi' || saved === 'en') {
      return saved;
    }
    return 'en';
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('madhav_language', lang);
  };

  const t = TRANSLATIONS[language];

  const getProductName = (product: { name: string; nameMr?: string; nameHi?: string }) => {
    if (language === 'mr' && product.nameMr) return product.nameMr;
    if (language === 'hi' && product.nameHi) return product.nameHi;
    return product.name;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, getProductName }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useTranslation = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useTranslation must be used within a LanguageProvider');
  }
  return context;
};
