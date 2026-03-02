import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingScreenProps {
    message?: string;
    companyName?: string;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({ message = 'Carregando...', companyName = 'VINNX ERP' }) => {
    return (
        <div className="fixed inset-0 min-h-screen w-full bg-slate-50 dark:bg-dark flex flex-col items-center justify-center z-50">
            <div className="flex flex-col items-center justify-center">
                <div className="relative mb-6">
                    <div className="w-16 h-16 border-4 border-slate-200 dark:border-slate-700 border-t-primary rounded-full animate-spin"></div>
                </div>
                <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-2 tracking-tight">
                    {companyName}
                </h2>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400 animate-pulse">
                    {message}
                </p>
            </div>
        </div>
    );
};
