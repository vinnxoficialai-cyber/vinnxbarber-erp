import React, { useState, useEffect, useRef } from 'react';
import { User, Settings, Moon, Sun, LogOut, ChevronRight, Edit3, Shield, Bell, Palette } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { TeamMember } from '../types';

interface ProfileDropdownProps {
    user: TeamMember | null;
    isDarkMode: boolean;
    onToggleTheme: () => void;
    onLogout: () => void;
}

export const ProfileDropdown: React.FC<ProfileDropdownProps> = ({
    user,
    isDarkMode,
    onToggleTheme,
    onLogout
}) => {
    const navigate = useNavigate();
    const dropdownRef = useRef<HTMLDivElement>(null);
    const [isOpen, setIsOpen] = useState(false);

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

    const getInitials = (name: string) => {
        return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
    };

    const handleNavigate = (path: string) => {
        navigate(path);
        setIsOpen(false);
    };

    const menuItems = [
        {
            icon: Edit3,
            label: 'Editar Perfil',
            action: () => handleNavigate('/team'),
            description: 'Alterar suas informações',
        },
        {
            icon: Palette,
            label: isDarkMode ? 'Modo Claro' : 'Modo Escuro',
            action: onToggleTheme,
            description: 'Alterar tema do sistema',
            toggle: true,
        },
        {
            icon: Settings,
            label: 'Configurações',
            action: () => handleNavigate('/settings'),
            description: 'Preferências do sistema',
        },
    ];

    return (
        <div className="relative" ref={dropdownRef}>
            {/* Profile Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
            >
                <div className="text-right hidden sm:block">
                    <p className={`text-sm font-semibold ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>
                        {user?.name || 'Usuário'}
                    </p>
                    <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                        {user?.role || 'Membro'}
                    </p>
                </div>
                <div className={`w-9 h-9 rounded-full border overflow-hidden flex items-center justify-center ${isDarkMode ? 'border-dark-border bg-dark' : 'border-slate-200 bg-slate-100'
                    }`}>
                    {user?.image ? (
                        <img src={user.image} className="w-full h-full object-cover" alt="Avatar" />
                    ) : (
                        <span className="text-sm font-bold text-primary">
                            {user ? getInitials(user.name) : 'U'}
                        </span>
                    )}
                </div>
            </button>

            {/* Dropdown */}
            {isOpen && (
                <div className={`absolute right-0 top-full mt-2 w-72 ${isDarkMode ? 'bg-dark-surface border-dark-border' : 'bg-white border-slate-200'} border rounded-xl shadow-xl z-50 animate-in fade-in slide-in-from-top-2 duration-200 overflow-hidden`}>
                    {/* User Info Header */}
                    <div className={`p-4 ${isDarkMode ? 'bg-dark' : 'bg-slate-50'}`}>
                        <div className="flex items-center gap-3">
                            <div className={`w-12 h-12 rounded-full border-2 overflow-hidden flex items-center justify-center ${isDarkMode ? 'border-primary/30 bg-dark-surface' : 'border-primary/30 bg-white'
                                }`}>
                                {user?.image ? (
                                    <img src={user.image} className="w-full h-full object-cover" alt="Avatar" />
                                ) : (
                                    <span className="text-lg font-bold text-primary">
                                        {user ? getInitials(user.name) : 'U'}
                                    </span>
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className={`font-bold truncate ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                                    {user?.name || 'Usuário'}
                                </p>
                                <p className={`text-xs truncate ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                                    {user?.email || 'email@exemplo.com'}
                                </p>
                                <span className={`inline-block mt-1 px-2 py-0.5 text-[10px] font-bold rounded-full ${isDarkMode ? 'bg-primary/20 text-primary' : 'bg-primary/10 text-primary'
                                    }`}>
                                    {user?.role || 'Membro'}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Menu Items */}
                    <div className="p-2">
                        {menuItems.map((item, index) => (
                            <button
                                key={index}
                                onClick={item.action}
                                className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors ${isDarkMode
                                        ? 'hover:bg-white/5 text-slate-300 hover:text-white'
                                        : 'hover:bg-slate-50 text-slate-600 hover:text-slate-900'
                                    }`}
                            >
                                <div className={`p-2 rounded-lg ${isDarkMode ? 'bg-dark' : 'bg-slate-100'}`}>
                                    <item.icon size={16} />
                                </div>
                                <div className="flex-1 text-left">
                                    <p className="text-sm font-medium">{item.label}</p>
                                    <p className={`text-xs ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                                        {item.description}
                                    </p>
                                </div>
                                {item.toggle ? (
                                    <div className={`w-8 h-5 rounded-full flex items-center px-0.5 transition-colors ${isDarkMode ? 'bg-primary justify-end' : 'bg-slate-300 justify-start'
                                        }`}>
                                        <div className="w-4 h-4 rounded-full bg-white shadow" />
                                    </div>
                                ) : (
                                    <ChevronRight size={16} className={isDarkMode ? 'text-slate-600' : 'text-slate-300'} />
                                )}
                            </button>
                        ))}
                    </div>

                    {/* Logout Button */}
                    <div className={`p-2 border-t ${isDarkMode ? 'border-dark-border' : 'border-slate-100'}`}>
                        <button
                            onClick={() => { onLogout(); setIsOpen(false); }}
                            className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors ${isDarkMode
                                    ? 'hover:bg-red-500/10 text-red-400 hover:text-red-300'
                                    : 'hover:bg-red-50 text-red-500 hover:text-red-600'
                                }`}
                        >
                            <div className={`p-2 rounded-lg ${isDarkMode ? 'bg-red-500/10' : 'bg-red-50'}`}>
                                <LogOut size={16} />
                            </div>
                            <div className="flex-1 text-left">
                                <p className="text-sm font-medium">Sair</p>
                                <p className={`text-xs ${isDarkMode ? 'text-red-400/60' : 'text-red-400'}`}>
                                    Encerrar sessão
                                </p>
                            </div>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
