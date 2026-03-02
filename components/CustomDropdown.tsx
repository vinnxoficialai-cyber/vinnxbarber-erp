import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, CheckCircle2 } from 'lucide-react';

export interface DropdownOption {
    value: string;
    label: string;
    icon?: React.ReactNode;
    dot?: string;
}

interface CustomDropdownProps {
    value: string;
    onChange: (value: string) => void;
    options: DropdownOption[];
    placeholder?: string;
    icon?: React.ReactNode;
    isDarkMode?: boolean;
    className?: string;
    disabled?: boolean;
}

export const CustomDropdown: React.FC<CustomDropdownProps> = ({
    value, onChange, options, placeholder, icon, isDarkMode: isDarkModeProp, className = '', disabled = false
}) => {
    const isDarkMode = isDarkModeProp ?? document.documentElement.classList.contains('dark');
    const [open, setOpen] = useState(false);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const selected = options.find(o => o.value === value);
    const [menuPos, setMenuPos] = useState({ top: 0, left: 0, width: 0 });

    // Close on outside click
    useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => {
            const target = e.target as Node;
            if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
            setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    // Calculate position when opening
    const handleToggle = () => {
        if (disabled) return;
        if (!open && triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom;
            const menuHeight = Math.min(options.length * 36 + 12, 240);
            const openAbove = spaceBelow < menuHeight + 8 && rect.top > menuHeight + 8;
            setMenuPos({
                top: openAbove ? rect.top - menuHeight - 6 : rect.bottom + 6,
                left: rect.left,
                width: rect.width,
            });
        }
        setOpen(prev => !prev);
    };

    return (
        <div className={`relative ${className}`}>
            <button
                ref={triggerRef}
                type="button"
                onClick={handleToggle}
                disabled={disabled}
                className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-bold transition-all text-left
          ${disabled ? 'opacity-60 cursor-not-allowed' : ''}
          ${open
                        ? (isDarkMode ? 'border-primary/40 bg-primary/5 ring-1 ring-primary/20' : 'border-primary/40 bg-primary/5 ring-1 ring-primary/15')
                        : (isDarkMode ? 'border-dark-border bg-white/[0.02] hover:border-slate-600' : 'border-slate-200 bg-white hover:border-slate-300')
                    }`}
            >
                {icon && <span className={isDarkMode ? 'text-slate-500' : 'text-slate-400'}>{icon}</span>}
                {selected?.dot && <div className={`w-2 h-2 rounded-full shrink-0 ${selected.dot}`} />}
                <span className={`flex-1 truncate ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>
                    {selected?.label || placeholder || 'Selecionar'}
                </span>
                <ChevronDown size={13} className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''} ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`} />
            </button>

            {open && (
                <div
                    ref={menuRef}
                    className={`fixed z-[9999] rounded-xl border shadow-2xl py-1.5 max-h-[240px] overflow-y-auto custom-scrollbar
            ${isDarkMode ? 'bg-dark-surface border-dark-border' : 'bg-white border-slate-200'}`}
                    style={{ top: `${menuPos.top}px`, left: `${menuPos.left}px`, width: `${menuPos.width}px` }}
                >
                    {options.map(opt => (
                        <button
                            key={opt.value}
                            onClick={() => { onChange(opt.value); setOpen(false); }}
                            className={`w-full text-left px-3 py-2 text-xs font-semibold flex items-center gap-2.5 transition-colors
                ${opt.value === value
                                    ? (isDarkMode ? 'bg-primary/10 text-primary' : 'bg-primary/5 text-primary')
                                    : (isDarkMode ? 'text-slate-300 hover:bg-dark hover:text-white' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900')
                                }`}
                        >
                            {opt.dot && <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${opt.dot}`} />}
                            {opt.icon && <span className="shrink-0">{opt.icon}</span>}
                            <span className="flex-1 truncate">{opt.label}</span>
                            {opt.value === value && <CheckCircle2 size={12} className="shrink-0 text-primary" />}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};
