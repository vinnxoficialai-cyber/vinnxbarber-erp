import { useState, useEffect, useCallback } from 'react';
import { contractService } from '../services/contractService';
import { Contract } from '../types';
import { useToast } from '../components/Toast';

export const useContracts = () => {
    const [contracts, setContracts] = useState<Contract[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);
    const toast = useToast();

    const loadContracts = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await contractService.getAll();
            setContracts(data);
        } catch (err) {
            setError(err as Error);
            toast.error('Erro ao carregar contratos');
        } finally {
            setLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        loadContracts();
    }, [loadContracts]);

    const createContract = async (contract: Omit<Contract, 'id'>) => {
        try {
            const newContract = await contractService.create(contract);
            setContracts(prev => [newContract, ...prev]);
            toast.success('Contrato criado');
            return newContract;
        } catch (err) {
            toast.error('Erro ao criar contrato');
            throw err;
        }
    };

    const updateContract = async (id: string, updates: Partial<Contract>) => {
        try {
            const updated = await contractService.update(id, updates);
            setContracts(prev => prev.map(c => c.id === id ? { ...c, ...updated } : c));
            toast.success('Contrato atualizado');
            return updated;
        } catch (err) {
            toast.error('Erro ao atualizar contrato');
            throw err;
        }
    };

    const deleteContract = async (id: string) => {
        try {
            await contractService.delete(id);
            setContracts(prev => prev.filter(c => c.id !== id));
            toast.success('Contrato excluído');
        } catch (err) {
            toast.error('Erro ao excluir contrato');
            throw err;
        }
    };

    return {
        contracts,
        setContracts,
        loading,
        error,
        createContract,
        updateContract,
        deleteContract,
        refresh: loadContracts,
    };
};
