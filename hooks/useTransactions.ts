import { useState, useEffect, useCallback } from 'react';
import { transactionService } from '../services/transactionService';
import { Transaction } from '../types';
import { useToast } from '../components/Toast';

export const useTransactions = () => {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);
    const toast = useToast();

    const loadTransactions = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await transactionService.getAll();
            setTransactions(data);
        } catch (err) {
            setError(err as Error);
            toast.error('Erro ao carregar transações');
        } finally {
            setLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        loadTransactions();
    }, [loadTransactions]);

    const createTransaction = async (transaction: Omit<Transaction, 'id' | 'createdAt'>) => {
        try {
            const newTransaction = await transactionService.create(transaction);
            setTransactions(prev => [newTransaction, ...prev]);
            toast.success('Transação criada');
            return newTransaction;
        } catch (err) {
            toast.error('Erro ao criar transação');
            throw err;
        }
    };

    const updateTransaction = async (id: string, updates: Partial<Transaction>) => {
        try {
            const updated = await transactionService.update(id, updates);
            setTransactions(prev => prev.map(t => String(t.id) === id ? { ...t, ...updated } : t));
            toast.success('Transação atualizada');
            return updated;
        } catch (err) {
            toast.error('Erro ao atualizar transação');
            throw err;
        }
    };

    const deleteTransaction = async (id: string) => {
        try {
            await transactionService.delete(id);
            setTransactions(prev => prev.filter(t => String(t.id) !== id));
            toast.success('Transação excluída');
        } catch (err) {
            toast.error('Erro ao excluir transação');
            throw err;
        }
    };

    return {
        transactions,
        setTransactions,
        loading,
        error,
        createTransaction,
        updateTransaction,
        deleteTransaction,
        refresh: loadTransactions,
    };
};
