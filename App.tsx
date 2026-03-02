import React, { useState, useEffect, useCallback } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Sidebar } from './components/Sidebar';
import { BottomNav } from './components/BottomNav';
import { authService } from './lib/auth';
import { NotificationsDropdown } from './components/NotificationsDropdown';
import { ProfileDropdown } from './components/ProfileDropdown';
import { ConfirmProvider } from './components/ConfirmModal';
import { PasswordConfirmProvider } from './components/PasswordConfirmModal';
import { ToastProvider } from './components/Toast';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LoadingScreen } from './components/LoadingScreen';
import { UnitSelector } from './components/UnitSelector';
import { Menu, Settings as SettingsIcon, Sun, Moon } from 'lucide-react';
import { Dashboard } from './pages/Dashboard';
import { Projects } from './pages/Projects';
import { Finance } from './pages/Finance';
import { Clients } from './pages/Clients';
import { Agenda } from './pages/Agenda';
import { Team } from './pages/Team';
import { Tasks } from './pages/Tasks';
import { Budgets } from './pages/Budgets';
import { Contracts } from './pages/Contracts';
import { PassivoCirculante } from './pages/PassivoCirculante';
import { AtivosCirculantes } from './pages/AtivosCirculantes';
import { Settings } from './pages/Settings';
import { Services } from './pages/Services';
import { ComandaPage } from './pages/Comanda';
import { Produtos } from './pages/Produtos';
import { Login } from './pages/Login';
import { Pipeline } from './pages/Pipeline';
import { ContasBancarias } from './pages/ContasBancarias';
import { ContasPagar } from './pages/ContasPagar';
import { Avaliacoes } from './pages/Avaliacoes';
import { BancoHoras } from './pages/BancoHoras';
import { Ferias } from './pages/Ferias';
import { Credenciais } from './pages/Credenciais';
import { Metas } from './pages/Metas';
import { FolhaPagamento } from './pages/FolhaPagamento';
import { Assinaturas } from './pages/Assinaturas';
import { Expedientes } from './pages/Expedientes';
import { Relatorios } from './pages/Relatorios';
import { Unidades } from './pages/Unidades';
import NotaFiscal from './pages/NotaFiscal';
import { SiteEditor } from './pages/SiteEditor';
import { UnitProvider } from './context/UnitContext';
import { useAppData } from './hooks/useAppData';
import { useDynamicFavicon } from './hooks/useDynamicFavicon';
import { Client, Contract, TeamMember, PersonalTask, Budget, ProjectTask, Service, CompanySettings, Transaction, BankAccount } from './types';

// Placeholder components for routes not fully implemented in this demo
const PlaceholderPage = ({ title }: { title: string }) => (
  <div className="flex flex-col items-center justify-center h-[60vh] text-center text-slate-500 dark:text-slate-400">
    <div className="bg-slate-100 dark:bg-dark-surface p-6 rounded-full mb-4 border border-slate-200 dark:border-dark-border">
      <SettingsIcon size={48} className="text-slate-400 dark:text-slate-500" />
    </div>
    <h2 className="text-2xl font-bold text-slate-800 dark:text-white">{title}</h2>
    <p className="mt-2 max-w-md">
      Este módulo está em desenvolvimento. Em breve você poderá gerenciar {title.toLowerCase()} aqui.
    </p>
  </div>
);

interface LayoutProps {
  children: React.ReactNode;
  isDarkMode: boolean;
  toggleTheme: () => void;
  user: TeamMember | null;
  onLogout: () => void;
}

const Layout: React.FC<LayoutProps> = ({ children, isDarkMode, toggleTheme, user, onLogout }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-dark font-sans text-slate-900 dark:text-dark-text transition-colors duration-200">
      <Sidebar isOpen={sidebarOpen} toggleSidebar={() => setSidebarOpen(!sidebarOpen)} currentUser={user} onLogout={onLogout} />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Top Header */}
        <header className="h-16 bg-white dark:bg-dark-surface border-b border-slate-200 dark:border-dark-border flex items-center justify-between px-4 lg:px-8 z-10 transition-colors duration-200">
          {/* Left: hamburger + animated VINNX logo */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-dark-border rounded-lg"
            >
              <Menu size={24} />
            </button>
            {/* Animated VINNX Logo */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              xmlSpace="preserve"
              viewBox="0 0 13929.2 2791.21"
              className="header-logo h-5 w-auto hidden sm:block text-slate-800 dark:text-white"
              style={{ shapeRendering: 'geometricPrecision', fillRule: 'evenodd', clipRule: 'evenodd' }}
            >
              <g>
                <path className="svg-elem-1" d="M10575.96 2770.97c1.81,-67.93 -6.84,-759.75 0.71,-1074.33 -0.71,-312.44 187.28,-481.99 567.14,-481.99l0.12 -419.71c-284.82,0 -393.93,-2.07 -524.85,182.93 -6.84,-10.88 -90.08,-171.34 -95.66,-182.93l-406.52 0 0 1976.03 459.07 0z" />
                <path className="svg-elem-2" d="M986.96 822.41c538.09,0 974.29,436.2 974.29,974.28 0,538.09 -436.2,974.29 -974.29,974.29 -194.4,0 -363.1,-73.47 -515.13,-171.57 -268.78,-173.43 -459.15,-459.04 -459.15,-802.72 0,-538.08 436.2,-974.28 974.28,-974.28zm0 436.54c296.99,0 537.74,240.75 537.74,537.74 0,296.99 -240.75,537.74 -537.74,537.74 -296.99,0 -537.74,-240.75 -537.74,-537.74 0,-296.99 240.75,-537.74 537.74,-537.74z" />
                <path className="svg-elem-3" d="M3159.77 822.38c224.55,0 442.51,58.83 607.26,186.46 230.04,178.2 367.02,474.29 367.02,787.82 0,327.08 -181.77,618.34 -429,795.04 -159.5,113.97 -334.27,179.25 -545.29,179.25 -538.08,0 -974.28,-436.2 -974.28,-974.29 0,-538.08 436.2,-974.28 974.28,-974.28zm0 436.54c296.99,0 537.74,240.75 537.74,537.74 0,296.99 -240.75,537.74 -537.74,537.74 -296.99,0 -537.74,-240.75 -537.74,-537.74 0,-296.99 240.75,-537.74 537.74,-537.74z" />
                <path className="svg-elem-4" d="M-0 232.77l0 2539.65 445.84 -191.06 0.04 -2581.37c0,0 -437.87,229.95 -445.88,232.77z" />
                <path className="svg-elem-5" d="M4168.33 794.94l0 1975.96 -445.74 -192.01 0 -1462.39 0 -139.54c0,0 437.73,-184.83 445.74,-182.03z" />
                <path className="svg-elem-6" d="M4932.59 2770.97c1.81,-67.93 -6.84,-759.75 0.71,-1074.33 -0.71,-312.44 187.28,-481.99 567.14,-481.99l0.12 -419.71c-284.82,0 -393.93,-2.07 -524.85,182.93 -6.84,-10.88 -90.08,-171.34 -95.66,-182.93l-406.52 0 0 1976.03 459.07 0z" />
                <path className="svg-elem-7" d="M6694.19 822.41c538.08,0 974.28,436.2 974.28,974.28 0,538.09 -436.2,974.29 -974.28,974.29 -194.41,0 -363.11,-73.47 -515.14,-171.57 -268.78,-173.43 -459.15,-459.04 -459.15,-802.72 0,-538.08 436.2,-974.28 974.29,-974.28zm0 436.54c296.99,0 537.74,240.75 537.74,537.74 0,296.99 -240.75,537.74 -537.74,537.74 -296.99,0 -537.74,-240.75 -537.74,-537.74 0,-296.99 240.75,-537.74 537.74,-537.74z" />
                <path className="svg-elem-8" d="M5707.22 232.77l0 2539.65 445.84 -191.06 0.05 -2581.37c0,0 -437.87,229.95 -445.89,232.77z" />
                <path className="svg-elem-9" d="M8883.2 822.41c436.12,0 805.27,286.55 929.53,681.63 29.06,92.38 44.76,190.69 44.76,292.65 0,52.14 -4.14,103.3 -12.02,153.22l-1336.29 0.02c0,0 229.95,-437.87 232.76,-445.89l592.44 0c-95.88,-147.51 -262.12,-245.09 -451.18,-245.09 -296.99,0 -537.74,240.75 -537.74,537.74 0,296.99 240.75,537.74 537.74,537.74 205.64,0 384.29,-115.44 474.74,-285.05l322.19 307.78c-176.33,250.29 -467.49,413.82 -796.93,413.82 -194.4,0 -363.1,-73.47 -515.13,-171.57 -268.78,-173.43 -459.15,-459.04 -459.15,-802.72 0,-538.08 436.2,-974.28 974.28,-974.28z" />
                <path className="svg-elem-10" d="M12954.05 2473.8l-974.83 -1678.86 -369.05 0 1159.51 1996.27 184.37 -317.41zm-184.39 -953.1c140.47,-241.94 280.97,-483.86 421.46,-725.77l-842.93 0 421.47 725.77zm184.51 317.77c61.48,105.87 122.94,211.74 184.42,317.62l790.61 -1361.15 -369.08 0c-201.91,347.88 -403.96,695.69 -605.94,1043.53z" />
              </g>
            </svg>
          </div>

          {/* Right: UnitSelector + controls */}
          <div className="flex items-center gap-2 sm:gap-3">
            <UnitSelector isDarkMode={isDarkMode} />

            <div className="h-8 w-[1px] bg-slate-200 dark:bg-dark-border hidden sm:block"></div>

            <button
              onClick={toggleTheme}
              className="p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-dark-border rounded-lg transition-colors"
              title={isDarkMode ? "Modo Claro" : "Modo Escuro"}
            >
              {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>

            <NotificationsDropdown isDarkMode={isDarkMode} />

            <div className="h-8 w-[1px] bg-slate-200 dark:bg-dark-border hidden sm:block"></div>

            <ProfileDropdown
              user={user}
              isDarkMode={isDarkMode}
              onToggleTheme={toggleTheme}
              onLogout={onLogout}
            />
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 overflow-auto p-4 lg:p-8 pb-32 lg:pb-8">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>

        {/* Mobile Bottom Navigation */}
        <BottomNav onOpenMenu={() => setSidebarOpen(true)} currentUser={user} />
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [currentUser, setCurrentUser] = useState<TeamMember | null>(null);

  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

  // Update favicon when company logo changes
  useDynamicFavicon();

  // App State from Supabase
  // Company settings management via AppData
  const {
    clients, setClients,
    contracts, setContracts,
    members, setMembers,
    transactions, setTransactions,
    personalTasks, setPersonalTasks,
    calendarEvents, setCalendarEvents,
    budgets, setBudgets,
    services, setServices,
    projects, setProjects,
    projectTasks, setProjectTasks,
    bankAccounts, setBankAccounts,
    loading: dataLoading,
    error: dataError,
    refresh,
    settings, setAppSettings
  } = useAppData();

  // Alias for backward compatibility
  const tasks = personalTasks;
  const setTasks = setPersonalTasks;
  const accounts = bankAccounts;
  const setAccounts = setBankAccounts;

  // Helper for company settings (use context settings, fallback to empty defaults only when fully loaded)
  const companySettings = settings?.company || {
    name: '', cnpj: '', email: '', phone: '', address: '', logo: '', primaryColor: '#00bf62'
  } as CompanySettings;
  const setCompanySettings = useCallback((newSettings: CompanySettings) => {
    // This is a wrapper to update via setAppSettings
    if (settings) {
      setAppSettings({ ...settings, company: newSettings });
    } else {
      // If settings not loaded yet, create a minimal SystemSettings
      setAppSettings({
        company: newSettings,
        hr: {} as any,
        financial: {} as any,
        projects: {} as any,
        notifications: {} as any,
        agenda: {} as any,
      });
    }
  }, [settings, setAppSettings]);

  // Auth Persistence
  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      try {
        // Race between auth check and 5s timeout
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Auth check timed out')), 5000)
        );

        const authPromise = authService.getCurrentUser();

        // Wait for either auth or timeout
        // We use Promise.race to ensure we don't wait forever
        const user = await Promise.race([authPromise, timeoutPromise]) as Awaited<ReturnType<typeof authService.getCurrentUser>>;

        if (mounted && user) {
          setCurrentUser(authService.toTeamMember(user));
        }
      } catch (error) {
        console.error("Auth check failed or timed out:", error);
      } finally {
        if (mounted) {
          setIsLoadingAuth(false);
        }
      }
    };

    initAuth();

    const { data: { subscription } } = authService.onAuthStateChange((user) => {
      if (!mounted) return;
      if (user) {
        setCurrentUser(authService.toTeamMember(user));
      } else {
        setCurrentUser(null);
      }
      setIsLoadingAuth(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);



  // Initialize theme
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // Sync currentUser to localStorage for pages that need it (Settings, Team)
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('erp_current_user', JSON.stringify(currentUser));
    } else {
      localStorage.removeItem('erp_current_user');
    }
  }, [currentUser]);

  const toggleTheme = () => setIsDarkMode(!isDarkMode);

  // Dummy notification handler
  const handleAddNotification = (title: string, message: string, type: 'info' | 'success' | 'warning') => {
    console.log(`Notification: [${type}] ${title} - ${message}`);
  };

  const handleLogin = (user: TeamMember) => {
    setCurrentUser(user);
    // Re-load all data now that we have an authenticated session
    refresh();
  };

  const handleLogout = () => {
    authService.signOut();
    setCurrentUser(null);
  };

  if (isLoadingAuth) {
    return <LoadingScreen message="Verificando autenticação..." companyName={companySettings.name || undefined} />;
  }

  if (!currentUser) {
    return <Login onLogin={handleLogin} />;
  }

  // Show loading screen while data is being fetched from Supabase
  if (dataLoading) {
    return <LoadingScreen message="Carregando dados do sistema..." companyName={companySettings.name || undefined} />;
  }

  if (dataError) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-50 dark:bg-dark text-slate-900 dark:text-white p-4">
        <div className="bg-rose-50 dark:bg-rose-900/20 p-6 rounded-2xl border border-rose-200 dark:border-rose-800/50 max-w-md text-center">
          <h2 className="text-xl font-bold text-rose-600 dark:text-rose-400 mb-2">Erro ao carregar dados</h2>
          <p className="text-slate-600 dark:text-slate-300 mb-4 text-sm">{dataError.message}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition-colors text-sm font-medium"
          >
            Tentar Novamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <ToastProvider>
      <ConfirmProvider isDarkMode={isDarkMode}>
        <PasswordConfirmProvider isDarkMode={isDarkMode}>
          <HashRouter>
            <Layout isDarkMode={isDarkMode} toggleTheme={toggleTheme} user={currentUser} onLogout={handleLogout}>
              <Routes>
                <Route path="/" element={<Dashboard currentUser={currentUser} />} />
                <Route
                  path="/projects"
                  element={
                    <ProtectedRoute path="/projects" currentUser={currentUser}>
                      <Projects
                        tasks={projectTasks}
                        setTasks={setProjectTasks}
                        clients={clients}
                        isDarkMode={isDarkMode}
                        currentUser={currentUser}
                      />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/clients"
                  element={
                    <ProtectedRoute path="/clients" currentUser={currentUser}>
                      <Clients
                        clients={clients}
                        setClients={setClients}
                        members={members}
                        contracts={contracts}
                        isDarkMode={isDarkMode}
                        currentUser={currentUser}
                      />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/finance"
                  element={
                    <ProtectedRoute path="/finance" currentUser={currentUser}>
                      <Finance
                        transactions={transactions}
                        setTransactions={setTransactions}
                        isDarkMode={isDarkMode}
                      />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/passivo-circulante"
                  element={
                    <ProtectedRoute path="/passivo-circulante" currentUser={currentUser}>
                      <PassivoCirculante
                        transactions={transactions}
                        setTransactions={setTransactions}
                        isDarkMode={isDarkMode}
                      />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/ativos-circulantes"
                  element={
                    <ProtectedRoute path="/ativos-circulantes" currentUser={currentUser}>
                      <AtivosCirculantes
                        transactions={transactions}
                        setTransactions={setTransactions}
                        isDarkMode={isDarkMode}
                      />
                    </ProtectedRoute>
                  }
                />

                <Route path="/agenda" element={
                  <ProtectedRoute path="/agenda" currentUser={currentUser}>
                    <Agenda isDarkMode={isDarkMode} currentUser={currentUser} />
                  </ProtectedRoute>
                } />
                <Route
                  path="/team"
                  element={
                    <ProtectedRoute path="/team" currentUser={currentUser}>
                      <Team
                        members={members}
                        setMembers={setMembers}
                        clients={clients}
                        contracts={contracts}
                        isDarkMode={isDarkMode}
                        currentUser={currentUser}
                      />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/contracts"
                  element={
                    <ProtectedRoute path="/contracts" currentUser={currentUser}>
                      <Contracts
                        contracts={contracts}
                        setContracts={setContracts}
                        clients={clients}
                        members={members}
                        transactions={transactions}
                        setTransactions={setTransactions}
                        onAddNotification={handleAddNotification}
                        isDarkMode={isDarkMode}
                        currentUser={currentUser}
                      />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/tasks"
                  element={
                    <ProtectedRoute path="/tasks" currentUser={currentUser}>
                      <Tasks
                        tasks={tasks}
                        setTasks={setTasks}
                        members={members}
                        currentUser={currentUser}
                        isDarkMode={isDarkMode}
                      />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/budgets"
                  element={
                    <ProtectedRoute path="/budgets" currentUser={currentUser}>
                      <Budgets
                        budgets={budgets}
                        setBudgets={setBudgets}
                        clients={clients}
                        services={services}
                        isDarkMode={isDarkMode}
                      />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/services"
                  element={
                    <ProtectedRoute path="/services" currentUser={currentUser}>
                      <Services
                        services={services}
                        setServices={setServices}
                        isDarkMode={isDarkMode}
                        currentUser={currentUser}
                      />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/comanda"
                  element={
                    <ProtectedRoute path="/comanda" currentUser={currentUser}>
                      <ComandaPage
                        isDarkMode={isDarkMode}
                        currentUser={currentUser}
                      />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/products"
                  element={
                    <ProtectedRoute path="/products" currentUser={currentUser}>
                      <Produtos
                        isDarkMode={isDarkMode}
                        currentUser={currentUser}
                      />
                    </ProtectedRoute>
                  }
                />
                <Route path="/pipeline" element={
                  <ProtectedRoute path="/pipeline" currentUser={currentUser}>
                    <Pipeline clients={clients} setClients={setClients} isDarkMode={isDarkMode} currentUser={currentUser} />
                  </ProtectedRoute>
                } />
                <Route path="/contas-bancarias" element={
                  <ProtectedRoute path="/contas-bancarias" currentUser={currentUser}>
                    <ContasBancarias isDarkMode={isDarkMode} />
                  </ProtectedRoute>
                } />
                <Route path="/contas-pagar" element={
                  <ProtectedRoute path="/contas-pagar" currentUser={currentUser}>
                    <ContasPagar isDarkMode={isDarkMode} />
                  </ProtectedRoute>
                } />
                <Route path="/avaliacoes" element={
                  <ProtectedRoute path="/avaliacoes" currentUser={currentUser}>
                    <Avaliacoes members={members} currentUser={currentUser!} isDarkMode={isDarkMode} />
                  </ProtectedRoute>
                } />
                <Route path="/banco-horas" element={
                  <ProtectedRoute path="/banco-horas" currentUser={currentUser}>
                    <BancoHoras members={members} currentUser={currentUser!} isDarkMode={isDarkMode} />
                  </ProtectedRoute>
                } />
                <Route path="/ferias" element={
                  <ProtectedRoute path="/ferias" currentUser={currentUser}>
                    <Ferias members={members} currentUser={currentUser!} isDarkMode={isDarkMode} />
                  </ProtectedRoute>
                } />
                <Route path="/credenciais" element={
                  <ProtectedRoute path="/credenciais" currentUser={currentUser}>
                    <Credenciais clients={clients} currentUser={currentUser!} isDarkMode={isDarkMode} />
                  </ProtectedRoute>
                } />
                <Route path="/metas" element={
                  <ProtectedRoute path="/metas" currentUser={currentUser}>
                    <Metas members={members} contracts={contracts} clients={clients} isDarkMode={isDarkMode} currentUser={currentUser} />
                  </ProtectedRoute>
                } />
                <Route path="/folha-pagamento" element={
                  <ProtectedRoute path="/folha-pagamento" currentUser={currentUser}>
                    <FolhaPagamento members={members} isDarkMode={isDarkMode} currentUser={currentUser} />
                  </ProtectedRoute>
                } />
                <Route path="/assinaturas" element={
                  <ProtectedRoute path="/assinaturas" currentUser={currentUser}>
                    <Assinaturas isDarkMode={isDarkMode} currentUser={currentUser} />
                  </ProtectedRoute>
                } />
                <Route path="/expedientes" element={
                  <ProtectedRoute path="/expedientes" currentUser={currentUser}>
                    <Expedientes isDarkMode={isDarkMode} currentUser={currentUser} />
                  </ProtectedRoute>
                } />
                <Route path="/relatorios" element={
                  <ProtectedRoute path="/relatorios" currentUser={currentUser}>
                    <Relatorios isDarkMode={isDarkMode} currentUser={currentUser} />
                  </ProtectedRoute>
                } />
                <Route path="/unidades" element={
                  <ProtectedRoute path="/unidades" currentUser={currentUser}>
                    <Unidades isDarkMode={isDarkMode} currentUser={currentUser} />
                  </ProtectedRoute>
                } />
                <Route
                  path="/settings"
                  element={
                    <ProtectedRoute path="/settings" currentUser={currentUser}>
                      <Settings
                        company={companySettings}
                        setCompany={setCompanySettings}
                        isDarkMode={isDarkMode}
                      />
                    </ProtectedRoute>
                  }
                />
                <Route path="/nota-fiscal" element={
                  <ProtectedRoute path="/nota-fiscal" currentUser={currentUser}>
                    <NotaFiscal isDarkMode={isDarkMode} currentUser={currentUser} />
                  </ProtectedRoute>
                } />
                <Route path="/editor-site" element={
                  <ProtectedRoute path="/editor-site" currentUser={currentUser}>
                    <SiteEditor isDarkMode={isDarkMode} currentUser={currentUser} />
                  </ProtectedRoute>
                } />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Layout>
          </HashRouter>
        </PasswordConfirmProvider>
      </ConfirmProvider>
    </ToastProvider>
  );
};

export default App;