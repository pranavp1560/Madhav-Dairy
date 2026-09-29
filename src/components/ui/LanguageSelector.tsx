import React from 'react';
import { useTranslation } from '../../i18n/LanguageContext';
import { Language } from '../../types/dairy';
import { Globe } from 'lucide-react';

export interface LanguageSelectorProps {
  variant?: 'pills' | 'dropdown' | 'compact';
  className?: string;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  variant = 'dropdown',
  className = '',
}) => {
  const { language, setLanguage } = useTranslation();

  const languages: { code: Language; label: string; native: string }[] = [
    { code: 'en', label: 'English', native: 'English' },
    { code: 'mr', label: 'Marathi', native: 'मराठी' },
    { code: 'hi', label: 'Hindi', native: 'हिंदी' },
  ];

  if (variant === 'pills') {
    return (
      <div className={`inline-flex items-center p-0.5 bg-slate-100 rounded-lg ${className}`}>
        {languages.map((l) => (
          <button
            key={l.code}
            type="button"
            onClick={() => setLanguage(l.code)}
            className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
              language === l.code
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {l.native}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className={`relative inline-flex items-center gap-1.5 ${className}`}>
      <Globe className="w-3.5 h-3.5 text-slate-400 shrink-0" />
      <select
        value={language}
        onChange={(e) => setLanguage(e.target.value as Language)}
        className="bg-transparent text-xs font-medium text-slate-700 hover:text-slate-900 focus:outline-none cursor-pointer py-1 pr-4 pl-0.5"
        aria-label="Select Language"
      >
        {languages.map((l) => (
          <option key={l.code} value={l.code}>
            {l.native} ({l.label})
          </option>
        ))}
      </select>
    </div>
  );
};
