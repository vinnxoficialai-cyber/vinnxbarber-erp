import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Briefcase, Users, Calendar, DollarSign, Settings,
  Home, ShoppingBag, PiggyBank, UserCircle, Wrench, Kanban, CheckSquare,
  FileSpreadsheet, FileSignature, Layers, UserCog, Landmark, Star, Clock,
  Sun, Key, Target, Wallet, CreditCard, Scissors, Package, ClipboardList
} from 'lucide-react';
import { SectionModal } from './SectionModal';
import { useMenuBadges } from '../hooks/useMenuBadges';
import { useAppData } from '../context/AppDataContext';
import { usePermissions } from '../hooks/usePermissions';
import { TeamMember } from '../types';

interface BottomNavProps {
  onOpenMenu: () => void;
  currentUser?: TeamMember;
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
      { icon: Layers, label: 'Serviços', path: '/services' },
      { icon: Package, label: 'Produtos', path: '/products' },
      { icon: Briefcase, label: 'Projetos', path: '/projects' },
    ],
  },
  {
    id: 'financeiro',
    label: 'Financeiro',
    icon: PiggyBank,
    items: [
      { icon: DollarSign, label: 'Financeiro', path: '/finance' },
      { icon: Wallet, label: 'Contas Bancárias', path: '/contas-bancarias' },
      { icon: Landmark, label: 'Receitas/Despesas', path: '/accounts' },
      { icon: FileSpreadsheet, label: 'Contas a Pagar', path: '/contas-pagar' },
    ],
  },
  {
    id: 'equipe',
    label: 'Equipe',
    icon: UserCircle,
    items: [
      { icon: UserCog, label: 'Equipe', path: '/team' },
      { icon: Star, label: 'Avaliações', path: '/avaliacoes' },
      { icon: Clock, label: 'Banco de Horas', path: '/banco-horas' },
      { icon: Sun, label: 'Férias', path: '/ferias' },
      { icon: Target, label: 'Metas', path: '/metas' },
      { icon: CreditCard, label: 'Folha de Pag.', path: '/folha-pagamento' },
    ],
  },
  {
    id: 'sistema',
    label: 'Sistema',
    icon: Wrench,
    items: [
      { icon: Key, label: 'Credenciais', path: '/credenciais' },
      { icon: Settings, label: 'Configurações', path: '/settings' },
    ],
  },
];

export const BottomNav: React.FC<BottomNavProps> = ({ onOpenMenu, currentUser }) => {
  const { permissions: contextPermissions } = useAppData();
  const { canAccess } = usePermissions(currentUser || null, contextPermissions);
  const [activeSection, setActiveSection] = useState<NavSection | null>(null);
  const location = useLocation();
  const menuBadges = useMenuBadges();

  // Refs for measuring button positions
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Sliding indicator state
  const [indicatorStyle, setIndicatorStyle] = useState<{ left: number; width: number } | null>(null);

  // Check if user has access to a page (centralized)
  const hasAccess = (path: string): boolean => canAccess(path);

  // Filter sections and items based on permissions
  const filteredSections = useMemo(() => {
    return SECTIONS.map(section => ({
      ...section,
      items: section.items.filter(item => hasAccess(item.path))
    })).filter(section => section.items.length > 0);
  }, [currentUser, contextPermissions]);

  // Calculate section badge count
  const getSectionBadgeCount = (section: NavSection) => {
    return section.items.reduce((total, item) => total + (menuBadges[item.path] || 0), 0);
  };

  // Find active section index
  const activeSectionId = useMemo(() => {
    const found = filteredSections.find(s => s.items.some(i => location.pathname === i.path));
    return found?.id || null;
  }, [location.pathname, filteredSections]);

  // Update indicator position when active section changes
  useEffect(() => {
    if (!activeSectionId || !containerRef.current) {
      setIndicatorStyle(null);
      return;
    }
    const el = buttonRefs.current[activeSectionId];
    if (el && containerRef.current) {
      const containerRect = containerRef.current.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      setIndicatorStyle({
        left: elRect.left - containerRect.left,
        width: elRect.width,
      });
    }
  }, [activeSectionId, filteredSections]);

  // Recalculate on resize
  useEffect(() => {
    const handleResize = () => {
      if (!activeSectionId || !containerRef.current) return;
      const el = buttonRefs.current[activeSectionId];
      if (el && containerRef.current) {
        const containerRect = containerRef.current.getBoundingClientRect();
        const elRect = el.getBoundingClientRect();
        setIndicatorStyle({
          left: elRect.left - containerRect.left,
          width: elRect.width,
        });
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [activeSectionId]);

  const SectionButton = ({ section }: { section: NavSection }) => {
    const SectionIcon = section.icon;
    const isActive = activeSectionId === section.id;
    const isModalOpen = activeSection?.id === section.id;
    const badgeCount = getSectionBadgeCount(section);

    return (
      <button
        onClick={() => setActiveSection(prev => prev?.id === section.id ? null : section)}
        className={`relative flex flex-col items-center justify-center w-full py-2 transition-all duration-300 ease-out
          ${isActive
            ? 'text-primary'
            : isModalOpen
              ? 'text-primary/70'
              : 'text-slate-400 dark:text-slate-500 active:scale-90'
          }`}
      >
        {/* Modal-open subtle pulse */}
        {isModalOpen && !isActive && (
          <div className="absolute inset-0 bg-primary/5 dark:bg-primary/8 rounded-full animate-pulse" />
        )}

        <div className={`relative z-10 flex flex-col items-center gap-0.5 transition-transform duration-300 ${isModalOpen && !isActive ? 'scale-95' : ''}`}>
          <SectionIcon size={22} strokeWidth={isActive ? 2.5 : 1.8} />
          <span className={`text-[10px] font-medium leading-tight transition-opacity duration-200 ${isActive || isModalOpen ? 'opacity-100' : 'opacity-70'}`}>
            {section.label}
          </span>
        </div>

        {badgeCount > 0 && (
          <span className="absolute top-0.5 right-0.5 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white dark:ring-dark-surface z-20" />
        )}
      </button>
    );
  };

  return (
    <>
      {/* Section Modal */}
      <SectionModal
        section={activeSection}
        isOpen={!!activeSection}
        onClose={() => setActiveSection(null)}
        isDarkMode={document.documentElement.classList.contains('dark')}
        badges={menuBadges}
      />

      {/* Gradient Fade Out */}
      <div className="fixed bottom-0 left-0 w-full h-28 bg-gradient-to-t from-slate-50 via-slate-50/80 to-transparent dark:from-dark dark:via-dark/80 dark:to-transparent pointer-events-none z-40 lg:hidden" />

      {/* Bottom Bar — Capsule/Stadium shape */}
      <div
        className="fixed left-1/2 -translate-x-1/2 w-[92%] max-w-[420px] bg-white/85 dark:bg-dark-surface/85 backdrop-blur-2xl rounded-full shadow-lg shadow-black/8 dark:shadow-black/40 border border-white/30 dark:border-white/10 z-50 lg:hidden p-1.5"
        style={{ bottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
      >
        <div ref={containerRef} className="relative flex items-center justify-around h-[52px]">

          {/* Sliding Indicator — single shared element */}
          {indicatorStyle && (
            <div
              className="absolute top-0 bottom-0 bg-primary/10 dark:bg-primary/15 rounded-full z-0"
              style={{
                left: indicatorStyle.left,
                width: indicatorStyle.width,
                transition: 'left 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), width 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
              }}
            />
          )}

          {/* Dynamically show sections based on permissions */}
          {filteredSections.slice(0, 5).map((section) => (
            <div
              key={section.id}
              ref={(el) => { buttonRefs.current[section.id] = el; }}
              className="flex-1 relative z-10"
            >
              <SectionButton section={section} />
            </div>
          ))}

        </div>
      </div>
    </>
  );
};