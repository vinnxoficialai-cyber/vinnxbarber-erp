import { supabase } from '../lib/supabase';
import { Transaction, TransactionType } from '../types';

const TABLE = 'transactions';

export const transactionService = {
    async getAll(): Promise<Transaction[]> {
        const { data, error } = await supabase
            .from(TABLE)
            .select(`
        *,
        clients (name),
        bank_accounts (name)
      `)
            .order('date', { ascending: false });

        if (error) throw error;

        return (data || []).map(t => ({
            id: Number(t.id) || t.id,
            description: t.description,
            amount: Number(t.amount),
            type: t.type.toLowerCase() as TransactionType,
            date: t.date,
            createdAt: t.createdAt,
            category: t.category,
            status: t.status === 'COMPLETED' ? 'Completed' :
                t.status === 'PENDING' ? 'Pending' : 'Overdue',
            clientId: t.clientId || undefined,
            accountId: t.accountId,
        })) as Transaction[];
    },

    async getById(id: string): Promise<Transaction | null> {
        const { data, error } = await supabase
            .from(TABLE)
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;
        return data as unknown as Transaction;
    },

    async create(transaction: Omit<Transaction, 'id' | 'createdAt'>): Promise<Transaction> {
        const statusMap: Record<string, string> = {
            'Completed': 'COMPLETED',
            'Pending': 'PENDING',
            'Overdue': 'OVERDUE'
        };

        const { data, error } = await supabase
            .from(TABLE)
            .insert({
                id: crypto.randomUUID(),
                description: transaction.description,
                amount: transaction.amount,
                type: transaction.type.toUpperCase(),
                date: transaction.date,
                status: statusMap[transaction.status] || 'PENDING',
                category: transaction.category,
                clientId: transaction.clientId?.toString(),
                accountId: transaction.accountId,
            })
            .select()
            .single();

        if (error) throw error;
        return { ...data, id: Number(data.id) } as Transaction;
    },

    async update(id: string, updates: Partial<Transaction>): Promise<Transaction> {
        const statusMap: Record<string, string> = {
            'Completed': 'COMPLETED',
            'Pending': 'PENDING',
            'Overdue': 'OVERDUE'
        };

        const { data, error } = await supabase
            .from(TABLE)
            .update({
                ...updates,
                type: updates.type?.toUpperCase(),
                status: updates.status ? statusMap[updates.status] : undefined,
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data as unknown as Transaction;
    },

    async delete(id: string): Promise<void> {
        const { error } = await supabase
            .from(TABLE)
            .delete()
            .eq('id', id);

        if (error) throw error;
    },

    async getByDateRange(startDate: string, endDate: string): Promise<Transaction[]> {
        const { data, error } = await supabase
            .from(TABLE)
            .select('*')
            .gte('date', startDate)
            .lte('date', endDate)
            .order('date', { ascending: false });

        if (error) throw error;
        return data as unknown as Transaction[];
    },

    async getByType(type: TransactionType): Promise<Transaction[]> {
        const { data, error } = await supabase
            .from(TABLE)
            .select('*')
            .eq('type', type.toUpperCase())
            .order('date', { ascending: false });

        if (error) throw error;
        return data as unknown as Transaction[];
    }
};
