import { useState, useEffect, useCallback } from 'react';
import { teamService } from '../services/teamService';
import { TeamMember } from '../types';
import { useToast } from '../components/Toast';

export const useTeam = () => {
    const [members, setMembers] = useState<TeamMember[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);
    const toast = useToast();

    const loadMembers = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await teamService.getAll();
            setMembers(data);
        } catch (err) {
            setError(err as Error);
            toast.error('Erro ao carregar equipe');
        } finally {
            setLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        loadMembers();
    }, [loadMembers]);

    const createMember = async (member: Omit<TeamMember, 'id'>) => {
        try {
            const newMember = await teamService.create(member);
            setMembers(prev => [newMember, ...prev]);
            toast.success('Membro adicionado');
            return newMember;
        } catch (err) {
            toast.error('Erro ao adicionar membro');
            throw err;
        }
    };

    const updateMember = async (id: string, updates: Partial<TeamMember>) => {
        try {
            const updated = await teamService.update(id, updates);
            setMembers(prev => prev.map(m => m.id === id ? { ...m, ...updated } : m));
            toast.success('Membro atualizado');
            return updated;
        } catch (err) {
            toast.error('Erro ao atualizar membro');
            throw err;
        }
    };

    const deleteMember = async (id: string) => {
        try {
            await teamService.delete(id);
            setMembers(prev => prev.filter(m => m.id !== id));
            toast.success('Membro removido');
        } catch (err) {
            toast.error('Erro ao remover membro');
            throw err;
        }
    };

    return {
        members,
        setMembers,
        loading,
        error,
        createMember,
        updateMember,
        deleteMember,
        refresh: loadMembers,
    };
};
