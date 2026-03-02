import React, { useState, useMemo } from 'react';
import { Kanban, X, User, Calendar, Phone, Mail, Building } from 'lucide-react';
import { Client, PipelineStage, ClientInteraction, TeamMember } from '../types';
import { useToast } from '../components/Toast';
import { saveClientInteraction, savePipelineStage, saveClient } from '../lib/dataService';
import { useAppData } from '../context/AppDataContext';
import { usePermissions } from '../hooks/usePermissions';

interface PipelineProps {
    clients?: Client[];
    setClients?: React.Dispatch<React.SetStateAction<Client[]>>;
    members?: TeamMember[];
    currentUser?: TeamMember;
    isDarkMode: boolean;
}

const STAGES: { id: PipelineStage; label: string; color: string; probability: number }[] = [
    { id: 'lead', label: 'Lead', color: 'bg-slate-500', probability: 10 },
    { id: 'qualified', label: 'Qualificado', color: 'bg-blue-500', probability: 25 },
    { id: 'proposal', label: 'Proposta', color: 'bg-yellow-500', probability: 50 },
    { id: 'negotiation', label: 'Negociação', color: 'bg-orange-500', probability: 75 },
    { id: 'won', label: 'Ganho', color: 'bg-primary', probability: 100 },
    { id: 'lost', label: 'Perdido', color: 'bg-red-500', probability: 0 },
];

const INACTIVITY_DAYS = 7;

export const Pipeline: React.FC<PipelineProps> = ({ currentUser, isDarkMode }) => {
    const { clients, pipelineStages, clientInteractions, refresh, setClients, setPipelineStages, setClientInteractions, permissions: contextPermissions } = useAppData();

    // Permissions
    // Guard: prevent crash if currentUser is not loaded yet
    const safeUser = currentUser || { id: '', role: 'Support' } as TeamMember;
    const { canViewAllData } = usePermissions(safeUser, contextPermissions);
    const viewAll = canViewAllData('/pipeline');

    // Local UI state
    const [draggedClientId, setDraggedClientId] = useState<string | null>(null);
    const [selectedClient, setSelectedClient] = useState<Client | null>(null);
    const [filterOwner, setFilterOwner] = useState<string>('all');
    const [filterMinValue, setFilterMinValue] = useState<number>(0);
    const [showInactiveOnly, setShowInactiveOnly] = useState(false);

    const toast = useToast();

    // Theme helpers
    const textMain = isDarkMode ? 'text-slate-50' : 'text-slate-900';
    const textSub = isDarkMode ? 'text-slate-400' : 'text-slate-500';
    const bgCard = isDarkMode ? 'bg-dark-surface' : 'bg-white';
    const borderCol = isDarkMode ? 'border-dark-border' : 'border-slate-200';

    const isClientInactive = (client: Client) => {
        if (!client.lastContact) return true;
        const lastContactDate = new Date(client.lastContact);
        const daysSinceContact = (Date.now() - lastContactDate.getTime()) / (1000 * 60 * 60 * 24);
        return daysSinceContact > INACTIVITY_DAYS;
    };

    const getFilteredClients = useMemo(() => {
        return clients.filter(client => {
            // Data Scoping
            if (!viewAll && client.salesExecutiveId !== safeUser.id) return false;

            if (filterOwner !== 'all' && client.salesExecutiveId !== filterOwner) return false;
            if (filterMinValue > 0 && (client.monthlyValue || 0) < filterMinValue) return false;
            if (showInactiveOnly && !isClientInactive(client)) return false;
            return true;
        });
    }, [clients, filterOwner, filterMinValue, showInactiveOnly, viewAll, safeUser.id]);

    const getClientStage = (clientId: string): PipelineStage => {
        // 1. Tenta pegar do pipelineStages (tabela do banco)
        const stageItem = pipelineStages.find(p => p.clientId === clientId);
        if (stageItem && STAGES.some(s => s.id === stageItem.stage)) {
            return stageItem.stage as PipelineStage;
        }

        // 2. Fallback para status do cliente
        const client = clients.find(c => c.id === clientId);
        if (client?.status === 'Lead') return 'lead';
        if (client?.status === 'Active') return 'won';
        if (client?.status === 'Churned') return 'lost';

        return 'lead';
    };

    const getClientsInStage = (stage: PipelineStage) => {
        return getFilteredClients.filter(c => getClientStage(c.id) === stage);
    };

    const getStageTotal = (stage: PipelineStage) => {
        return getClientsInStage(stage).reduce((sum, c) => sum + (c.monthlyValue || 0), 0);
    };

    const handleDragStart = (e: React.DragEvent, clientId: string) => {
        setDraggedClientId(clientId);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDrop = async (e: React.DragEvent, targetStage: PipelineStage) => {
        e.preventDefault();
        if (!draggedClientId) return;

        // Otimistic Update Local
        const now = new Date().toISOString();
        const oldStage = getClientStage(draggedClientId);

        if (oldStage === targetStage) {
            setDraggedClientId(null);
            return;
        }

        // Atualiza pipelineStages localmente
        setPipelineStages(prev => {
            const existing = prev.find(p => p.clientId === draggedClientId);
            if (existing) {
                return prev.map(p => p.clientId === draggedClientId ? { ...p, stage: targetStage, updatedAt: now } : p);
            } else {
                return [...prev, { id: 'temp-' + Date.now(), clientId: draggedClientId, stage: targetStage, updatedAt: now }];
            }
        });

        // Persistir no Supabase
        const result = await savePipelineStage(draggedClientId, targetStage);

        if (!result.success) {
            toast.error("Erro ao salvar estágio: " + result.error);
            // Reverter em caso de erro (seria ideal, mas o refresh corrige)
            refresh();
            setDraggedClientId(null);
            return;
        }

        // Sincroniza status do cliente com o estágio do pipeline (Regra de Negócio)
        const statusMap: Partial<Record<PipelineStage, Client['status']>> = {
            won: 'Active',
            lost: 'Churned',
            lead: 'Lead',
        };

        if (statusMap[targetStage]) {
            const client = clients.find(c => c.id === draggedClientId);
            if (client && client.status !== statusMap[targetStage]) {
                const updatedClient = { ...client, status: statusMap[targetStage]! };

                // Otimistic Update Client
                setClients(prev => prev.map(c => c.id === draggedClientId ? updatedClient : c));

                const clientResult = await saveClient(updatedClient);
                if (!clientResult.success) {
                    toast.error("Erro ao atualizar status do cliente");
                }
            }
        }

        setDraggedClientId(null);
        // Refresh para garantir consistência
        refresh();
    };

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    };

    return (
        <div className="animate-in fade-in duration-300">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                    <h1 className={`text-2xl font-bold ${textMain} flex items-center gap-2`}>
                        <Kanban className="text-primary" /> Pipeline CRM
                    </h1>
                    <p className={`${textSub} text-sm`}>Gerencie seus leads e oportunidades de vendas.</p>
                </div>
            </div>

            {/* Kanban Board */}
            <div className="overflow-x-auto pb-4">
                <div className="flex gap-4 min-w-max">
                    {STAGES.map(stage => {
                        const stageClients = getClientsInStage(stage.id);
                        const stageTotal = getStageTotal(stage.id);

                        return (
                            <div
                                key={stage.id}
                                className={`w-72 flex-shrink-0 rounded-xl ${bgCard} border ${borderCol} flex flex-col max-h-[calc(100vh-14rem)]`}
                                onDragOver={handleDragOver}
                                onDrop={(e) => handleDrop(e, stage.id)}
                            >
                                {/* Stage Header */}
                                <div className={`p-3 border-b ${borderCol} flex-shrink-0`}>
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <div className={`w-3 h-3 rounded-full ${stage.color}`}></div>
                                            <span className={`font-semibold ${textMain}`}>{stage.label}</span>
                                            <span className={`text-xs px-2 py-0.5 rounded-full ${isDarkMode ? 'bg-dark' : 'bg-slate-100'} ${textSub}`}>
                                                {stageClients.length}
                                            </span>
                                        </div>
                                    </div>
                                    <div className={`text-sm font-bold ${stage.id === 'won' ? 'text-primary' : stage.id === 'lost' ? 'text-red-500' : textSub}`}>
                                        {formatCurrency(stageTotal)}
                                    </div>
                                </div>

                                {/* Cards Container */}
                                <div className="p-2 space-y-2 overflow-y-auto flex-1 custom-scrollbar">
                                    {stageClients.length === 0 ? (
                                        <div className={`text-center py-8 ${textSub} text-sm`}>
                                            Arraste clientes aqui
                                        </div>
                                    ) : (
                                        stageClients.map(client => (
                                            <div
                                                key={client.id}
                                                draggable
                                                onDragStart={(e) => handleDragStart(e, client.id)}
                                                onClick={() => setSelectedClient(client)}
                                                className={`
                          ${bgCard} border ${borderCol} rounded-lg p-3 cursor-grab active:cursor-grabbing
                          hover:shadow-md transition-all hover:border-primary/30
                          ${draggedClientId === client.id ? 'opacity-50 scale-95' : ''}
                        `}
                                            >
                                                <div className="flex items-start justify-between mb-2">
                                                    <div className="flex items-center gap-2">
                                                        <div className={`w-8 h-8 rounded-full ${isDarkMode ? 'bg-dark' : 'bg-slate-100'} flex items-center justify-center`}>
                                                            <User size={14} className={textSub} />
                                                        </div>
                                                        <div>
                                                            <p className={`font-semibold text-sm ${textMain}`}>{client.name}</p>
                                                            <p className={`text-xs ${textSub}`}>{client.company}</p>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex items-center justify-between">
                                                    <span className={`text-sm font-bold ${textMain}`}>
                                                        {formatCurrency(client.monthlyValue || 0)}/mês
                                                    </span>
                                                    {client.lastContact && (
                                                        <span className={`text-xs ${textSub} flex items-center gap-1`}>
                                                            <Calendar size={10} />
                                                            {new Date(client.lastContact).toLocaleDateString('pt-BR')}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Client Detail Modal */}
            {selectedClient && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className={`${bgCard} border ${borderCol} rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200`}>
                        <div className={`p-4 border-b ${borderCol} flex justify-between items-center ${isDarkMode ? 'bg-dark' : 'bg-slate-50'}`}>
                            <h3 className={`font-semibold text-lg ${textMain}`}>Detalhes do Cliente</h3>
                            <button onClick={() => setSelectedClient(null)} className={`${textSub} hover:${textMain}`}>
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            <div className="flex items-center gap-4">
                                <div className={`w-16 h-16 rounded-full ${isDarkMode ? 'bg-dark' : 'bg-slate-100'} flex items-center justify-center`}>
                                    <User size={28} className={textSub} />
                                </div>
                                <div>
                                    <h4 className={`text-xl font-bold ${textMain}`}>{selectedClient.name}</h4>
                                    <p className={`${textSub} flex items-center gap-1`}>
                                        <Building size={14} /> {selectedClient.company}
                                    </p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className={`p-3 rounded-lg ${isDarkMode ? 'bg-dark' : 'bg-slate-50'}`}>
                                    <p className={`text-xs ${textSub} mb-1`}>Valor Mensal</p>
                                    <p className={`text-lg font-bold text-primary`}>{formatCurrency(selectedClient.monthlyValue || 0)}</p>
                                </div>
                                <div className={`p-3 rounded-lg ${isDarkMode ? 'bg-dark' : 'bg-slate-50'}`}>
                                    <p className={`text-xs ${textSub} mb-1`}>Valor Total</p>
                                    <p className={`text-lg font-bold ${textMain}`}>{formatCurrency(selectedClient.totalValue || 0)}</p>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <a href={`mailto:${selectedClient.email}`} className={`flex items-center gap-3 p-3 rounded-lg ${isDarkMode ? 'bg-dark hover:bg-dark-border' : 'bg-slate-50 hover:bg-slate-100'} transition-colors`}>
                                    <Mail size={16} className="text-primary" />
                                    <span className={textMain}>{selectedClient.email}</span>
                                </a>
                                <a href={`tel:${selectedClient.phone}`} className={`flex items-center gap-3 p-3 rounded-lg ${isDarkMode ? 'bg-dark hover:bg-dark-border' : 'bg-slate-50 hover:bg-slate-100'} transition-colors`}>
                                    <Phone size={16} className="text-primary" />
                                    <span className={textMain}>{selectedClient.phone}</span>
                                </a>
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    onClick={() => setSelectedClient(null)}
                                    className="flex-1 py-3 font-bold rounded-lg bg-primary hover:bg-primary-600 text-white transition-colors"
                                >
                                    Fechar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
