import { useState, useEffect, useCallback } from 'react';
import { projectService } from '../services/projectService';
import { Project } from '../types';
import { useToast } from '../components/Toast';

export const useProjects = () => {
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);
    const toast = useToast();

    const loadProjects = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await projectService.getAll();
            setProjects(data);
        } catch (err) {
            setError(err as Error);
            toast.error('Erro ao carregar projetos');
        } finally {
            setLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        loadProjects();
    }, [loadProjects]);

    const createProject = async (project: Omit<Project, 'id'>) => {
        try {
            const newProject = await projectService.create(project);
            setProjects(prev => [newProject, ...prev]);
            toast.success('Projeto criado');
            return newProject;
        } catch (err) {
            toast.error('Erro ao criar projeto');
            throw err;
        }
    };

    const updateProject = async (id: string, updates: Partial<Project>) => {
        try {
            const updated = await projectService.update(id, updates);
            setProjects(prev => prev.map(p => p.id === id ? { ...p, ...updated } : p));
            toast.success('Projeto atualizado');
            return updated;
        } catch (err) {
            toast.error('Erro ao atualizar projeto');
            throw err;
        }
    };

    const deleteProject = async (id: string) => {
        try {
            await projectService.delete(id);
            setProjects(prev => prev.filter(p => p.id !== id));
            toast.success('Projeto excluído');
        } catch (err) {
            toast.error('Erro ao excluir projeto');
            throw err;
        }
    };

    return {
        projects,
        setProjects,
        loading,
        error,
        createProject,
        updateProject,
        deleteProject,
        refresh: loadProjects,
    };
};
