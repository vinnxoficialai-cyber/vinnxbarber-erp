import { useMemo } from 'react';
import { useAppData } from './useAppData'; // Assuming relative import or adjust path
import { ProjectStatus } from '../types';

interface MenuBadges {
    [path: string]: number;
}

export const useMenuBadges = (): MenuBadges => {
    const { calendarEvents, clients, projects, transactions } = useAppData();

    return useMemo(() => {
        const badges: MenuBadges = {};
        const now = new Date();
        const today = now.toISOString().split('T')[0];

        // Agenda: Reuniões nas próximas 2 horas
        const upcomingMeetings = calendarEvents.filter(event => {
            if (event.type !== 'meeting') return false;
            const eventDate = new Date(event.year, event.month, event.date);
            const [hours, minutes] = event.startTime.split(':').map(Number);
            eventDate.setHours(hours, minutes);
            const diffMs = eventDate.getTime() - now.getTime();
            const diffHours = diffMs / (1000 * 60 * 60);
            return diffHours >= 0 && diffHours <= 2;
        });
        if (upcomingMeetings.length > 0) badges['/agenda'] = upcomingMeetings.length;

        // Tarefas: Tarefas atrasadas (simplificado - sem dados de tarefas pendentes)
        // Seria implementado quando houver status de tarefas

        // Pipeline: Leads inativos > 7 dias
        const inactiveLeads = clients.filter(client => {
            if (client.status !== 'Lead') return false;
            if (!client.lastContact) return true;
            const lastContactDate = new Date(client.lastContact);
            const daysSinceContact = (now.getTime() - lastContactDate.getTime()) / (1000 * 60 * 60 * 24);
            return daysSinceContact > 7;
        });
        if (inactiveLeads.length > 0) badges['/pipeline'] = inactiveLeads.length;

        // Contratos: Contratos expirando em 30 dias
        // (Simplificado - sem dados de contratos com data de expiração)

        // Projetos: Projetos atrasados
        const overdueProjects = projects.filter(project => {
            if (project.status === ProjectStatus.DONE) return false;
            if (!project.dueDate) return false;
            return new Date(project.dueDate) < now;
        });
        if (overdueProjects.length > 0) badges['/projects'] = overdueProjects.length;

        // Financeiro: Contas vencidas ou vencendo hoje
        const urgentTransactions = transactions.filter(t => {
            if (t.status === 'Completed') return false;
            const dueDate = new Date(t.date);
            return dueDate <= now || t.status === 'Overdue';
        });
        if (urgentTransactions.length > 0) badges['/finance'] = urgentTransactions.length;

        // Férias: Solicitações pendentes (seria baseado em dados reais)

        // Avaliações: Avaliações pendentes (seria baseado em dados reais)

        return badges;
    }, [calendarEvents, clients, projects, transactions]);
};

// Hook para pegar o total de badges de uma seção
export const useSectionBadgeCount = (sectionPaths: string[], badges: MenuBadges): number => {
    return useMemo(() => {
        return sectionPaths.reduce((total, path) => total + (badges[path] || 0), 0);
    }, [sectionPaths, badges]);
};
