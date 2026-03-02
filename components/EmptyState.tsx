import React from 'react';
import { Inbox, FileX, Users, Calendar, FolderOpen, AlertCircle } from 'lucide-react';

interface EmptyStateProps {
    icon?: 'inbox' | 'file' | 'users' | 'calendar' | 'folder' | 'alert';
    title: string;
    description?: string;
    action?: {
        label: string;
        onclick: () => void;
    };
    className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
    icon = 'inbox',
    title,
    description,
    action,
    className = ''
}) => {
    const icons = {
        inbox: Inbox,
        file: FileX,
        users: Users,
        calendar: Calendar,
        folder: FolderOpen,
        alert: AlertCircle
    };

    const Icon = icons[icon];

    return (
        <div className={`flex flex-col items-center justify-center py-12 px-4 text-center ${className}`}>
            <div className="mb-4 p-4 bg-slate-100 dark:bg-dark-border rounded-full">
                <Icon size={48} className="text-slate-400 dark:text-slate-500" />
            </div>

            <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300 mb-2">
                {title}
            </h3>

            {description && (
                <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mb-6">
                    {description}
                </p>
            )}

            {action && (
                <button
                    onClick={action.onclick}
                    className="px-4 py-2 bg-primary hover:bg-primary-600 text-white font-semibold rounded-lg transition-colors shadow-lg shadow-primary/20"
                >
                    {action.label}
                </button>
            )}
        </div>
    );
};
