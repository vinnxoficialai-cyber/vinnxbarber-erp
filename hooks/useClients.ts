import { useState, useEffect, useCallback } from 'react';
import { clientService } from '../services/clientService';
import { Client } from '../types';
import { useToast } from '../components/Toast';

export const useClients = () => {
    const [clients, setClients] = useState<Client[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);
    const toast = useToast();

    const loadClients = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await clientService.getAll();
            setClients(data);
        } catch (err) {
            setError(err as Error);
            toast.error('Erro ao carregar clientes');
        } finally {
            setLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        loadClients();
    }, [loadClients]);

    const createClient = async (client: Omit<Client, 'id'>) => {
        try {
            const newClient = await clientService.create(client);
            setClients(prev => [newClient, ...prev]);
            toast.success('Cliente criado');
            return newClient;
        } catch (err) {
            toast.error('Erro ao criar cliente');
            throw err;
        }
    };

    const updateClient = async (id: string, updates: Partial<Client>) => {
        try {
            const updated = await clientService.update(id, updates);
            setClients(prev => prev.map(c => c.id === id ? { ...c, ...updated } : c));
            toast.success('Cliente atualizado');
            return updated;
        } catch (err) {
            toast.error('Erro ao atualizar cliente');
            throw err;
        }
    };

    const deleteClient = async (id: string) => {
        try {
            await clientService.delete(id);
            setClients(prev => prev.filter(c => c.id !== id));
            toast.success('Cliente excluído');
        } catch (err) {
            toast.error('Erro ao excluir cliente');
            throw err;
        }
    };

    return {
        clients,
        setClients,
        loading,
        error,
        createClient,
        updateClient,
        deleteClient,
        refresh: loadClients,
    };
};
