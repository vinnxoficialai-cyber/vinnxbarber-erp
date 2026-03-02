import { Project, ProjectStatus, Priority, Client, Transaction, CalendarEvent, TeamMember, Contract, PersonalTask, Budget, ProjectTask, Service, CompanySettings, BankAccount, PerformanceReview, TimeEntry, VacationPeriod, ServiceCredential, Goal, Commission, Withdrawal, PayrollPeriod, WeeklyCheckin, ClientInteraction } from './types';

// Helpers for dynamic dates
const today = new Date();
const currentYear = today.getFullYear();
const currentMonth = today.getMonth();
const currentDay = today.getDate();

export const MOCK_COMPANY_SETTINGS: CompanySettings = {
  name: 'VINNX Agency',
  cnpj: '00.000.000/0001-00',
  email: 'admin@vinnx.com',
  phone: '',
  address: '',
  logo: '', // Empty means default logic
  primaryColor: '#00bf62'
};

export const MOCK_HR_SETTINGS: import('./types').HRSettings = {
  workdayHours: 8,
  weeklyHours: 44,
  lunchBreakMinutes: 60,
  timeBank: {
    enabled: true,
    maxAccumulatedHours: 40,
    compensationPeriod: 'monthly',
    toleranceMinutes: 10,
    overtimeAction: 'pay'
  },
  vacation: {
    monthlyAccrual: 2.5,
    maxDays: 30,
    minAdvanceRequestDays: 30,
    allowSplit: true,
    maxSplitParts: 3,
    allowSellDays: true,
    maxSellDays: 10
  },
  holidays: [],
  positions: [],
  departments: ['Vendas', 'Suporte', 'Financeiro', 'RH']
};

export const MOCK_FINANCIAL_SETTINGS: import('./types').FinancialSettings = {
  currency: 'BRL',
  taxes: { inssEmployer: 0.20, fgts: 0.08, rat: 0.02, terceiros: 0.058 },
  inssTable: { ceiling: 7507.49, brackets: [] },
  irTable: { exemptLimit: 2112, brackets: [] },
  incomeCategories: ['Venda de Serviço', 'Consultoria', 'Setup'],
  expenseCategories: ['Salários', 'Impostos', 'Infraestrutura', 'Marketing'],
  paymentMethods: ['Boleto', 'PIX', 'Cartão de Crédito'],
  paymentTerms: [{ label: 'À Vista', days: 0 }, { label: '30 Dias', days: 30 }]
};

export const MOCK_PROJECT_SETTINGS: import('./types').ProjectSettings = {
  projectStatuses: [
    { id: 'todo', label: 'A Fazer', color: '#64748b' },
    { id: 'in-progress', label: 'Em Andamento', color: '#3b82f6' },
    { id: 'review', label: 'Em Revisão', color: '#eab308' },
    { id: 'done', label: 'Concluído', color: '#22c55e' }
  ],
  contractStatuses: [
    { id: 'active', label: 'Ativo', color: '#22c55e' },
    { id: 'pending', label: 'Pendente', color: '#eab308' },
    { id: 'cancelled', label: 'Cancelado', color: '#ef4444' },
    { id: 'ended', label: 'Finalizado', color: '#64748b' }
  ],
  serviceTypes: ['Consultoria', 'Desenvolvimento', 'Design', 'Marketing'],
  defaultSLA: { responseTimeHours: 24, resolutionTimeHours: 72 }
};

export const MOCK_NOTIFICATION_SETTINGS: import('./types').NotificationSettings = {
  emailAlerts: {
    contractExpiring: true,
    paymentDue: true,
    vacationRequest: true,
    evaluationDue: true,
    goalProgress: false
  },
  reminderDays: { contractExpiring: 30, paymentDue: 5 },
  scheduledReports: { daily: false, weekly: true, monthly: true, recipients: [] }
};

export const MOCK_ROLES_PERMISSIONS: import('./types').RolePermission[] = [
  { id: 'admin', role: 'ADMIN', permissions: { all: true }, updatedAt: new Date().toISOString() },
  { id: 'manager', role: 'MANAGER', permissions: { view_financial: true, edit_team: true }, updatedAt: new Date().toISOString() },
  { id: 'sales', role: 'SALES', permissions: { view_financial: false, view_clients: true }, updatedAt: new Date().toISOString() },
  { id: 'support', role: 'SUPPORT', permissions: { view_financial: false, view_tickets: true }, updatedAt: new Date().toISOString() }
];


export const MOCK_SERVICES: Service[] = [];

// Mantendo 1 usuário Admin para o sistema funcionar
export const MOCK_TEAM: TeamMember[] = [
  {
    id: 'u1',
    name: 'Admin User',
    email: 'admin@vinnx.com',
    role: 'Admin',
    status: 'Active',
    joinDate: new Date().toISOString().split('T')[0],
    commissionRate: 0,
    baseSalary: 5000
  }
];

export const MOCK_CLIENTS: Client[] = [];

export const MOCK_CONTRACTS: Contract[] = [];

export const MOCK_PROJECTS: Project[] = [];

export const MOCK_PROJECT_TASKS: ProjectTask[] = [];

export const MOCK_TRANSACTIONS: Transaction[] = [];

export const MOCK_TASKS: PersonalTask[] = [];

export const MOCK_BUDGETS: Budget[] = [];

export const MOCK_ACCOUNTS: BankAccount[] = [];

export const MOCK_FINANCE = [];

export const MOCK_EVENTS: CalendarEvent[] = [];

// NEW ERP Mock Data
export const MOCK_REVIEWS: PerformanceReview[] = [];
export const MOCK_TIME_ENTRIES: TimeEntry[] = [];
export const MOCK_VACATIONS: VacationPeriod[] = [];
export const MOCK_CREDENTIALS: ServiceCredential[] = [];
export const MOCK_GOALS: Goal[] = [];
export const MOCK_COMMISSIONS: Commission[] = [];
export const MOCK_WITHDRAWALS: Withdrawal[] = [];
export const MOCK_PAYROLL_PERIODS: PayrollPeriod[] = [];
export const MOCK_CHECKINS: WeeklyCheckin[] = [];
export const MOCK_INTERACTIONS: ClientInteraction[] = [];

// Estrutura do gráfico zerada
export const CHART_DATA = [
  { name: 'Jan', receita: 0, despesa: 0 },
  { name: 'Fev', receita: 0, despesa: 0 },
  { name: 'Mar', receita: 0, despesa: 0 },
  { name: 'Abr', receita: 0, despesa: 0 },
  { name: 'Mai', receita: 0, despesa: 0 },
  { name: 'Jun', receita: 0, despesa: 0 },
  { name: 'Jul', receita: 0, despesa: 0 },
  { name: 'Ago', receita: 0, despesa: 0 },
  { name: 'Set', receita: 0, despesa: 0 },
  { name: 'Out', receita: 0, despesa: 0 },
  { name: 'Nov', receita: 0, despesa: 0 },
  { name: 'Dez', receita: 0, despesa: 0 },
];