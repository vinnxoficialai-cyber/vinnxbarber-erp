import React, { useState, useEffect, useMemo } from 'react';
import {
  Building2, Save, Mail, Phone, MapPin, Globe, Users, Calendar,
  Clock, Briefcase, DollarSign, Bell, Settings2, ChevronRight,
  Plus, Trash2, Edit2, X, Check, AlertCircle, Shield, Loader2,
  Bug, Database, ChevronUp, Upload, Image as ImageIcon, Eye,
  Palette
} from 'lucide-react';
import { safeStorage } from '../utils';
import { CustomDropdown } from '../components/CustomDropdown';
import { isBase64, uploadBase64Image } from '../lib/storage';
import { generateAndUploadPWAIcons } from '../lib/pwaIconGenerator';
import { CompanySettings, HRSettings, FinancialSettings, ProjectSettings, NotificationSettings, TeamMember, RolePermission, SystemSettings } from '../types';
import { useAppData } from '../hooks/useAppData';
import { saveAppSettings, saveRolePermissions } from '../lib/dataService';
import { usePasswordConfirm } from '../components/PasswordConfirmModal';
import { useToast } from '../components/Toast';
import {
  MOCK_COMPANY_SETTINGS, MOCK_HR_SETTINGS, MOCK_FINANCIAL_SETTINGS,
  MOCK_PROJECT_SETTINGS, MOCK_NOTIFICATION_SETTINGS
} from '../constants';

type SettingsTab = 'company' | 'hr' | 'financial' | 'projects' | 'notifications' | 'permissions' | 'customize';

interface SettingsProps {
  company: CompanySettings;
  setCompany: (c: CompanySettings) => void;
  isDarkMode: boolean;
}

const TABS: { id: SettingsTab; label: string; icon: React.ElementType }[] = [
  { id: 'company', label: 'Empresa', icon: Building2 },
  { id: 'hr', label: 'RH', icon: Users },
  { id: 'financial', label: 'Financeiro', icon: DollarSign },
  { id: 'projects', label: 'Projetos', icon: Briefcase },
  { id: 'notifications', label: 'Notificações', icon: Bell },
  { id: 'permissions', label: 'Permissões', icon: Shield },
  { id: 'customize', label: 'Personalizar', icon: Palette },
];

const COLOR_PRESETS: { name: string; hex: string; rgb: { DEFAULT: string; '50': string; '500': string; '600': string; '700': string } }[] = [
  { name: 'Verde', hex: '#00bf62', rgb: { DEFAULT: '0 191 98', '50': '230 249 239', '500': '0 191 98', '600': '0 168 86', '700': '0 143 73' } },
  { name: 'Azul', hex: '#3b82f6', rgb: { DEFAULT: '59 130 246', '50': '239 246 255', '500': '59 130 246', '600': '37 99 235', '700': '29 78 216' } },
  { name: 'Branco', hex: '#ffffff', rgb: { DEFAULT: '255 255 255', '50': '250 250 252', '500': '255 255 255', '600': '243 244 246', '700': '229 231 235' } },
  { name: 'Roxo', hex: '#8b5cf6', rgb: { DEFAULT: '139 92 246', '50': '245 243 255', '500': '139 92 246', '600': '124 58 237', '700': '109 40 217' } },
  { name: 'Rosa', hex: '#ec4899', rgb: { DEFAULT: '236 72 153', '50': '253 242 248', '500': '236 72 153', '600': '219 39 119', '700': '190 24 93' } },
  { name: 'Vermelho', hex: '#ef4444', rgb: { DEFAULT: '239 68 68', '50': '254 242 242', '500': '239 68 68', '600': '220 38 38', '700': '185 28 28' } },
  { name: 'Laranja', hex: '#f97316', rgb: { DEFAULT: '249 115 22', '50': '255 247 237', '500': '249 115 22', '600': '234 88 12', '700': '194 65 12' } },
  { name: 'Ambar', hex: '#f59e0b', rgb: { DEFAULT: '245 158 11', '50': '255 251 235', '500': '245 158 11', '600': '217 119 6', '700': '180 83 9' } },
  { name: 'Dourado', hex: '#f6c927', rgb: { DEFAULT: '246 201 39', '50': '255 251 235', '500': '246 201 39', '600': '220 175 20', '700': '180 140 10' } },
  { name: 'Teal', hex: '#14b8a6', rgb: { DEFAULT: '20 184 166', '50': '240 253 250', '500': '20 184 166', '600': '13 148 136', '700': '15 118 110' } },
];

export const Settings: React.FC<SettingsProps> = ({ company, setCompany, isDarkMode }) => {
  const { settings, permissions, loading, setAppSettings, setPermissions } = useAppData();
  const [activeTab, setActiveTab] = useState<SettingsTab>('company');
  const toast = useToast();
  const passwordConfirm = usePasswordConfirm();
  const [isSaving, setIsSaving] = useState(false);

  // Local state for editing - initialize from context if available, else use mocks
  const [hrSettings, setHrSettings] = useState<HRSettings>(() => settings?.hr || MOCK_HR_SETTINGS);
  const [finSettings, setFinSettings] = useState<FinancialSettings>(() => settings?.financial || MOCK_FINANCIAL_SETTINGS);
  const [projSettings, setProjSettings] = useState<ProjectSettings>(() => settings?.projects || MOCK_PROJECT_SETTINGS);
  const [notifSettings, setNotifSettings] = useState<NotificationSettings>(() => settings?.notifications || MOCK_NOTIFICATION_SETTINGS);

  // Store initial settings to detect changes
  const initialSettingsRef = React.useRef<{
    company: CompanySettings | null;
    hr: HRSettings | null;
    fin: FinancialSettings | null;
    proj: ProjectSettings | null;
    notif: NotificationSettings | null;
  }>({ company: null, hr: null, fin: null, proj: null, notif: null });

  // Check if any settings have changed
  const hasChanges = useMemo(() => {
    const initial = initialSettingsRef.current;
    if (!initial.company) return false; // Not initialized yet
    return JSON.stringify(company) !== JSON.stringify(initial.company) ||
      JSON.stringify(hrSettings) !== JSON.stringify(initial.hr) ||
      JSON.stringify(finSettings) !== JSON.stringify(initial.fin) ||
      JSON.stringify(projSettings) !== JSON.stringify(initial.proj) ||
      JSON.stringify(notifSettings) !== JSON.stringify(initial.notif);
  }, [company, hrSettings, finSettings, projSettings, notifSettings]);

  // Permissions Types
  type Role = TeamMember['role'];
  type PermissionMatrix = Record<Role, Record<string, boolean>>;

  const PAGES_LIST = [
    { path: '/', label: 'Dashboard', section: 'Principal' },
    { path: '/agenda', label: 'Agenda', section: 'Principal' },
    { path: '/tasks', label: 'Tarefas', section: 'Principal' },
    { path: '/clients', label: 'Clientes', section: 'Comercial' },
    { path: '/pipeline', label: 'Pipeline', section: 'Comercial' },
    { path: '/budgets', label: 'Orçamentos', section: 'Comercial' },
    { path: '/contracts', label: 'Contratos', section: 'Comercial' },
    { path: '/services', label: 'Serviços', section: 'Comercial' },
    { path: '/projects', label: 'Projetos', section: 'Comercial' },
    { path: '/finance', label: 'Financeiro', section: 'Financeiro' },
    { path: '/contas-bancarias', label: 'Contas Bancárias', section: 'Financeiro' },
    { path: '/accounts', label: 'Receitas/Despesas', section: 'Financeiro' },
    { path: '/team', label: 'Equipe', section: 'Equipe' },
    { path: '/avaliacoes', label: 'Avaliações', section: 'Equipe' },
    { path: '/banco-horas', label: 'Banco de Horas', section: 'Equipe' },
    { path: '/ferias', label: 'Férias', section: 'Equipe' },
    { path: '/metas', label: 'Metas', section: 'Equipe' },
    { path: '/folha-pagamento', label: 'Folha de Pag.', section: 'Equipe' },
    { path: '/credenciais', label: 'Credenciais', section: 'Sistema' },
    { path: '/settings', label: 'Configurações', section: 'Sistema' },
  ];

  const ROLES: Role[] = ['Admin', 'Manager', 'Sales Executive', 'Support', 'Barber', 'Attendant'];

  const DEFAULT_PERMISSIONS: PermissionMatrix = {
    'Admin': Object.fromEntries(PAGES_LIST.map(p => [p.path, true])),
    'Manager': Object.fromEntries(PAGES_LIST.map(p => [p.path, true])),
    'Sales Executive': Object.fromEntries(PAGES_LIST.map(p => [p.path,
    ['/', '/agenda', '/tasks', '/clients', '/pipeline', '/budgets', '/contracts', '/services', '/projects', '/team', '/avaliacoes', '/banco-horas', '/ferias', '/metas'].includes(p.path)
    ])),
    'Support': Object.fromEntries(PAGES_LIST.map(p => [p.path,
    ['/', '/agenda', '/tasks', '/projects', '/team', '/avaliacoes', '/banco-horas', '/ferias'].includes(p.path)
    ])),
    'Barber': Object.fromEntries(PAGES_LIST.map(p => [p.path,
    ['/', '/agenda'].includes(p.path)
    ])),
    'Attendant': Object.fromEntries(PAGES_LIST.map(p => [p.path,
    ['/', '/agenda', '/tasks', '/clients', '/services', '/comanda', '/products'].includes(p.path)
    ])),
  };

  const [permissionsMatrix, setPermissionsMatrix] = useState<PermissionMatrix>(DEFAULT_PERMISSIONS);

  // Track if initial sync has happened
  const hasInitializedRef = React.useRef(false);

  // Sync state with context when loaded - handles async loading
  useEffect(() => {
    // Only sync once, and only after loading is complete with valid data
    if (!loading && settings && !hasInitializedRef.current) {
      hasInitializedRef.current = true;

      // Sync company to parent via setCompany
      if (settings.company && settings.company.name) {
        setCompany(settings.company);
      }

      // Sync other settings to local state
      if (settings.hr) setHrSettings(settings.hr);
      if (settings.financial) setFinSettings(settings.financial);
      if (settings.projects) setProjSettings(settings.projects);
      if (settings.notifications) setNotifSettings(settings.notifications);

      // Store initial settings for dirty detection
      initialSettingsRef.current = {
        company: settings.company || company,
        hr: settings.hr || hrSettings,
        fin: settings.financial || finSettings,
        proj: settings.projects || projSettings,
        notif: settings.notifications || notifSettings
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, settings]);

  useEffect(() => {
    if (permissions && permissions.length > 0) {
      const newMatrix = { ...DEFAULT_PERMISSIONS };
      permissions.forEach(p => {
        if (p.role && p.permissions) {
          // Merge with default ensuring all keys exist
          newMatrix[p.role] = {
            ...(DEFAULT_PERMISSIONS[p.role] || {}),
            ...(p.permissions as Record<string, boolean>)
          };
        }
      });
      setPermissionsMatrix(newMatrix);
    }
  }, [permissions]);

  // Get current user
  const currentUser = React.useMemo(() => {
    const userData = localStorage.getItem('erp_current_user');
    if (userData) {
      try {
        return JSON.parse(userData) as TeamMember;
      } catch {
        return null;
      }
    }
    return null;
  }, []);

  // Theme
  const textMain = isDarkMode ? 'text-slate-50' : 'text-slate-900';
  const textSub = isDarkMode ? 'text-slate-400' : 'text-slate-600';
  const bgCard = isDarkMode ? 'bg-dark-surface' : 'bg-white';
  const borderCol = isDarkMode ? 'border-dark-border' : 'border-slate-200';
  const bgInput = isDarkMode ? 'bg-dark' : 'bg-slate-50';

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // 1. Save App Settings
      const results = await Promise.all([
        saveAppSettings('company', company),
        saveAppSettings('hr', hrSettings),
        saveAppSettings('financial', finSettings),
        saveAppSettings('projects', projSettings),
        saveAppSettings('notifications', notifSettings),
      ]);

      const errors = results.filter(r => !r.success);
      if (errors.length > 0) {
        throw new Error(errors[0].error || 'Erro ao salvar configurações');
      }

      // 2. Save Permissions
      // Convert matrix back to RolePermission[]
      const permissionsToSave: RolePermission[] = Object.entries(permissionsMatrix).map(([role, perms]) => ({
        id: permissions.find(p => p.role === role)?.id || '', // Maintain ID if possible, though upsert handles it
        role: role as any,
        permissions: perms as RolePermission['permissions'],
        updatedAt: new Date().toISOString()
      }));

      for (const p of permissionsToSave) {
        const res = await saveRolePermissions(p);
        if (!res.success) throw new Error(res.error || `Erro ao salvar permissões de ${p.role} `);
      }

      // 3. Update Context (Optimistic or wait for refresh)
      setAppSettings({
        company,
        hr: hrSettings,
        financial: finSettings,
        projects: projSettings,
        notifications: notifSettings,
        agenda: (settings as any)?.agenda || {} as any,
      });

      // Update permissions context
      // Re-fetch logic or optimistic update?
      // Since permissions array has IDs, simple replacement might be tricky without IDs.
      // But we can trigger a refresh via useAppData if needed, or just update local optimism.
      // For now, let's assume valid IDs or just update UI.

      toast.success('Todas as configurações foram salvas com sucesso!');
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Erro ao salvar configurações');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCompanyChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setCompany({ ...company, [e.target.name]: e.target.value });
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Arquivo muito grande', 'A imagem deve ter no máximo 5MB.');
        return;
      }

      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        // Upload to Supabase Storage
        try {
          const fileName = `company_logo_${Date.now()}`;
          const publicUrl = await uploadBase64Image(base64, 'public', fileName);

          if (publicUrl) {
            const updatedCompany = { ...company, logo: publicUrl };
            setCompany(updatedCompany);

            // Auto-save to database so logo persists across refreshes
            const saveResult = await saveAppSettings('company', updatedCompany);
            if (saveResult.success) {
              setAppSettings({
                company: updatedCompany,
                hr: hrSettings,
                financial: finSettings,
                projects: projSettings,
                notifications: notifSettings,
                agenda: (settings as any)?.agenda || {} as any,
              });
              toast.success('Logo atualizada', 'A logo da empresa foi salva com sucesso.');
            } else {
              toast.warning('Logo visível', 'A imagem foi carregada, mas houve erro ao salvar no banco.');
            }

            // Generate PWA icons in the background (non-blocking)
            generateAndUploadPWAIcons(publicUrl).then(result => {
              if (result) {
                toast.success('Ícones PWA atualizados', 'Os ícones do aplicativo móvel foram gerados automaticamente.');
              }
            }).catch(err => {
              console.warn('[PWA Icons] Background generation failed:', err);
            });
          } else {
            // Fallback if storage fails/not configured, try to save base64 directly (not recommended but functional for small images)
            // or just show error. For now, let's try to set base64 as temporary preview
            setCompany({ ...company, logo: base64 });
            toast.warning('Aviso', 'Não foi possível salvar no storage, usando imagem localmente.');
          }
        } catch (error) {
          console.error('Logo upload error:', error);
          toast.error('Erro no upload', 'Falha ao carregar a imagem.');
        }
      };
      reader.readAsDataURL(file);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Tab Content Renderers
  const renderCompanyTab = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2 flex justify-center mb-4">
          <div className="relative group">
            <div className={`w-32 h-32 rounded-lg border-2 border-dashed ${borderCol} flex items-center justify-center overflow-hidden bg-slate-50 dark:bg-slate-900`}>
              {company.logo ? (
                <img src={company.logo} alt="Logo" className="w-full h-full object-contain" />
              ) : (
                <div className="text-center p-4">
                  <ImageIcon className={`mx-auto mb-2 ${textSub}`} size={24} />
                  <span className={`text-xs ${textSub}`}>Adicionar Logo</span>
                </div>
              )}
            </div>
            <label className="absolute inset-0 flex items-center justify-center bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer rounded-lg">
              <Upload size={20} />
              <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
            </label>
          </div>
        </div>
        <div>
          <label className={`block text-xs font-medium ${textSub} mb-1`}>Razão Social</label>
          <input type="text" name="name" value={company.name} onChange={handleCompanyChange}
            className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-primary outline-none`} />
        </div>
        <div>
          <label className={`block text-xs font-medium ${textSub} mb-1`}>Nome Fantasia</label>
          <input type="text" name="tradeName" value={company.tradeName || ''} onChange={handleCompanyChange}
            className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-primary outline-none`} />
        </div>
        <div>
          <label className={`block text-xs font-medium ${textSub} mb-1`}>CNPJ</label>
          <input type="text" name="cnpj" value={company.cnpj} onChange={handleCompanyChange}
            className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-primary outline-none`} />
        </div>
        <div>
          <label className={`block text-xs font-medium ${textSub} mb-1`}>Inscrição Estadual</label>
          <input type="text" name="stateRegistration" value={company.stateRegistration || ''} onChange={handleCompanyChange}
            className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-primary outline-none`} />
        </div>
        <div>
          <label className={`block text-xs font-medium ${textSub} mb-1`}>Regime Tributário</label>
          <CustomDropdown
            value={company.taxRegime || ''}
            onChange={v => setCompany({ ...company, taxRegime: v as any })}
            options={[
              { value: '', label: 'Selecione...' },
              { value: 'mei', label: 'MEI' },
              { value: 'simples', label: 'Simples Nacional' },
              { value: 'lucro_presumido', label: 'Lucro Presumido' },
              { value: 'lucro_real', label: 'Lucro Real' }
            ]}
            isDarkMode={isDarkMode}
          />
        </div>
        <div>
          <label className={`block text-xs font-medium ${textSub} mb-1`}>Ramo de Atividade</label>
          <input type="text" name="businessSector" value={company.businessSector || ''} onChange={handleCompanyChange}
            className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-primary outline-none`} />
        </div>
      </div>

      <div className={`border-t ${borderCol} pt-4`}>
        <h3 className={`text-sm font-semibold ${textMain} mb-3 flex items-center gap-2`}>
          <Mail size={16} className="text-primary" /> Contato
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={`block text-xs font-medium ${textSub} mb-1`}>Email</label>
            <input type="email" name="email" value={company.email} onChange={handleCompanyChange}
              className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-primary outline-none`} />
          </div>
          <div>
            <label className={`block text-xs font-medium ${textSub} mb-1`}>Telefone</label>
            <input type="text" name="phone" value={company.phone} onChange={handleCompanyChange}
              className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-primary outline-none`} />
          </div>
          <div className="md:col-span-2">
            <label className={`block text-xs font-medium ${textSub} mb-1`}>Endereço</label>
            <input type="text" name="address" value={company.address} onChange={handleCompanyChange}
              className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-primary outline-none`} />
          </div>
          <div>
            <label className={`block text-xs font-medium ${textSub} mb-1`}>Website</label>
            <input type="url" name="website" value={company.website || ''} onChange={handleCompanyChange}
              className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-primary outline-none`} placeholder="https://" />
          </div>
        </div>
      </div>
    </div>
  );

  const renderHRTab = () => (
    <div className="space-y-6">
      {/* Jornada */}
      <div>
        <h3 className={`text-sm font-semibold ${textMain} mb-3 flex items-center gap-2`}>
          <Clock size={16} className="text-primary" /> Jornada de Trabalho
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className={`block text-xs font-medium ${textSub} mb-1`}>Horas/Dia</label>
            <input type="number" value={hrSettings.workdayHours} onChange={e => setHrSettings({ ...hrSettings, workdayHours: +e.target.value })}
              className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-primary outline-none`} />
          </div>
          <div>
            <label className={`block text-xs font-medium ${textSub} mb-1`}>Horas/Semana</label>
            <input type="number" value={hrSettings.weeklyHours} onChange={e => setHrSettings({ ...hrSettings, weeklyHours: +e.target.value })}
              className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-primary outline-none`} />
          </div>
          <div>
            <label className={`block text-xs font-medium ${textSub} mb-1`}>Intervalo (min)</label>
            <input type="number" value={hrSettings.lunchBreakMinutes} onChange={e => setHrSettings({ ...hrSettings, lunchBreakMinutes: +e.target.value })}
              className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-primary outline-none`} />
          </div>
        </div>
      </div>

      {/* Banco de Horas */}
      <div className={`border-t ${borderCol} pt-4`}>
        <h3 className={`text-sm font-semibold ${textMain} mb-3 flex items-center gap-2`}>
          <Calendar size={16} className="text-primary" /> Banco de Horas
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center gap-3">
            <input type="checkbox" id="timeBankEnabled" checked={hrSettings.timeBank.enabled}
              onChange={e => setHrSettings({ ...hrSettings, timeBank: { ...hrSettings.timeBank, enabled: e.target.checked } })}
              className="w-4 h-4 text-primary rounded" />
            <label htmlFor="timeBankEnabled" className={`text-sm ${textMain}`}>Banco de horas ativo</label>
          </div>
          <div>
            <label className={`block text-xs font-medium ${textSub} mb-1`}>Máximo acumulado (h)</label>
            <input type="number" value={hrSettings.timeBank.maxAccumulatedHours}
              onChange={e => setHrSettings({ ...hrSettings, timeBank: { ...hrSettings.timeBank, maxAccumulatedHours: +e.target.value } })}
              className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-primary outline-none`} />
          </div>
          <div>
            <label className={`block text-xs font-medium ${textSub} mb-1`}>Período de compensação</label>
            <CustomDropdown
              value={hrSettings.timeBank.compensationPeriod}
              onChange={v => setHrSettings({ ...hrSettings, timeBank: { ...hrSettings.timeBank, compensationPeriod: v as HRSettings['timeBank']['compensationPeriod'] } })}
              options={[
                { value: 'monthly', label: 'Mensal' },
                { value: 'quarterly', label: 'Trimestral' },
                { value: 'semester', label: 'Semestral' },
                { value: 'annual', label: 'Anual' }
              ]}
              isDarkMode={isDarkMode}
            />
          </div>
          <div>
            <label className={`block text-xs font-medium ${textSub} mb-1`}>Tolerância atraso (min)</label>
            <input type="number" value={hrSettings.timeBank.toleranceMinutes}
              onChange={e => setHrSettings({ ...hrSettings, timeBank: { ...hrSettings.timeBank, toleranceMinutes: +e.target.value } })}
              className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-primary outline-none`} />
          </div>
          <div>
            <label className={`block text-xs font-medium ${textSub} mb-1`}>Hora extra</label>
            <CustomDropdown
              value={hrSettings.timeBank.overtimeAction}
              onChange={v => setHrSettings({ ...hrSettings, timeBank: { ...hrSettings.timeBank, overtimeAction: v as HRSettings['timeBank']['overtimeAction'] } })}
              options={[
                { value: 'compensate', label: 'Compensar em folga' },
                { value: 'pay', label: 'Pagar em folha' },
                { value: 'choose', label: 'Escolher por caso' }
              ]}
              isDarkMode={isDarkMode}
            />
          </div>
        </div>
      </div>

      {/* Férias */}
      <div className={`border-t ${borderCol} pt-4`}>
        <h3 className={`text-sm font-semibold ${textMain} mb-3 flex items-center gap-2`}>
          <Calendar size={16} className="text-green-500" /> Férias
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className={`block text-xs font-medium ${textSub} mb-1`}>Acúmulo mensal (dias)</label>
            <input type="number" step="0.5" value={hrSettings.vacation.monthlyAccrual}
              onChange={e => setHrSettings({ ...hrSettings, vacation: { ...hrSettings.vacation, monthlyAccrual: +e.target.value } })}
              className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-primary outline-none`} />
          </div>
          <div>
            <label className={`block text-xs font-medium ${textSub} mb-1`}>Máximo anual (dias)</label>
            <input type="number" value={hrSettings.vacation.maxDays}
              onChange={e => setHrSettings({ ...hrSettings, vacation: { ...hrSettings.vacation, maxDays: +e.target.value } })}
              className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-primary outline-none`} />
          </div>
          <div>
            <label className={`block text-xs font-medium ${textSub} mb-1`}>Antecedência mínima (dias)</label>
            <input type="number" value={hrSettings.vacation.minAdvanceRequestDays}
              onChange={e => setHrSettings({ ...hrSettings, vacation: { ...hrSettings.vacation, minAdvanceRequestDays: +e.target.value } })}
              className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-primary outline-none`} />
          </div>
          <div className="flex items-center gap-3">
            <input type="checkbox" id="allowSplit" checked={hrSettings.vacation.allowSplit}
              onChange={e => setHrSettings({ ...hrSettings, vacation: { ...hrSettings.vacation, allowSplit: e.target.checked } })}
              className="w-4 h-4 text-primary rounded" />
            <label htmlFor="allowSplit" className={`text-sm ${textMain}`}>Permitir fracionamento</label>
          </div>
          <div className="flex items-center gap-3">
            <input type="checkbox" id="allowSell" checked={hrSettings.vacation.allowSellDays}
              onChange={e => setHrSettings({ ...hrSettings, vacation: { ...hrSettings.vacation, allowSellDays: e.target.checked } })}
              className="w-4 h-4 text-primary rounded" />
            <label htmlFor="allowSell" className={`text-sm ${textMain}`}>Permitir abono pecuniário</label>
          </div>
          {hrSettings.vacation.allowSellDays && (
            <div>
              <label className={`block text-xs font-medium ${textSub} mb-1`}>Máx. dias para venda</label>
              <input type="number" value={hrSettings.vacation.maxSellDays}
                onChange={e => setHrSettings({ ...hrSettings, vacation: { ...hrSettings.vacation, maxSellDays: +e.target.value } })}
                className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-primary outline-none`} />
            </div>
          )}
        </div>
      </div>

      {/* Departamentos */}
      <div className={`border-t ${borderCol} pt-4`}>
        <h3 className={`text-sm font-semibold ${textMain} mb-3 flex items-center gap-2`}>
          <Users size={16} className="text-purple-500" /> Departamentos
        </h3>
        <div className="flex flex-wrap gap-2">
          {hrSettings.departments.map((dept, i) => (
            <span key={i} className={`px-3 py-1.5 rounded-full text-xs font-medium ${isDarkMode ? 'bg-dark' : 'bg-slate-100'} ${textMain} flex items-center gap-2`}>
              {dept}
              <button onClick={() => setHrSettings({ ...hrSettings, departments: hrSettings.departments.filter((_, idx) => idx !== i) })}
                className="text-red-500 hover:text-red-600">
                <X size={12} />
              </button>
            </span>
          ))}
          <button onClick={() => {
            const name = prompt('Nome do departamento:');
            if (name) setHrSettings({ ...hrSettings, departments: [...hrSettings.departments, name] });
          }} className={`px-3 py-1.5 rounded-full text-xs font-medium border ${borderCol} ${textSub} hover:border-primary hover:text-primary flex items-center gap-1`}>
            <Plus size={12} /> Adicionar
          </button>
        </div>
      </div>
    </div>
  );

  const renderFinancialTab = () => (
    <div className="space-y-6">
      {/* Impostos */}
      <div>
        <h3 className={`text-sm font-semibold ${textMain} mb-3 flex items-center gap-2`}>
          <DollarSign size={16} className="text-primary" /> Encargos do Empregador
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className={`block text-xs font-medium ${textSub} mb-1`}>INSS Patronal (%)</label>
            <input type="number" step="0.01" value={(finSettings.taxes.inssEmployer * 100).toFixed(1)}
              onChange={e => setFinSettings({ ...finSettings, taxes: { ...finSettings.taxes, inssEmployer: +e.target.value / 100 } })}
              className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-primary outline-none`} />
          </div>
          <div>
            <label className={`block text-xs font-medium ${textSub} mb-1`}>FGTS (%)</label>
            <input type="number" step="0.01" value={(finSettings.taxes.fgts * 100).toFixed(1)}
              onChange={e => setFinSettings({ ...finSettings, taxes: { ...finSettings.taxes, fgts: +e.target.value / 100 } })}
              className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-primary outline-none`} />
          </div>
          <div>
            <label className={`block text-xs font-medium ${textSub} mb-1`}>RAT (%)</label>
            <input type="number" step="0.01" value={(finSettings.taxes.rat * 100).toFixed(1)}
              onChange={e => setFinSettings({ ...finSettings, taxes: { ...finSettings.taxes, rat: +e.target.value / 100 } })}
              className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-primary outline-none`} />
          </div>
          <div>
            <label className={`block text-xs font-medium ${textSub} mb-1`}>Terceiros (%)</label>
            <input type="number" step="0.01" value={(finSettings.taxes.terceiros * 100).toFixed(1)}
              onChange={e => setFinSettings({ ...finSettings, taxes: { ...finSettings.taxes, terceiros: +e.target.value / 100 } })}
              className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-primary outline-none`} />
          </div>
        </div>
      </div>

      {/* Categorias */}
      <div className={`border-t ${borderCol} pt-4`}>
        <h3 className={`text-sm font-semibold ${textMain} mb-3`}>Categorias de Receita</h3>
        <div className="flex flex-wrap gap-2">
          {finSettings.incomeCategories.map((cat, i) => (
            <span key={i} className={`px-3 py-1.5 rounded-full text-xs font-medium bg-green-500/10 text-green-500 flex items-center gap-2`}>
              {cat}
              <button onClick={() => setFinSettings({ ...finSettings, incomeCategories: finSettings.incomeCategories.filter((_, idx) => idx !== i) })} className="hover:text-green-600">
                <X size={12} />
              </button>
            </span>
          ))}
          <button onClick={() => {
            const name = prompt('Nova categoria:');
            if (name) setFinSettings({ ...finSettings, incomeCategories: [...finSettings.incomeCategories, name] });
          }} className={`px-3 py-1.5 rounded-full text-xs font-medium border ${borderCol} ${textSub} hover:border-green-500 hover:text-green-500 flex items-center gap-1`}>
            <Plus size={12} /> Adicionar
          </button>
        </div>
      </div>

      <div className={`border-t ${borderCol} pt-4`}>
        <h3 className={`text-sm font-semibold ${textMain} mb-3`}>Categorias de Despesa</h3>
        <div className="flex flex-wrap gap-2">
          {finSettings.expenseCategories.map((cat, i) => (
            <span key={i} className={`px-3 py-1.5 rounded-full text-xs font-medium bg-red-500/10 text-red-500 flex items-center gap-2`}>
              {cat}
              <button onClick={() => setFinSettings({ ...finSettings, expenseCategories: finSettings.expenseCategories.filter((_, idx) => idx !== i) })} className="hover:text-red-600">
                <X size={12} />
              </button>
            </span>
          ))}
          <button onClick={() => {
            const name = prompt('Nova categoria:');
            if (name) setFinSettings({ ...finSettings, expenseCategories: [...finSettings.expenseCategories, name] });
          }} className={`px-3 py-1.5 rounded-full text-xs font-medium border ${borderCol} ${textSub} hover:border-red-500 hover:text-red-500 flex items-center gap-1`}>
            <Plus size={12} /> Adicionar
          </button>
        </div>
      </div>

      {/* Formas de Pagamento */}
      <div className={`border-t ${borderCol} pt-4`}>
        <h3 className={`text-sm font-semibold ${textMain} mb-3`}>Formas de Pagamento</h3>
        <div className="flex flex-wrap gap-2">
          {finSettings.paymentMethods.map((method, i) => (
            <span key={i} className={`px-3 py-1.5 rounded-full text-xs font-medium ${isDarkMode ? 'bg-dark' : 'bg-slate-100'} ${textMain} flex items-center gap-2`}>
              {method}
              <button onClick={() => setFinSettings({ ...finSettings, paymentMethods: finSettings.paymentMethods.filter((_, idx) => idx !== i) })} className="text-red-500 hover:text-red-600">
                <X size={12} />
              </button>
            </span>
          ))}
          <button onClick={() => {
            const name = prompt('Nova forma de pagamento:');
            if (name) setFinSettings({ ...finSettings, paymentMethods: [...finSettings.paymentMethods, name] });
          }} className={`px-3 py-1.5 rounded-full text-xs font-medium border ${borderCol} ${textSub} hover:border-primary hover:text-primary flex items-center gap-1`}>
            <Plus size={12} /> Adicionar
          </button>
        </div>
      </div>
    </div>
  );

  const renderProjectsTab = () => (
    <div className="space-y-6">
      {/* Status de Projetos */}
      <div>
        <h3 className={`text-sm font-semibold ${textMain} mb-3 flex items-center gap-2`}>
          <Briefcase size={16} className="text-primary" /> Status de Projetos
        </h3>
        <div className="space-y-2">
          {projSettings.projectStatuses.map((status, i) => (
            <div key={status.id} className={`flex items-center gap-3 p-2 rounded-lg ${isDarkMode ? 'bg-dark' : 'bg-slate-50'}`}>
              <input type="color" value={status.color} onChange={e => {
                const updated = [...projSettings.projectStatuses];
                updated[i] = { ...status, color: e.target.value };
                setProjSettings({ ...projSettings, projectStatuses: updated });
              }} className="w-8 h-8 rounded cursor-pointer" />
              <input type="text" value={status.label} onChange={e => {
                const updated = [...projSettings.projectStatuses];
                updated[i] = { ...status, label: e.target.value };
                setProjSettings({ ...projSettings, projectStatuses: updated });
              }} className={`flex-1 ${bgInput} border ${borderCol} rounded-lg p-2 text-sm ${textMain}`} />
              <button onClick={() => setProjSettings({ ...projSettings, projectStatuses: projSettings.projectStatuses.filter((_, idx) => idx !== i) })}
                className="text-red-500 hover:text-red-600 p-1">
                <Trash2 size={16} />
              </button>
            </div>
          ))}
          <button onClick={() => setProjSettings({ ...projSettings, projectStatuses: [...projSettings.projectStatuses, { id: Date.now().toString(), label: 'Novo Status', color: '#6366f1' }] })}
            className={`w-full p-2 rounded-lg border border-dashed ${borderCol} ${textSub} hover:border-primary hover:text-primary text-sm flex items-center justify-center gap-2`}>
            <Plus size={16} /> Adicionar Status
          </button>
        </div>
      </div>

      {/* Tipos de Serviço */}
      <div className={`border-t ${borderCol} pt-4`}>
        <h3 className={`text-sm font-semibold ${textMain} mb-3`}>Tipos de Serviço</h3>
        <div className="flex flex-wrap gap-2">
          {projSettings.serviceTypes.map((type, i) => (
            <span key={i} className={`px-3 py-1.5 rounded-full text-xs font-medium ${isDarkMode ? 'bg-dark' : 'bg-slate-100'} ${textMain} flex items-center gap-2`}>
              {type}
              <button onClick={() => setProjSettings({ ...projSettings, serviceTypes: projSettings.serviceTypes.filter((_, idx) => idx !== i) })} className="text-red-500 hover:text-red-600">
                <X size={12} />
              </button>
            </span>
          ))}
          <button onClick={() => {
            const name = prompt('Novo tipo de serviço:');
            if (name) setProjSettings({ ...projSettings, serviceTypes: [...projSettings.serviceTypes, name] });
          }} className={`px-3 py-1.5 rounded-full text-xs font-medium border ${borderCol} ${textSub} hover:border-primary hover:text-primary flex items-center gap-1`}>
            <Plus size={12} /> Adicionar
          </button>
        </div>
      </div>

      {/* SLA */}
      <div className={`border-t ${borderCol} pt-4`}>
        <h3 className={`text-sm font-semibold ${textMain} mb-3 flex items-center gap-2`}>
          <Clock size={16} className="text-orange-500" /> SLA Padrão
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={`block text-xs font-medium ${textSub} mb-1`}>Tempo de Resposta (horas)</label>
            <input type="number" value={projSettings.defaultSLA.responseTimeHours}
              onChange={e => setProjSettings({ ...projSettings, defaultSLA: { ...projSettings.defaultSLA, responseTimeHours: +e.target.value } })}
              className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-primary outline-none`} />
          </div>
          <div>
            <label className={`block text-xs font-medium ${textSub} mb-1`}>Tempo de Resolução (horas)</label>
            <input type="number" value={projSettings.defaultSLA.resolutionTimeHours}
              onChange={e => setProjSettings({ ...projSettings, defaultSLA: { ...projSettings.defaultSLA, resolutionTimeHours: +e.target.value } })}
              className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-primary outline-none`} />
          </div>
        </div>
      </div>
    </div>
  );

  const renderNotificationsTab = () => (
    <div className="space-y-6">
      {/* Alertas por Email */}
      <div>
        <h3 className={`text-sm font-semibold ${textMain} mb-3 flex items-center gap-2`}>
          <Bell size={16} className="text-primary" /> Alertas por Email
        </h3>
        <div className="space-y-3">
          {[
            { key: 'contractExpiring', label: 'Contrato expirando' },
            { key: 'paymentDue', label: 'Pagamento pendente' },
            { key: 'vacationRequest', label: 'Solicitação de férias' },
            { key: 'evaluationDue', label: 'Avaliação pendente' },
            { key: 'goalProgress', label: 'Progresso de metas' },
          ].map(item => (
            <label key={item.key} className={`flex items-center gap-3 p-3 rounded-lg ${isDarkMode ? 'bg-dark' : 'bg-slate-50'} cursor-pointer`}>
              <input type="checkbox" checked={notifSettings.emailAlerts[item.key as keyof typeof notifSettings.emailAlerts]}
                onChange={e => setNotifSettings({ ...notifSettings, emailAlerts: { ...notifSettings.emailAlerts, [item.key]: e.target.checked } })}
                className="w-4 h-4 text-primary rounded" />
              <span className={`text-sm ${textMain}`}>{item.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Dias de Antecedência */}
      <div className={`border-t ${borderCol} pt-4`}>
        <h3 className={`text-sm font-semibold ${textMain} mb-3`}>Dias de Antecedência para Lembretes</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={`block text-xs font-medium ${textSub} mb-1`}>Contrato expirando</label>
            <input type="number" value={notifSettings.reminderDays.contractExpiring}
              onChange={e => setNotifSettings({ ...notifSettings, reminderDays: { ...notifSettings.reminderDays, contractExpiring: +e.target.value } })}
              className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-primary outline-none`} />
          </div>
          <div>
            <label className={`block text-xs font-medium ${textSub} mb-1`}>Pagamento pendente</label>
            <input type="number" value={notifSettings.reminderDays.paymentDue}
              onChange={e => setNotifSettings({ ...notifSettings, reminderDays: { ...notifSettings.reminderDays, paymentDue: +e.target.value } })}
              className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-primary outline-none`} />
          </div>
        </div>
      </div>

      {/* Relatórios Agendados */}
      <div className={`border-t ${borderCol} pt-4`}>
        <h3 className={`text-sm font-semibold ${textMain} mb-3`}>Relatórios Agendados</h3>
        <div className="flex flex-wrap gap-4">
          {[
            { key: 'daily', label: 'Diário' },
            { key: 'weekly', label: 'Semanal' },
            { key: 'monthly', label: 'Mensal' },
          ].map(item => (
            <label key={item.key} className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={notifSettings.scheduledReports[item.key as keyof Pick<typeof notifSettings.scheduledReports, 'daily' | 'weekly' | 'monthly'>]}
                onChange={e => setNotifSettings({ ...notifSettings, scheduledReports: { ...notifSettings.scheduledReports, [item.key]: e.target.checked } })}
                className="w-4 h-4 text-primary rounded" />
              <span className={`text-sm ${textMain}`}>{item.label}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );

  const togglePermission = (role: Role, path: string) => {
    // Admin sempre tem acesso total, não pode ser alterado
    if (role === 'Admin') return;

    setPermissionsMatrix(prev => ({
      ...prev,
      [role]: {
        ...prev[role],
        [path]: !prev[role][path]
      }
    }));
  };

  const toggleAllForRole = async (role: Role, value: boolean) => {
    if (role === 'Admin') return;

    if (!currentUser || !currentUser.password) {
      alert('Usuário não autenticado.');
      return;
    }

    const action = value ? 'Conceder Acesso Total' : 'Revogar Todos os Acessos';
    const ok = await passwordConfirm({
      title: `${action} - ${role} `,
      message: `Esta ação irá ${value ? 'conceder acesso a todas as páginas' : 'revogar acesso a todas as páginas'} para o role "${role}".`,
      action: 'Confirmar',
      currentUserPassword: currentUser.password
    });

    if (ok) {
      setPermissionsMatrix(prev => ({
        ...prev,
        [role]: Object.fromEntries(PAGES_LIST.map(p => [p.path, value]))
      }));
    }
  };

  const resetPermissions = async () => {
    if (!currentUser || !currentUser.password) {
      alert('Usuário não autenticado.');
      return;
    }

    const ok = await passwordConfirm({
      title: 'Restaurar Permissões Padrão',
      message: 'Esta ação irá sobrescrever todas as permissões customizadas e restaurar aos valores padrão do sistema.',
      action: 'Confirmar',
      currentUserPassword: currentUser.password
    });

    if (ok) {
      setPermissionsMatrix(DEFAULT_PERMISSIONS);
    }
  };

  // --- Customize Tab ---
  const [activeColor, setActiveColor] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('erp_primary_color');
      if (saved) {
        const parsed = JSON.parse(saved);
        const match = COLOR_PRESETS.find(p => p.rgb.DEFAULT === parsed.DEFAULT);
        return match?.hex || '#00bf62';
      }
    } catch { }
    return '#00bf62';
  });

  const applyColor = (preset: typeof COLOR_PRESETS[number]) => {
    const root = document.documentElement.style;
    root.setProperty('--primary', preset.rgb.DEFAULT);
    root.setProperty('--primary-50', preset.rgb['50']);
    root.setProperty('--primary-500', preset.rgb['500']);
    root.setProperty('--primary-600', preset.rgb['600']);
    root.setProperty('--primary-700', preset.rgb['700']);
    localStorage.setItem('erp_primary_color', JSON.stringify(preset.rgb));
    setActiveColor(preset.hex);
  };

  const renderCustomizeTab = () => (
    <div className="space-y-6">
      {/* Cor Primária */}
      <div>
        <h3 className={`text-sm font-semibold ${textMain} mb-1 flex items-center gap-2`}>
          <Palette size={16} className="text-primary" /> Cor Primária
        </h3>
        <p className={`text-xs ${textSub} mb-4`}>
          Escolha a cor que será aplicada em todo o sistema: ícones, botões, indicadores e destaques.
        </p>
        <div className="grid grid-cols-5 sm:grid-cols-10 gap-4">
          {COLOR_PRESETS.map(preset => {
            const isActive = activeColor === preset.hex;
            return (
              <button
                key={preset.hex}
                onClick={() => applyColor(preset)}
                className="flex flex-col items-center gap-1.5 group"
                title={preset.name}
              >
                <div
                  className={`w-10 h-10 rounded-full border-2 transition-all duration-200 flex items-center justify-center
                    ${isActive
                      ? 'border-white dark:border-white scale-110 shadow-lg ring-2 ring-offset-2 dark:ring-offset-dark'
                      : `border-transparent group-hover:scale-105 group-hover:shadow-md`
                    }`}
                  style={{
                    backgroundColor: preset.hex,
                    ['--tw-ring-color' as any]: isActive ? preset.hex : undefined,
                  }}
                >
                  {isActive && <Check size={18} className="text-white" strokeWidth={3} />}
                </div>
                <span className={`text-[10px] font-medium ${isActive ? textMain : textSub} transition-colors`}>
                  {preset.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Preview */}
      <div className={`border-t ${borderCol} pt-5`}>
        <h3 className={`text-sm font-semibold ${textMain} mb-3`}>Preview</h3>
        <div className={`p-4 rounded-xl border ${borderCol} ${isDarkMode ? 'bg-dark' : 'bg-slate-50'} space-y-3`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Palette size={20} className="text-primary" />
            </div>
            <div>
              <p className={`text-sm font-semibold ${textMain}`}>Cor Primária Aplicada</p>
              <p className={`text-xs ${textSub}`}>Veja como os elementos ficam com a cor selecionada</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="px-3 py-1.5 bg-primary text-white rounded-full text-xs font-bold">Botão Primário</span>
            <span className="px-3 py-1.5 bg-primary/10 text-primary border border-primary/30 rounded-full text-xs font-bold">Botão Secundário</span>
            <span className={`px-3 py-1.5 rounded-full text-xs font-bold border ${borderCol} ${textSub}`}>Botão Neutro</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2 flex-1 rounded-full bg-primary/20">
              <div className="h-full w-3/4 rounded-full bg-primary transition-all" />
            </div>
            <span className="text-xs font-bold text-primary">75%</span>
          </div>
        </div>
      </div>
    </div>
  );

  const renderPermissionsTab = () => {
    const sections = [...new Set(PAGES_LIST.map(p => p.section))];

    return (
      <div className="space-y-6">
        <div className={`p-4 rounded-lg border ${borderCol} mb-6`}>
          <h3 className={`text-sm font-semibold ${textMain} mb-3 flex items-center gap-2`}>
            <Eye size={16} className="text-primary" /> Escopo de Dados (Sales & Support)
          </h3>
          <p className={`text-xs ${textSub} mb-4`}>
            Defina se vendedores e suporte podem ver todos os dados ou apenas os seus próprios.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <label className={`flex items-center gap-2 cursor-pointer p-3 rounded-lg border ${company.dataScoping === 'own_only' || !company.dataScoping ? `border-primary bg-primary/5` : borderCol} flex-1`}>
              <input
                type="radio"
                name="dataScoping"
                value="own_only"
                checked={!company.dataScoping || company.dataScoping === 'own_only'}
                onChange={() => setCompany({ ...company, dataScoping: 'own_only' })}
                className="text-primary focus:ring-primary"
              />
              <div>
                <span className={`block text-sm font-medium ${textMain}`}>Apenas Próprios (Padrão)</span>
                <span className={`text-xs ${textSub}`}>Vê apenas leads/clientes atribuídos a ele</span>
              </div>
            </label>

            <label className={`flex items-center gap-2 cursor-pointer p-3 rounded-lg border ${company.dataScoping === 'view_all_edit_own' ? `border-primary bg-primary/5` : borderCol} flex-1`}>
              <input
                type="radio"
                name="dataScoping"
                value="view_all_edit_own"
                checked={company.dataScoping === 'view_all_edit_own'}
                onChange={() => setCompany({ ...company, dataScoping: 'view_all_edit_own' })}
                className="text-primary focus:ring-primary"
              />
              <div>
                <span className={`block text-sm font-medium ${textMain}`}>Ver Tudo / Editar Próprios</span>
                <span className={`text-xs ${textSub}`}>Vê todos os leads, mas edita apenas os seus</span>
              </div>
            </label>
          </div>
        </div>

        <div className={`p-4 rounded-lg border ${borderCol} bg-amber-500/10 border-amber-500/30`}>
          <div className="flex items-center gap-2 text-amber-500 text-sm">
            <AlertCircle size={16} />
            <span className="font-medium">Apenas Admin e Manager podem editar estas configurações.</span>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex flex-wrap gap-2">
          <button onClick={resetPermissions}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border ${borderCol} ${textSub} hover:bg-slate-100 dark:hover:bg-dark transition-colors`}>
            Restaurar Padrões
          </button>
        </div>

        {/* Permissions Matrix */}
        <div className={`border ${borderCol} rounded-xl overflow-hidden`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className={`${bgInput} border-b ${borderCol}`}>
                  <th className={`text-left px-4 py-3 font-semibold ${textMain} sticky left-0 ${bgInput} z-10`}>Página</th>
                  {ROLES.map(role => (
                    <th key={role} className={`text-center px-4 py-3 font-semibold ${textMain} min-w-[100px]`}>
                      <div className="flex flex-col items-center gap-1">
                        <span>{role}</span>
                        {role !== 'Admin' && (
                          <div className="flex gap-1">
                            <button onClick={() => toggleAllForRole(role, true)}
                              className="text-[10px] px-1.5 py-0.5 bg-green-500/20 text-green-500 rounded hover:bg-green-500/30">
                              Todos
                            </button>
                            <button onClick={() => toggleAllForRole(role, false)}
                              className="text-[10px] px-1.5 py-0.5 bg-red-500/20 text-red-500 rounded hover:bg-red-500/30">
                              Nenhum
                            </button>
                          </div>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sections.map(section => (
                  <React.Fragment key={section}>
                    <tr className={`${isDarkMode ? 'bg-slate-800/50' : 'bg-slate-50'}`}>
                      <td colSpan={ROLES.length + 1} className={`px-4 py-2 text-xs font-bold ${textSub} uppercase tracking-wider`}>
                        {section}
                      </td>
                    </tr>
                    {PAGES_LIST.filter(p => p.section === section).map(page => (
                      <tr key={page.path} className={`border-b ${borderCol} hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors`}>
                        <td className={`px-4 py-3 font-medium ${textMain} sticky left-0 ${isDarkMode ? 'bg-dark-surface' : 'bg-white'}`}>
                          {page.label}
                        </td>
                        {ROLES.map(role => (
                          <td key={role} className="px-4 py-3 text-center">
                            <div className="flex justify-center">
                              {role === 'Admin' ? (
                                <Check size={18} className="text-green-500" />
                              ) : (
                                <input
                                  type="checkbox"
                                  checked={permissionsMatrix[role][page.path] || false}
                                  onChange={() => togglePermission(role, page.path)}
                                  className="w-4 h-4 text-primary rounded cursor-pointer"
                                />
                              )}
                            </div>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={`p-6 ${isDarkMode ? 'bg-dark' : 'bg-slate-50'} min-h-screen`}>
      <div className="flex justify-between items-center mb-6">
        <h1 className={`text-2xl font-bold ${textMain} flex items-center gap-2`}>
          <Settings2 className="text-primary" /> Configurações
        </h1>
        <button onClick={handleSave} disabled={isSaving || !hasChanges}
          className={`px-4 py-2 rounded-lg flex items-center gap-2 font-semibold transition-colors ${(isSaving || !hasChanges) ? 'bg-slate-400 text-slate-200 cursor-not-allowed' : 'bg-primary hover:bg-primary-600 text-white'}`}>
          {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
          Salvar Alterações
        </button>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        {/* Sidebar */}
        <div className={`w-full md:w-64 flex-shrink-0 space-y-1`}>
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === tab.id
                ? 'bg-primary text-white'
                : `${textSub} hover:bg-slate-100 dark:hover:bg-slate-800`
                }`}
            >
              <div className="flex items-center gap-3">
                <tab.icon size={18} />
                {tab.label}
              </div>
              {activeTab === tab.id && <ChevronRight size={16} />}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className={`flex-1 ${bgCard} rounded-xl border ${borderCol} p-6`}>
          {activeTab === 'company' && renderCompanyTab()}
          {activeTab === 'hr' && renderHRTab()}
          {activeTab === 'financial' && renderFinancialTab()}
          {activeTab === 'projects' && renderProjectsTab()}
          {activeTab === 'notifications' && renderNotificationsTab()}
          {activeTab === 'permissions' && renderPermissionsTab()}
          {activeTab === 'customize' && renderCustomizeTab()}
        </div>
      </div>
    </div >
  );
};