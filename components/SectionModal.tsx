import React from 'react';
import { NavLink } from 'react-router-dom';
import { X, ChevronRight } from 'lucide-react';

interface NavItem {
    icon: React.ElementType;
    label: string;
    path: string;
}

interface NavSection {
    id: string;
    label: string;
    icon: React.ElementType;
    items: NavItem[];
}

interface SectionModalProps {
    section: NavSection | null;
    isOpen: boolean;
    onClose: () => void;
    isDarkMode: boolean;
    badges?: Record<string, number>;
}

export const SectionModal: React.FC<SectionModalProps> = ({ section, isOpen, onClose, isDarkMode, badges = {} }) => {
    if (!section) return null;

    const textMain = isDarkMode ? 'text-slate-50' : 'text-slate-900';
    const textSub = isDarkMode ? 'text-slate-400' : 'text-slate-600';
    const bgCard = isDarkMode ? 'bg-dark-surface/95' : 'bg-white/95';
    const borderCol = isDarkMode ? 'border-dark-border' : 'border-slate-200';

    const SectionIcon = section.icon;

    return (
        <>
            {/* Backdrop */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm animate-in fade-in duration-200 lg:hidden"
                    onClick={onClose}
                />
            )}

            {/* Modal */}
            <div
                className={`
          fixed left-1/2 -translate-x-1/2 z-50 
          w-[90%] max-w-[400px]
          ${bgCard} backdrop-blur-xl
          border ${borderCol}
          rounded-3xl shadow-2xl lg:hidden
          transform transition-all duration-400 cubic-bezier(0.16, 1, 0.3, 1) origin-bottom
          ${isOpen ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-4 opacity-0 scale-95 pointer-events-none'}
        `}
                style={{ bottom: 'calc(6.5rem + env(safe-area-inset-bottom))' }}
            >
                {/* Header */}
                <div className={`p-4 border-b ${borderCol} flex items-center justify-between`}>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <SectionIcon size={20} className="text-primary" />
                        </div>
                        <h3 className={`font-semibold text-lg ${textMain}`}>{section.label}</h3>
                    </div>
                    <button
                        onClick={onClose}
                        className={`${textSub} hover:${textMain} transition-colors`}
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Items List */}
                <div className="p-2 max-h-[60vh] overflow-y-auto">
                    {section.items.map((item) => {
                        const ItemIcon = item.icon;
                        const badgeCount = badges[item.path] || 0;

                        return (
                            <NavLink
                                key={item.path}
                                to={item.path}
                                onClick={onClose}
                                className={({ isActive }) => `
                  flex items-center gap-3 p-3 rounded-lg transition-all group
                  ${isActive
                                        ? 'bg-primary/10 text-primary'
                                        : `${textSub} hover:bg-slate-100 dark:hover:bg-dark`
                                    }
                `}
                            >
                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center bg-slate-100 dark:bg-dark`}>
                                    <ItemIcon size={20} />
                                </div>
                                <span className={`flex-1 font-medium text-sm ${textMain}`}>{item.label}</span>

                                {badgeCount > 0 && (
                                    <span className="px-2 py-0.5 bg-red-500 text-white text-xs font-bold rounded-full min-w-[20px] text-center">
                                        {badgeCount > 99 ? '99+' : badgeCount}
                                    </span>
                                )}

                                <ChevronRight size={16} className="opacity-30 group-hover:opacity-100 transition-opacity" />
                            </NavLink>
                        );
                    })}
                </div>
            </div>
        </>
    );
};
