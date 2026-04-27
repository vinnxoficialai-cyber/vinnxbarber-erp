import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Briefcase, Users, Calendar, DollarSign, Settings,
  Layers, ChevronLeft, ChevronRight, UserCog, CheckSquare,
  FileSpreadsheet, FileSignature, LogOut, Kanban, Star,
  Clock, Sun, Key, Target, Wallet, CreditCard, ChevronDown, ChevronUp,
  Home, ShoppingBag, PiggyBank, UserCircle, Wrench, Scissors, Package, ClipboardList, Crown, BarChart3, Building2, Receipt, Globe, Bell
} from 'lucide-react';
import { TeamMember } from '../types';
import { safeStorage } from '../utils';
import { useMenuBadges } from '../hooks/useMenuBadges';
import { useAppData } from '../context/AppDataContext';
import { usePermissions } from '../hooks/usePermissions';

interface SidebarProps {
  isOpen: boolean;
  toggleSidebar: () => void;
  currentUser?: TeamMember;
  onLogout?: () => void;
}

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

const SECTIONS: NavSection[] = [
  {
    id: 'principal',
    label: 'Principal',
    icon: Home,
    items: [
      { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
      { icon: Calendar, label: 'Agenda', path: '/agenda' },
      { icon: CheckSquare, label: 'Tarefas', path: '/tasks' },
      { icon: ClipboardList, label: 'Comanda', path: '/comanda' },
    ],
  },
  {
    id: 'comercial',
    label: 'Comercial',
    icon: ShoppingBag,
    items: [
      { icon: Users, label: 'Clientes', path: '/clients' },
      { icon: Kanban, label: 'Pipeline', path: '/pipeline' },
      { icon: FileSpreadsheet, label: 'Orçamentos', path: '/budgets' },
      { icon: FileSignature, label: 'Contratos', path: '/contracts' },
      { icon: Briefcase, label: 'Projetos', path: '/projects' },
      { icon: Layers, label: 'Serviços', path: '/services' },
      { icon: Package, label: 'Produtos', path: '/products' },
      { icon: Crown, label: 'Assinaturas', path: '/assinaturas' },
      { icon: Bell, label: 'Notificações', path: '/notificacoes' },
    ],
  },
  {
    id: 'financeiro',
    label: 'Financeiro',
    icon: PiggyBank,
    items: [
      { icon: DollarSign, label: 'Financeiro', path: '/finance' },
      { icon: CreditCard, label: 'Contas Bancárias', path: '/contas-bancarias' },
      { icon: FileSpreadsheet, label: 'Contas a Pagar', path: '/contas-pagar' },
      { icon: Receipt, label: 'Nota Fiscal', path: '/nota-fiscal' },
    ],
  },
  {
    id: 'equipe',
    label: 'Equipe',
    icon: UserCircle,
    items: [
      { icon: Calendar, label: 'Expedientes', path: '/expedientes' },
      { icon: UserCog, label: 'Membros', path: '/team' },
      { icon: Star, label: 'Avaliações', path: '/avaliacoes' },
      { icon: Clock, label: 'Banco de Horas', path: '/banco-horas' },
      { icon: Sun, label: 'Férias', path: '/ferias' },
      { icon: Wallet, label: 'Folha Pagamento', path: '/folha-pagamento' },
      { icon: Target, label: 'Metas', path: '/metas' },
    ],
  },
  {
    id: 'sistema',
    label: 'Sistema',
    icon: Wrench,
    items: [
      { icon: BarChart3, label: 'Relatórios', path: '/relatorios' },
      { icon: Building2, label: 'Unidades', path: '/unidades' },
      { icon: Globe, label: 'Personalizar', path: '/personalizar' },
      { icon: Key, label: 'Credenciais', path: '/credenciais' },
      { icon: Settings, label: 'Configurações', path: '/settings' },
    ],
  },
];

const STORAGE_KEY = 'erp_sidebar_sections';

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, toggleSidebar, currentUser, onLogout }) => {
  const { settings, permissions: contextPermissions } = useAppData();
  const { canAccess } = usePermissions(currentUser || null, contextPermissions);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // UI State can persist in localStorage as user preference
  const [openSections, setOpenSections] = useState<Set<string>>(() => {
    const saved = safeStorage.get<string[]>(STORAGE_KEY, ['principal', 'comercial']);
    return new Set(saved);
  });

  const location = useLocation();
  const menuBadges = useMenuBadges();

  // Company Branding
  const companyName = settings?.company?.name || 'VINNX';
  const companyLogo = settings?.company?.logo;

  // Check if user has access to a page (centralized)
  const hasAccess = (path: string): boolean => canAccess(path);

  // Filter sections and items based on permissions
  const filteredSections = SECTIONS.map(section => ({
    ...section,
    items: section.items.filter(item => hasAccess(item.path))
  })).filter(section => section.items.length > 0);

  // Get section badge count
  const getSectionBadgeCount = (section: NavSection) => {
    return section.items.reduce((total, item) => total + (menuBadges[item.path] || 0), 0);
  };

  // Persist open sections
  useEffect(() => {
    safeStorage.set(STORAGE_KEY, Array.from(openSections));
  }, [openSections]);

  // Auto-open section containing current route
  useEffect(() => {
    const currentSection = SECTIONS.find(section =>
      section.items.some(item => item.path === location.pathname)
    );
    if (currentSection && !openSections.has(currentSection.id)) {
      setOpenSections(prev => new Set([...prev, currentSection.id]));
    }
  }, [location.pathname]);

  const toggleCollapse = () => setIsCollapsed(!isCollapsed);

  const toggleSection = (sectionId: string) => {
    setOpenSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId);
      } else {
        newSet.add(sectionId);
      }
      return newSet;
    });
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  };

  const isItemActive = (path: string) => location.pathname === path;

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 lg:hidden backdrop-blur-sm transition-opacity"
          onClick={toggleSidebar}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-30 
          bg-white dark:bg-dark-surface border-r border-slate-200 dark:border-dark-border 
          text-slate-800 dark:text-slate-200 
          transition-all duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          ${isCollapsed ? 'w-20' : 'w-64'}
          flex flex-col h-screen shadow-2xl lg:shadow-none
        `}
      >
        {/* Header */}
        <div className="h-16 flex items-center justify-center border-b border-slate-200 dark:border-dark-border relative transition-all">
          {!isCollapsed ? (
            <div className="flex items-center gap-2.5 animate-in fade-in duration-300">
              {companyLogo ? (
                <img src={companyLogo} alt={companyName} className="w-8 h-8 object-contain flex-shrink-0" />
              ) : (
                <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center shadow-lg shadow-primary/30 flex-shrink-0">
                  <span className="font-bold text-white">{companyName.charAt(0)}</span>
                </div>
              )}
              <div className="w-px h-5 bg-slate-200 dark:bg-dark-border flex-shrink-0" />
              <span className="font-semibold text-xs leading-tight text-slate-700 dark:text-slate-200 max-w-[130px] line-clamp-2">{companyName}</span>
            </div>
          ) : (
            <>
              {companyLogo ? (
                <img src={companyLogo} alt={companyName} className="w-8 h-8 object-contain" />
              ) : (
                <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/30 animate-in fade-in duration-300">
                  <span className="font-bold text-white text-xl">{companyName.charAt(0)}</span>
                </div>
              )}
            </>
          )}

          {/* Collapse Toggle (Desktop Only) */}
          <button
            onClick={toggleCollapse}
            className="absolute -right-3 top-6 hidden lg:flex bg-white dark:bg-dark-surface text-slate-400 hover:text-primary p-1 rounded-full border border-slate-200 dark:border-dark-border shadow-sm transition-colors z-50"
          >
            {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>

          {/* Close Button (Mobile Only) */}
          <button onClick={toggleSidebar} className="lg:hidden absolute right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <ChevronLeft size={24} />
          </button>
        </div>

        {/* Navigation with Sections */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-2 custom-scrollbar overflow-x-hidden">
          {filteredSections.map((section) => {
            const SectionIcon = section.icon;
            const isSectionOpen = openSections.has(section.id);
            const hasActiveItem = section.items.some(item => isItemActive(item.path));
            const sectionBadgeCount = getSectionBadgeCount(section);

            return (
              <div key={section.id} className="space-y-1">
                {/* Section Header */}
                <button
                  onClick={() => !isCollapsed && toggleSection(section.id)}
                  className={`
                    w-full flex items-center rounded-lg transition-all duration-200 group
                    ${isCollapsed ? 'justify-center px-2 py-2' : 'justify-between px-3 py-2'}
                    ${hasActiveItem
                      ? 'bg-primary/5 text-primary'
                      : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-600 dark:hover:text-slate-300'
                    }
                  `}
                  title={isCollapsed ? section.label : ''}
                >
                  <div className="flex items-center gap-2 relative">
                    <SectionIcon size={18} className="flex-shrink-0" />
                    {isCollapsed && sectionBadgeCount > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                        {sectionBadgeCount > 9 ? '9+' : sectionBadgeCount}
                      </span>
                    )}
                    {!isCollapsed && (
                      <span className="text-xs font-bold uppercase tracking-wider">{section.label}</span>
                    )}
                  </div>
                  {!isCollapsed && (
                    <div className="flex items-center gap-2">
                      {sectionBadgeCount > 0 && (
                        <span className="w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                          {sectionBadgeCount > 9 ? '9+' : sectionBadgeCount}
                        </span>
                      )}
                      <span className="text-slate-300 dark:text-slate-600">
                        {isSectionOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </span>
                    </div>
                  )}
                </button>

                {/* Section Items */}
                {(isSectionOpen || isCollapsed) && (
                  <div className={`space-y-0.5 ${!isCollapsed ? 'ml-2 pl-3 border-l border-slate-200 dark:border-dark-border' : ''}`}>
                    {section.items.map((item) => {
                      const itemBadge = menuBadges[item.path] || 0;
                      return (
                        <NavLink
                          key={item.path}
                          to={item.path}
                          onClick={() => window.innerWidth < 1024 && toggleSidebar()}
                          className={({ isActive }) =>
                            `flex items-center rounded-lg transition-all duration-200 group
                            ${isCollapsed ? 'justify-center px-2 py-2.5' : 'justify-between px-3 py-2'}
                            ${isActive
                              ? 'bg-primary/10 text-primary font-semibold'
                              : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-slate-100'
                            }`
                          }
                          title={isCollapsed ? item.label : ''}
                        >
                          <div className="flex items-center gap-3 relative">
                            <item.icon size={18} className={`flex-shrink-0 transition-transform duration-200 ${isCollapsed ? '' : 'group-hover:scale-110'}`} />
                            {isCollapsed && itemBadge > 0 && (
                              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 rounded-full" />
                            )}
                            {!isCollapsed && <span className="text-sm truncate">{item.label}</span>}
                          </div>
                          {!isCollapsed && itemBadge > 0 && (
                            <span className="w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                              {itemBadge > 9 ? '9+' : itemBadge}
                            </span>
                          )}
                        </NavLink>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Footer User Profile */}
        <div className="p-4 border-t border-slate-200 dark:border-dark-border">
          <div className={`flex items-center transition-all ${isCollapsed ? 'justify-center flex-col gap-2' : 'gap-3'}`}>
            <div className="w-9 h-9 rounded-full bg-primary/20 dark:bg-primary/30 border border-primary/30 overflow-hidden flex-shrink-0 flex items-center justify-center">
              {currentUser?.image ? (
                <img src={currentUser.image} alt={currentUser.name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-sm font-bold text-primary">{currentUser ? getInitials(currentUser.name) : 'U'}</span>
              )}
            </div>

            {!isCollapsed && (
              <div className="flex-1 min-w-0 animate-in fade-in duration-300">
                <p className="text-sm font-semibold text-slate-800 dark:text-white truncate">{currentUser?.name || 'Usuário'}</p>
                <p className="text-[10px] uppercase font-bold text-slate-400 truncate">{currentUser?.role || 'Membro'}</p>
              </div>
            )}

            <button
              onClick={onLogout}
              className={`text-slate-400 hover:text-red-500 transition-colors ${isCollapsed ? '' : 'ml-auto'}`}
              title="Sair"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};