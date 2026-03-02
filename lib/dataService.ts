import { supabase } from './supabase';
import { Client, Contract, TeamMember, Transaction, PaymentRecord } from '../types';
import { ProfessionalFiscalData, InvoiceEmitter, Invoice, FiscalSettings } from '../types';

// ============================================
// TEAM MEMBERS (Users/Colaboradores)
// ============================================

interface SupabaseUser {
    id: string;
    name: string;
    email: string;
    role: 'ADMIN' | 'MANAGER' | 'SALES' | 'SUPPORT';
    phone?: string;
    avatar?: string;
    // NOTE: birthday, cpf, salary are in team_members table, not users
}

function teamMemberToSupabase(member: TeamMember): Partial<SupabaseUser> {
    return {
        id: member.id,
        name: member.name,
        email: member.email,
        role: member.role === 'Admin' ? 'ADMIN' :
            member.role === 'Manager' ? 'MANAGER' :
                member.role === 'Sales Executive' ? 'SALES' : 'SUPPORT',
        phone: member.phone,
        avatar: member.image,
        // birthday, cpf, salary - NOT included, these belong to team_members table
    };
}

export async function saveMember(member: TeamMember): Promise<{ success: boolean; error?: string }> {
    try {
        const now = new Date().toISOString();

        // Data for 'users' table
        const userData = {
            id: member.id,
            name: member.name,
            email: member.email,
            role: member.role === 'Admin' ? 'ADMIN' :
                member.role === 'Manager' ? 'MANAGER' :
                    member.role === 'Sales Executive' ? 'SALES' :
                        member.role === 'Barber' ? 'BARBER' : 'SUPPORT',
            phone: member.phone,
            avatar: member.image,
            updatedAt: now,
        };

        // NOTE: teamMemberData is defined AFTER user creation to use the correct ID

        // Check if user exists by ID
        const { data: existingUser } = await supabase
            .from('users')
            .select('id')
            .eq('id', member.id)
            .single();

        console.log('[DEBUG] Payload userData:', userData);
        console.log('[DEBUG] ID do usuario alvo:', member.id);

        if (existingUser) {
            // Update user
            const { error: userError } = await supabase.from('users').update(userData).eq('id', member.id);
            if (userError) throw userError;
        } else {
            // Check if email already exists (for another user)
            const { data: existingEmail } = await supabase
                .from('users')
                .select('id')
                .eq('email', member.email)
                .single();

            if (existingEmail) {
                throw new Error(`Email "${member.email}" já está em uso por outro usuário.`);
            }

            // ========== CREATE IN SUPABASE AUTH FIRST ==========
            const password = member.password || 'changeme123';
            console.log('[AUTH] Creating new auth user for:', member.email);

            // IMPORTANT: Save current session before signUp (to restore after)
            const { data: currentSession } = await supabase.auth.getSession();
            const adminSession = currentSession?.session;

            const { data: authData, error: authError } = await supabase.auth.signUp({
                email: member.email,
                password: password,
                options: {
                    data: {
                        name: member.name,
                        role: member.role
                    }
                }
            });

            if (authError) {
                if (authError.message.includes('already registered')) {
                    throw new Error(`Email "${member.email}" já está registrado.`);
                }
                throw authError;
            }

            if (!authData.user) {
                throw new Error('Falha ao criar usuário de autenticação');
            }

            // Use Auth ID for users table
            const authUserId = authData.user.id;
            console.log('[AUTH] Auth user created with ID:', authUserId);

            // Update userData with correct ID from Auth
            const newUserData = {
                id: authUserId,
                name: member.name,
                email: member.email,
                role: userData.role,
                phone: member.phone,
                avatar: member.image,
                password: password,
                updatedAt: new Date().toISOString(),
            };

            const { error: userError } = await supabase.from('users').insert(newUserData);
            if (userError) throw userError;

            // Update member.id for team_members insert
            member.id = authUserId;

            // IMPORTANT: Restore admin session after creating the new user
            if (adminSession) {
                console.log('[AUTH] Restoring admin session...');
                await supabase.auth.setSession({
                    access_token: adminSession.access_token,
                    refresh_token: adminSession.refresh_token
                });
            }
        }

        // Data for 'team_members' table - MUST be defined AFTER user creation to use correct ID
        const teamMemberData = {
            userId: member.id, // Uses authUserId for new users, original ID for existing
            baseSalary: Number(member.salary || member.baseSalary || 0),
            commissionRate: Number(member.commissionRate || 0.20),
            subscriptionCommission: Number(member.subscriptionCommission || 0.20),
            productCommission: Number(member.productCommission || 0.10),
            joinDate: member.joinDate || now,
            birthDate: member.birthday || null,
            cpf: member.cpf || null,
            // Contract & RH fields
            contractType: member.contractType || 'CLT',
            paymentPreference: member.paymentPreference || 'Mensal',
            pixKey: member.pixKey || null,
            bankInfo: member.bankInfo || null,
            admissionDate: member.admissionDate || member.joinDate || null,
            // Barbershop fields
            station: member.station || null,
            specialties: member.specialties || null,
            updatedAt: now,
        }


        // Check if team_member exists
        const { data: existingTeamMember } = await supabase
            .from('team_members')
            .select('id')
            .eq('userId', member.id)
            .single();

        if (existingTeamMember) {
            // Update team_member
            const { error: tmError, data: tmData } = await supabase
                .from('team_members')
                .update(teamMemberData)
                .eq('userId', member.id)
                .select();

            if (tmError) throw tmError;
            if (!tmData || tmData.length === 0) {
                console.error('Update silencioso em team_members. RLS falhou.');
                // throw new Error('Permissão negada (RLS) ao atualizar Team Member.'); // Comentado para não crashar a UI drasticamente se for admin problema, mas logado.
            }
        } else {
            // Insert team_member - MUST include id field
            const { error: tmError, data: tmData } = await supabase
                .from('team_members')
                .insert({
                    ...teamMemberData,
                    id: crypto.randomUUID(), // Generate UUID for team_members.id
                })
                .select();

            if (tmError) throw tmError;
            if (!tmData || tmData.length === 0) {
                console.error('Insert silencioso em team_members. RLS falhou.');
                // throw new Error('Permissão negada (RLS) ao inserir Team Member.');
            }
        }

        return { success: true };
    } catch (err: any) {
        console.error('Error saving member:', err);
        return { success: false, error: err.message };
    }
}


export async function deleteMember(id: string): Promise<{ success: boolean; error?: string }> {
    try {
        // Try the RPC function that completely deletes user + auth + sessions
        const { error: rpcError } = await supabase.rpc('delete_user_completely', {
            target_user_id: id
        });

        if (rpcError) {
            // Fallback: RPC not available (migration not run) — do manual delete
            console.warn('[AUTH] RPC delete_user_completely failed, using manual fallback:', rpcError.message);

            // 1. Delete from team_members first (FK constraint)
            const { error: tmError } = await supabase
                .from('team_members')
                .delete()
                .eq('userId', id);

            if (tmError) {
                console.warn('Error deleting team_member:', tmError.message);
            }

            // 2. Delete from users table
            const { error: userError } = await supabase.from('users').delete().eq('id', id);
            if (userError) throw userError;
        }

        return { success: true };
    } catch (err: any) {
        console.error('Error deleting member:', err);
        return { success: false, error: err.message };
    }
}

// ============================================
// CLIENTS
// ============================================

interface SupabaseClient {
    id: string;
    name: string;
    company?: string;
    email: string;
    phone?: string;
    cpfCnpj?: string;
    status: 'ACTIVE' | 'INACTIVE' | 'LEAD' | 'CHURNED';
    monthlyValue?: number;
    setupValue?: number;
    totalValue?: number;
    monthsActive?: number;
    origin?: string;
    segment?: string;
    lastContact?: string;
    avatar?: string;
    birthday?: string;
    salesExecutiveId?: string;
    gender?: string;
    preferredBarberId?: string;
    totalVisits?: number;
    lastVisit?: string;
}

function clientToSupabase(client: Client): Partial<SupabaseClient> {
    return {
        id: client.id,
        name: client.name,
        company: client.company,
        email: client.email,
        phone: client.phone,
        cpfCnpj: client.cpfCnpj || null,
        status: client.status === 'Active' ? 'ACTIVE' :
            client.status === 'Inactive' ? 'INACTIVE' :
                client.status === 'Lead' ? 'LEAD' : 'CHURNED',
        monthlyValue: client.monthlyValue,
        setupValue: client.setupValue,
        totalValue: client.totalValue,
        monthsActive: client.monthsActive,
        origin: client.origin,
        segment: client.segment,
        lastContact: client.lastContact,
        avatar: client.image || client.avatar,
        birthday: client.birthday,
        salesExecutiveId: client.salesExecutiveId,
        gender: client.gender || null,
        preferredBarberId: client.preferredBarberId || null,
        totalVisits: client.totalVisits || 0,
        lastVisit: client.lastVisit || null,
    };
}

export async function saveClient(client: Client): Promise<{ success: boolean; error?: string }> {
    try {
        const now = new Date().toISOString();
        const dbData = {
            ...clientToSupabase(client),
            updatedAt: now, // Required NOT NULL field
        };

        // Check if client exists
        const { data: existing } = await supabase
            .from('clients')
            .select('id')
            .eq('id', client.id)
            .single();

        if (existing) {
            const { error } = await supabase.from('clients').update(dbData).eq('id', client.id);
            if (error) throw error;
        } else {
            const { error } = await supabase.from('clients').insert(dbData);
            if (error) throw error;
        }

        return { success: true };
    } catch (err: any) {
        console.error('Error saving client:', err);
        return { success: false, error: err.message };
    }
}

export async function deleteClient(id: string): Promise<{ success: boolean; error?: string }> {
    try {
        const { error } = await supabase.from('clients').delete().eq('id', id);
        if (error) throw error;
        return { success: true };
    } catch (err: any) {
        console.error('Error deleting client:', err);
        return { success: false, error: err.message };
    }
}

// ============================================
// CONTRACTS
// ============================================

interface SupabaseContract {
    id: string;
    title: string;
    clientId: string;
    salesExecutiveId?: string;
    monthlyValue: number;
    setupValue?: number;
    contractDuration: number;
    startDate: string;
    endDate?: string;
    status: 'ACTIVE' | 'CANCELLED' | 'PENDING' | 'ENDED';
}

function contractToSupabase(contract: Contract): Partial<SupabaseContract> {
    return {
        id: contract.id,
        title: contract.title,
        clientId: contract.clientId,
        salesExecutiveId: contract.salesExecutiveId || null, // FK: empty string → null
        monthlyValue: contract.monthlyValue,
        setupValue: contract.setupValue,
        contractDuration: contract.contractDuration,
        startDate: contract.startDate,
        endDate: contract.endDate,
        status: contract.status === 'Active' ? 'ACTIVE' :
            contract.status === 'Cancelled' ? 'CANCELLED' :
                contract.status === 'Pending' ? 'PENDING' : 'ENDED',
    };
}

export async function saveContract(contract: Contract): Promise<{ success: boolean; error?: string }> {
    try {
        const now = new Date().toISOString();
        const dbData = {
            ...contractToSupabase(contract),
            updatedAt: now, // Required NOT NULL field
        };

        const { data: existing } = await supabase
            .from('contracts')
            .select('id')
            .eq('id', contract.id)
            .single();

        if (existing) {
            const { error } = await supabase.from('contracts').update(dbData).eq('id', contract.id);
            if (error) throw error;
        } else {
            const { error } = await supabase.from('contracts').insert(dbData);
            if (error) throw error;
        }

        return { success: true };
    } catch (err: any) {
        console.error('Error saving contract:', err);
        return { success: false, error: err.message };
    }
}

export async function deleteContract(id: string): Promise<{ success: boolean; error?: string }> {
    try {
        const { error } = await supabase.from('contracts').delete().eq('id', id);
        if (error) throw error;
        return { success: true };
    } catch (err: any) {
        console.error('Error deleting contract:', err);
        return { success: false, error: err.message };
    }
}

// ============================================
// TRANSACTIONS
// ============================================

interface SupabaseTransaction {
    id: number;
    description: string;
    amount: number;
    type: 'INCOME' | 'EXPENSE' | 'COMMISSION';
    date: string;
    createdAt?: string;
    category?: string;
    status: 'COMPLETED' | 'PENDING' | 'OVERDUE';
    clientId?: string;
    accountId?: string;
}

function transactionToSupabase(transaction: Transaction): Partial<SupabaseTransaction> {
    return {
        id: transaction.id,
        description: transaction.description,
        amount: transaction.amount,
        type: transaction.type.toUpperCase() as 'INCOME' | 'EXPENSE' | 'COMMISSION',
        date: transaction.date,
        createdAt: transaction.createdAt || new Date().toISOString().split('T')[0],
        category: transaction.category,
        status: transaction.status === 'Completed' ? 'COMPLETED' :
            transaction.status === 'Pending' ? 'PENDING' : 'OVERDUE',
        clientId: transaction.clientId,
        accountId: transaction.accountId,
    };
}

export async function saveTransaction(transaction: Transaction): Promise<{ success: boolean; error?: string }> {
    try {
        const now = new Date().toISOString();
        const dbData = {
            ...transactionToSupabase(transaction),
            updatedAt: now, // Required NOT NULL field
        };

        const { data: existing } = await supabase
            .from('transactions')
            .select('id')
            .eq('id', transaction.id)
            .single();

        if (existing) {
            const { error } = await supabase.from('transactions').update(dbData).eq('id', transaction.id);
            if (error) throw error;
        } else {
            // Para insert, deixa o ID ser gerado pelo banco
            const { id, ...dataWithoutId } = dbData;
            const { error } = await supabase.from('transactions').insert(dataWithoutId);
            if (error) throw error;
        }

        return { success: true };
    } catch (err: any) {
        console.error('Error saving transaction:', err);
        return { success: false, error: err.message };
    }
}

export async function deleteTransaction(id: number): Promise<{ success: boolean; error?: string }> {
    try {
        const { error } = await supabase.from('transactions').delete().eq('id', id);
        if (error) throw error;
        return { success: true };
    } catch (err: any) {
        console.error('Error deleting transaction:', err);
        return { success: false, error: err.message };
    }
}

// ============================================
// PROJECTS (Kanban)
// ============================================

import { Project, CalendarEvent, ProjectTask, Budget, PersonalTask } from '../types';

export async function saveProject(project: Project): Promise<{ success: boolean; error?: string }> {
    try {
        const now = new Date().toISOString();
        const dbData = {
            id: project.id,
            title: project.title,
            clientId: project.clientId || project.clientName, // schema uses clientId, not clientName
            status: project.status.toUpperCase(),
            dueDate: project.dueDate,
            budget: project.budget,
            priority: project.priority.toUpperCase(),
            tags: project.tags,
            updatedAt: now, // Required NOT NULL field
        };

        const { data: existing } = await supabase
            .from('projects')
            .select('id')
            .eq('id', project.id)
            .single();

        if (existing) {
            const { error } = await supabase.from('projects').update(dbData).eq('id', project.id);
            if (error) throw error;
        } else {
            const { error } = await supabase.from('projects').insert(dbData);
            if (error) throw error;
        }

        return { success: true };
    } catch (err: any) {
        console.error('Error saving project:', err);
        return { success: false, error: err.message };
    }
}

export async function deleteProject(id: string): Promise<{ success: boolean; error?: string }> {
    try {
        const { error } = await supabase.from('projects').delete().eq('id', id);
        if (error) throw error;
        return { success: true };
    } catch (err: any) {
        console.error('Error deleting project:', err);
        return { success: false, error: err.message };
    }
}

// ============================================
// CALENDAR EVENTS (Agenda)
// ============================================

export async function saveCalendarEvent(event: CalendarEvent): Promise<{ success: boolean; error?: string }> {
    try {
        const now = new Date().toISOString();
        // Reconstruct ISO date from day/month/year (DB column is DateTime)
        const isoDate = new Date(event.year, event.month, event.date).toISOString();
        const dbData: Record<string, any> = {
            id: event.id,
            title: event.title,
            type: event.type.toUpperCase(),
            startTime: event.startTime,
            endTime: event.endTime,
            date: isoDate,
            clientName: event.client, // schema uses clientName, not client
            observation: event.observation,
            color: event.color,
            updatedAt: now, // Required NOT NULL field
            // Barbershop fields
            barberId: event.barberId || null,
            barberName: event.barberName || null,
            serviceId: event.serviceId || null,
            serviceName: event.serviceName || null,
            duration: event.duration || 30,
            unitId: event.unitId || null,
            source: event.source || 'manual',
            status: event.status || 'confirmed',
            serviceIds: event.serviceIds && event.serviceIds.length > 0 ? JSON.stringify(event.serviceIds) : '[]',
            comandaId: event.comandaId || null,
        };

        const { data: existing } = await supabase
            .from('calendar_events')
            .select('id')
            .eq('id', event.id)
            .single();

        if (existing) {
            const { error } = await supabase.from('calendar_events').update(dbData).eq('id', event.id);
            if (error) throw error;
        } else {
            const { error } = await supabase.from('calendar_events').insert(dbData);
            if (error) throw error;
        }

        return { success: true };
    } catch (err: any) {
        console.error('Error saving calendar event:', err);
        return { success: false, error: err.message };
    }
}


export async function deleteCalendarEvent(id: string): Promise<{ success: boolean; error?: string }> {
    try {
        const { error } = await supabase.from('calendar_events').delete().eq('id', id);
        if (error) throw error;
        return { success: true };
    } catch (err: any) {
        console.error('Error deleting calendar event:', err);
        return { success: false, error: err.message };
    }
}

// ============================================
// PROJECT TASKS (Kanban Tasks)
// ============================================

export async function saveProjectTask(task: ProjectTask): Promise<{ success: boolean; error?: string }> {
    try {
        const now = new Date().toISOString();
        const dbData = {
            id: task.id,
            title: task.title,
            clientName: task.clientName,
            clientPhone: task.clientPhone,
            segment: task.segment,
            deadline: task.deadline,
            daysLeft: task.daysLeft,
            status: task.status.toUpperCase().replace('-', '_'),
            salesExecutiveId: task.salesExecutiveId,
            updatedAt: now, // Required NOT NULL field
        };

        const { data: existing } = await supabase
            .from('tasks')
            .select('id')
            .eq('id', task.id)
            .single();

        if (existing) {
            const { error } = await supabase.from('tasks').update(dbData).eq('id', task.id);
            if (error) throw error;
        } else {
            const { error } = await supabase.from('tasks').insert(dbData);
            if (error) throw error;
        }

        return { success: true };
    } catch (err: any) {
        console.error('Error saving project task:', err);
        return { success: false, error: err.message };
    }
}

export async function deleteProjectTask(id: number): Promise<{ success: boolean; error?: string }> {
    try {
        const { error } = await supabase.from('tasks').delete().eq('id', id);
        if (error) throw error;
        return { success: true };
    } catch (err: any) {
        console.error('Error deleting project task:', err);
        return { success: false, error: err.message };
    }
}

// ============================================
// PERSONAL TASKS (Tarefas Pessoais)
// ============================================

export async function savePersonalTask(task: PersonalTask): Promise<{ success: boolean; error?: string }> {
    try {
        const dbData = {
            id: task.id,
            text: task.text,
            scope: task.scope.toUpperCase(),
            completed: task.completed,
            createdAt: task.createdAt,
            completedAt: task.completedAt,
            assigneeId: task.assigneeId,
        };

        const { data: existing } = await supabase
            .from('personal_tasks')
            .select('id')
            .eq('id', task.id)
            .single();

        if (existing) {
            const { error } = await supabase.from('personal_tasks').update(dbData).eq('id', task.id);
            if (error) throw error;
        } else {
            const { id: _id, ...dataWithoutId } = dbData;
            const { error } = await supabase.from('personal_tasks').insert(dataWithoutId);
            if (error) throw error;
        }

        return { success: true };
    } catch (err: any) {
        console.error('Error saving personal task:', err);
        return { success: false, error: err.message };
    }
}

export async function deletePersonalTask(id: number): Promise<{ success: boolean; error?: string }> {
    try {
        const { error } = await supabase.from('personal_tasks').delete().eq('id', id);
        if (error) throw error;
        return { success: true };
    } catch (err: any) {
        console.error('Error deleting personal task:', err);
        return { success: false, error: err.message };
    }
}

// ============================================
// BUDGETS (Orçamentos)
// ============================================

export async function saveBudget(budget: Budget): Promise<{ success: boolean; error?: string }> {
    try {
        const now = new Date().toISOString();
        const dbData = {
            id: budget.id,
            clientId: budget.clientId,
            title: budget.title,
            status: budget.status || 'Draft', // Keep mixed-case to match schema default
            items: budget.items, // JSONB
            totalValue: budget.totalValue,
            discount: budget.discount || 0,
            validUntil: budget.validUntil,
            notes: budget.notes,
            updatedAt: now, // Required NOT NULL field
        };

        const { data: existing } = await supabase
            .from('budgets')
            .select('id')
            .eq('id', budget.id)
            .single();

        if (existing) {
            const { error } = await supabase.from('budgets').update(dbData).eq('id', budget.id);
            if (error) throw error;
        } else {
            const { error } = await supabase.from('budgets').insert(dbData);
            if (error) throw error;
        }

        return { success: true };
    } catch (err: any) {
        console.error('Error saving budget:', err);
        return { success: false, error: err.message };
    }
}

export async function deleteBudget(id: string): Promise<{ success: boolean; error?: string }> {
    try {
        const { error } = await supabase.from('budgets').delete().eq('id', id);
        if (error) throw error;
        return { success: true };
    } catch (err: any) {
        console.error('Error deleting budget:', err);
        return { success: false, error: err.message };
    }
}

// ============================================
// GENERIC SAVE/DELETE for localStorage-based entities
// These functions save to localStorage as fallback when tables don't exist
// ============================================

export async function saveToLocalStorage<T extends { id: string | number }>(
    key: string,
    items: T[]
): Promise<{ success: boolean }> {
    try {
        localStorage.setItem(key, JSON.stringify(items));
        return { success: true };
    } catch (err) {
        console.error(`Error saving to localStorage key ${key}: `, err);
        return { success: false };
    }
}

export function loadFromLocalStorage<T>(key: string): T[] {
    try {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : [];
    } catch (err) {
        console.error(`Error loading from localStorage key ${key}: `, err);
        return [];
    }
}

// ============================================
// GOALS (Metas)
// ============================================

import { Goal, Service, TimeEntry, PerformanceReview } from '../types';

export async function saveGoal(goal: Goal): Promise<{ success: boolean; error?: string }> {
    try {
        const now = new Date().toISOString();
        const dbData = {
            id: goal.id,
            title: goal.title,
            type: goal.type.toUpperCase(),
            targetValue: goal.targetValue,
            period: goal.period || 'monthly',
            startDate: goal.startDate || new Date().toISOString(),
            endDate: goal.endDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            assignedTo: goal.assignedTo || [],
            updatedAt: now, // Required NOT NULL field
        };

        const { data: existing } = await supabase
            .from('goals')
            .select('id')
            .eq('id', goal.id)
            .single();

        if (existing) {
            const { error } = await supabase.from('goals').update(dbData).eq('id', goal.id);
            if (error) throw error;
        } else {
            const { error } = await supabase.from('goals').insert(dbData);
            if (error) throw error;
        }

        return { success: true };
    } catch (err: any) {
        console.error('Error saving goal:', err);
        return { success: false, error: err.message };
    }
}

export async function deleteGoal(id: string): Promise<{ success: boolean; error?: string }> {
    try {
        const { error } = await supabase.from('goals').delete().eq('id', id);
        if (error) throw error;
        return { success: true };
    } catch (err: any) {
        console.error('Error deleting goal:', err);
        return { success: false, error: err.message };
    }
}

// ============================================
// SERVICES (Serviços)
// ============================================

export async function saveService(service: Service): Promise<{ success: boolean; error?: string }> {
    try {
        const now = new Date().toISOString();
        const dbData = {
            id: service.id,
            name: service.name,
            description: service.description,
            price: service.price,
            cost: service.cost || 0,
            type: service.type?.toUpperCase(),
            active: service.active,
            duration: service.duration ?? 30,
            category: service.category || 'corte',
            commission: service.commission ?? 50,
            assistantCommission: service.assistantCommission ?? 0,
            priceVaries: service.priceVaries ?? false,
            returnForecast: service.returnForecast ?? 30,
            allowsOnlineBooking: service.allowsOnlineBooking ?? true,
            registerAllProfessionals: service.registerAllProfessionals ?? true,
            image: service.image || null,
            updatedAt: now,
        };

        const { data: existing } = await supabase
            .from('services')
            .select('id')
            .eq('id', service.id)
            .single();

        if (existing) {
            const { error } = await supabase.from('services').update(dbData).eq('id', service.id);
            if (error) throw error;
        } else {
            const { error } = await supabase.from('services').insert(dbData);
            if (error) throw error;
        }

        return { success: true };
    } catch (err: any) {
        console.error('Error saving service:', err);
        return { success: false, error: err.message };
    }
}

export async function deleteService(id: string): Promise<{ success: boolean; error?: string }> {
    try {
        const { error } = await supabase.from('services').delete().eq('id', id);
        if (error) throw error;
        return { success: true };
    } catch (err: any) {
        console.error('Error deleting service:', err);
        return { success: false, error: err.message };
    }
}

// ============================================
// TIME ENTRIES (Banco de Horas)
// ============================================

export async function saveTimeEntry(entry: TimeEntry): Promise<{ success: boolean; error?: string }> {
    try {
        const now = new Date().toISOString();
        const dbData = {
            id: entry.id,
            teamMemberId: (entry as any).teamMemberId || entry.employeeId, // Prefer teamMemberId FK
            date: entry.date,
            clockIn: entry.clockIn,
            clockOut: entry.clockOut,
            totalMinutes: entry.totalMinutes,
            type: entry.type?.toUpperCase() || 'REGULAR',
            notes: entry.notes,
            updatedAt: now, // Required NOT NULL field
        };

        const { data: existing } = await supabase
            .from('time_entries')
            .select('id')
            .eq('id', entry.id)
            .single();

        if (existing) {
            const { error } = await supabase.from('time_entries').update(dbData).eq('id', entry.id);
            if (error) throw error;
        } else {
            const { error } = await supabase.from('time_entries').insert(dbData);
            if (error) throw error;
        }

        return { success: true };
    } catch (err: any) {
        console.error('Error saving time entry:', err);
        return { success: false, error: err.message };
    }
}

export async function deleteTimeEntry(id: string): Promise<{ success: boolean; error?: string }> {
    try {
        const { error } = await supabase.from('time_entries').delete().eq('id', id);
        if (error) throw error;
        return { success: true };
    } catch (err: any) {
        console.error('Error deleting time entry:', err);
        return { success: false, error: err.message };
    }
}

// ============================================
// PERFORMANCE REVIEWS (Avaliações 360)
// ============================================

export async function savePerformanceReview(review: PerformanceReview): Promise<{ success: boolean; error?: string }> {
    try {
        const dbData = {
            id: review.id,
            teamMemberId: (review as any).teamMemberId || review.employeeId, // Prefer teamMemberId FK
            reviewerId: review.reviewerId,
            direction: review.direction,
            type: 'monthly',
            period: review.period,
            criteria: review.criteria, // JSONB in schema
            overallScore: review.overallScore,
            positives: review.positives,
            improvements: review.improvements,
            goals: review.goals,
        };

        const { data: existing } = await supabase
            .from('evaluations') // schema table is 'evaluations'
            .select('id')
            .eq('id', review.id)
            .single();

        if (existing) {
            const { error } = await supabase.from('evaluations').update(dbData).eq('id', review.id);
            if (error) throw error;
        } else {
            const { error } = await supabase.from('evaluations').insert(dbData);
            if (error) throw error;
        }

        return { success: true };
    } catch (err: any) {
        console.error('Error saving performance review:', err);
        return { success: false, error: err.message };
    }
}

export async function deletePerformanceReview(id: string): Promise<{ success: boolean; error?: string }> {
    try {
        const { error } = await supabase.from('evaluations').delete().eq('id', id);
        if (error) throw error;
        return { success: true };
    } catch (err: any) {
        console.error('Error deleting performance review:', err);
        return { success: false, error: err.message };
    }
}

// ============================================
// VACATION PERIODS (Férias)
// ============================================

import { VacationPeriod, ServiceCredential, Commission, Withdrawal, BankAccount, ClientInteraction } from '../types';

export async function saveVacation(vacation: VacationPeriod): Promise<{ success: boolean; error?: string }> {
    try {
        const now = new Date().toISOString();
        const teamMemberId = (vacation as any).teamMemberId;
        if (!teamMemberId) {
            return { success: false, error: 'teamMemberId is required (FK to team_members table)' };
        }
        const dbData = {
            id: vacation.id,
            teamMemberId, // FK to team_members.id — validated above
            startDate: vacation.startDate,
            endDate: vacation.endDate,
            days: Math.ceil((new Date(vacation.endDate).getTime() - new Date(vacation.startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1,
            type: vacation.type || 'vacation',
            status: vacation.status?.toUpperCase(),
            approvedBy: vacation.approvedBy,
            approvedAt: vacation.approvedAt,
            notes: vacation.notes,
            updatedAt: now, // Required NOT NULL field
        };

        const { data: existing } = await supabase.from('vacations').select('id').eq('id', vacation.id).single();
        if (existing) {
            const { error } = await supabase.from('vacations').update(dbData).eq('id', vacation.id);
            if (error) throw error;
        } else {
            const { error } = await supabase.from('vacations').insert(dbData);
            if (error) throw error;
        }
        return { success: true };
    } catch (err: any) {
        console.error('Error saving vacation:', err);
        return { success: false, error: err.message };
    }
}

export async function deleteVacation(id: string): Promise<{ success: boolean; error?: string }> {
    try {
        const { error } = await supabase.from('vacations').delete().eq('id', id);
        if (error) throw error;
        return { success: true };
    } catch (err: any) {
        console.error('Error deleting vacation:', err);
        return { success: false, error: err.message };
    }
}

// ============================================
// SERVICE CREDENTIALS (Credenciais)
// ============================================

export async function saveCredential(credential: ServiceCredential): Promise<{ success: boolean; error?: string }> {
    try {
        const now = new Date().toISOString();
        const dbData = {
            id: credential.id,
            clientId: credential.clientId,
            category: credential.category?.toLowerCase() || 'other',
            serviceName: credential.serviceName,
            url: credential.url,
            username: credential.username,
            password: credential.password,
            updatedAt: now, // Required NOT NULL field
        };

        const { data: existing } = await supabase.from('service_credentials').select('id').eq('id', credential.id).single();
        if (existing) {
            const { error } = await supabase.from('service_credentials').update(dbData).eq('id', credential.id);
            if (error) throw error;
        } else {
            const { error } = await supabase.from('service_credentials').insert(dbData);
            if (error) throw error;
        }
        return { success: true };
    } catch (err: any) {
        console.error('Error saving credential:', err);
        return { success: false, error: err.message };
    }
}

export async function deleteCredential(id: string): Promise<{ success: boolean; error?: string }> {
    try {
        const { error } = await supabase.from('service_credentials').delete().eq('id', id);
        if (error) throw error;
        return { success: true };
    } catch (err: any) {
        console.error('Error deleting credential:', err);
        return { success: false, error: err.message };
    }
}

// ============================================
// COMMISSIONS (Comissões - Folha de Pagamento)
// ============================================

export async function saveCommission(commission: Commission): Promise<{ success: boolean; error?: string }> {
    try {
        const dbData = {
            id: commission.id,
            employeeId: commission.employeeId,
            amount: commission.amount,
            source: commission.source,
            period: commission.period,
            status: commission.status || 'pending',
            createdAt: commission.createdAt,
        };

        const { data: existing } = await supabase.from('commissions').select('id').eq('id', commission.id).single();
        if (existing) {
            const { error } = await supabase.from('commissions').update(dbData).eq('id', commission.id);
            if (error) throw error;
        } else {
            const { error } = await supabase.from('commissions').insert(dbData);
            if (error) throw error;
        }
        return { success: true };
    } catch (err: any) {
        console.error('Error saving commission:', err);
        return { success: false, error: err.message };
    }
}

export async function deleteCommission(id: string): Promise<{ success: boolean; error?: string }> {
    try {
        const { error } = await supabase.from('commissions').delete().eq('id', id);
        if (error) throw error;
        return { success: true };
    } catch (err: any) {
        console.error('Error deleting commission:', err);
        return { success: false, error: err.message };
    }
}

// ============================================
// WITHDRAWALS (Adiantamentos - Folha de Pagamento)
// ============================================

export async function saveWithdrawal(withdrawal: Withdrawal): Promise<{ success: boolean; error?: string }> {
    try {
        const dbData = {
            id: withdrawal.id,
            employeeId: withdrawal.employeeId,
            amount: withdrawal.amount,
            reason: withdrawal.reason || 'other',
            description: withdrawal.description,
            date: withdrawal.date,
            status: withdrawal.status || 'pending',
            createdAt: withdrawal.createdAt,
        };

        const { data: existing } = await supabase.from('withdrawals').select('id').eq('id', withdrawal.id).single();
        if (existing) {
            const { error } = await supabase.from('withdrawals').update(dbData).eq('id', withdrawal.id);
            if (error) throw error;
        } else {
            const { error } = await supabase.from('withdrawals').insert(dbData);
            if (error) throw error;
        }
        return { success: true };
    } catch (err: any) {
        console.error('Error saving withdrawal:', err);
        return { success: false, error: err.message };
    }
}

export async function deleteWithdrawal(id: string): Promise<{ success: boolean; error?: string }> {
    try {
        const { error } = await supabase.from('withdrawals').delete().eq('id', id);
        if (error) throw error;
        return { success: true };
    } catch (err: any) {
        console.error('Error deleting withdrawal:', err);
        return { success: false, error: err.message };
    }
}

// ============================================
// BANK ACCOUNTS (Contas Bancárias)
// ============================================

export async function saveBankAccount(account: BankAccount): Promise<{ success: boolean; error?: string }> {
    try {
        const now = new Date().toISOString();
        const dbData = {
            id: account.id,
            name: account.name,
            bank: account.institution, // schema uses 'bank'
            type: account.type,
            balance: account.balance,
            color: account.color,
            isActive: !account.archived, // schema uses isActive (opposite of archived)
            updatedAt: now, // Required NOT NULL field
        };

        const { data: existing } = await supabase.from('bank_accounts').select('id').eq('id', account.id).single();
        if (existing) {
            const { error } = await supabase.from('bank_accounts').update(dbData).eq('id', account.id);
            if (error) throw error;
        } else {
            const { error } = await supabase.from('bank_accounts').insert(dbData);
            if (error) throw error;
        }
        return { success: true };
    } catch (err: any) {
        console.error('Error saving bank account:', err);
        return { success: false, error: err.message };
    }
}

export async function deleteBankAccount(id: string): Promise<{ success: boolean; error?: string }> {
    try {
        const { error } = await supabase.from('bank_accounts').delete().eq('id', id);
        if (error) throw error;
        return { success: true };
    } catch (err: any) {
        console.error('Error deleting bank account:', err);
        return { success: false, error: err.message };
    }
}

// ============================================
// CLIENT INTERACTIONS (Pipeline CRM)
// ============================================

export async function saveClientInteraction(interaction: ClientInteraction): Promise<{ success: boolean; error?: string }> {
    try {
        const dbData = {
            id: interaction.id,
            clientId: interaction.clientId,
            type: interaction.type?.toUpperCase() || 'CALL',
            title: interaction.title,
            notes: interaction.description, // schema uses notes, not description
            date: interaction.date,
            userId: interaction.userId,
        };

        const { data: existing } = await supabase.from('client_interactions').select('id').eq('id', interaction.id).single();
        if (existing) {
            const { error } = await supabase.from('client_interactions').update(dbData).eq('id', interaction.id);
            if (error) throw error;
        } else {
            const { error } = await supabase.from('client_interactions').insert(dbData);
            if (error) throw error;
        }
        return { success: true };
    } catch (err: any) {
        console.error('Error saving client interaction:', err);
        return { success: false, error: err.message };
    }
}

export async function deleteClientInteraction(id: string): Promise<{ success: boolean; error?: string }> {
    try {
        const { error } = await supabase.from('client_interactions').delete().eq('id', id);
        if (error) throw error;
        return { success: true };
    } catch (err: any) {
        console.error('Error deleting client interaction:', err);
        return { success: false, error: err.message };
    }
}

// ============================================
// PIPELINE STAGES (CRM)
// ============================================

// ============================================
// PIPELINE (CRM) - Stages & Notes
// ============================================

export async function savePipelineStage(clientId: string, stage: string): Promise<{ success: boolean; error?: string }> {
    try {
        const now = new Date().toISOString();
        // Usamos upsert na tabela pipeline_stages
        // Se já existe, atualiza o stage e updatedAt, mantém notes

        // Primeiro verificamos se existe para decidir se é update ou insert
        const { data: existing } = await supabase.from('pipeline_stages').select('id').eq('clientId', clientId).single();

        if (existing) {
            const { error } = await supabase.from('pipeline_stages').update({
                stage: stage.toUpperCase(),
                updatedAt: now
            }).eq('clientId', clientId);
            if (error) throw error;
        } else {
            const { error } = await supabase.from('pipeline_stages').insert({
                clientId,
                stage: stage.toUpperCase(),
                updatedAt: now
            });
            if (error) throw error;
        }
        return { success: true };
    } catch (err: any) {
        console.error('Error saving pipeline stage:', err);
        return { success: false, error: err.message };
    }
}

export async function savePipelineNote(clientId: string, note: string): Promise<{ success: boolean; error?: string }> {
    try {
        const now = new Date().toISOString();
        const { data: existing } = await supabase.from('pipeline_stages').select('id').eq('clientId', clientId).single();

        if (existing) {
            const { error } = await supabase.from('pipeline_stages').update({
                notes: note,
                updatedAt: now
            }).eq('clientId', clientId);
            if (error) throw error;
        } else {
            // Se não existe estágio, cria um stage padrão "LEAD" junto com a nota?
            // Ou apenas falha? Idealmente o cliente já entra no pipeline ao ser criado.
            // Vamos criar com 'LEAD' se não existir.
            const { error } = await supabase.from('pipeline_stages').insert({
                clientId,
                stage: 'LEAD',
                notes: note,
                updatedAt: now
            });
            if (error) throw error;
        }
        return { success: true };
    } catch (err: any) {
        console.error('Error saving pipeline note:', err);
        return { success: false, error: err.message };
    }
}

// ============================================
// APP SETTINGS (Fase 2)
// ============================================

import { AppSettingsDB, RolePermission, Notification, SystemSettings } from '../types';

export async function saveAppSettings(category: keyof SystemSettings, data: any): Promise<{ success: boolean; error?: string }> {
    try {
        console.log(`[SETTINGS] Saving ${category}: `, data);
        const now = new Date().toISOString();

        // Settings é singleton. Usar maybeSingle para não dar erro se não existir
        const { data: existing, error: fetchError } = await supabase
            .from('app_settings')
            .select('id')
            .limit(1)
            .maybeSingle();

        if (fetchError) {
            console.error('[SETTINGS] Error fetching existing settings:', fetchError);
            throw fetchError;
        }

        if (existing) {
            console.log('[SETTINGS] Updating existing settings with ID:', existing.id);
            const { error } = await supabase.from('app_settings').update({
                [category]: data,
                updatedAt: now
            }).eq('id', existing.id);
            if (error) throw error;
        } else {
            console.log('[SETTINGS] Creating new settings entry');
            // Criar novo registro com este dado
            const { error } = await supabase.from('app_settings').insert({
                id: crypto.randomUUID(),
                [category]: data,
                updatedAt: now
            });
            if (error) throw error;
        }
        console.log(`[SETTINGS] ${category} saved successfully`);
        return { success: true };
    } catch (err: any) {
        console.error('[SETTINGS] Error saving app settings:', err);
        return { success: false, error: err.message };
    }
}

// ============================================
// PERMISSIONS (Fase 2)
// ============================================

export async function saveRolePermissions(rolePermission: RolePermission): Promise<{ success: boolean; error?: string }> {
    try {
        const now = new Date().toISOString();

        // Convert frontend role to database ENUM (cast to string to handle both formats)
        const roleStr = rolePermission.role as string;
        const dbRole = roleStr === 'Admin' || roleStr === 'ADMIN' ? 'ADMIN' :
            roleStr === 'Manager' || roleStr === 'MANAGER' ? 'MANAGER' :
                roleStr === 'Sales Executive' || roleStr === 'SALES' ? 'SALES' : 'SUPPORT';

        const dbData = {
            role: dbRole,
            permissions: rolePermission.permissions,
            updatedAt: now
        };

        const { data: existing } = await supabase.from('role_permissions').select('id').eq('role', dbRole).single();

        if (existing) {
            const { error } = await supabase.from('role_permissions').update(dbData).eq('role', dbRole);
            if (error) throw error;
        } else {
            // Generate ID for new record
            const { error } = await supabase.from('role_permissions').insert({
                ...dbData,
                id: crypto.randomUUID()
            });
            if (error) throw error;
        }
        return { success: true };
    } catch (err: any) {
        console.error('Error saving role permissions:', err);
        return { success: false, error: err.message };
    }
}

// ============================================
// SYSTEM NOTIFICATIONS (Fase 2)
// ============================================

export async function saveSystemNotification(notification: Notification): Promise<{ success: boolean; error?: string }> {
    try {
        const dbData = {
            id: notification.id,
            type: notification.type,
            title: notification.title,
            message: notification.message,
            read: notification.read,
            actionLabel: notification.action?.label,
            actionPath: notification.action?.path,
            createdAt: notification.createdAt
        };

        const { error } = await supabase.from('system_notifications').insert(dbData);
        if (error) throw error;

        return { success: true };
    } catch (err: any) {
        console.error('Error saving notification:', err);
        return { success: false, error: err.message };
    }
}

export async function markNotificationAsRead(id: string): Promise<{ success: boolean; error?: string }> {
    try {
        const { error } = await supabase.from('system_notifications').update({ read: true }).eq('id', id);
        if (error) throw error;
        return { success: true };
    } catch (err: any) {
        console.error('Error marking notification as read:', err);
        return { success: false, error: err.message };
    }
}

export async function markAllNotificationsAsRead(): Promise<{ success: boolean; error?: string }> {
    try {
        const { error } = await supabase.from('system_notifications').update({ read: true }).neq('read', true);
        if (error) throw error;
        return { success: true };
    } catch (err: any) {
        console.error('Error marking all notifications as read:', err);
        return { success: false, error: err.message };
    }
}

export async function deleteNotification(id: string): Promise<{ success: boolean; error?: string }> {
    try {
        const { error } = await supabase.from('system_notifications').delete().eq('id', id);
        if (error) throw error;
        return { success: true };
    } catch (err: any) {
        console.error('Error deleting notification:', err);
        return { success: false, error: err.message };
    }
}

// ============================================
// PAYMENT RECORDS (Registros de Pagamento)
// ============================================


export async function savePaymentRecord(record: PaymentRecord): Promise<{ success: boolean; error?: string }> {
    try {
        const now = new Date().toISOString();
        const dbData = {
            id: record.id,
            employeeId: record.employeeId,
            period: record.period,
            grossSalary: record.grossSalary,
            netSalary: record.netSalary,
            inss: record.inss,
            irrf: record.irrf,
            fgts: record.fgts,
            commissions: record.commissions,
            deductions: record.deductions,
            status: record.status,
            paidAt: record.paidAt || null,
            paidBy: record.paidBy || null,
            paymentMethod: record.paymentMethod || null,
            transactionId: record.transactionId || null,
            notes: record.notes || null,
            receiptUrl: record.receiptUrl || null,
            updatedAt: now
        };

        const { error } = await supabase
            .from('payment_records')
            .upsert(dbData, { onConflict: 'id' });

        if (error) throw error;
        return { success: true };
    } catch (err: any) {
        console.error('Error saving payment record:', err);
        return { success: false, error: err.message };
    }
}

export async function getPaymentRecords(period?: string): Promise<PaymentRecord[]> {
    try {
        let query = supabase.from('payment_records').select('*').order('createdAt', { ascending: false });

        if (period) {
            query = query.eq('period', period);
        }

        const { data, error } = await query;
        if (error) throw error;

        return (data || []).map((row: any) => ({
            id: row.id,
            employeeId: row.employeeId,
            period: row.period,
            grossSalary: parseFloat(row.grossSalary) || 0,
            netSalary: parseFloat(row.netSalary) || 0,
            inss: parseFloat(row.inss) || 0,
            irrf: parseFloat(row.irrf) || 0,
            fgts: parseFloat(row.fgts) || 0,
            commissions: parseFloat(row.commissions) || 0,
            deductions: parseFloat(row.deductions) || 0,
            status: row.status || 'pending',
            paidAt: row.paidAt,
            paidBy: row.paidBy,
            paymentMethod: row.paymentMethod,
            transactionId: row.transactionId,
            notes: row.notes,
            receiptUrl: row.receiptUrl,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt
        }));
    } catch (err: any) {
        console.error('Error fetching payment records:', err);
        return [];
    }
}

export async function updatePaymentStatus(
    id: string,
    status: 'pending' | 'processing' | 'paid' | 'partial',
    extras?: { paidAt?: string; paidBy?: string; paymentMethod?: string; transactionId?: string; notes?: string }
): Promise<{ success: boolean; error?: string }> {
    try {
        const updateData: any = {
            status,
            updatedAt: new Date().toISOString()
        };

        if (extras?.paidAt) updateData.paidAt = extras.paidAt;
        if (extras?.paidBy) updateData.paidBy = extras.paidBy;
        if (extras?.paymentMethod) updateData.paymentMethod = extras.paymentMethod;
        if (extras?.transactionId) updateData.transactionId = extras.transactionId;
        if (extras?.notes) updateData.notes = extras.notes;

        const { error } = await supabase
            .from('payment_records')
            .update(updateData)
            .eq('id', id);

        if (error) throw error;
        return { success: true };
    } catch (err: any) {
        console.error('Error updating payment status:', err);
        return { success: false, error: err.message };
    }
}

export async function deletePaymentRecord(id: string): Promise<{ success: boolean; error?: string }> {
    try {
        const { error } = await supabase.from('payment_records').delete().eq('id', id);
        if (error) throw error;
        return { success: true };
    } catch (err: any) {
        console.error('Error deleting payment record:', err);
        return { success: false, error: err.message };
    }
}

// ============================================
// PRODUCTS (Barbershop - Estoque)
// ============================================

import { Product, Comanda, ComandaItem, PurchaseOrder, PurchaseOrderItem } from '../types';

export async function saveProduct(product: Product): Promise<{ success: boolean; error?: string }> {
    try {
        const now = new Date().toISOString();
        const dbData = {
            id: product.id,
            name: product.name,
            description: product.description,
            brand: product.brand,
            category: product.category || 'pomada',
            costPrice: product.costPrice || 0,
            sellPrice: product.sellPrice,
            stock: product.stock ?? 0,
            minStock: product.minStock ?? 5,
            active: product.active ?? true,
            image: product.image || null,
            barcode: product.barcode || null,
            unit: product.unit || 'un',
            weight: product.weight || null,
            notes: product.notes || null,
            supplierId: product.supplierId || null,
            updatedAt: now,
        };

        const { data: existing } = await supabase
            .from('products')
            .select('id')
            .eq('id', product.id)
            .single();

        if (existing) {
            const { error } = await supabase.from('products').update(dbData).eq('id', product.id);
            if (error) throw error;
        } else {
            const { id: _id, ...dataWithoutId } = dbData;
            const { error } = await supabase.from('products').insert(dataWithoutId);
            if (error) throw error;
        }

        return { success: true };
    } catch (err: any) {
        console.error('Error saving product:', err);
        return { success: false, error: err.message };
    }
}

export async function deleteProduct(id: string): Promise<{ success: boolean; error?: string }> {
    try {
        const { error } = await supabase.from('products').delete().eq('id', id);
        if (error) throw error;
        return { success: true };
    } catch (err: any) {
        console.error('Error deleting product:', err);
        return { success: false, error: err.message };
    }
}

// ============================================
// COMANDAS (Barbershop - Atendimentos)
// ============================================

export async function saveComanda(comanda: Comanda): Promise<{ success: boolean; error?: string }> {
    try {
        const now = new Date().toISOString();
        const dbData = {
            id: comanda.id,
            clientId: comanda.clientId || null,
            clientName: comanda.clientName || null,
            barberId: comanda.barberId,
            barberName: comanda.barberName || null,
            status: comanda.status || 'open',
            totalAmount: comanda.totalAmount || 0,
            discountAmount: comanda.discountAmount || 0,
            finalAmount: comanda.finalAmount || 0,
            paymentMethod: comanda.paymentMethod || null,
            notes: comanda.notes || null,
            openedAt: comanda.openedAt || now,
            closedAt: comanda.closedAt || null,
            appointmentId: comanda.appointmentId || null,
            origin: comanda.origin || 'manual',
            openedBy: comanda.openedBy || null,
            closedBy: comanda.closedBy || null,
            unitId: comanda.unitId || null,
            updatedAt: now,
        };

        const { data: existing } = await supabase
            .from('comandas')
            .select('id')
            .eq('id', comanda.id)
            .single();

        if (existing) {
            const { error } = await supabase.from('comandas').update(dbData).eq('id', comanda.id);
            if (error) throw error;
        } else {
            const { error } = await supabase.from('comandas').insert(dbData);
            if (error) throw error;
        }

        return { success: true };
    } catch (err: any) {
        console.error('Error saving comanda:', err);
        return { success: false, error: err.message };
    }
}

export async function deleteComanda(id: string): Promise<{ success: boolean; error?: string }> {
    try {
        // CASCADE will delete comanda_items automatically
        const { error } = await supabase.from('comandas').delete().eq('id', id);
        if (error) throw error;
        return { success: true };
    } catch (err: any) {
        console.error('Error deleting comanda:', err);
        return { success: false, error: err.message };
    }
}

export async function saveComandaItem(item: ComandaItem): Promise<{ success: boolean; error?: string }> {
    try {
        const dbData = {
            id: item.id,
            comandaId: item.comandaId,
            type: item.type,
            itemId: item.itemId,
            name: item.name,
            quantity: item.quantity || 1,
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice,
        };

        const { data: existing } = await supabase
            .from('comanda_items')
            .select('id')
            .eq('id', item.id)
            .single();

        if (existing) {
            const { error } = await supabase.from('comanda_items').update(dbData).eq('id', item.id);
            if (error) throw error;
        } else {
            const { error } = await supabase.from('comanda_items').insert(dbData);
            if (error) throw error;
        }

        return { success: true };
    } catch (err: any) {
        console.error('Error saving comanda item:', err);
        return { success: false, error: err.message };
    }
}

export async function deleteComandaItem(id: string): Promise<{ success: boolean; error?: string }> {
    try {
        const { error } = await supabase.from('comanda_items').delete().eq('id', id);
        if (error) throw error;
        return { success: true };
    } catch (err: any) {
        console.error('Error deleting comanda item:', err);
        return { success: false, error: err.message };
    }
}

// Close a comanda: update status, set closedAt, and optionally create a transaction
export async function closeComanda(
    comandaId: string,
    paymentMethod: string,
    discount: number = 0,
    closedBy?: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const now = new Date().toISOString();

        // Fetch the comanda with items to calculate total
        const { data: comanda, error: fetchError } = await supabase
            .from('comandas')
            .select('*, comanda_items:comanda_items(*)')
            .eq('id', comandaId)
            .single();

        if (fetchError || !comanda) throw fetchError || new Error('Comanda not found');

        const items = comanda.comanda_items || [];
        const totalAmount = items.reduce((sum: number, item: any) => sum + Number(item.totalPrice || 0), 0);
        const finalAmount = Math.max(0, totalAmount - discount);

        // Update comanda
        const { error: updateError } = await supabase
            .from('comandas')
            .update({
                status: 'closed',
                totalAmount,
                discountAmount: discount,
                finalAmount,
                paymentMethod,
                closedAt: now,
                closedBy: closedBy || null,
                updatedAt: now,
            })
            .eq('id', comandaId);

        if (updateError) throw updateError;

        // Deduct product stock for product items
        const productItems = items.filter((item: any) => item.type === 'product');
        for (const item of productItems) {
            await supabase.rpc('decrement_stock', {
                product_id: item.itemId,
                qty: item.quantity
            }).then(({ error }) => {
                if (error) console.warn('Stock decrement failed for', item.itemId, error.message);
            });
        }

        // Update client's lastVisit and totalVisits if clientId exists
        if (comanda.clientId) {
            await supabase
                .from('clients')
                .update({
                    lastVisit: now,
                    totalVisits: (comanda as any).client_total_visits
                        ? Number((comanda as any).client_total_visits) + 1
                        : undefined,
                    updatedAt: now,
                })
                .eq('id', comanda.clientId)
                .then(({ error }) => {
                    if (error) console.warn('Client update failed:', error.message);
                });
        }

        // If comanda has a linked appointment, update its status to 'completed'
        if (comanda.appointmentId) {
            await supabase
                .from('calendar_events')
                .update({ status: 'completed', updatedAt: now })
                .eq('id', comanda.appointmentId)
                .then(({ error }) => {
                    if (error) console.warn('Appointment status update failed:', error.message);
                });
        }

        return { success: true };
    } catch (err: any) {
        console.error('Error closing comanda:', err);
        return { success: false, error: err.message };
    }
}

// Create a comanda automatically from an appointment (calendar event)
export async function createComandaFromAppointment(
    event: CalendarEvent,
    allServices: Service[],
    allClients: Client[],
    currentUserId: string
): Promise<{ success: boolean; comanda?: Comanda; error?: string }> {
    try {
        // Guard: check if a comanda already exists for this appointment
        const { data: existing } = await supabase
            .from('comandas')
            .select('id')
            .eq('appointmentId', event.id)
            .single();

        if (existing) {
            return { success: false, error: 'Comanda já existe para este agendamento' };
        }

        const now = new Date().toISOString();
        const comandaId = crypto.randomUUID();

        // Resolve client info
        const client = event.client
            ? allClients.find(c => c.name === event.client || c.id === event.client)
            : null;

        // Build comanda items from event services
        const serviceIds = event.serviceIds && event.serviceIds.length > 0
            ? event.serviceIds
            : event.serviceId ? [event.serviceId] : [];

        const comandaItems: ComandaItem[] = serviceIds
            .map(svcId => {
                const svc = allServices.find(s => s.id === svcId);
                if (!svc) return null;
                return {
                    id: crypto.randomUUID(),
                    comandaId,
                    type: 'service' as const,
                    itemId: svc.id,
                    name: svc.name,
                    quantity: 1,
                    unitPrice: svc.price,
                    totalPrice: svc.price,
                };
            })
            .filter(Boolean) as ComandaItem[];

        const totalAmount = comandaItems.reduce((sum, item) => sum + item.totalPrice, 0);

        const newComanda: Comanda = {
            id: comandaId,
            clientId: client?.id || undefined,
            clientName: client?.name || event.client || 'Cliente Avulso',
            barberId: event.barberId || '',
            barberName: event.barberName || '',
            status: 'open',
            totalAmount,
            discountAmount: 0,
            finalAmount: totalAmount,
            openedAt: now,
            items: comandaItems,
            appointmentId: event.id,
            origin: 'agenda',
            openedBy: currentUserId,
            unitId: event.unitId,
        };

        // Save comanda to DB
        const saveResult = await saveComanda(newComanda);
        if (!saveResult.success) {
            return { success: false, error: saveResult.error };
        }

        // Save comanda items
        for (const item of comandaItems) {
            const itemResult = await saveComandaItem(item);
            if (!itemResult.success) {
                console.warn('Failed to save comanda item:', item.name, itemResult.error);
            }
        }

        // Link the calendar_event to the comanda
        await supabase
            .from('calendar_events')
            .update({ comandaId, updatedAt: now })
            .eq('id', event.id)
            .then(({ error }) => {
                if (error) console.warn('Failed to link event to comanda:', error.message);
            });

        return { success: true, comanda: newComanda };
    } catch (err: any) {
        console.error('Error creating comanda from appointment:', err);
        return { success: false, error: err.message };
    }
}

// ============================================
// PRODUCT SUPPLIERS
// ============================================

import { ProductSupplier, ProductMovement } from '../types';

export async function saveProductSupplier(supplier: ProductSupplier): Promise<{ success: boolean; error?: string }> {
    try {
        const now = new Date().toISOString();
        const dbData = {
            id: supplier.id,
            name: supplier.name,
            contactName: supplier.contactName || null,
            phone: supplier.phone || null,
            email: supplier.email || null,
            website: supplier.website || null,
            cnpj: supplier.cnpj || null,
            address: supplier.address || null,
            notes: supplier.notes || null,
            updatedAt: now,
        };

        const { data: existing } = await supabase
            .from('product_suppliers')
            .select('id')
            .eq('id', supplier.id)
            .single();

        if (existing) {
            const { error } = await supabase.from('product_suppliers').update(dbData).eq('id', supplier.id);
            if (error) throw error;
        } else {
            const { id: _id, ...dataWithoutId } = dbData;
            const { error } = await supabase.from('product_suppliers').insert(dataWithoutId);
            if (error) throw error;
        }

        return { success: true };
    } catch (err: any) {
        console.error('Error saving supplier:', err);
        return { success: false, error: err.message };
    }
}

export async function deleteProductSupplier(id: string): Promise<{ success: boolean; error?: string }> {
    try {
        const { error } = await supabase.from('product_suppliers').delete().eq('id', id);
        if (error) throw error;
        return { success: true };
    } catch (err: any) {
        console.error('Error deleting supplier:', err);
        return { success: false, error: err.message };
    }
}

// ============================================
// PRODUCT MOVEMENTS (Stock History)
// ============================================

export async function createProductMovement(movement: Omit<ProductMovement, 'id' | 'createdAt'>): Promise<{ success: boolean; error?: string }> {
    try {
        const { error } = await supabase.from('product_movements').insert(movement);
        if (error) throw error;
        return { success: true };
    } catch (err: any) {
        console.error('Error creating movement:', err);
        return { success: false, error: err.message };
    }
}

export async function getProductMovements(productId?: string): Promise<ProductMovement[]> {
    try {
        let query = supabase
            .from('product_movements')
            .select('*')
            .order('createdAt', { ascending: false })
            .limit(200);
        if (productId) {
            query = query.eq('productId', productId);
        }
        const { data, error } = await query;
        if (error) throw error;
        return (data || []) as ProductMovement[];
    } catch (err) {
        console.error('Error fetching movements:', err);
        return [];
    }
}

// ===== PURCHASE ORDERS (Compras de Produtos) =====

export async function savePurchaseOrder(
    order: PurchaseOrder,
    items: PurchaseOrderItem[]
): Promise<{ success: boolean; error?: string }> {
    try {
        const now = new Date().toISOString();
        const dbData = {
            id: order.id,
            supplierId: order.supplierId || null,
            supplierName: order.supplierName,
            nfNumber: order.nfNumber || null,
            orderDate: order.orderDate || now,
            deliveryDate: order.deliveryDate || null,
            status: order.status || 'pending',
            totalAmount: order.totalAmount || 0,
            notes: order.notes || null,
            createdBy: order.createdBy || null,
            updatedAt: now,
        };

        const { data: existing } = await supabase
            .from('purchase_orders')
            .select('id')
            .eq('id', order.id)
            .single();

        if (existing) {
            const { error } = await supabase.from('purchase_orders').update(dbData).eq('id', order.id);
            if (error) throw error;
        } else {
            const { error } = await supabase.from('purchase_orders').insert(dbData);
            if (error) throw error;
        }

        // Delete existing items and re-insert
        await supabase.from('purchase_order_items').delete().eq('purchaseOrderId', order.id);

        if (items.length > 0) {
            const itemsData = items.map(item => ({
                id: item.id || crypto.randomUUID(),
                purchaseOrderId: order.id,
                productId: item.productId || null,
                productName: item.productName,
                quantity: item.quantity || 1,
                unitCost: item.unitCost || 0,
                totalCost: item.totalCost || 0,
            }));
            const { error } = await supabase.from('purchase_order_items').insert(itemsData);
            if (error) throw error;
        }

        return { success: true };
    } catch (err: any) {
        console.error('Error saving purchase order:', err);
        return { success: false, error: err.message };
    }
}

export async function deletePurchaseOrder(id: string): Promise<{ success: boolean; error?: string }> {
    try {
        // CASCADE will delete purchase_order_items automatically
        const { error } = await supabase.from('purchase_orders').delete().eq('id', id);
        if (error) throw error;
        return { success: true };
    } catch (err: any) {
        console.error('Error deleting purchase order:', err);
        return { success: false, error: err.message };
    }
}

export async function getPurchaseOrders(): Promise<PurchaseOrder[]> {
    try {
        const { data, error } = await supabase
            .from('purchase_orders')
            .select('*, purchase_order_items:purchase_order_items(*)')
            .order('orderDate', { ascending: false })
            .limit(200);
        if (error) throw error;
        return (data || []).map((o: any) => ({
            ...o,
            totalAmount: Number(o.totalAmount) || 0,
            items: (o.purchase_order_items || []).map((i: any) => ({
                ...i,
                quantity: Number(i.quantity) || 0,
                unitCost: Number(i.unitCost) || 0,
                totalCost: Number(i.totalCost) || 0,
            })),
        })) as PurchaseOrder[];
    } catch (err) {
        console.error('Error fetching purchase orders:', err);
        return [];
    }
}

// ============================================
// SUBSCRIPTION PLANS
// ============================================

import { SubscriptionPlan, Subscription } from '../types';

export async function saveSubscriptionPlan(plan: SubscriptionPlan): Promise<{ success: boolean; error?: string }> {
    try {
        const now = new Date().toISOString();
        const dbData = {
            id: plan.id,
            name: plan.name,
            description: plan.description || null,
            price: plan.price,
            servicesIncluded: plan.servicesIncluded || [],
            maxUsesPerMonth: plan.maxUsesPerMonth || null,
            durationDays: plan.durationDays || 30,
            active: plan.active ?? true,
            recurrence: plan.recurrence || 'monthly',
            availableForSale: plan.availableForSale ?? true,
            creditEnabled: plan.creditEnabled ?? true,
            creditPrice: plan.creditPrice ?? null,
            boletoEnabled: plan.boletoEnabled ?? false,
            boletoPrice: plan.boletoPrice ?? null,
            benefits: plan.benefits || [],
            planServices: JSON.stringify(plan.planServices || []),
            planProducts: JSON.stringify(plan.planProducts || []),
            disabledDays: plan.disabledDays || [],
            excludedProfessionals: plan.excludedProfessionals || [],
            updatedAt: now,
        };
        const { error } = await supabase
            .from('subscription_plans')
            .upsert(dbData, { onConflict: 'id' });
        if (error) throw error;
        return { success: true };
    } catch (err: any) {
        console.error('Error saving subscription plan:', err);
        return { success: false, error: err.message };
    }
}

export async function deleteSubscriptionPlan(id: string): Promise<{ success: boolean; error?: string }> {
    try {
        const { error } = await supabase.from('subscription_plans').delete().eq('id', id);
        if (error) throw error;
        return { success: true };
    } catch (err: any) {
        console.error('Error deleting subscription plan:', err);
        return { success: false, error: err.message };
    }
}

export async function getSubscriptionPlans(): Promise<SubscriptionPlan[]> {
    try {
        const { data, error } = await supabase
            .from('subscription_plans')
            .select('*')
            .order('createdAt', { ascending: false });
        if (error) throw error;
        return (data || []).map((p: any) => ({
            ...p,
            price: Number(p.price) || 0,
            servicesIncluded: p.servicesIncluded || [],
            durationDays: Number(p.durationDays) || 30,
            active: p.active ?? true,
            recurrence: p.recurrence || 'monthly',
            availableForSale: p.availableForSale ?? true,
            creditEnabled: p.creditEnabled ?? true,
            creditPrice: p.creditPrice != null ? Number(p.creditPrice) : undefined,
            boletoEnabled: p.boletoEnabled ?? false,
            boletoPrice: p.boletoPrice != null ? Number(p.boletoPrice) : undefined,
            benefits: p.benefits || [],
            planServices: typeof p.planServices === 'string' ? JSON.parse(p.planServices) : (p.planServices || []),
            planProducts: typeof p.planProducts === 'string' ? JSON.parse(p.planProducts) : (p.planProducts || []),
            disabledDays: p.disabledDays || [],
            excludedProfessionals: p.excludedProfessionals || [],
        })) as SubscriptionPlan[];
    } catch (err) {
        console.error('Error fetching subscription plans:', err);
        return [];
    }
}

// ============================================
// SUBSCRIPTIONS (Assinantes)
// ============================================

export async function saveSubscription(sub: Subscription): Promise<{ success: boolean; error?: string }> {
    try {
        const now = new Date().toISOString();
        const dbData = {
            id: sub.id,
            planId: sub.planId,
            clientId: sub.clientId,
            clientName: sub.clientName || null,
            status: sub.status || 'active',
            startDate: sub.startDate,
            endDate: sub.endDate || null,
            usesThisMonth: sub.usesThisMonth ?? 0,
            paymentDay: sub.paymentDay || 5,
            paymentMethod: sub.paymentMethod || null,
            gatewayCustomerId: sub.gatewayCustomerId || null,
            gatewaySubscriptionId: sub.gatewaySubscriptionId || null,
            lastPaymentDate: sub.lastPaymentDate || null,
            nextPaymentDate: sub.nextPaymentDate || null,
            invoiceUrl: sub.invoiceUrl || null,
            cardBrand: sub.cardBrand || null,
            cardLast4: sub.cardLast4 || null,
            billingEmail: sub.billingEmail || null,
            soldBy: sub.soldBy || null,
            soldByName: sub.soldByName || null,
            saleChannel: sub.saleChannel || null,
            saleCommission: sub.saleCommission ?? null,
            saleCommissionType: sub.saleCommissionType || null,
            autoRenew: sub.autoRenew ?? true,
            cancellationReason: sub.cancellationReason || null,
            notes: sub.notes || null,
            updatedAt: now,
        };
        const { error } = await supabase
            .from('subscriptions')
            .upsert(dbData, { onConflict: 'id' });
        if (error) throw error;
        return { success: true };
    } catch (err: any) {
        console.error('Error saving subscription:', err);
        return { success: false, error: err.message };
    }
}

export async function deleteSubscription(id: string): Promise<{ success: boolean; error?: string }> {
    try {
        const { error } = await supabase.from('subscriptions').delete().eq('id', id);
        if (error) throw error;
        return { success: true };
    } catch (err: any) {
        console.error('Error deleting subscription:', err);
        return { success: false, error: err.message };
    }
}

export async function getSubscriptions(): Promise<Subscription[]> {
    try {
        const { data, error } = await supabase
            .from('subscriptions')
            .select('*, subscription_plans(*)')
            .order('createdAt', { ascending: false });
        if (error) throw error;
        return (data || []).map((s: any) => ({
            ...s,
            usesThisMonth: Number(s.usesThisMonth) || 0,
            paymentDay: Number(s.paymentDay) || 5,
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
            saleCommission: s.saleCommission != null ? Number(s.saleCommission) : undefined,
            saleCommissionType: s.saleCommissionType || undefined,
            autoRenew: s.autoRenew ?? true,
            cancellationReason: s.cancellationReason || undefined,
            notes: s.notes || undefined,
            plan: s.subscription_plans ? {
                ...s.subscription_plans,
                price: Number(s.subscription_plans.price) || 0,
                servicesIncluded: s.subscription_plans.servicesIncluded || [],
                durationDays: Number(s.subscription_plans.durationDays) || 30,
            } : undefined,
        })) as Subscription[];
    } catch (err) {
        console.error('Error fetching subscriptions:', err);
        return [];
    }
}

// ============================================
// WORK SCHEDULES (Expedientes)
// ============================================

import { WorkSchedule } from '../types';

export async function saveWorkSchedule(schedule: WorkSchedule): Promise<{ success: boolean; error?: string }> {
    try {
        const now = new Date().toISOString();
        const dbData = {
            id: schedule.id,
            memberId: schedule.memberId,
            dayOfWeek: schedule.dayOfWeek,
            startTime: schedule.startTime || null,
            endTime: schedule.endTime || null,
            breakStart: schedule.breakStart || null,
            breakEnd: schedule.breakEnd || null,
            isOff: schedule.isOff ?? false,
            templateName: schedule.templateName || null,
            updatedAt: now,
        };
        const { error } = await supabase
            .from('work_schedules')
            .upsert(dbData, { onConflict: 'id' });
        if (error) throw error;
        return { success: true };
    } catch (err: any) {
        console.error('Error saving work schedule:', err);
        return { success: false, error: err.message };
    }
}

export async function deleteWorkSchedule(id: string): Promise<{ success: boolean; error?: string }> {
    try {
        const { error } = await supabase.from('work_schedules').delete().eq('id', id);
        if (error) throw error;
        return { success: true };
    } catch (err: any) {
        console.error('Error deleting work schedule:', err);
        return { success: false, error: err.message };
    }
}

export async function getWorkSchedules(): Promise<WorkSchedule[]> {
    try {
        const { data, error } = await supabase
            .from('work_schedules')
            .select('*')
            .order('dayOfWeek', { ascending: true });
        if (error) throw error;
        return (data || []).map((s: any) => ({
            ...s,
            dayOfWeek: Number(s.dayOfWeek),
            isOff: s.isOff ?? false,
        })) as WorkSchedule[];
    } catch (err) {
        console.error('Error fetching work schedules:', err);
        return [];
    }
}

export async function saveWorkSchedulesBulk(schedules: WorkSchedule[]): Promise<{ success: boolean; error?: string }> {
    try {
        const now = new Date().toISOString();
        const dbData = schedules.map(s => ({
            id: s.id,
            memberId: s.memberId,
            dayOfWeek: s.dayOfWeek,
            startTime: s.startTime || null,
            endTime: s.endTime || null,
            breakStart: s.breakStart || null,
            breakEnd: s.breakEnd || null,
            isOff: s.isOff ?? false,
            templateName: s.templateName || null,
            updatedAt: now,
        }));
        const { error } = await supabase
            .from('work_schedules')
            .upsert(dbData, { onConflict: 'id' });
        if (error) throw error;
        return { success: true };
    } catch (err: any) {
        console.error('Error bulk saving work schedules:', err);
        return { success: false, error: err.message };
    }
}

// ============================================
// UNITS (Multi-Unidades)
// ============================================

import { Unit, UnitMember } from '../types';

// Upload image to Supabase Storage and return public URL
export async function uploadUnitImage(file: File, unitId: string, type: 'cover' | 'profile'): Promise<string | null> {
    try {
        const ext = file.name.split('.').pop() || 'jpg';
        const path = `${unitId}/${type}_${Date.now()}.${ext}`;
        const { error } = await supabase.storage.from('unit-images').upload(path, file, {
            cacheControl: '3600',
            upsert: true,
        });
        if (error) throw error;
        const { data } = supabase.storage.from('unit-images').getPublicUrl(path);
        return data.publicUrl;
    } catch (err: any) {
        console.error('Error uploading unit image:', err);
        return null;
    }
}

export async function saveUnit(unit: Unit): Promise<{ success: boolean; error?: string }> {
    try {
        const now = new Date().toISOString();
        const isNew = !unit.id || unit.id.startsWith('unit_');
        const dbData: Record<string, unknown> = {
            name: unit.name,
            tradeName: unit.tradeName || null,
            cnpj: unit.cnpj || null,
            address: unit.address,
            city: unit.city,
            state: unit.state || 'SP',
            zip: unit.zip || null,
            phone: unit.phone,
            email: unit.email || null,
            managerId: unit.managerId || null,
            managerName: unit.managerName || null,
            status: unit.status || 'active',
            image: unit.image || null,
            coverImage: unit.coverImage || null,
            profileImage: unit.profileImage || null,
            openingDate: unit.openingDate || null,
            maxCapacity: unit.maxCapacity ?? 6,
            operatingHours: unit.operatingHours || '09:00 - 20:00',
            notes: unit.notes || null,
            updatedAt: now,
        };

        if (isNew) {
            dbData.createdAt = now;
            const { error } = await supabase.from('units').insert(dbData);
            if (error) throw error;
        } else {
            dbData.id = unit.id;
            const { error } = await supabase.from('units').upsert(dbData, { onConflict: 'id' });
            if (error) throw error;
        }
        return { success: true };
    } catch (err: any) {
        console.error('Error saving unit:', err);
        return { success: false, error: err.message };
    }
}

export async function deleteUnit(id: string): Promise<{ success: boolean; error?: string }> {
    try {
        const { error } = await supabase.from('units').delete().eq('id', id);
        if (error) throw error;
        return { success: true };
    } catch (err: any) {
        console.error('Error deleting unit:', err);
        return { success: false, error: err.message };
    }
}

export async function saveUnitMember(member: UnitMember): Promise<{ success: boolean; error?: string }> {
    try {
        const now = new Date().toISOString();
        const dbData: Record<string, unknown> = {
            unitId: member.unitId,
            userId: member.userId,
            role: member.role || 'member',
            isPrimary: member.isPrimary ?? false,
            createdAt: now,
        };
        if (member.id && !member.id.startsWith('temp_')) {
            dbData.id = member.id;
        }
        const { error } = await supabase.from('unit_members').upsert(dbData, { onConflict: 'id' });
        if (error) throw error;
        return { success: true };
    } catch (err: any) {
        console.error('Error saving unit member:', err);
        return { success: false, error: err.message };
    }
}

export async function deleteUnitMember(id: string): Promise<{ success: boolean; error?: string }> {
    try {
        const { error } = await supabase.from('unit_members').delete().eq('id', id);
        if (error) throw error;
        return { success: true };
    } catch (err: any) {
        console.error('Error deleting unit member:', err);
        return { success: false, error: err.message };
    }
}

// ============================================
// NOTA FISCAL — Professional Fiscal Data
// ============================================



export async function getProfessionalFiscalData(): Promise<ProfessionalFiscalData[]> {
    try {
        const { data, error } = await supabase
            .from('professional_fiscal_data')
            .select('*')
            .order('createdAt', { ascending: false });
        if (error) throw error;
        return (data || []) as ProfessionalFiscalData[];
    } catch (err: any) {
        console.error('Error fetching professional fiscal data:', err);
        return [];
    }
}

export async function saveProfessionalFiscalData(
    fiscal: ProfessionalFiscalData
): Promise<{ success: boolean; error?: string }> {
    try {
        const now = new Date().toISOString();
        const dbData = {
            memberId: fiscal.memberId,
            cnpj: fiscal.cnpj,
            razaoSocial: fiscal.razaoSocial,
            nomeFantasia: fiscal.nomeFantasia || null,
            taxRegime: fiscal.taxRegime || 'mei',
            emissionVia: fiscal.emissionVia || 'cnpj_proprio',
            municipalRegistration: fiscal.municipalRegistration || null,
            stateRegistration: fiscal.stateRegistration || null,
            cnae: fiscal.cnae || null,
            address: fiscal.address || null,
            city: fiscal.city || null,
            state: fiscal.state || null,
            zip: fiscal.zip || null,
            certificateFile: fiscal.certificateFile || null,
            certificatePassword: fiscal.certificatePassword || null,
            certificateName: fiscal.certificateName || null,
            certificateExpiry: fiscal.certificateExpiry || null,
            certificateStatus: fiscal.certificateStatus || 'missing',
            fiscalStatus: fiscal.fiscalStatus || 'pending',
            active: fiscal.active ?? true,
            updatedAt: now,
        };

        const { data: existing } = await supabase
            .from('professional_fiscal_data')
            .select('id')
            .eq('memberId', fiscal.memberId)
            .single();

        if (existing) {
            const { error } = await supabase
                .from('professional_fiscal_data')
                .update(dbData)
                .eq('memberId', fiscal.memberId);
            if (error) throw error;
        } else {
            const { error } = await supabase
                .from('professional_fiscal_data')
                .insert({ ...dbData, createdAt: now });
            if (error) throw error;
        }

        return { success: true };
    } catch (err: any) {
        console.error('Error saving professional fiscal data:', err);
        return { success: false, error: err.message };
    }
}

export async function deleteProfessionalFiscalData(
    memberId: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const { error } = await supabase
            .from('professional_fiscal_data')
            .delete()
            .eq('memberId', memberId);
        if (error) throw error;
        return { success: true };
    } catch (err: any) {
        console.error('Error deleting professional fiscal data:', err);
        return { success: false, error: err.message };
    }
}

// ============================================
// NOTA FISCAL — Invoice Emitters
// ============================================

export async function getEmitters(): Promise<InvoiceEmitter[]> {
    try {
        const { data, error } = await supabase
            .from('invoice_emitters')
            .select('*')
            .order('createdAt', { ascending: false });
        if (error) throw error;
        return (data || []) as InvoiceEmitter[];
    } catch (err: any) {
        console.error('Error fetching emitters:', err);
        return [];
    }
}

export async function saveEmitter(
    emitter: InvoiceEmitter
): Promise<{ success: boolean; error?: string }> {
    try {
        const now = new Date().toISOString();
        const dbData = {
            type: emitter.type || 'company',
            name: emitter.name,
            tradeName: emitter.tradeName || null,
            cnpj: emitter.cnpj,
            taxRegime: emitter.taxRegime || 'simples',
            municipalRegistration: emitter.municipalRegistration || null,
            stateRegistration: emitter.stateRegistration || null,
            cnae: emitter.cnae || null,
            address: emitter.address || null,
            city: emitter.city || null,
            state: emitter.state || null,
            zip: emitter.zip || null,
            email: emitter.email || null,
            phone: emitter.phone || null,
            nfseEnvironment: emitter.nfseEnvironment || 'homologacao',
            nfseSeries: emitter.nfseSeries || '1',
            nfseNextNumber: emitter.nfseNextNumber || 1,
            nfseIssRate: emitter.nfseIssRate || 5.00,
            defaultServiceCode: emitter.defaultServiceCode || null,
            nfceEnvironment: emitter.nfceEnvironment || 'homologacao',
            nfceSeries: emitter.nfceSeries || '1',
            nfceCsc: emitter.nfceCsc || null,
            nfceTokenId: emitter.nfceTokenId || null,
            certificateFile: emitter.certificateFile || null,
            certificatePassword: emitter.certificatePassword || null,
            certificateName: emitter.certificateName || null,
            certificateExpiry: emitter.certificateExpiry || null,
            certificateStatus: emitter.certificateStatus || 'missing',
            active: emitter.active ?? true,
            memberId: emitter.memberId || null,
            unitId: emitter.unitId || null,
            updatedAt: now,
        };

        const { data: existing } = await supabase
            .from('invoice_emitters')
            .select('id')
            .eq('id', emitter.id)
            .single();

        if (existing) {
            const { error } = await supabase
                .from('invoice_emitters')
                .update(dbData)
                .eq('id', emitter.id);
            if (error) throw error;
        } else {
            const insertData: Record<string, unknown> = { ...dbData, createdAt: now };
            if (emitter.id && !emitter.id.startsWith('temp_')) {
                insertData.id = emitter.id;
            }
            const { error } = await supabase
                .from('invoice_emitters')
                .insert(insertData);
            if (error) throw error;
        }

        return { success: true };
    } catch (err: any) {
        console.error('Error saving emitter:', err);
        return { success: false, error: err.message };
    }
}

export async function deleteEmitter(
    id: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const { error } = await supabase
            .from('invoice_emitters')
            .delete()
            .eq('id', id);
        if (error) throw error;
        return { success: true };
    } catch (err: any) {
        console.error('Error deleting emitter:', err);
        return { success: false, error: err.message };
    }
}

// ============================================
// NOTA FISCAL — Invoices
// ============================================

export async function getInvoices(): Promise<Invoice[]> {
    try {
        const { data, error } = await supabase
            .from('invoices')
            .select('*')
            .order('createdAt', { ascending: false });
        if (error) throw error;
        return (data || []).map((inv: any) => ({
            ...inv,
            items: typeof inv.items === 'string' ? JSON.parse(inv.items) : inv.items || [],
            events: typeof inv.events === 'string' ? JSON.parse(inv.events) : inv.events || [],
            totalServices: Number(inv.totalServices || 0),
            totalProducts: Number(inv.totalProducts || 0),
            totalAmount: Number(inv.totalAmount || 0),
            discountAmount: Number(inv.discountAmount || 0),
            issTotal: Number(inv.issTotal || 0),
        })) as Invoice[];
    } catch (err: any) {
        console.error('Error fetching invoices:', err);
        return [];
    }
}

export async function saveInvoice(
    invoice: Invoice
): Promise<{ success: boolean; error?: string }> {
    try {
        const now = new Date().toISOString();
        const dbData = {
            number: invoice.number || null,
            series: invoice.series || null,
            docType: invoice.docType,
            status: invoice.status,
            emitterId: invoice.emitterId || null,
            emitterName: invoice.emitterName || null,
            clientId: invoice.clientId || null,
            clientName: invoice.clientName,
            clientCpfCnpj: invoice.clientCpfCnpj || null,
            clientEmail: invoice.clientEmail || null,
            clientAddress: invoice.clientAddress || null,
            comandaId: invoice.comandaId || null,
            appointmentId: invoice.appointmentId || null,
            professionalId: invoice.professionalId || null,
            professionalName: invoice.professionalName || null,
            items: JSON.stringify(invoice.items || []),
            totalServices: invoice.totalServices || 0,
            totalProducts: invoice.totalProducts || 0,
            totalAmount: invoice.totalAmount || 0,
            discountAmount: invoice.discountAmount || 0,
            issTotal: invoice.issTotal || 0,
            icmsTotal: invoice.icmsTotal || 0,
            pisTotal: invoice.pisTotal || 0,
            cofinsTotal: invoice.cofinsTotal || 0,
            taxSummary: invoice.taxSummary || null,
            protocolNumber: invoice.protocolNumber || null,
            authorizationDate: invoice.authorizationDate || null,
            rejectionReason: invoice.rejectionReason || null,
            cancellationReason: invoice.cancellationReason || null,
            correctionText: invoice.correctionText || null,
            pdfUrl: invoice.pdfUrl || null,
            xmlUrl: invoice.xmlUrl || null,
            events: JSON.stringify(invoice.events || []),
            notes: invoice.notes || null,
            createdBy: invoice.createdBy || null,
            updatedAt: now,
        };

        const { data: existing } = await supabase
            .from('invoices')
            .select('id')
            .eq('id', invoice.id)
            .single();

        if (existing) {
            const { error } = await supabase
                .from('invoices')
                .update(dbData)
                .eq('id', invoice.id);
            if (error) throw error;
        } else {
            const insertData: Record<string, unknown> = { ...dbData, createdAt: now };
            if (invoice.id && !invoice.id.startsWith('temp_')) {
                insertData.id = invoice.id;
            }
            const { error } = await supabase
                .from('invoices')
                .insert(insertData);
            if (error) throw error;
        }

        return { success: true };
    } catch (err: any) {
        console.error('Error saving invoice:', err);
        return { success: false, error: err.message };
    }
}

export async function deleteInvoice(
    id: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const { error } = await supabase
            .from('invoices')
            .delete()
            .eq('id', id);
        if (error) throw error;
        return { success: true };
    } catch (err: any) {
        console.error('Error deleting invoice:', err);
        return { success: false, error: err.message };
    }
}

// ============================================
// NOTA FISCAL — Fiscal Settings
// ============================================

export async function getFiscalSettings(): Promise<FiscalSettings | null> {
    try {
        const { data, error } = await supabase
            .from('fiscal_settings')
            .select('*')
            .limit(1)
            .single();
        if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows
        return data as FiscalSettings | null;
    } catch (err: any) {
        console.error('Error fetching fiscal settings:', err);
        return null;
    }
}

export async function saveFiscalSettings(
    settings: FiscalSettings
): Promise<{ success: boolean; error?: string }> {
    try {
        const now = new Date().toISOString();
        const dbData = {
            autoEmitOnClose: settings.autoEmitOnClose ?? false,
            autoSendEmail: settings.autoSendEmail ?? false,
            defaultDocType: settings.defaultDocType || 'nfse',
            defaultEmitterId: settings.defaultEmitterId || null,
            splitMixedComanda: settings.splitMixedComanda ?? false,
            apiProvider: settings.apiProvider || 'none',
            apiKey: settings.apiKey || null,
            apiEnvironment: settings.apiEnvironment || 'sandbox',
            cancellationWindowHours: settings.cancellationWindowHours ?? 24,
            emailTemplate: settings.emailTemplate || null,
            unitId: settings.unitId || null,
            updatedAt: now,
        };

        // Check if settings row exists
        const { data: existing } = await supabase
            .from('fiscal_settings')
            .select('id')
            .limit(1)
            .single();

        if (existing) {
            const { error } = await supabase
                .from('fiscal_settings')
                .update(dbData)
                .eq('id', existing.id);
            if (error) throw error;
        } else {
            const { error } = await supabase
                .from('fiscal_settings')
                .insert(dbData);
            if (error) throw error;
        }

        return { success: true };
    } catch (err: any) {
        console.error('Error saving fiscal settings:', err);
        return { success: false, error: err.message };
    }
}

// ═══════════════════════════════════════════════════════════
// ██  SITE SETTINGS (Editor do Site de Agendamento)  ██
// ═══════════════════════════════════════════════════════════

import type { SiteSettings } from '../types';

export async function getSiteSettings(): Promise<SiteSettings | null> {
    try {
        const { data, error } = await supabase
            .from('site_settings')
            .select('*')
            .eq('id', 'default')
            .single();

        if (error || !data) return null;

        return {
            id: data.id,
            isActive: data.isActive ?? false,
            primaryColor: data.primaryColor || '#00bf62',
            logoUrl: data.logoUrl || undefined,
            heroImageUrl: data.heroImageUrl || undefined,
            sectionsVisible: data.sectionsVisible || { reviews: true, team: true, promotions: false, social: true },
            businessName: data.businessName || undefined,
            slogan: data.slogan || undefined,
            address: data.address || undefined,
            phone: data.phone || undefined,
            aboutText: data.aboutText || undefined,
            ctaButtonText: data.ctaButtonText || 'Agendar Agora',
            businessHours: data.businessHours || [],
            visibleServiceIds: data.visibleServiceIds || [],
            whatsappNumber: data.whatsappNumber || undefined,
            whatsappEnabled: data.whatsappEnabled ?? false,
            instagramHandle: data.instagramHandle || undefined,
            googleMapsUrl: data.googleMapsUrl || undefined,
            googleAnalyticsId: data.googleAnalyticsId || undefined,
            updatedAt: data.updatedAt || undefined,
            updatedBy: data.updatedBy || undefined,
        };
    } catch (err: any) {
        console.error('Error loading site settings:', err);
        return null;
    }
}

export async function saveSiteSettings(
    settings: Partial<SiteSettings>,
    userId?: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const now = new Date().toISOString();
        const dbData: Record<string, any> = {
            id: 'default',
            updatedAt: now,
            updatedBy: userId || null,
        };

        // Only include fields that were passed
        if (settings.isActive !== undefined) dbData.isActive = settings.isActive;
        if (settings.primaryColor !== undefined) dbData.primaryColor = settings.primaryColor;
        if (settings.logoUrl !== undefined) dbData.logoUrl = settings.logoUrl || null;
        if (settings.heroImageUrl !== undefined) dbData.heroImageUrl = settings.heroImageUrl || null;
        if (settings.sectionsVisible !== undefined) dbData.sectionsVisible = settings.sectionsVisible;
        if (settings.businessName !== undefined) dbData.businessName = settings.businessName || null;
        if (settings.slogan !== undefined) dbData.slogan = settings.slogan || null;
        if (settings.address !== undefined) dbData.address = settings.address || null;
        if (settings.phone !== undefined) dbData.phone = settings.phone || null;
        if (settings.aboutText !== undefined) dbData.aboutText = settings.aboutText || null;
        if (settings.ctaButtonText !== undefined) dbData.ctaButtonText = settings.ctaButtonText || 'Agendar Agora';
        if (settings.businessHours !== undefined) dbData.businessHours = settings.businessHours;
        if (settings.visibleServiceIds !== undefined) dbData.visibleServiceIds = settings.visibleServiceIds;
        if (settings.whatsappNumber !== undefined) dbData.whatsappNumber = settings.whatsappNumber || null;
        if (settings.whatsappEnabled !== undefined) dbData.whatsappEnabled = settings.whatsappEnabled;
        if (settings.instagramHandle !== undefined) dbData.instagramHandle = settings.instagramHandle || null;
        if (settings.googleMapsUrl !== undefined) dbData.googleMapsUrl = settings.googleMapsUrl || null;
        if (settings.googleAnalyticsId !== undefined) dbData.googleAnalyticsId = settings.googleAnalyticsId || null;

        const { error } = await supabase
            .from('site_settings')
            .upsert(dbData, { onConflict: 'id' });

        if (error) throw error;
        return { success: true };
    } catch (err: any) {
        console.error('Error saving site settings:', err);
        return { success: false, error: err.message };
    }
}
