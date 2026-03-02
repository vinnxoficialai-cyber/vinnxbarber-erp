import { supabase } from '../lib/supabase';
import { Project, ProjectStatus, Priority } from '../types';

const TABLE = 'projects';

export const projectService = {
    async getAll(): Promise<Project[]> {
        const { data, error } = await supabase
            .from(TABLE)
            .select(`
        *,
        clients (name),
        tasks (id, status)
      `)
            .order('createdAt', { ascending: false });

        if (error) throw error;

        return (data || []).map(p => ({
            id: p.id,
            title: p.title,
            clientName: p.clients?.name || '',
            status: p.status === 'TODO' ? ProjectStatus.TODO :
                p.status === 'IN_PROGRESS' ? ProjectStatus.IN_PROGRESS :
                    p.status === 'IN_REVIEW' ? ProjectStatus.IN_REVIEW : ProjectStatus.DONE,
            dueDate: p.dueDate,
            budget: Number(p.budget),
            priority: p.priority === 'LOW' ? Priority.LOW :
                p.priority === 'MEDIUM' ? Priority.MEDIUM : Priority.HIGH,
            tags: p.tags || [],
        })) as Project[];
    },

    async getById(id: string): Promise<Project | null> {
        const { data, error } = await supabase
            .from(TABLE)
            .select(`
        *,
        clients (name),
        tasks (*)
      `)
            .eq('id', id)
            .single();

        if (error) throw error;
        return data as unknown as Project;
    },

    async create(project: Omit<Project, 'id'>): Promise<Project> {
        const statusMap: Record<ProjectStatus, string> = {
            [ProjectStatus.TODO]: 'TODO',
            [ProjectStatus.IN_PROGRESS]: 'IN_PROGRESS',
            [ProjectStatus.IN_REVIEW]: 'IN_REVIEW',
            [ProjectStatus.DONE]: 'DONE',
        };

        const priorityMap: Record<Priority, string> = {
            [Priority.LOW]: 'LOW',
            [Priority.MEDIUM]: 'MEDIUM',
            [Priority.HIGH]: 'HIGH',
        };

        // First, get or create the client
        const { data: clients } = await supabase
            .from('clients')
            .select('id')
            .eq('name', project.clientName)
            .limit(1);

        const clientId = clients?.[0]?.id;
        if (!clientId) throw new Error('Client not found');

        const { data, error } = await supabase
            .from(TABLE)
            .insert({
                id: crypto.randomUUID(),
                title: project.title,
                clientId,
                status: statusMap[project.status] || 'TODO',
                priority: priorityMap[project.priority] || 'MEDIUM',
                dueDate: project.dueDate,
                budget: project.budget,
                tags: project.tags,
            })
            .select()
            .single();

        if (error) throw error;
        return { ...project, id: data.id } as Project;
    },

    async update(id: string, updates: Partial<Project>): Promise<Project> {
        const statusMap: Record<ProjectStatus, string> = {
            [ProjectStatus.TODO]: 'TODO',
            [ProjectStatus.IN_PROGRESS]: 'IN_PROGRESS',
            [ProjectStatus.IN_REVIEW]: 'IN_REVIEW',
            [ProjectStatus.DONE]: 'DONE',
        };

        const priorityMap: Record<Priority, string> = {
            [Priority.LOW]: 'LOW',
            [Priority.MEDIUM]: 'MEDIUM',
            [Priority.HIGH]: 'HIGH',
        };

        const { data, error } = await supabase
            .from(TABLE)
            .update({
                title: updates.title,
                status: updates.status ? statusMap[updates.status] : undefined,
                priority: updates.priority ? priorityMap[updates.priority] : undefined,
                dueDate: updates.dueDate,
                budget: updates.budget,
                tags: updates.tags,
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data as unknown as Project;
    },

    async delete(id: string): Promise<void> {
        const { error } = await supabase
            .from(TABLE)
            .delete()
            .eq('id', id);

        if (error) throw error;
    }
};
