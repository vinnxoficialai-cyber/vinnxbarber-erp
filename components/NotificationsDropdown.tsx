import React, { useState, useEffect, useRef } from 'react';
import { Bell, X, Check, CheckCheck, Info, AlertTriangle, AlertCircle, CheckCircle, Clock, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppData } from '../hooks/useAppData';
import { markNotificationAsRead, markAllNotificationsAsRead, deleteNotification, saveSystemNotification } from '../lib/dataService';
import { Notification } from '../types'; // Import from types now

// Removed local interface Notification definition to use global type


interface NotificationsDropdownProps {
    isDarkMode: boolean;
}

const STORAGE_KEY = 'erp_notifications';

const ICON_MAP: Record<Notification['type'], React.ReactNode> = {
    info: <Info size={16} className="text-blue-500" />,
    warning: <AlertTriangle size={16} className="text-yellow-500" />,
    error: <AlertCircle size={16} className="text-red-500" />,
    success: <CheckCircle size={16} className="text-green-500" />,
};

const BG_MAP: Record<Notification['type'], string> = {
    info: 'bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-900/30',
    warning: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-100 dark:border-yellow-900/30',
    error: 'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-900/30',
    success: 'bg-green-50 dark:bg-green-900/20 border-green-100 dark:border-green-900/30',
};

// Generate sample notifications based on system state
const generateSystemNotifications = (): Notification[] => {
    const now = new Date();
    const notifications: Notification[] = [];

    // Welcome notification
    notifications.push({
        id: 'welcome',
        type: 'info',
        title: 'Bem-vindo ao VINNX ERP!',
        message: 'Explore as funcionalidades do sistema usando o menu lateral.',
        read: false,
        createdAt: now.toISOString(),
    });

    return notifications;
};

export const NotificationsDropdown: React.FC<NotificationsDropdownProps> = ({ isDarkMode }) => {
    const navigate = useNavigate();
    const dropdownRef = useRef<HTMLDivElement>(null);
    const [isOpen, setIsOpen] = useState(false);
    const { notifications, setNotifications, refresh } = useAppData();

    // Remove local storage logic
    // const [notifications, setNotifications] = useState<Notification[]>(...);


    // Save to storage
    // No storage effect needed


    // Close on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const unreadCount = notifications.filter(n => !n.read).length;

    const markAsRead = async (id: string) => {
        // Optimistic update
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
        await markNotificationAsRead(id);
        refresh();
    };

    const markAllAsRead = async () => {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
        await markAllNotificationsAsRead();
        refresh();
    };

    const dismissNotification = async (id: string) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
        await deleteNotification(id);
        refresh();
    };

    const handleAction = (notification: Notification) => {
        if (notification.action) {
            navigate(notification.action.path);
            markAsRead(notification.id);
            setIsOpen(false);
        }
    };

    const formatTime = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffMins < 1) return 'Agora';
        if (diffMins < 60) return `${diffMins}min`;
        if (diffHours < 24) return `${diffHours}h`;
        return `${diffDays}d`;
    };

    return (
        <div className="relative" ref={dropdownRef}>
            {/* Bell Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-dark-border rounded-lg transition-colors"
            >
                <Bell size={20} />
                {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 w-4 h-4 bg-primary text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white dark:border-dark-surface">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {/* Dropdown */}
            {isOpen && (
                <div className={`absolute right-0 top-full mt-2 w-80 sm:w-96 ${isDarkMode ? 'bg-dark-surface border-dark-border' : 'bg-white border-slate-200'} border rounded-xl shadow-xl z-50 animate-in fade-in slide-in-from-top-2 duration-200`}>
                    {/* Header */}
                    <div className={`p-4 border-b ${isDarkMode ? 'border-dark-border' : 'border-slate-100'} flex items-center justify-between`}>
                        <div className="flex items-center gap-2">
                            <Bell size={18} className="text-primary" />
                            <h3 className={`font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Notificações</h3>
                            {unreadCount > 0 && (
                                <span className="px-2 py-0.5 bg-primary/10 text-primary text-xs font-bold rounded-full">
                                    {unreadCount} nova{unreadCount > 1 ? 's' : ''}
                                </span>
                            )}
                        </div>
                        {unreadCount > 0 && (
                            <button
                                onClick={markAllAsRead}
                                className="text-xs text-primary hover:text-primary-600 font-medium flex items-center gap-1"
                            >
                                <CheckCheck size={14} />
                                Marcar todas
                            </button>
                        )}
                    </div>

                    {/* Notifications List */}
                    <div className="max-h-80 overflow-y-auto custom-scrollbar">
                        {notifications.length > 0 ? (
                            <div className="p-2 space-y-2">
                                {notifications.map(notification => (
                                    <div
                                        key={notification.id}
                                        className={`relative p-3 rounded-lg border transition-all ${notification.read ? 'opacity-60' : ''} ${BG_MAP[notification.type]}`}
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className="mt-0.5">
                                                {ICON_MAP[notification.type]}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between gap-2">
                                                    <h4 className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-slate-800'} truncate`}>
                                                        {notification.title}
                                                    </h4>
                                                    <span className={`text-xs ${isDarkMode ? 'text-slate-500' : 'text-slate-400'} flex-shrink-0`}>
                                                        {formatTime(notification.createdAt)}
                                                    </span>
                                                </div>
                                                <p className={`text-xs mt-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                                                    {notification.message}
                                                </p>
                                                {notification.action && (
                                                    <button
                                                        onClick={() => handleAction(notification)}
                                                        className="mt-2 text-xs font-medium text-primary hover:text-primary-600 flex items-center gap-1"
                                                    >
                                                        {notification.action.label}
                                                        <ExternalLink size={12} />
                                                    </button>
                                                )}
                                            </div>
                                            <button
                                                onClick={() => dismissNotification(notification.id)}
                                                className={`p-1 rounded hover:bg-black/5 dark:hover:bg-white/5 transition-colors ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}
                                            >
                                                <X size={14} />
                                            </button>
                                        </div>
                                        {!notification.read && (
                                            <button
                                                onClick={() => markAsRead(notification.id)}
                                                className="absolute bottom-2 right-2 p-1 rounded hover:bg-black/5 dark:hover:bg-white/5"
                                                title="Marcar como lida"
                                            >
                                                <Check size={12} className="text-primary" />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="p-8 text-center">
                                <Bell size={32} className={`mx-auto mb-2 ${isDarkMode ? 'text-slate-600' : 'text-slate-300'}`} />
                                <p className={`text-sm ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                                    Nenhuma notificação
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    {notifications.length > 0 && (
                        <div className={`p-3 border-t ${isDarkMode ? 'border-dark-border' : 'border-slate-100'} text-center`}>
                            <button
                                onClick={() => setNotifications([])}
                                className={`text-xs ${isDarkMode ? 'text-slate-500 hover:text-slate-400' : 'text-slate-400 hover:text-slate-600'} transition-colors`}
                            >
                                Limpar todas
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

// Export function to add notifications from other components
// Export function to add notifications from other components
export const addNotification = async (notification: Omit<Notification, 'id' | 'createdAt' | 'read'>) => {
    const newNotification: Notification = {
        ...notification,
        id: crypto.randomUUID(), // Use crypto or uuid lib
        read: false,
        createdAt: new Date().toISOString(),
    };
    await saveSystemNotification(newNotification);
    // Note: This won't trigger immediate UI update unless polling/refresh happens
    // Ideally useAppData would expose this method wrapped with refresh
};
