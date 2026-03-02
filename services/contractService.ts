import { supabase } from '../lib/supabase';
import { Contract } from '../types';

const TABLE = 'contracts';

export const contractService = {
    async getAll(): Promise<Contract[]> {
        const { data, error } = await supabase
            .from(TABLE)
            .select(`
        *,
        clients (name, company),
        team_members (
          users (name)
        )
      `)
            .order('createdAt', { ascending: false });

        if (error) throw error;

        return (data || []).map(c => ({
            id: c.id,
            title: c.title,
            clientId: c.clientId,
            salesExecutiveId: c.salesExecutiveId,
            monthlyValue: Number(c.monthlyValue),
            setupValue: Number(c.setupValue),
            contractDuration: c.contractDuration,
            startDate: c.startDate,
            endDate: c.endDate,
            status: c.status === 'ACTIVE' ? 'Active' :
                c.status === 'CANCELLED' ? 'Cancelled' :
                    c.status === 'PENDING' ? 'Pending' : 'Ended',
        })) as Contract[];
    },

    async getById(id: string): Promise<Contract | null> {
        const { data, error } = await supabase
            .from(TABLE)
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;
        return data as Contract;
    },

    async create(contract: Omit<Contract, 'id'>): Promise<Contract> {
        const statusMap: Record<string, string> = {
            'Active': 'ACTIVE',
            'Cancelled': 'CANCELLED',
            'Pending': 'PENDING',
            'Ended': 'ENDED'
        };

        const { data, error } = await supabase
            .from(TABLE)
            .insert({
                id: crypto.randomUUID(),
                title: contract.title,
                clientId: contract.clientId,
                salesExecutiveId: contract.salesExecutiveId,
                monthlyValue: contract.monthlyValue,
                setupValue: contract.setupValue || 0,
                contractDuration: contract.contractDuration,
                startDate: contract.startDate,
                endDate: contract.endDate,
                status: statusMap[contract.status] || 'ACTIVE',
            })
            .select()
            .single();

        if (error) throw error;
        return { ...data, ...contract } as Contract;
    },

    async update(id: string, updates: Partial<Contract>): Promise<Contract> {
        const statusMap: Record<string, string> = {
            'Active': 'ACTIVE',
            'Cancelled': 'CANCELLED',
            'Pending': 'PENDING',
            'Ended': 'ENDED'
        };

        const { data, error } = await supabase
            .from(TABLE)
            .update({
                ...updates,
                status: updates.status ? statusMap[updates.status] : undefined,
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data as Contract;
    },

    async delete(id: string): Promise<void> {
        const { error } = await supabase
            .from(TABLE)
            .delete()
            .eq('id', id);

        if (error) throw error;
    },

    async getByClient(clientId: string): Promise<Contract[]> {
        const { data, error } = await supabase
            .from(TABLE)
            .select('*')
            .eq('clientId', clientId)
            .order('startDate', { ascending: false });

        if (error) throw error;
        return data as Contract[];
    }
};
