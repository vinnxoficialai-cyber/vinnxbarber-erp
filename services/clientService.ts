import { supabase } from '../lib/supabase';
import { Client } from '../types';

const TABLE = 'clients';

export const clientService = {
    async getAll(): Promise<Client[]> {
        const { data, error } = await supabase
            .from(TABLE)
            .select('*')
            .order('createdAt', { ascending: false });

        if (error) throw error;
        return data as Client[];
    },

    async getById(id: string): Promise<Client | null> {
        const { data, error } = await supabase
            .from(TABLE)
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;
        return data as Client;
    },

    async create(client: Omit<Client, 'id'>): Promise<Client> {
        const { data, error } = await supabase
            .from(TABLE)
            .insert({
                id: crypto.randomUUID(),
                name: client.name,
                company: client.company,
                email: client.email,
                phone: client.phone,
                status: client.status?.toUpperCase() || 'LEAD',
                monthlyValue: client.monthlyValue || 0,
                setupValue: client.setupValue || 0,
                totalValue: client.totalValue || 0,
                monthsActive: client.monthsActive || 0,
                origin: client.origin,
                segment: client.segment,
                lastContact: client.lastContact,
                avatar: client.avatar || client.image,
                birthday: client.birthday,
                salesExecutiveId: client.salesExecutiveId,
            })
            .select()
            .single();

        if (error) throw error;
        return data as Client;
    },

    async update(id: string, updates: Partial<Client>): Promise<Client> {
        const { data, error } = await supabase
            .from(TABLE)
            .update({
                ...updates,
                status: updates.status?.toUpperCase(),
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data as Client;
    },

    async delete(id: string): Promise<void> {
        const { error } = await supabase
            .from(TABLE)
            .delete()
            .eq('id', id);

        if (error) throw error;
    },

    async getByStatus(status: Client['status']): Promise<Client[]> {
        const { data, error } = await supabase
            .from(TABLE)
            .select('*')
            .eq('status', status.toUpperCase())
            .order('createdAt', { ascending: false });

        if (error) throw error;
        return data as Client[];
    },

    async search(query: string): Promise<Client[]> {
        const { data, error } = await supabase
            .from(TABLE)
            .select('*')
            .or(`name.ilike.%${query}%,email.ilike.%${query}%,company.ilike.%${query}%`)
            .order('name');

        if (error) throw error;
        return data as Client[];
    }
};
