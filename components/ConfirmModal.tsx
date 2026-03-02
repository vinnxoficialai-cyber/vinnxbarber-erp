import React, { createContext, useContext, useState, useCallback } from 'react';
import { AlertTriangle, AlertCircle, Info, X, Check } from 'lucide-react';

// Types
interface ConfirmOptions {
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: 'danger' | 'warning' | 'info';
}

interface ConfirmContextType {
    confirm: (options: ConfirmOptions) => Promise<boolean>;
}

// Context
const ConfirmContext = createContext<ConfirmContextType | null>(null);

// Hook
export const useConfirm = () => {
    const context = useContext(ConfirmContext);
    if (!context) {
        throw new Error('useConfirm must be used within ConfirmProvider');
    }
    return context.confirm;
};

// Provider Component
interface ConfirmProviderProps {
    children: React.ReactNode;
    isDarkMode: boolean;
}

export const ConfirmProvider: React.FC<ConfirmProviderProps> = ({ children, isDarkMode }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [options, setOptions] = useState<ConfirmOptions | null>(null);
    const [resolvePromise, setResolvePromise] = useState<((value: boolean) => void) | null>(null);

    const confirm = useCallback((opts: ConfirmOptions): Promise<boolean> => {
        setOptions(opts);
        setIsOpen(true);
        return new Promise<boolean>((resolve) => {
            setResolvePromise(() => resolve);
        });
    }, []);

    const handleConfirm = () => {
        setIsOpen(false);
        resolvePromise?.(true);
        setResolvePromise(null);
        setOptions(null);
    };

    const handleCancel = () => {
        setIsOpen(false);
        resolvePromise?.(false);
        setResolvePromise(null);
        setOptions(null);
    };

    const getVariantStyles = (variant: ConfirmOptions['variant'] = 'warning') => {
        switch (variant) {
            case 'danger':
                return {
                    icon: <AlertTriangle size={24} className="text-red-500" />,
                    iconBg: 'bg-red-100 dark:bg-red-900/30',
                    confirmBtn: 'bg-red-500 hover:bg-red-600 text-white',
                };
            case 'warning':
                return {
                    icon: <AlertCircle size={24} className="text-orange-500" />,
                    iconBg: 'bg-orange-100 dark:bg-orange-900/30',
                    confirmBtn: 'bg-orange-500 hover:bg-orange-600 text-white',
                };
            case 'info':
            default:
                return {
                    icon: <Info size={24} className="text-blue-500" />,
                    iconBg: 'bg-blue-100 dark:bg-blue-900/30',
                    confirmBtn: 'bg-primary hover:bg-primary-600 text-white',
                };
        }
    };

    const styles = options ? getVariantStyles(options.variant) : getVariantStyles();

    return (
        <ConfirmContext.Provider value={{ confirm }}>
            {children}

            {/* Modal */}
            {isOpen && options && (
                <div
                    className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
                    onClick={handleCancel}
                >
                    <div
                        className={`${isDarkMode ? 'bg-dark-surface border-dark-border' : 'bg-white border-slate-200'} border rounded-xl shadow-2xl max-w-md w-full animate-in fade-in zoom-in-95 duration-200`}
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className={`p-6 border-b ${isDarkMode ? 'border-dark-border' : 'border-slate-100'}`}>
                            <div className="flex items-start gap-4">
                                <div className={`p-3 rounded-xl ${styles.iconBg}`}>
                                    {styles.icon}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                                        {options.title}
                                    </h3>
                                    <p className={`mt-1 text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                                        {options.message}
                                    </p>
                                </div>
                                <button
                                    onClick={handleCancel}
                                    className={`p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-dark transition-colors ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}
                                >
                                    <X size={20} />
                                </button>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="p-4 flex gap-3">
                            <button
                                onClick={handleCancel}
                                className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-colors border ${isDarkMode
                                        ? 'border-dark-border text-slate-300 hover:bg-dark'
                                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                                    }`}
                            >
                                {options.cancelLabel || 'Cancelar'}
                            </button>
                            <button
                                onClick={handleConfirm}
                                className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 ${styles.confirmBtn}`}
                            >
                                <Check size={18} />
                                {options.confirmLabel || 'Confirmar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </ConfirmContext.Provider>
    );
};
