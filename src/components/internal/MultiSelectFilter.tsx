import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search, X, Check } from 'lucide-react';

export interface MultiSelectOption {
  value: string;
  label: string;
  sublabel?: string;
}

interface MultiSelectFilterProps {
  label: string;
  icon: React.ReactNode;
  options: MultiSelectOption[];
  selectedValues: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
}

export const MultiSelectFilter: React.FC<MultiSelectFilterProps> = ({
  label,
  icon,
  options,
  selectedValues,
  onChange,
  placeholder = 'All'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const filteredOptions = options.filter(opt => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    return (
      opt.label.toLowerCase().includes(q) ||
      (opt.sublabel && opt.sublabel.toLowerCase().includes(q))
    );
  });

  const toggleOption = (val: string) => {
    if (selectedValues.includes(val)) {
      onChange(selectedValues.filter(v => v !== val));
    } else {
      onChange([...selectedValues, val]);
    }
  };

  const selectAll = () => {
    const allValues = options.map(o => o.value);
    onChange(allValues);
  };

  const clearAll = () => {
    onChange([]);
  };

  // Label display logic
  let displaySummary = `${placeholder} (${options.length})`;
  if (selectedValues.length === 1) {
    const matched = options.find(o => o.value === selectedValues[0]);
    displaySummary = matched ? matched.label : selectedValues[0];
  } else if (selectedValues.length > 1) {
    displaySummary = `${selectedValues.length} Selected`;
  }

  const isAllSelected = selectedValues.length > 0 && selectedValues.length === options.length;
  const isPartiallySelected = selectedValues.length > 0 && !isAllSelected;

  return (
    <div className="space-y-1 relative" ref={dropdownRef}>
      <label className="block text-[11px] font-bold text-slate-700 flex items-center justify-between">
        <span className="flex items-center gap-1">
          {icon}
          <span>{label}</span>
        </span>
        {selectedValues.length > 0 && (
          <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.2 rounded-full border border-blue-200">
            {selectedValues.length} selected
          </span>
        )}
      </label>

      {/* Trigger Button */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`w-full p-2 pr-8 text-left bg-slate-50 border rounded-xl text-xs font-medium flex items-center justify-between transition-all cursor-pointer ${
            isOpen
              ? 'border-blue-600 ring-2 ring-blue-100 bg-white'
              : selectedValues.length > 0
              ? 'border-blue-400 bg-blue-50/40 text-blue-900 font-semibold'
              : 'border-slate-200 text-slate-800 hover:bg-slate-100/70'
          }`}
          title={`Click to filter by multiple ${label.toLowerCase()}`}
        >
          <span className="truncate pr-1">
            {displaySummary}
          </span>
          <ChevronDown
            className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform duration-200 ${
              isOpen ? 'rotate-180 text-blue-600' : ''
            }`}
          />
        </button>

        {/* Clear Icon button directly on trigger */}
        {selectedValues.length > 0 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              clearAll();
            }}
            className="absolute right-7 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded"
            title="Clear this filter"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Floating Dropdown Menu */}
      {isOpen && (
        <div className="absolute top-full mt-1 left-0 z-50 w-72 sm:w-80 bg-white rounded-xl shadow-2xl border border-slate-200 p-2.5 space-y-2 animate-in fade-in duration-150">
          {/* Header Action Bar */}
          <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 text-[11px]">
            <span className="font-bold text-slate-700">
              Select {label}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={selectAll}
                className="text-blue-600 hover:text-blue-800 font-semibold cursor-pointer"
              >
                Select All
              </button>
              <span className="text-slate-300">|</span>
              <button
                type="button"
                onClick={clearAll}
                className="text-slate-500 hover:text-slate-700 font-medium cursor-pointer"
              >
                Clear
              </button>
            </div>
          </div>

          {/* Search Box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={`Search ${label.toLowerCase()}...`}
              className="w-full pl-8 pr-7 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-blue-600 focus:outline-none"
              autoFocus
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Options Checklist */}
          <div className="max-h-56 overflow-y-auto space-y-0.5 pr-0.5 divide-y divide-slate-50 scrollbar-thin">
            {filteredOptions.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-400">
                No matching {label.toLowerCase()} found.
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isChecked = selectedValues.includes(opt.value);
                return (
                  <label
                    key={opt.value}
                    className={`flex items-start gap-2.5 p-2 rounded-lg text-xs cursor-pointer transition-colors ${
                      isChecked
                        ? 'bg-blue-50/70 text-blue-900 font-semibold'
                        : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleOption(opt.value)}
                      className="mt-0.5 w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer shrink-0"
                    />
                    <div className="min-w-0 flex-1 leading-snug">
                      <div className="truncate">{opt.label}</div>
                      {opt.sublabel && (
                        <div className="text-[10px] text-slate-400 font-normal truncate">
                          {opt.sublabel}
                        </div>
                      )}
                    </div>
                  </label>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>
              {selectedValues.length === 0
                ? `Showing all (${options.length})`
                : `${selectedValues.length} of ${options.length} selected`}
            </span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-[11px] font-bold shadow-2xs cursor-pointer transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
