import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import {
    Client, Contract, TeamMember, Transaction, PersonalTask, CalendarEvent, PaymentRecord,
    Budget, Service, ProjectTask, BankAccount,
    PerformanceReview, VacationPeriod, TimeEntry, ServiceCredential, Goal,
    Commission, Withdrawal, PayrollPeriod, WeeklyCheckin, ClientInteraction,
    PerformanceCriterion, CredentialCategory, GoalType, InteractionType,
    SystemSettings, RolePermission, Notification, Project, PipelineStageItem, RecurringExpense,
    Product, Comanda, Unit, UnitMember, SubscriptionPlan, Subscription, ClientReview
}
    from '../types';
import {
    MOCK_COMPANY_SETTINGS, MOCK_HR_SETTINGS, MOCK_FINANCIAL_SETTINGS,
    MOCK_PROJECT_SETTINGS, MOCK_NOTIFICATION_SETTINGS, MOCK_ROLES_PERMISSIONS
} from '../constants';

interface AppData {
    clients: Client[];
    contracts: Contract[];
    members: TeamMember[];
    transactions: Transaction[];
    personalTasks: PersonalTask[];
    calendarEvents: CalendarEvent[];
    budgets: Budget[];
    services: Service[];
    projects: Project[];
    projectTasks: ProjectTask[];
    bankAccounts: BankAccount[];
    // New Entities
    reviews: PerformanceReview[];
    vacations: VacationPeriod[];
    timeEntries: TimeEntry[];
    credentials: ServiceCredential[];
    goals: Goal[];
    commissions: Commission[];
    withdrawals: Withdrawal[];
    payrollPeriods: PayrollPeriod[];
    paymentRecords: PaymentRecord[];
    checkins: WeeklyCheckin[];
    clientInteractions: ClientInteraction[];
    // Phase 2 Entities
    settings: SystemSettings | null;
    permissions: RolePermission[];
    notifications: Notification[];
    pipelineStages: PipelineStageItem[];
    recurringExpenses: RecurringExpense[];
    // Barbershop Entities
    products: Product[];
    comandas: Comanda[];
    // Multi-Unit
    units: Unit[];
    unitMembers: UnitMember[];
    // Subscriptions
    subscriptionPlans: SubscriptionPlan[];
    subscriptions: Subscription[];
    // Client Reviews
    clientReviews: ClientReview[];

    loading: boolean;
    error: Error | null;

    // Setters
    setClients: (valueOrFn: Client[] | ((prev: Client[]) => Client[])) => void;
    setContracts: (valueOrFn: Contract[] | ((prev: Contract[]) => Contract[])) => void;
    setMembers: (valueOrFn: TeamMember[] | ((prev: TeamMember[]) => TeamMember[])) => void;
    setTransactions: (valueOrFn: Transaction[] | ((prev: Transaction[]) => Transaction[])) => void;
    setPersonalTasks: (valueOrFn: PersonalTask[] | ((prev: PersonalTask[]) => PersonalTask[])) => void;
    setCalendarEvents: (valueOrFn: CalendarEvent[] | ((prev: CalendarEvent[]) => CalendarEvent[])) => void;
    setBudgets: (valueOrFn: Budget[] | ((prev: Budget[]) => Budget[])) => void;
    setServices: (valueOrFn: Service[] | ((prev: Service[]) => Service[])) => void;
    setProjects: (valueOrFn: Project[] | ((prev: Project[]) => Project[])) => void;
    setProjectTasks: (valueOrFn: ProjectTask[] | ((prev: ProjectTask[]) => ProjectTask[])) => void;
    setBankAccounts: (valueOrFn: BankAccount[] | ((prev: BankAccount[]) => BankAccount[])) => void;
    setReviews: (valueOrFn: PerformanceReview[] | ((prev: PerformanceReview[]) => PerformanceReview[])) => void;
    setVacations: (valueOrFn: VacationPeriod[] | ((prev: VacationPeriod[]) => VacationPeriod[])) => void;
    setTimeEntries: (valueOrFn: TimeEntry[] | ((prev: TimeEntry[]) => TimeEntry[])) => void;
    setCredentials: (valueOrFn: ServiceCredential[] | ((prev: ServiceCredential[]) => ServiceCredential[])) => void;
    setGoals: (valueOrFn: Goal[] | ((prev: Goal[]) => Goal[])) => void;
    setCommissions: (valueOrFn: Commission[] | ((prev: Commission[]) => Commission[])) => void;
    setWithdrawals: (valueOrFn: Withdrawal[] | ((prev: Withdrawal[]) => Withdrawal[])) => void;
    setPayrollPeriods: (valueOrFn: PayrollPeriod[] | ((prev: PayrollPeriod[]) => PayrollPeriod[])) => void;
    setPaymentRecords: (valueOrFn: PaymentRecord[] | ((prev: PaymentRecord[]) => PaymentRecord[])) => void;
    setCheckins: (valueOrFn: WeeklyCheckin[] | ((prev: WeeklyCheckin[]) => WeeklyCheckin[])) => void;
    setClientInteractions: (valueOrFn: ClientInteraction[] | ((prev: ClientInteraction[]) => ClientInteraction[])) => void;

    setAppSettings: (newSettings: SystemSettings | ((prev: SystemSettings | null) => SystemSettings)) => void;
    setPermissions: (valueOrFn: RolePermission[] | ((prev: RolePermission[]) => RolePermission[])) => void;
    setNotifications: (valueOrFn: Notification[] | ((prev: Notification[]) => Notification[])) => void;
    setPipelineStages: (valueOrFn: PipelineStageItem[] | ((prev: PipelineStageItem[]) => PipelineStageItem[])) => void;
    setRecurringExpenses: (valueOrFn: RecurringExpense[] | ((prev: RecurringExpense[]) => RecurringExpense[])) => void;
    setProducts: (valueOrFn: Product[] | ((prev: Product[]) => Product[])) => void;
    setComandas: (valueOrFn: Comanda[] | ((prev: Comanda[]) => Comanda[])) => void;
    setUnits: (valueOrFn: Unit[] | ((prev: Unit[]) => Unit[])) => void;
    setUnitMembers: (valueOrFn: UnitMember[] | ((prev: UnitMember[]) => UnitMember[])) => void;
    setSubscriptionPlans: (valueOrFn: SubscriptionPlan[] | ((prev: SubscriptionPlan[]) => SubscriptionPlan[])) => void;
    setSubscriptions: (valueOrFn: Subscription[] | ((prev: Subscription[]) => Subscription[])) => void;
    setClientReviews: (valueOrFn: ClientReview[] | ((prev: ClientReview[]) => ClientReview[])) => void;

    refresh: (silent?: boolean) => Promise<void>;
}

const AppDataContext = createContext<AppData | null>(null);

export const AppDataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [dataState, setDataState] = useState<Omit<AppData, 'setClients' | 'setContracts' | 'setMembers' | 'setTransactions' | 'setPersonalTasks' | 'setCalendarEvents' | 'setBudgets' | 'setServices' | 'setProjects' | 'setProjectTasks' | 'setBankAccounts' | 'setReviews' | 'setVacations' | 'setTimeEntries' | 'setCredentials' | 'setGoals' | 'setCommissions' | 'setWithdrawals' | 'setPayrollPeriods' | 'setPaymentRecords' | 'setCheckins' | 'setClientInteractions' | 'setAppSettings' | 'setPermissions' | 'setNotifications' | 'setPipelineStages' | 'setRecurringExpenses' | 'setProducts' | 'setComandas' | 'setUnits' | 'setUnitMembers' | 'setSubscriptionPlans' | 'setSubscriptions' | 'setClientReviews' | 'refresh'>>({

        clients: [],
        contracts: [],
        members: [],
        transactions: [],
        personalTasks: [],
        calendarEvents: [],
        budgets: [],
        services: [],
        projects: [],
        projectTasks: [],
        bankAccounts: [],
        reviews: [],
        vacations: [],
        timeEntries: [],
        credentials: [],
        goals: [],
        commissions: [],
        withdrawals: [],
        payrollPeriods: [],
        paymentRecords: [],
        checkins: [],
        clientInteractions: [],
        settings: null,
        permissions: [],
        notifications: [],
        pipelineStages: [],
        recurringExpenses: [],
        products: [],
        comandas: [],
        units: [],
        unitMembers: [],
        subscriptionPlans: [],
        subscriptions: [],
        clientReviews: [],

        loading: true,
        error: null,
    });

    const loadFromSupabase = useCallback(async (silent = false) => {
        try {
            if (!silent) {
                setDataState(prev => ({ ...prev, loading: true, error: null }));
            }

            const [
                clientsRes, contractsRes, usersRes, transactionsRes,
                tasksRes, eventsRes, budgetsRes, servicesRes,
                projectTasksRes, bankAccountsRes,
                projectsRes,
                reviewsRes, vacationsRes, timeEntriesRes, credentialsRes,
                goalsRes, commissionsRes, withdrawalsRes, payrollPeriodsRes,
                paymentRecordsRes,
                checkinsRes, interactionsRes,
                settingsRes, permissionsRes, notificationsRes, pipelineStagesRes,
                recurringExpensesRes,
                productsRes, comandasRes,
                unitsRes, unitMembersRes,
                subscriptionPlansRes, subscriptionsRes,
                clientReviewsRes
            ] = await Promise.all([
                supabase.from('clients').select('*').order('createdAt', { ascending: false }),
                supabase.from('contracts').select('*').order('createdAt', { ascending: false }),
                supabase.from('users').select('*, team_members(*)').order('createdAt', { ascending: false }),
                supabase.from('transactions').select('*').order('date', { ascending: false }),
                supabase.from('personal_tasks').select('*').order('createdAt', { ascending: false }),
                supabase.from('calendar_events').select('*').order('date', { ascending: false }),
                supabase.from('budgets').select('*').order('createdAt', { ascending: false }),
                supabase.from('services').select('*').order('createdAt', { ascending: false }),
                supabase.from('tasks').select('*').order('createdAt', { ascending: false }),
                supabase.from('bank_accounts').select('*').order('createdAt', { ascending: false }),
                supabase.from('projects').select('*').order('createdAt', { ascending: false }),
                // New Tables
                supabase.from('evaluations').select('*').order('createdAt', { ascending: false }),
                supabase.from('vacations').select('*').order('createdAt', { ascending: false }),
                supabase.from('time_entries').select('*').order('date', { ascending: false }),
                supabase.from('service_credentials').select('*').order('createdAt', { ascending: false }),
                supabase.from('goals').select('*').order('createdAt', { ascending: false }),
                supabase.from('commissions').select('*').order('createdAt', { ascending: false }),
                supabase.from('withdrawals').select('*').order('date', { ascending: false }),
                supabase.from('payroll_periods').select('*').order('period', { ascending: false }),
                supabase.from('payment_records').select('*').order('createdAt', { ascending: false }),
                supabase.from('weekly_checkins').select('*').order('periodStart', { ascending: false }),
                supabase.from('client_interactions').select('*').order('date', { ascending: false }),
                // Phase 2 Tables
                supabase.from('app_settings').select('*').limit(1),
                supabase.from('role_permissions').select('*'),
                supabase.from('system_notifications').select('*').order('createdAt', { ascending: false }),
                supabase.from('pipeline_stages').select('*'),
                supabase.from('recurring_expenses').select('*').order('dueDay', { ascending: true }),
                // Barbershop Tables
                supabase.from('products').select('*').order('name', { ascending: true }),
                supabase.from('comandas').select('*, comanda_items:comanda_items(*)').order('openedAt', { ascending: false }),
                // Multi-Unit Tables
                supabase.from('units').select('*').order('createdAt', { ascending: false }),
                supabase.from('unit_members').select('*'),
                // Subscriptions
                supabase.from('subscription_plans').select('*').order('name', { ascending: true }),
                supabase.from('subscriptions').select('*, subscription_plans(*)').order('createdAt', { ascending: false }),
                // Client Reviews
                supabase.from('client_reviews').select('*').order('createdAt', { ascending: false }),
            ]);

            const clients: Client[] = (clientsRes.data || []).map(c => ({
                id: c.id,
                name: c.name,
                company: c.company || '',
                email: c.email,
                phone: c.phone || '',
                status: c.status === 'ACTIVE' ? 'Active' :
                    c.status === 'INACTIVE' ? 'Inactive' :
                        c.status === 'LEAD' ? 'Lead' : 'Churned',
                revenue: Number(c.totalValue) || 0,
                monthlyValue: Number(c.monthlyValue) || 0,
                setupValue: Number(c.setupValue) || 0,
                totalValue: Number(c.totalValue) || 0,
                monthsActive: c.monthsActive || 0,
                origin: c.origin,
                segment: c.segment,
                lastContact: c.lastContact,
                image: c.avatar,
                avatar: c.avatar,
                birthday: c.birthday ? c.birthday.split('T')[0] : undefined,
                salesExecutiveId: c.salesExecutiveId,
                lastVisit: c.lastVisit,
                preferredBarberId: c.preferredBarberId,
                totalVisits: c.totalVisits ?? 0,
                gender: c.gender || undefined,
                cpfCnpj: c.cpfCnpj || undefined,
                unitId: c.unitId || undefined,
            }));

            const contracts: Contract[] = (contractsRes.data || []).map(c => ({
                id: c.id,
                title: c.title,
                clientId: c.clientId,
                salesExecutiveId: c.salesExecutiveId || '',
                monthlyValue: Number(c.monthlyValue),
                setupValue: Number(c.setupValue) || 0,
                contractDuration: c.contractDuration,
                startDate: c.startDate,
                endDate: c.endDate,
                status: c.status === 'ACTIVE' ? 'Active' :
                    c.status === 'CANCELLED' ? 'Cancelled' :
                        c.status === 'PENDING' ? 'Pending' : 'Ended',
            }));

            const members: TeamMember[] = (usersRes.data || []).map(u => {
                const tm = Array.isArray(u.team_members) ? u.team_members[0] : u.team_members;
                // Normalize birthDate: database returns "1995-06-15T00:00:00", form needs "1995-06-15"
                const rawBirthday = tm?.birthDate || tm?.birth_date;
                const normalizedBirthday = rawBirthday ? rawBirthday.split('T')[0] : undefined;
                return {
                    id: u.id,
                    name: u.name,
                    email: u.email,
                    password: u.password,
                    role: u.role === 'ADMIN' ? 'Admin' :
                        u.role === 'MANAGER' ? 'Manager' :
                            u.role === 'SALES' ? 'Sales Executive' :
                                u.role === 'BARBER' ? 'Barber' :
                                    u.role === 'ATTENDANT' ? 'Attendant' : 'Support',
                    status: 'Active' as const,
                    phone: u.phone,
                    avatar: u.avatar,
                    image: u.avatar,
                    joinDate: (tm?.joinDate || u.createdAt)?.split('T')[0], // Also normalize joinDate
                    commissionRate: tm?.commissionRate || 0.20,
                    subscriptionCommission: tm?.subscriptionCommission || 0.20,
                    productCommission: tm?.productCommission || 0.10,
                    baseSalary: tm?.baseSalary || 0,
                    salary: tm?.baseSalary || 0,
                    cpf: tm?.cpf,
                    birthday: normalizedBirthday,
                    // Contract & RH fields
                    contractType: tm?.contractType || 'CLT',
                    paymentPreference: tm?.paymentPreference || 'Mensal',
                    pixKey: tm?.pixKey || '',
                    bankInfo: tm?.bankInfo || { bank: '', agency: '', account: '', accountType: 'Corrente' },
                    admissionDate: tm?.admissionDate?.split('T')[0] || (tm?.joinDate || u.createdAt)?.split('T')[0],
                    teamMemberId: tm?.id || undefined, // FK ID from team_members table
                    // Barbershop fields
                    station: tm?.station || undefined,
                    specialties: tm?.specialties || undefined,
                };
            });

            const transactions: Transaction[] = (transactionsRes.data || []).map(t => ({
                id: t.id,
                description: t.description,
                amount: Number(t.amount),
                type: t.type.toLowerCase() as 'income' | 'expense' | 'commission',
                date: t.date?.split('T')[0] || t.date,
                createdAt: t.createdAt?.split('T')[0] || t.createdAt,
                category: t.category,
                status: t.status === 'COMPLETED' ? 'Completed' :
                    t.status === 'PENDING' ? 'Pending' : 'Overdue',
                clientId: t.clientId || undefined,
                accountId: t.accountId,
                unitId: t.unitId || undefined,
            }));

            const personalTasks: PersonalTask[] = (tasksRes.data || []).map(t => ({
                id: t.id,
                text: t.text,
                scope: t.scope?.toLowerCase() as 'day' | 'week' | 'month',
                completed: t.completed,
                createdAt: t.createdAt,
                completedAt: t.completedAt,
                assigneeId: t.assigneeId,
            }));

            const calendarEvents: CalendarEvent[] = (eventsRes.data || []).map(e => {
                const eventDate = new Date(e.date);
                return {
                    id: e.id,
                    title: e.title,
                    type: e.type?.toLowerCase() as CalendarEvent['type'],
                    startTime: e.startTime,
                    endTime: e.endTime,
                    date: eventDate.getDate(),       // Day 1-31 (number)
                    month: eventDate.getMonth(),     // Month 0-11 (number)
                    year: eventDate.getFullYear(),   // Year (number)
                    client: e.clientName,
                    observation: e.observation,
                    color: e.color,
                    barberId: e.barberId || undefined,
                    barberName: e.barberName || undefined,
                    serviceId: e.serviceId || undefined,
                    serviceName: e.serviceName || undefined,
                    duration: e.duration ? Number(e.duration) : undefined,
                    unitId: e.unitId || undefined,
                    source: e.source || 'manual',
                    status: e.status || 'confirmed',
                    serviceIds: Array.isArray(e.serviceIds) ? e.serviceIds : (typeof e.serviceIds === 'string' ? JSON.parse(e.serviceIds || '[]') : []),
                    comandaId: e.comandaId || undefined,
                };
            });

            const budgets: Budget[] = (budgetsRes.data || []).map(b => ({
                id: b.id,
                clientId: b.clientId,
                title: b.title,
                status: b.status || 'Draft',
                items: b.items || [],
                totalValue: Number(b.totalValue) || 0,
                discount: Number(b.discount) || 0,
                createdAt: b.createdAt || new Date().toISOString(),
                validUntil: b.validUntil,
                notes: b.notes,
            }));

            const services: Service[] = (servicesRes.data || []).map(s => ({
                id: s.id,
                name: s.name,
                description: s.description || '',
                price: Number(s.price) || 0,
                cost: Number(s.cost) || 0,
                type: s.type === 'RECURRING' ? 'Recurring' : 'One-Time',
                active: s.active ?? true,
                duration: s.duration ?? 30,
                category: s.category || 'corte',
                commission: Number(s.commission) ?? 50,
                assistantCommission: Number(s.assistantCommission) ?? 0,
                priceVaries: s.priceVaries ?? false,
                returnForecast: s.returnForecast ?? 30,
                allowsOnlineBooking: s.allowsOnlineBooking ?? true,
                registerAllProfessionals: s.registerAllProfessionals ?? true,
                image: s.image || undefined,
                unitId: s.unitId || undefined,
            }));

            const projects: Project[] = (projectsRes.data || []).map(p => ({
                id: p.id,
                title: p.title,
                description: p.description || '',
                clientId: p.clientId,
                status: p.status,
                priority: p.priority,
                progress: p.progress || 0,
                startDate: p.startDate,
                dueDate: p.dueDate,
                budget: Number(p.budget) || 0,
                tags: p.tags || [],
                createdAt: p.createdAt || new Date().toISOString(),
            }));

            const projectTasks: ProjectTask[] = (projectTasksRes.data || []).map(t => {
                const createdAt = t.createdAt ? new Date(t.createdAt) : new Date();
                const deadlineDays = t.deadline || 7;
                const dueDate = new Date(createdAt);
                dueDate.setDate(dueDate.getDate() + deadlineDays);
                const now = new Date();
                const diffMs = dueDate.getTime() - now.getTime();
                const dynamicDaysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
                const status = (t.status?.toLowerCase()?.replace('_', '-') || 'todo') as 'todo' | 'in-progress' | 'review' | 'done';

                return {
                    id: Number(t.id) || Date.now(),
                    title: t.title || t.name || '',
                    clientName: t.clientName || '',
                    clientPhone: t.clientPhone || '',
                    segment: t.segment || '',
                    deadline: deadlineDays as 7 | 15 | 30,
                    daysLeft: status === 'done' ? 0 : dynamicDaysLeft,
                    status,
                    createdAt: t.createdAt || new Date().toISOString(),
                    salesExecutiveId: t.salesExecutiveId || undefined,
                };
            });

            const bankAccounts: BankAccount[] = (bankAccountsRes.data || []).map(a => ({
                id: a.id,
                name: a.name,
                institution: a.bank || a.institution || '',
                type: a.type === 'checking' ? 'Checking' :
                    a.type === 'savings' ? 'Savings' :
                        a.type === 'credit' ? 'CreditCard' : 'Checking',
                balance: Number(a.balance) || 0,
                limit: Number(a.limit) || undefined,
                dueDate: a.dueDate || undefined,
                color: a.color || '#3B82F6',
                archived: a.archived ?? !a.isActive,
                isDefault: a.isDefault ?? false,
            }));

            const reviews: PerformanceReview[] = (reviewsRes.data || []).map(r => ({
                id: r.id,
                employeeId: r.employeeId || r.teamMemberId,
                reviewerId: r.reviewerId,
                direction: r.direction as PerformanceReview['direction'],
                type: r.type,
                period: r.period,
                criteria: r.criteria || [],
                overallScore: Number(r.overallScore) || 0,
                positives: r.positives,
                improvements: r.improvements,
                goals: r.goals,
                createdAt: r.createdAt || new Date().toISOString(),
            }));

            const vacations: VacationPeriod[] = (vacationsRes.data || []).map(v => ({
                id: v.id,
                employeeId: v.employeeId,
                startDate: v.startDate,
                endDate: v.endDate,
                type: v.type,
                status: v.status,
                approvedBy: v.approvedBy,
                approvedAt: v.approvedAt,
                notes: v.notes,
                createdAt: v.createdAt || new Date().toISOString(),
            }));

            const timeEntries: TimeEntry[] = (timeEntriesRes.data || []).map(t => ({
                id: t.id,
                employeeId: t.employeeId,
                date: t.date,
                clockIn: t.clockIn,
                clockOut: t.clockOut,
                breakMinutes: t.breakMinutes,
                totalMinutes: t.totalMinutes,
                type: t.type,
                notes: t.notes,
                createdAt: t.createdAt || new Date().toISOString(),
            }));

            const credentials: ServiceCredential[] = (credentialsRes.data || []).map(c => ({
                id: c.id,
                clientId: c.clientId,
                clientName: c.clientName || '',
                category: c.category as CredentialCategory,
                serviceName: c.serviceName,
                url: c.url,
                username: c.username,
                password: c.password,
                notes: c.notes,
                createdAt: c.createdAt || new Date().toISOString(),
                updatedAt: c.updatedAt || new Date().toISOString(),
            }));

            const goals: Goal[] = (goalsRes.data || []).map(g => ({
                id: g.id,
                type: g.type as GoalType,
                title: g.title,
                targetValue: Number(g.targetValue) || 0,
                currentValue: Number(g.currentValue) || 0,
                period: g.period,
                startDate: g.startDate,
                endDate: g.endDate,
                assignedTo: g.assignedTo || [],
                createdAt: g.createdAt || new Date().toISOString(),
            }));

            const commissions: Commission[] = (commissionsRes.data || []).map(c => ({
                id: c.id,
                employeeId: c.employeeId,
                amount: Number(c.amount) || 0,
                source: c.source,
                period: c.period,
                status: c.status,
                createdAt: c.createdAt || new Date().toISOString(),
            }));

            const withdrawals: Withdrawal[] = (withdrawalsRes.data || []).map(w => ({
                id: w.id,
                employeeId: w.employeeId,
                amount: Number(w.amount) || 0,
                reason: w.reason,
                description: w.description,
                date: w.date,
                status: w.status,
                createdAt: w.createdAt || new Date().toISOString(),
            }));

            const payrollPeriods: PayrollPeriod[] = (payrollPeriodsRes.data || []).map(p => ({
                id: p.id,
                period: p.period,
                status: p.status,
                closedAt: p.closedAt,
                closedBy: p.closedBy,
                createdAt: p.createdAt || new Date().toISOString(),
            }));

            const paymentRecords: PaymentRecord[] = (paymentRecordsRes.data || []).map(pr => ({
                id: pr.id,
                employeeId: pr.employeeId,
                period: pr.period,
                grossSalary: parseFloat(pr.grossSalary) || 0,
                netSalary: parseFloat(pr.netSalary) || 0,
                inss: parseFloat(pr.inss) || 0,
                irrf: parseFloat(pr.irrf) || 0,
                fgts: parseFloat(pr.fgts) || 0,
                commissions: parseFloat(pr.commissions) || 0,
                deductions: parseFloat(pr.deductions) || 0,
                status: pr.status || 'pending',
                paidAt: pr.paidAt,
                paidBy: pr.paidBy,
                paymentMethod: pr.paymentMethod,
                transactionId: pr.transactionId,
                notes: pr.notes,
                receiptUrl: pr.receiptUrl,
                createdAt: pr.createdAt,
                updatedAt: pr.updatedAt || pr.createdAt,
            }));

            const checkins: WeeklyCheckin[] = (checkinsRes.data || []).map(c => ({
                id: c.id,
                employeeId: c.employeeId || c.teamMemberId,
                weekStart: c.weekStart || c.periodStart,
                satisfaction: c.satisfaction,
                highlights: c.highlights,
                blockers: c.blockers,
                needHelp: c.needHelp,
                createdAt: c.createdAt || new Date().toISOString(),
            }));

            const clientInteractions: ClientInteraction[] = (interactionsRes.data || []).map(i => ({
                id: i.id,
                clientId: i.clientId,
                type: i.type as InteractionType,
                title: i.title,
                description: i.notes || i.description,
                date: i.date,
                userId: i.userId,
                createdAt: i.createdAt || new Date().toISOString(),
            }));

            const settingsDB = settingsRes.data?.[0];
            const settings: SystemSettings | null = settingsDB ? {
                company: (settingsDB.company as any) || MOCK_COMPANY_SETTINGS,
                hr: (settingsDB.hr as any) || MOCK_HR_SETTINGS,
                financial: (settingsDB.financial as any) || MOCK_FINANCIAL_SETTINGS,
                projects: (settingsDB.projects as any) || MOCK_PROJECT_SETTINGS,
                notifications: (settingsDB.notifications as any) || MOCK_NOTIFICATION_SETTINGS,
                agenda: (settingsDB.agenda as any) || {} as any,
            } : {
                company: MOCK_COMPANY_SETTINGS,
                hr: MOCK_HR_SETTINGS,
                financial: MOCK_FINANCIAL_SETTINGS,
                projects: MOCK_PROJECT_SETTINGS,
                notifications: MOCK_NOTIFICATION_SETTINGS,
                agenda: {} as any,
            };

            const permissions: RolePermission[] = (permissionsRes.data || []).map(p => ({
                id: p.id,
                role: p.role as any,
                permissions: p.permissions as any,
                updatedAt: p.updatedAt
            }));
            if (permissions.length === 0) {
                permissions.push(...MOCK_ROLES_PERMISSIONS);
            }

            const notifications: Notification[] = (notificationsRes.data || []).map(n => ({
                id: n.id,
                type: n.type as any,
                title: n.title,
                message: n.message,
                read: n.read,
                action: n.actionLabel ? { label: n.actionLabel, path: n.actionPath! } : undefined,
                createdAt: n.createdAt
            }));

            const pipelineStages: PipelineStageItem[] = (pipelineStagesRes.data || []).map(p => ({
                id: p.id,
                clientId: p.clientId,
                stage: p.stage,
                notes: p.notes,
                updatedAt: p.updatedAt
            }));

            const recurringExpenses: RecurringExpense[] = (recurringExpensesRes.data || []).map(e => ({
                id: e.id,
                name: e.name,
                description: e.description,
                amount: Number(e.amount) || 0,
                category: e.category,
                dueDay: e.dueDay,
                recurrence: e.recurrence,
                status: e.status,
                lastPaidAt: e.lastPaidAt,
                lastPaidAmount: e.lastPaidAmount ? Number(e.lastPaidAmount) : undefined,
                notes: e.notes,
                createdAt: e.createdAt,
                updatedAt: e.updatedAt,
            }));

            // Barbershop data mapping
            const products: Product[] = (productsRes.data || []).map(p => ({
                id: p.id,
                name: p.name,
                description: p.description,
                brand: p.brand,
                category: p.category || 'pomada',
                costPrice: Number(p.costPrice) || 0,
                sellPrice: Number(p.sellPrice) || 0,
                stock: p.stock ?? 0,
                minStock: p.minStock ?? 5,
                active: p.active ?? true,
                createdAt: p.createdAt,
                updatedAt: p.updatedAt,
                unitId: p.unitId || undefined,
            }));

            const comandas: Comanda[] = (comandasRes.data || []).map(c => ({
                id: c.id,
                clientId: c.clientId,
                clientName: c.clientName,
                barberId: c.barberId,
                barberName: c.barberName,
                status: c.status || 'open',
                totalAmount: Number(c.totalAmount) || 0,
                discountAmount: Number(c.discountAmount) || 0,
                finalAmount: Number(c.finalAmount) || 0,
                paymentMethod: c.paymentMethod,
                notes: c.notes,
                openedAt: c.openedAt || c.createdAt,
                closedAt: c.closedAt,
                createdAt: c.createdAt,
                updatedAt: c.updatedAt,
                appointmentId: c.appointmentId || undefined,
                origin: c.origin || 'manual',
                openedBy: c.openedBy || undefined,
                closedBy: c.closedBy || undefined,
                items: (c.comanda_items || []).map((i: any) => ({
                    id: i.id,
                    comandaId: i.comandaId,
                    type: i.type,
                    itemId: i.itemId,
                    name: i.name,
                    quantity: i.quantity || 1,
                    unitPrice: Number(i.unitPrice) || 0,
                    totalPrice: Number(i.totalPrice) || 0,
                    createdAt: i.createdAt,
                })),
                unitId: c.unitId || undefined,
            }));

            // Multi-Unit data mapping
            const units: Unit[] = (unitsRes.data || []).map(u => ({
                id: u.id,
                name: u.name,
                tradeName: u.tradeName,
                cnpj: u.cnpj,
                address: u.address,
                city: u.city,
                state: u.state || 'SP',
                zip: u.zip,
                phone: u.phone,
                email: u.email,
                managerId: u.managerId,
                managerName: u.managerName,
                status: u.status || 'active',
                image: u.image,
                coverImage: u.coverImage,
                profileImage: u.profileImage,
                openingDate: u.openingDate,
                maxCapacity: u.maxCapacity ?? 6,
                operatingHours: u.operatingHours || '09:00 - 20:00',
                notes: u.notes,
                createdAt: u.createdAt,
                updatedAt: u.updatedAt,
                deletedAt: u.deletedAt,
            }));

            const unitMembers: UnitMember[] = (unitMembersRes.data || []).map(m => ({
                id: m.id,
                unitId: m.unitId,
                userId: m.userId,
                role: m.role || 'member',
                isPrimary: m.isPrimary ?? false,
                createdAt: m.createdAt,
            }));

            const subscriptionPlans: SubscriptionPlan[] = (subscriptionPlansRes.data || []).map((p: any) => ({
                id: p.id,
                name: p.name,
                description: p.description || '',
                price: Number(p.price) || 0,
                servicesIncluded: p.servicesIncluded || [],
                maxUsesPerMonth: p.maxUsesPerMonth ?? undefined,
                durationDays: Number(p.durationDays) || 30,
                active: p.active ?? true,
                recurrence: p.recurrence || 'monthly',
                availableForSale: p.availableForSale ?? true,
                creditEnabled: p.creditEnabled ?? true,
                creditPrice: p.creditPrice ? Number(p.creditPrice) : undefined,
                boletoEnabled: p.boletoEnabled ?? false,
                boletoPrice: p.boletoPrice ? Number(p.boletoPrice) : undefined,
                benefits: p.benefits || [],
                planServices: p.planServices || [],
                planProducts: p.planProducts || [],
                disabledDays: p.disabledDays || [],
                excludedProfessionals: p.excludedProfessionals || [],
                unitScope: p.unitScope || 'all',
                allowedUnitIds: p.allowedUnitIds || [],
                createdAt: p.createdAt,
                updatedAt: p.updatedAt,
            }));

            const subscriptions: Subscription[] = (subscriptionsRes.data || []).map((s: any) => ({
                id: s.id,
                planId: s.planId,
                clientId: s.clientId,
                clientName: s.clientName || '',
                status: s.status || 'active',
                startDate: s.startDate,
                endDate: s.endDate || undefined,
                usesThisMonth: s.usesThisMonth || 0,
                paymentDay: s.paymentDay || 5,
                paymentMethod: s.paymentMethod || undefined,
                gatewayCustomerId: s.gatewayCustomerId || undefined,
                gatewaySubscriptionId: s.gatewaySubscriptionId || undefined,
                lastPaymentDate: s.lastPaymentDate || undefined,
                nextPaymentDate: s.nextPaymentDate || undefined,
                invoiceUrl: s.invoiceUrl || undefined,
                cardBrand: s.cardBrand || undefined,
                cardLast4: s.cardLast4 || undefined,
                billingEmail: s.billingEmail || undefined,
                soldBy: s.soldBy || undefined,
                soldByName: s.soldByName || undefined,
                saleChannel: s.saleChannel || undefined,
                saleCommission: s.saleCommission ? Number(s.saleCommission) : undefined,
                saleCommissionType: s.saleCommissionType || undefined,
                autoRenew: s.autoRenew ?? true,
                cancellationReason: s.cancellationReason || undefined,
                notes: s.notes || undefined,
                createdAt: s.createdAt,
                updatedAt: s.updatedAt,
                plan: s.subscription_plans ? {
                    ...s.subscription_plans,
                    price: Number(s.subscription_plans.price) || 0,
                    servicesIncluded: s.subscription_plans.servicesIncluded || [],
                    durationDays: Number(s.subscription_plans.durationDays) || 30,
                } as SubscriptionPlan : undefined,
            }));

            setDataState({
                clients,
                contracts,
                members,
                transactions,
                personalTasks,
                calendarEvents,
                budgets,
                services,
                projects,
                projectTasks,
                bankAccounts,
                reviews,
                vacations,
                timeEntries,
                credentials,
                goals,
                commissions,
                withdrawals,
                payrollPeriods,
                paymentRecords,
                checkins,
                clientInteractions,
                settings,
                permissions,
                notifications,
                pipelineStages,
                recurringExpenses,
                products,
                comandas,
                units,
                unitMembers,
                subscriptionPlans,
                subscriptions,
                clientReviews: (clientReviewsRes.data || []).map(cr => ({
                    id: cr.id,
                    clientId: cr.clientId,
                    barberId: cr.barberId,
                    comandaId: cr.comandaId || undefined,
                    rating: Number(cr.rating) || 5,
                    comment: cr.comment || undefined,
                    tags: cr.tags || [],
                    createdAt: cr.createdAt || new Date().toISOString(),
                })),

                loading: false,
                error: null,
            });

        } catch (err) {
            console.error('Error loading from Supabase:', err);
            setDataState(prev => ({
                ...prev,
                loading: false,
                error: err as Error,
            }));
        }
    }, []);

    // Load branding (company name + logo) immediately via public RPC
    // This works WITHOUT authentication, so it runs before login
    const loadBranding = useCallback(async () => {
        try {
            const { data, error } = await supabase.rpc('get_company_branding');
            if (!error && data) {
                const branding = typeof data === 'string' ? JSON.parse(data) : data;
                setDataState(prev => ({
                    ...prev,
                    settings: {
                        ...(prev.settings || { hr: null, financial: null, projects: null, notifications: null, agenda: {} as any }),
                        company: {
                            ...(prev.settings?.company || {}),
                            name: branding.name || '',
                            logo: branding.logo || '',
                        } as any,
                    },
                }));
            }
        } catch (err) {
            console.warn('Could not load branding:', err);
        }
    }, []);

    useEffect(() => {
        loadBranding();
        loadFromSupabase();
    }, [loadBranding, loadFromSupabase]);

    // ═══ SUPABASE REALTIME ═══
    // Listen to all critical tables and trigger silent refresh on changes
    useEffect(() => {
        let debounceTimer: ReturnType<typeof setTimeout> | null = null;

        const silentRefresh = () => {
            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                loadFromSupabase(true); // silent = true, no loading spinner
            }, 1500); // 1.5s debounce to batch multiple rapid changes
        };

        const REALTIME_TABLES = [
            'clients', 'services', 'products', 'comandas',
            'subscription_plans', 'subscriptions',
            'users', 'transactions', 'contracts', 'budgets',
            'calendar_events', 'personal_tasks',
            'commissions', 'withdrawals', 'payment_records',
            'work_schedules',
            'units', 'unit_members',
        ];

        const channel = supabase
            .channel('vinnx-realtime');

        REALTIME_TABLES.forEach(table => {
            channel.on(
                'postgres_changes' as any,
                { event: '*', schema: 'public', table },
                silentRefresh
            );
        });

        channel.subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                console.log('🔴 Realtime: connected to', REALTIME_TABLES.length, 'tables');
            }
        });

        return () => {
            if (debounceTimer) clearTimeout(debounceTimer);
            supabase.removeChannel(channel);
        };
    }, [loadFromSupabase]);

    const createSetter = <T,>(key: keyof AppData) => {
        return useCallback((valueOrFn: T[] | ((prev: T[]) => T[])) => {
            setDataState(prev => {
                const prevValue = prev[key] as T[];
                const newValue = typeof valueOrFn === 'function'
                    ? (valueOrFn as (prev: T[]) => T[])(prevValue)
                    : valueOrFn;
                return { ...prev, [key]: newValue };
            });
        }, []);
    };

    const setAppSettings = useCallback((newSettings: SystemSettings | ((prev: SystemSettings | null) => SystemSettings)) => {
        setDataState(prev => ({
            ...prev,
            settings: typeof newSettings === 'function' ? newSettings(prev.settings) : newSettings
        }));
    }, []);

    const contextValue: AppData = {
        ...dataState,
        setClients: createSetter<Client>('clients'),
        setContracts: createSetter<Contract>('contracts'),
        setMembers: createSetter<TeamMember>('members'),
        setTransactions: createSetter<Transaction>('transactions'),
        setPersonalTasks: createSetter<PersonalTask>('personalTasks'),
        setCalendarEvents: createSetter<CalendarEvent>('calendarEvents'),
        setBudgets: createSetter<Budget>('budgets'),
        setServices: createSetter<Service>('services'),
        setProjects: createSetter<Project>('projects'),
        setProjectTasks: createSetter<ProjectTask>('projectTasks'),
        setBankAccounts: createSetter<BankAccount>('bankAccounts'),
        setReviews: createSetter<PerformanceReview>('reviews'),
        setVacations: createSetter<VacationPeriod>('vacations'),
        setTimeEntries: createSetter<TimeEntry>('timeEntries'),
        setCredentials: createSetter<ServiceCredential>('credentials'),
        setGoals: createSetter<Goal>('goals'),
        setCommissions: createSetter<Commission>('commissions'),
        setWithdrawals: createSetter<Withdrawal>('withdrawals'),
        setPayrollPeriods: createSetter<PayrollPeriod>('payrollPeriods'),
        setPaymentRecords: createSetter<PaymentRecord>('paymentRecords'),
        setCheckins: createSetter<WeeklyCheckin>('checkins'),
        setClientInteractions: createSetter<ClientInteraction>('clientInteractions'),
        setAppSettings,
        setPermissions: createSetter<RolePermission>('permissions'),
        setNotifications: createSetter<Notification>('notifications'),
        setPipelineStages: createSetter<PipelineStageItem>('pipelineStages'),
        setRecurringExpenses: createSetter<RecurringExpense>('recurringExpenses'),
        setProducts: createSetter<Product>('products'),
        setComandas: createSetter<Comanda>('comandas'),
        setUnits: createSetter<Unit>('units'),
        setUnitMembers: createSetter<UnitMember>('unitMembers'),
        setSubscriptionPlans: createSetter<SubscriptionPlan>('subscriptionPlans'),
        setSubscriptions: createSetter<Subscription>('subscriptions'),
        setClientReviews: createSetter<ClientReview>('clientReviews'),

        refresh: loadFromSupabase,
    };

    return (
        <AppDataContext.Provider value={contextValue}>
            {children}
        </AppDataContext.Provider>
    );
};

export const useAppData = () => {
    const context = useContext(AppDataContext);
    if (!context) {
        throw new Error('useAppData must be used within an AppDataProvider');
    }
    return context;
};
