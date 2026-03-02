import React, { createContext, useContext, useState, useCallback } from 'react';
import { Lock, AlertCircle, X, Eye, EyeOff, Loader2 } from 'lucide-react';

interface PasswordConfirmOptions {
    title: string;
    message: string;
    action: string;
    onValidate?: (password: string) => Promise<boolean>; // Async validator
    currentUserPassword?: string; // Fallback for legacy
}

interface PasswordConfirmContextType {
    confirm: (options: PasswordConfirmOptions) => Promise<boolean>;
}

const PasswordConfirmContext = createContext<PasswordConfirmContextType | null>(null);

interface PasswordConfirmProviderProps {
    children: React.ReactNode;
    isDarkMode: boolean;
}

export const PasswordConfirmProvider: React.FC<PasswordConfirmProviderProps> = ({ children, isDarkMode }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [options, setOptions] = useState<PasswordConfirmOptions | null>(null);
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [validating, setValidating] = useState(false);
    const [resolvePromise, setResolvePromise] = useState<((value: boolean) => void) | null>(null);

    const textMain = isDarkMode ? 'text-slate-50' : 'text-slate-900';
    const textSub = isDarkMode ? 'text-slate-400' : 'text-slate-600';
    const bgCard = isDarkMode ? 'bg-dark-surface' : 'bg-white';
    const borderCol = isDarkMode ? 'border-dark-border' : 'border-slate-200';
    const bgInput = isDarkMode ? 'bg-dark' : 'bg-slate-50';

    const confirm = useCallback((opts: PasswordConfirmOptions): Promise<boolean> => {
        return new Promise<boolean>((resolve) => {
            setOptions(opts);
            setPassword('');
            setShowPassword(false);
            setError('');
            setValidating(false);
            setIsOpen(true);
            setResolvePromise(() => resolve);
        });
    }, []);

    const handleConfirm = async () => {
        if (!options) return;
        setError('');
        setValidating(true);

        try {
            let isValid = false;

            if (options.onValidate) {
                isValid = await options.onValidate(password);
            } else if (options.currentUserPassword) {
                isValid = password === options.currentUserPassword;
            }

            if (isValid) {
                setIsOpen(false);
                setPassword('');
                if (resolvePromise) resolvePromise(true);
            } else {
                setError('Senha incorreta. Tente novamente.');
                setPassword('');
            }
        } catch (err) {
            setError('Erro ao validar senha.');
            console.error(err);
        } finally {
            setValidating(false);
        }
    };

    const handleCancel = () => {
        setIsOpen(false);
        setPassword('');
        setError('');
        setValidating(false);
        if (resolvePromise) resolvePromise(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && password && !validating) {
            handleConfirm();
        }
        if (e.key === 'Escape' && !validating) {
            handleCancel();
        }
    };

    return (
        <PasswordConfirmContext.Provider value={{ confirm }}>
            {children}

            {isOpen && options && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div
                        className={`${bgCard} border ${borderCol} rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200`}
                        onKeyDown={handleKeyDown}
                    >
                        {/* Header */}
                        <div className={`p-4 border-b ${borderCol} flex items-center justify-between ${isDarkMode ? 'bg-dark' : 'bg-slate-50'}`}>
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center">
                                    <Lock size={20} className="text-amber-500" />
                                </div>
                                <h3 className={`font-semibold text-lg ${textMain}`}>{options.title}</h3>
                            </div>
                            <button
                                onClick={handleCancel}
                                disabled={validating}
                                className={`${textSub} hover:${textMain} transition-colors disabled:opacity-50`}
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="p-6 space-y-4">
                            {/* Warning */}
                            <div className={`p-3 rounded-lg border bg-amber-500/10 ${isDarkMode ? 'border-amber-500/30' : 'border-amber-500/20'}`}>
                                <div className="flex items-start gap-2 text-amber-500">
                                    <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                                    <div className="text-sm">
                                        <p className="font-medium mb-1">Ação Crítica Detectada</p>
                                        <p className={`${textSub} text-xs`}>{options.message}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Password Input */}
                            <div>
                                <label className={`block text-xs font-medium ${textSub} mb-2 flex items-center gap-1`}>
                                    <Lock size={12} />
                                    Digite sua senha para confirmar
                                </label>
                                <div className="relative">
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={password}
                                        onChange={(e) => {
                                            setPassword(e.target.value);
                                            setError(''); // Clear error on typing
                                        }}
                                        disabled={validating}
                                        placeholder="••••••••"
                                        autoFocus
                                        className={`w-full ${bgInput} border ${error ? 'border-red-500' : borderCol} rounded-lg p-3 pr-10 text-sm ${textMain} focus:ring-2 ${error ? 'focus:ring-red-500' : 'focus:ring-amber-500'} outline-none transition-all disabled:opacity-50`}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className={`absolute right-3 top-1/2 -translate-y-1/2 ${textSub} hover:${textMain} transition-colors`}
                                    >
                                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                                {error && (
                                    <p className="text-xs text-red-500 mt-1.5 flex items-center gap-1">
                                        <AlertCircle size={12} />
                                        {error}
                                    </p>
                                )}
                            </div>

                            {/* Info */}
                            <p className={`text-xs ${textSub} italic`}>
                                * Esta verificação garante que apenas usuários autorizados possam executar esta ação.
                            </p>
                        </div>

                        {/* Actions */}
                        <div className={`p-4 border-t ${borderCol} flex gap-3 ${isDarkMode ? 'bg-dark/50' : 'bg-slate-50'}`}>
                            <button
                                onClick={handleCancel}
                                disabled={validating}
                                className={`flex-1 px-4 py-2.5 border ${borderCol} ${textMain} font-medium rounded-lg hover:bg-slate-100 dark:hover:bg-dark transition-colors disabled:opacity-50`}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleConfirm}
                                disabled={!password || validating}
                                className={`flex-1 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-lg transition-colors shadow-lg shadow-amber-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2`}
                            >
                                {validating ? <Loader2 size={16} className="animate-spin" /> : <Lock size={16} />}
                                {validating ? 'Verificando...' : options.action}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </PasswordConfirmContext.Provider>
    );
};

export const usePasswordConfirm = () => {
    const context = useContext(PasswordConfirmContext);
    if (!context) {
        throw new Error('usePasswordConfirm must be used within PasswordConfirmProvider');
    }
    return context.confirm;
};
