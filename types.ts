
export enum ProjectStatus {
  TODO = 'A fazer',
  IN_PROGRESS = 'Em andamento',
  IN_REVIEW = 'Em revisão',
  DONE = 'Concluído'
}

export enum Priority {
  LOW = 'Baixa',
  MEDIUM = 'Média',
  HIGH = 'Alta'
}

export interface Client {
  id: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  status: 'Active' | 'Inactive' | 'Lead' | 'Churned';

  // Financials
  revenue: number; // Deprecated, use totalValue/monthlyValue
  monthlyValue: number;
  setupValue: number;
  totalValue: number;
  monthsActive: number;

  // CRM Info
  origin?: string;
  segment?: string;
  lastContact?: string;

  image?: string; // Replaces avatar
  avatar?: string; // Backward compatibility
  birthday?: string; // YYYY-MM-DD
  salesExecutiveId?: string; // Link to team member

  // Barbershop Fields
  lastVisit?: string; // ISO timestamp
  preferredBarberId?: string; // FK to users.id
  totalVisits?: number; // Auto-incremented on comanda close
  gender?: 'M' | 'F' | 'O'; // M=Masculino, F=Feminino, O=Outro
  cpfCnpj?: string; // CPF or CNPJ document number
  unitId?: string; // Multi-unit: unidade principal do cliente

  // Public Booking App Fields
  authUserId?: string; // FK to auth.users(id) — Supabase Auth link
  referralCode?: string; // Unique referral code for this client
  referralCredits?: number; // Accumulated referral credits (R$)
  referralsMade?: number; // Number of successful referrals
  redeemedGoals?: string[]; // IDs of referral goals already redeemed
  profilePic?: string; // Profile picture URL
  notificationPreferences?: { email?: boolean; whatsapp?: boolean; push?: boolean };
  profileNudgeCount?: number;
  lastProfileNudge?: string;

  // ASAAS Integration
  asaasCustomerId?: string;  // ID do cliente no gateway ASAAS
}

export interface TeamMember {
  id: string;
  name: string;
  role: 'Admin' | 'Sales Executive' | 'Manager' | 'Support' | 'Barber' | 'Attendant';

  // Auth & Status
  email: string;
  password?: string;
  status: 'Active' | 'Inactive';

  // Profile
  phone?: string;
  cpf?: string; // CPF do colaborador
  birthday?: string; // Data de nascimento YYYY-MM-DD
  image?: string; // Replaces avatar
  avatar?: string; // Backward compatibility
  joinDate: string; // YYYY-MM-DD

  // Financial
  salary?: number; // Salário mensal
  baseSalary?: number; // Alias for salary (backward compatibility)

  // RH & Contrato (New Fields)
  contractType?: 'CLT' | 'PJ' | 'Estágio' | 'Informal';
  paymentPreference?: 'Mensal' | 'Quinzenal';
  pixKey?: string;
  bankInfo?: {
    bank: string;
    agency: string;
    account: string;
    accountType: 'Corrente' | 'Poupança';
  };
  commissionRate?: number; // % Comissão por Serviço (já existe)
  subscriptionCommission?: number; // % Comissão por Atendimento Assinante
  productCommission?: number; // % Comissão por Venda de Produto
  admissionDate?: string; // Data de admissão formal
  teamMemberId?: string; // FK ID from team_members table (differs from users.id)

  // Barbershop Fields
  specialties?: string[]; // Ex: ['Corte Degradê', 'Barba', 'Pigmentação']
  station?: string; // Cadeira/estação do barbeiro
}

export interface ClientReview {
  id: string;
  clientId: string;
  barberId: string;
  comandaId?: string;
  rating: number; // 1-5
  comment?: string;
  tags?: string[]; // Ex: ['atendimento', 'pontualidade']
  createdAt?: string;
}

export interface Contract {
  id: string;
  title: string;
  clientId: string;
  salesExecutiveId: string;
  monthlyValue: number;
  setupValue: number;
  contractDuration: number; // months
  startDate: string;
  endDate?: string;
  status: 'Active' | 'Cancelled' | 'Pending' | 'Ended';
}

export interface Project {
  id: string;
  title: string;
  clientId?: string; // Required by schema
  clientName?: string; // Backward compatibility
  status: ProjectStatus;
  dueDate: string;
  budget: number;
  priority: Priority;
  tags: string[];
}

export type TransactionType = 'income' | 'expense' | 'commission';

export interface Transaction {
  id: number;
  description: string;
  amount: number;
  type: TransactionType;
  date: string; // YYYY-MM-DD - Data Prevista / Vencimento
  createdAt: string; // YYYY-MM-DD - Data de Cadastro
  category?: string;
  status: 'Completed' | 'Pending' | 'Overdue';
  clientId?: string;
  accountId?: string; // Link to BankAccount (Credit Card purchase)
  unitId?: string; // Multi-unit: unidade da transacao
}

export interface FinancialRecord {
  id: string;
  description: string;
  amount: number;
  type: 'Income' | 'Expense';
  date: string;
  category: string;
  status: 'Paid' | 'Pending' | 'Overdue';
}

export interface StatMetric {
  label: string;
  value: string;
  trend?: number;
  trendDirection?: 'up' | 'down';
  contractModel: string;
  logo?: string; // URL da logo da empresa
}

export type EventType = 'meeting' | 'work' | 'personal' | 'deadline' | 'delivery' | 'blocked' | 'appointment';

export interface CalendarEvent {
  id: string;
  title: string;
  type: EventType;
  startTime: string; // "HH:MM"
  endTime: string;   // "HH:MM"
  date: number;      // Day of month (1-31)
  month: number;     // Month index (0-11)
  year: number;
  client?: string;
  observation?: string;
  color?: string;
  barberId?: string;      // FK team_members.id — professional assigned
  barberName?: string;    // Cached display name
  serviceId?: string;     // FK services.id — primary service (backward compat)
  serviceName?: string;   // Cached display name
  serviceIds?: string[];  // Multi-service: array of service IDs
  duration?: number;      // Duration in minutes (default 30)
  unitId?: string;        // FK units.id — multi-unit association
  source?: 'manual' | 'app' | 'website';  // Booking origin
  status?: 'confirmed' | 'arrived' | 'in_service' | 'completed' | 'no_show' | 'cancelled'; // Lifecycle
  comandaId?: string;   // FK comandas.id — linked comanda (set when comanda is auto-created)

  // Public Booking App Fields
  clientName?: string;       // Client display name
  clientId?: string;         // FK clients.id
  finalPrice?: number;       // Final price after discounts/plan coverage
  rating?: number;           // Client rating 1-5
  ratingComment?: string;    // Client review comment
  usedReferralCredit?: boolean; // Whether referral credit was used
  usedInPlan?: boolean;          // Whether this appointment was covered by a subscription plan
}

export interface PersonalTask {
  id: number;
  text: string;
  scope: 'day' | 'week' | 'month';
  completed: boolean;
  createdAt: string;
  completedAt?: string;
  assigneeId: string;
}

export interface BudgetItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface Budget {
  id: string;
  clientId: string;
  title: string;
  status: 'Draft' | 'Sent' | 'Approved' | 'Rejected';
  items: BudgetItem[];
  totalValue: number;
  discount?: number; // New field
  createdAt: string; // YYYY-MM-DD
  validUntil: string; // YYYY-MM-DD
  notes?: string;
}

// Kanban Project Types
export type TaskStatus = 'todo' | 'in-progress' | 'review' | 'done';
export type DeadlineOption = 7 | 15 | 30;

export interface ProjectTask {
  id: number;
  title: string;
  clientName: string;
  clientPhone: string;
  segment: string;
  status: TaskStatus;
  deadline: DeadlineOption;
  daysLeft: number;
  createdAt?: string;
  salesExecutiveId?: string;
  description?: string;
  priority?: 'high' | 'medium' | 'low';
  assignedToId?: string;
  assignedToName?: string;
  value?: number;
  notes?: string;
}

// Settings Types
export interface CompanySettings {
  // Dados da Empresa
  name: string;
  tradeName?: string; // Nome Fantasia
  cnpj: string;
  stateRegistration?: string; // Inscrição Estadual
  email: string;
  phone: string;
  address: string;
  logo: string;
  primaryColor: string;
  taxRegime?: 'simples' | 'lucro_real' | 'lucro_presumido' | 'mei';
  businessSector?: string;
  website?: string;
  socialMedia?: {
    instagram?: string;
    linkedin?: string;
    facebook?: string;
  };
  dataScoping?: 'own_only' | 'view_all_edit_own';
}

// Site Editor Settings (agendamento online)
export interface SiteSettings {
  id: string;
  isActive: boolean;
  // Aparência
  primaryColor: string;
  logoUrl?: string;
  heroImageUrl?: string;
  sectionsVisible: {
    reviews: boolean;
    team: boolean;
    promotions: boolean;
    social: boolean;
  };
  // Textos
  businessName?: string;
  slogan?: string;
  address?: string;
  phone?: string;
  aboutText?: string;
  ctaButtonText: string;
  // Horários
  businessHours: {
    day: string;
    open: boolean;
    start: string;
    end: string;
  }[];
  // Serviços
  visibleServiceIds: string[];
  // Integrações
  whatsappNumber?: string;
  whatsappEnabled: boolean;
  instagramHandle?: string;
  googleMapsUrl?: string;
  googleAnalyticsId?: string;
  // Audit
  updatedAt?: string;
  updatedBy?: string;
}

// HR Settings
export interface HRSettings {
  // Jornada de Trabalho
  workdayHours: number; // Ex: 8
  weeklyHours: number; // Ex: 44
  lunchBreakMinutes: number; // Ex: 60

  // Banco de Horas
  timeBank: {
    enabled: boolean;
    maxAccumulatedHours: number; // Ex: 40
    compensationPeriod: 'monthly' | 'quarterly' | 'semester' | 'annual';
    toleranceMinutes: number; // Ex: 10
    overtimeAction: 'compensate' | 'pay' | 'choose';
  };

  // Férias
  vacation: {
    monthlyAccrual: number; // Ex: 2.5 dias/mês
    maxDays: number; // Ex: 30
    minAdvanceRequestDays: number; // Ex: 30
    allowSplit: boolean; // Pode fracionar
    maxSplitParts: number; // Ex: 3
    allowSellDays: boolean; // Abono pecuniário
    maxSellDays: number; // Ex: 10
  };

  // Feriados
  holidays: {
    date: string;
    name: string;
    type: 'national' | 'state' | 'municipal' | 'company';
  }[];

  // Cargos
  positions: {
    id: string;
    name: string;
    department: string;
    salaryRangeMin?: number;
    salaryRangeMax?: number;
  }[];

  // Departamentos
  departments: string[];
}

// Financial Settings
export interface FinancialSettings {
  currency: string; // Ex: BRL

  // Impostos
  taxes: {
    inssEmployer: number; // Ex: 0.20 (20%)
    fgts: number; // Ex: 0.08 (8%)
    rat: number; // Ex: 0.02 (2%)
    terceiros: number; // Ex: 0.058 (5.8%)
  };

  // Tabelas progressivas INSS e IRRF
  inssTable: {
    ceiling: number;
    brackets: { min: number; max: number; rate: number }[];
  };

  irTable: {
    exemptLimit: number;
    brackets: { min: number; max: number; rate: number; deduction: number }[];
  };

  // Categorias
  incomeCategories: string[];
  expenseCategories: string[];

  // Formas de Pagamento
  paymentMethods: string[];

  // Condições de Pagamento
  paymentTerms: { label: string; days: number }[];

  // Configuração de Pagamento
  paymentDay?: number; // Dia do pagamento (ex: 5)
  secondPaymentDay?: number; // Segundo dia (pagamento quinzenal)
  reminderDaysBeforePayment?: number; // Dias de antecedência p/ lembrete
}

// Project Settings
export interface ProjectSettings {
  // Status customizáveis
  projectStatuses: { id: string; label: string; color: string }[];
  contractStatuses: { id: string; label: string; color: string }[];

  // Tipos de Serviço
  serviceTypes: string[];

  // SLA
  defaultSLA: {
    responseTimeHours: number;
    resolutionTimeHours: number;
  };
}

// Notification Settings
export interface NotificationSettings {
  emailAlerts: {
    contractExpiring: boolean;
    paymentDue: boolean;
    vacationRequest: boolean;
    evaluationDue: boolean;
    goalProgress: boolean;
  };

  reminderDays: {
    contractExpiring: number; // Ex: 30 dias antes
    paymentDue: number; // Ex: 5 dias antes
  };

  scheduledReports: {
    daily: boolean;
    weekly: boolean;
    monthly: boolean;
    recipients: string[];
  };
}

// All Settings Combined
export interface AgendaSettings {
  startHour: number;              // Grid start (7)
  endHour: number;                // Grid end (21)
  slotInterval: 15 | 30 | 60;    // Granularity (default 30)
  bufferMinutes: number;          // Gap between appointments (0, 5, 10, 15)
  allowOverbooking: boolean;      // Allow overlapping appointments
  autoAssignBarber: boolean;      // Auto-pick available barber
  requireService: boolean;        // Mandate service selection
  requireClient: boolean;         // Mandate client name
  showBreakTime: boolean;         // Display break overlay in grid
  showOffDays: boolean;           // Display off-day overlay in grid
  weekStartsOnMonday: boolean;    // Monday vs Sunday start
  defaultDuration: number;        // Default appointment duration (30, 45, 60, 90)
  reminderMinutes: number;        // Auto-reminder before appointment (0=off, 15, 30, 60)
  autoConfirmOnline: boolean;     // Auto-confirm online bookings
  colorByStatus: boolean;         // Color event cards by status in day view
  compactView: boolean;           // Compact grid with smaller slot heights
  whatsappReminder: boolean;      // Enable WhatsApp reminder notifications
  onlineBooking: {
    enabled: boolean;
    leadTimeMinutes: number;      // Min advance notice (60)
    maxAdvanceDays: number;       // Max future booking (30 days)
    cancellationMinutes: number;  // Cancel deadline (120)
    requireDeposit: boolean;
  };
}

export interface SystemSettings {
  company: CompanySettings;
  hr: HRSettings;
  financial: FinancialSettings;
  projects: ProjectSettings;
  notifications: NotificationSettings;
  agenda: AgendaSettings;
}

export interface Service {
  id: string;
  name: string;
  description: string;
  price: number;
  cost: number;
  type: 'Recurring' | 'One-Time';
  active: boolean;

  // Barbershop Fields
  duration?: number;                 // Duration in minutes (default 30)
  category?: string;                 // corte | barba | combo | tratamento | sobrancelha
  commission?: number;               // % commission for main professional
  assistantCommission?: number;      // % commission for assistant
  priceVaries?: boolean;             // Price can change per client
  returnForecast?: number;           // Days until expected return
  allowsOnlineBooking?: boolean;     // Available for client self-booking
  registerAllProfessionals?: boolean; // Auto-assign to all barbers
  image?: string;                    // Service image URL
  unitId?: string;                   // Multi-unit: null=global, uuid=unit-exclusive
}

// New Bank Account Types
export type AccountType = 'Checking' | 'Savings' | 'CreditCard' | 'Investment' | 'Cash';

export interface BankAccount {
  id: string;
  name: string;
  institution: string; // e.g., Nubank, Itaú
  type: AccountType;
  balance: number; // For CreditCard, this is the current Invoice amount
  limit?: number; // Only for Credit Cards
  dueDate?: number; // Day of month (e.g., 10) for Invoice Due Date
  color: string; // Hex for UI card background
  archived: boolean;
  isDefault?: boolean;
}

// ============ NEW ERP TYPES ============

// Calendar Enhanced Types
export type CalendarEventType = 'meeting' | 'call' | 'follow_up' | 'deadline' | 'personal' | 'holiday';
export type CalendarEventStatus = 'scheduled' | 'confirmed' | 'completed' | 'cancelled';

// Pipeline CRM Types
export type PipelineStage = 'lead' | 'qualified' | 'proposal' | 'negotiation' | 'won' | 'lost';

// Performance Review Types
export interface PerformanceCriterion {
  id: string;
  name: string;
  score: 1 | 2 | 3 | 4 | 5;
}

export interface PerformanceReview {
  id: string;
  employeeId: string;
  reviewerId: string;
  direction: 'self' | 'manager' | 'peer' | 'upward';
  type: 'monthly' | 'quarterly' | 'annual';
  period: string;
  criteria: PerformanceCriterion[];
  overallScore: number;
  positives?: string;
  improvements?: string;
  goals?: string;
  createdAt: string;
}

// Time Entry Types (Banco de Horas)
export interface TimeEntry {
  id: string;
  employeeId: string;
  date: string;
  clockIn?: string;
  clockOut?: string;
  breakMinutes?: number;
  totalMinutes?: number;
  type: 'regular' | 'overtime' | 'vacation' | 'sick';
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

// Vacation Types
export interface VacationPeriod {
  id: string;
  employeeId: string;
  startDate: string;
  endDate: string;
  type: 'vacation' | 'pecuniary';
  status: 'pending' | 'approved' | 'rejected' | 'in_progress' | 'completed';
  approvedBy?: string;
  approvedAt?: string;
  notes?: string;
  createdAt: string;
}

// Credentials Types
export type CredentialCategory = 'hosting' | 'social' | 'tools' | 'api' | 'analytics' | 'email' | 'other';

export interface ServiceCredential {
  id: string;
  clientId: string;
  clientName: string;
  category: CredentialCategory;
  serviceName: string;
  url?: string;
  username?: string;
  password?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// Goals Types
export type GoalType = 'revenue' | 'mrr' | 'contracts' | 'clients';

export interface Goal {
  id: string;
  type: GoalType;
  title: string;
  targetValue: number;
  currentValue: number;
  period: 'monthly' | 'quarterly' | 'annual';
  startDate: string;
  endDate: string;
  assignedTo: string[];
  createdAt: string;
}

// Payroll Types
export interface Commission {
  id: string;
  employeeId: string;
  amount: number;
  source: string;
  period: string;
  status: 'pending' | 'paid';
  createdAt: string;
}

export interface Withdrawal {
  id: string;
  employeeId: string;
  amount: number;
  reason: 'advance' | 'loan' | 'deduction' | 'other';
  description?: string;
  date: string;
  status: 'pending' | 'approved' | 'compensated';
  createdAt: string;
}

export interface PaymentRecord {
  id: string;
  employeeId: string;
  period: string; // YYYY-MM
  grossSalary: number;
  netSalary: number;
  inss: number;
  irrf: number;
  fgts: number;
  commissions: number;
  deductions: number;
  status: 'pending' | 'processing' | 'paid' | 'partial';
  paidAt?: string;
  paidBy?: string;
  paymentMethod?: 'pix' | 'transfer' | 'cash';
  transactionId?: string;
  notes?: string;
  receiptUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PayrollPeriod {
  id: string;
  period: string; // YYYY-MM
  status: 'open' | 'closed';
  closedAt?: string;
  closedBy?: string;
  createdAt: string;
}

// Weekly Check-in Types
export interface WeeklyCheckin {
  id: string;
  employeeId: string;
  weekStart: string;
  satisfaction: 1 | 2 | 3 | 4 | 5;
  highlights?: string;
  blockers?: string;
  needHelp?: string;
  createdAt: string;
}

// Client Interaction Types
export type InteractionType = 'call' | 'email' | 'meeting' | 'whatsapp' | 'note';

export interface ClientInteraction {
  id: string;
  clientId: string;
  type: InteractionType;
  title: string;
  description?: string;
  date: string;
  userId: string;
  createdAt: string;
}

// ============ FASE 2: NOVOS TIPOS ============

// Permissions Types
export interface PermissionMatrix {
  [resource: string]: boolean | { [action: string]: boolean };
}

export interface RolePermission {
  id: string; // UUID
  role: 'ADMIN' | 'MANAGER' | 'SALES' | 'SUPPORT';
  permissions: PermissionMatrix;
  updatedAt: string;
}

// App Settings DB Wrapper
export interface AppSettingsDB {
  id: string;
  company: CompanySettings;
  hr: HRSettings;
  financial: FinancialSettings;
  projects: ProjectSettings;
  notifications: NotificationSettings;
  updatedAt: string;
}

// Notification System
export interface Notification {
  id: string;
  type: 'info' | 'warning' | 'success' | 'error';
  title: string;
  message: string;
  read: boolean;
  action?: { label: string; path: string };
  createdAt: string;
}

export interface PipelineStageItem {
  id: string;
  clientId: string;
  stage: string;
  notes?: string;
  updatedAt: string;
}

export interface RecurringExpense {
  id: string;
  name: string;
  description?: string;
  amount: number;
  category: string;
  dueDay: number;
  recurrence: string;
  status: string;
  lastPaidAt?: string;
  lastPaidAmount?: number;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

// ============ BARBERSHOP TYPES ============

export interface Product {
  id: string;
  name: string;
  description?: string;
  brand?: string;
  category: string;       // pomada | gel | shampoo | oleo | acessorio
  costPrice: number;
  sellPrice: number;
  stock: number;
  minStock: number;
  active: boolean;
  image?: string;         // Product image URL
  barcode?: string;       // EAN/SKU code
  unit?: string;          // un | ml | g | kg
  weight?: number;        // Weight for shipping/inventory
  notes?: string;         // Internal notes
  supplierId?: string;    // FK to product_suppliers
  unitId?: string;        // Multi-unit: null=global, uuid=unit-exclusive stock
  createdAt?: string;
  updatedAt?: string;
}

export interface ProductSupplier {
  id: string;
  name: string;
  contactName?: string;
  phone?: string;
  email?: string;
  website?: string;
  cnpj?: string;
  address?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ProductMovement {
  id: string;
  productId: string;
  type: 'entrada' | 'saida' | 'ajuste' | 'venda';
  quantity: number;
  previousStock: number;
  newStock: number;
  reason?: string;
  referenceId?: string;
  createdBy?: string;
  createdAt?: string;
}

export type ComandaStatus = 'open' | 'in_progress' | 'closed' | 'cancelled';

export interface Comanda {
  id: string;
  clientId?: string;
  clientName?: string;
  barberId: string;
  barberName?: string;
  status: ComandaStatus;
  totalAmount: number;
  discountAmount: number;
  finalAmount: number;
  paymentMethod?: string;
  notes?: string;
  openedAt: string;
  closedAt?: string;
  createdAt?: string;
  updatedAt?: string;
  items?: ComandaItem[]; // Loaded via join
  unitId?: string;       // Multi-unit FK
  appointmentId?: string; // FK to calendar_events (1:1 link)
  origin?: 'agenda' | 'balcao' | 'recorrencia' | 'clube' | 'manual';
  openedBy?: string;      // userId who opened
  closedBy?: string;      // userId who closed
}

export interface ComandaItem {
  id: string;
  comandaId: string;
  type: 'service' | 'product';
  itemId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  createdAt?: string;

  // Subscription discount tracking
  subscriptionDiscount?: number;  // % desconto aplicado pelo plano
  originalPrice?: number;          // preço original antes do desconto
}

// Purchase Orders (Compras de Produtos)
export interface PurchaseOrder {
  id: string;
  supplierId?: string;
  supplierName: string;
  nfNumber?: string;
  orderDate: string;
  deliveryDate?: string;
  status: 'pending' | 'received' | 'cancelled';
  totalAmount: number;
  notes?: string;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
  items?: PurchaseOrderItem[];
}

export interface PurchaseOrderItem {
  id: string;
  purchaseOrderId: string;
  productId?: string;
  productName: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  createdAt?: string;
}

// Subscription Types

export interface PlanServiceRule {
  serviceId: string;
  discount: number;                // 0-100%
  monthlyLimit?: number;           // null = unlimited
  commissionType: 'default' | 'fixed' | 'percentage' | 'time';
  customCommission?: number;       // value when commissionType != 'default'
}

export interface PlanProductRule {
  productId: string;
  discount: number;                // 0-100%
  monthlyLimit?: number;           // null = unlimited
  commission?: number;             // % commission for professional
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  description?: string;
  price: number;                   // Legacy/default price
  servicesIncluded: string[];      // Legacy — kept for backward compat
  maxUsesPerMonth?: number;        // Legacy
  durationDays: number;
  active: boolean;

  // V2 Fields
  recurrence: 'monthly' | 'quarterly' | 'semiannual' | 'annual';
  availableForSale: boolean;
  creditEnabled: boolean;
  creditPrice?: number;
  boletoEnabled: boolean;
  boletoPrice?: number;
  benefits: string[];              // Free-text benefit descriptions
  planServices: PlanServiceRule[];  // Service rules with discount/limit/commission
  planProducts: PlanProductRule[];  // Product rules with discount/limit/commission
  disabledDays: number[];          // 0=Dom, 1=Seg... 6=Sab
  excludedProfessionals: string[]; // Member IDs

  // Multi-Unit Scope
  unitScope: 'all' | 'specific';   // Funciona em todas ou só em unidades específicas?
  allowedUnitIds: string[];        // Se 'specific': quais unidades?

  // Combo Mode (fractional quota)
  comboMode?: boolean;             // true = booking all combo services = 1 use, partial = 0.5
  comboServiceIds?: string[];      // Service IDs that form the combo group

  createdAt?: string;
  updatedAt?: string;
}

export interface Subscription {
  id: string;
  planId: string;
  clientId: string;
  clientName?: string;
  status: 'active' | 'paused' | 'cancelled' | 'overdue' | 'pending_payment';
  startDate: string;
  endDate?: string;
  usesThisMonth: number;
  paymentDay: number;

  // Billing / Gateway fields
  paymentMethod?: 'credit' | 'boleto' | 'pix';
  gatewayCustomerId?: string;
  gatewaySubscriptionId?: string;
  lastPaymentDate?: string;
  nextPaymentDate?: string;
  invoiceUrl?: string;
  cardBrand?: string;           // visa, mastercard, elo...
  cardLast4?: string;           // últimos 4 dígitos
  billingEmail?: string;        // email de cobrança

  // Sales / Commission fields
  soldBy?: string;              // memberId de quem vendeu
  soldByName?: string;          // nome do vendedor (cache)
  saleChannel?: string;         // presencial, instagram, indicação, site...
  saleCommission?: number;      // valor ou % de comissão pela venda
  saleCommissionType?: 'fixed' | 'percentage';

  // Contract fields
  autoRenew?: boolean;
  cancellationReason?: string;
  notes?: string;               // observações internas

  // Unit binding (Decisão #8)
  unitId?: string;              // Unidade onde a assinatura é válida

  // Billing lifecycle
  currentInvoiceUrl?: string;
  currentBankSlipUrl?: string;
  currentPixQrCode?: string;
  lastWebhookAt?: string;
  failedAttempts?: number;
  pausedAt?: string;
  cancelledAt?: string;

  // Scheduled plan change
  pendingPlanId?: string;
  pendingPlanName?: string;
  planChangeScheduledAt?: string;

  createdAt?: string;
  updatedAt?: string;
  plan?: SubscriptionPlan;        // Joined data
}

// Work Schedule Types
export interface WorkSchedule {
  id: string;
  memberId: string;
  dayOfWeek: number;              // 0=Dom, 1=Seg... 6=Sab
  startTime?: string;             // "09:00"
  endTime?: string;               // "18:00"
  breakStart?: string;            // "12:00"
  breakEnd?: string;              // "13:00"
  isOff: boolean;
  templateName?: string;          // "Integral" | "Meio" | "Custom"
  createdAt?: string;
  updatedAt?: string;
}

// Multi-Unit Types
export interface Unit {
  id: string;
  name: string;
  tradeName?: string;
  cnpj?: string;
  address: string;
  city: string;
  state: string;
  zip?: string;
  phone: string;
  email?: string;
  managerId?: string;
  managerName?: string;
  status: 'active' | 'inactive' | 'opening';
  image?: string;
  coverImage?: string;     // Banner/cover image URL
  profileImage?: string;   // Logo/profile image URL
  openingDate?: string;
  maxCapacity?: number;
  operatingHours?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string;       // Soft-delete timestamp (null = active)
}

export interface UnitMember {
  id: string;
  unitId: string;
  userId: string;
  role?: string;
  isPrimary?: boolean;
  createdAt?: string;
}

// Client Unit Settings (auto-reassignment config)
export interface ClientUnitSettings {
  autoReassignEnabled: boolean;       // Ativa auto-reatribuicao
  reassignWindowDays: number;         // Janela de avaliacao (padrao: 60)
  reassignMinAppointments: number;    // Minimo de agendamentos (padrao: 3)
  reassignThresholdPercent: number;   // % minimo para trocar (padrao: 60)
  notifyOnReassign: boolean;          // Notificar ao reatribuir
}

// ============ NOTA FISCAL TYPES ============

export type InvoiceDocType = 'nfse' | 'nfe' | 'nfce';
export type InvoiceStatus = 'draft' | 'queued' | 'processing' | 'authorized' | 'rejected' | 'cancelled';
export type CertificateStatus = 'valid' | 'expiring' | 'expired' | 'missing';
export type FiscalStatus = 'active' | 'irregular' | 'pending';

// --- Dados Fiscais do Profissional (barbeiro) ---
export interface ProfessionalFiscalData {
  id: string;
  memberId: string;
  cnpj: string;
  razaoSocial: string;
  nomeFantasia?: string;
  taxRegime: 'mei' | 'simples' | 'presumido';
  emissionVia: 'cnpj_proprio' | 'cnpj_empresa';
  municipalRegistration?: string;
  stateRegistration?: string;
  cnae?: string;
  // Address
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  // Certificate
  certificateFile?: string;
  certificatePassword?: string;
  certificateName?: string;
  certificateExpiry?: string;
  certificateStatus: CertificateStatus;
  // Status
  fiscalStatus: FiscalStatus;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

// --- NFS-e Config ---
export interface NfseConfig {
  environment: 'homologacao' | 'producao';
  series: string;
  nextNumber: number;
  issRate: number;
  defaultServiceCode?: string;
}

// --- NFC-e Config ---
export interface NfceConfig {
  environment: 'homologacao' | 'producao';
  series: string;
  csc: string;
  tokenId: string;
}

// --- Emitente (empresa ou profissional) ---
export interface InvoiceEmitter {
  id: string;
  type: 'company' | 'professional';
  name: string;
  tradeName?: string;
  cnpj: string;
  taxRegime?: string;
  municipalRegistration?: string;
  stateRegistration?: string;
  cnae?: string;
  address: string;
  city: string;
  state: string;
  zip?: string;
  email: string;
  phone?: string;
  // NFS-e settings
  nfseEnvironment?: 'homologacao' | 'producao';
  nfseSeries?: string;
  nfseNextNumber?: number;
  nfseIssRate?: number;
  defaultServiceCode?: string;
  // NFC-e settings
  nfceEnvironment?: 'homologacao' | 'producao';
  nfceSeries?: string;
  nfceCsc?: string;
  nfceTokenId?: string;
  // Legacy (keep backward compat)
  series?: string;
  nextNumber?: number;
  // Certificate
  certificateFile?: string;
  certificatePassword?: string;
  certificateName?: string;
  certificateExpiry?: string;
  certificateStatus?: CertificateStatus;
  // Meta
  active: boolean;
  memberId?: string;
  unitId?: string;
}

// --- Item da Nota ---
export interface InvoiceItem {
  id: string;
  type: 'service' | 'product';
  sourceId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  fiscalCode?: string;
  cfop?: string;
  issRate?: number;
  icmsRate?: number;
}

// --- Evento do Histórico da NF ---
export interface InvoiceEvent {
  id: string;
  type: 'created' | 'queued' | 'sent' | 'authorized' | 'rejected' | 'cancelled' | 'corrected' | 'email_sent' | 'pdf_generated';
  description: string;
  timestamp: string;
  userId?: string;
  metadata?: Record<string, string>;
}

// --- Nota Fiscal ---
export interface Invoice {
  id: string;
  number?: string;
  series?: string;
  docType: InvoiceDocType;
  status: InvoiceStatus;
  emitterId: string;
  emitterName: string;
  clientId?: string;
  clientName: string;
  clientCpfCnpj?: string;
  clientEmail?: string;
  clientAddress?: string;
  comandaId?: string;
  appointmentId?: string;
  professionalId?: string;
  professionalName?: string;
  items: InvoiceItem[];
  totalServices: number;
  totalProducts: number;
  totalAmount: number;
  discountAmount: number;
  issTotal?: number;
  icmsTotal?: number;
  pisTotal?: number;
  cofinsTotal?: number;
  taxSummary?: string;
  protocolNumber?: string;
  authorizationDate?: string;
  rejectionReason?: string;
  cancellationReason?: string;
  correctionText?: string;
  pdfUrl?: string;
  xmlUrl?: string;
  events: InvoiceEvent[];
  notes?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// --- Configurações Fiscais Globais ---
export interface FiscalSettings {
  id?: string;
  autoEmitOnClose: boolean;
  autoSendEmail: boolean;
  defaultDocType: InvoiceDocType;
  defaultEmitterId?: string;
  splitMixedComanda: boolean;
  apiProvider: 'focus_nfe' | 'nfe_io' | 'plugnotas' | 'none';
  apiKey?: string;
  apiEnvironment: 'sandbox' | 'production';
  cancellationWindowHours: number;
  emailTemplate?: string;
  unitId?: string;
  // Subscription NF settings
  autoEmitOnSubscription?: boolean;
  includePlanDetails?: boolean;
  // Tax rates for dashboard indicators
  pisRate?: number;
  cofinsRate?: number;
  updatedAt?: string;
}

// ============ PUBLIC BOOKING APP TYPES ============

export interface ReferralGoal {
  id: string;
  target: number;           // Number of referrals needed (e.g., 5, 8, 12)
  prize: string;            // Prize description (e.g., "Hidratação Grátis")
  icon: string;             // Lucide icon name (e.g., "droplets", "gift", "bottle")
  serviceId?: string;       // FK to services.id — if redeemable as service booking
  active: boolean;
  createdAt?: string;
}

export interface Coupon {
  id: string;
  code: string;             // Unique coupon code (e.g., "VS10")
  discountType: 'percentage' | 'fixed';
  discountValue: number;    // Percentage (0-100) or fixed amount in R$
  minAmount?: number;       // Minimum order amount to apply
  maxUses?: number;         // Max total uses (null = unlimited)
  usedCount: number;        // Current use count
  validFrom?: string;       // ISO timestamp
  validUntil?: string;      // ISO timestamp (null = no expiry)
  active: boolean;
  createdAt?: string;
}

// ══════════════════════════════════════════════════
// Push Notifications
// ══════════════════════════════════════════════════

export interface PushCampaign {
  id: string;
  type: string;
  title: string;
  body: string;
  imageUrl?: string;
  targetUrl?: string;
  segment?: string;
  targetClientId?: string;
  filterCriteria?: Record<string, unknown>;
  schedule?: string;
  recurrence?: string;
  enabled: boolean;
  status: 'draft' | 'scheduled' | 'recurring' | 'sent' | 'failed';
  sentCount: number;
  failedCount: number;
  scheduledAt?: string;
  sentAt?: string;
  createdAt?: string;
  createdBy?: string;
}

export interface PushAutomationConfig {
  id: string; // 'reminder' | 'review' | 'incomplete' | 'birthday'
  enabled: boolean;
  config: Record<string, unknown>;
  messageTemplate: string;
  imageUrl?: string;
  updatedAt?: string;
}

export interface PushLogEntry {
  id: string;
  campaignId?: string;
  clientId?: string;
  type: string;
  title: string;
  body?: string;
  status: 'sent' | 'failed';
  errorDetail?: string;
  createdAt?: string;
}

// ============================================
// Billing Gateway Types (ASAAS Integration)
// ============================================

export interface BillingGatewayConfig {
  id: string;
  provider: string;
  environment: 'sandbox' | 'production';
  apiKey: string;
  webhookSecret?: string;
  webhookUrl?: string;
  active: boolean;
  autoCreateCustomer: boolean;
  autoCharge: boolean;
  sendNotifications: boolean;
  daysBeforeDue: number;
  maxRetries: number;
  finePercent: number;
  interestPercent: number;
  enableCredit: boolean;
  enableBoleto: boolean;
  enablePix: boolean;
  unitId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface BillingEvent {
  id: string;
  subscriptionId?: string;
  clientId?: string;
  asaasPaymentId?: string;
  event: string;
  status: string;
  amount?: number;
  billingType?: string;
  dueDate?: string;
  paymentDate?: string;
  invoiceUrl?: string;
  bankSlipUrl?: string;
  pixQrCode?: string;
  raw?: Record<string, unknown>;
  processedAt?: string;
  createdAt?: string;
}

export interface SubscriptionUsageLog {
  id: string;
  subscriptionId: string;
  comandaId?: string;
  comandaItemId?: string;
  itemId: string;
  type: 'service' | 'product';
  discountApplied: number;
  originalPrice?: number;
  finalPrice?: number;
  usedAt?: string;
  createdAt?: string;
}
