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
            <div className="mb-4 p-4 bg-muted rounded-full">
                <Icon size={48} className="text-muted-foreground" />
            </div>

            <h3 className="text-lg font-bold text-foreground mb-2">
                {title}
            </h3>

            {description && (
                <p className="text-sm text-muted-foreground max-w-md mb-6">
                    {description}
                </p>
            )}

            {action && (
                <button
                    onClick={action.onclick}
                    className="px-4 py-2 bg-primary hover:bg-primary/90 text-white font-semibold rounded-full transition-colors"
                >
                    {action.label}
                </button>
            )}
        </div>
    );
};
