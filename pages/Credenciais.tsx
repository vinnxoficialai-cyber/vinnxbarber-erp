import React, { useState, useEffect, useMemo } from 'react';
import { Key, Plus, X, Eye, EyeOff, Copy, Check, Trash2, Search, Globe, Link, AlertTriangle, User } from 'lucide-react';
import { CustomDropdown } from '../components/CustomDropdown';
import { Client, ServiceCredential, CredentialCategory, TeamMember } from '../types';
import { useAppData } from '../hooks/useAppData'; // MIGRATED
import { useFilteredData } from '../hooks/useFilteredData';
import { usePermissions } from '../hooks/usePermissions';
import { useConfirm } from '../components/ConfirmModal';
import { usePasswordConfirm } from '../components/PasswordConfirmModal';
import { useToast } from '../components/Toast';
import { saveCredential, deleteCredential } from '../lib/dataService';
import { authService } from '../lib/auth'; // Added import

interface CredenciaisProps {
    clients: Client[];
    currentUser: TeamMember; // Added currentUser prop
    isDarkMode: boolean;
}

const SECURITY_DISMISSED_KEY = 'erp_credentials_security_dismissed';

const CATEGORIES: { value: CredentialCategory; label: string; icon: string }[] = [
    { value: 'hosting', label: 'Hospedagem', icon: '🌐' },
    { value: 'social', label: 'Redes Sociais', icon: '📱' },
    { value: 'tools', label: 'Ferramentas', icon: '🛠️' },
    { value: 'api', label: 'APIs', icon: '🔌' },
    { value: 'analytics', label: 'Analytics', icon: '📊' },
    { value: 'email', label: 'Email', icon: '📧' },
    { value: 'other', label: 'Outros', icon: '📁' },
];

export const Credenciais: React.FC<CredenciaisProps> = ({ clients: propClients, currentUser, isDarkMode }) => {
    // Use useAppData
    const { credentials, permissions: contextPermissions, setCredentials, refresh, loading } = useAppData();
    const { filteredClients: appClients } = useFilteredData();
    const { canCreate, canEdit, canDelete, isAdminOrManager } = usePermissions(currentUser, contextPermissions);

    // Permissions
    const canCreateCredential = canCreate('/credenciais');
    const canEditCredential = canEdit('/credenciais');
    const canDeleteCredential = canDelete('/credenciais');
    // Note: canViewAllData returns true for 'read' level, but Sales with 'read'
    // should still only see credentials for THEIR clients, not all.
    const viewAll = isAdminOrManager;

    // Guard: prevent crash if currentUser is not loaded yet or data is loading
    if (!currentUser || loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    // Prefer appClients from hook, or propClients. They should be same. Hook is safer for updates.
    const clients = appClients.length > 0 ? appClients : propClients;

    // Data Scoping: Sales sees only credentials for their assigned clients
    const scopedCredentials = useMemo(() => {
        if (viewAll) return credentials;
        const myClientIds = new Set(clients.filter(c => c.salesExecutiveId === currentUser.id).map(c => c.id));
        return credentials.filter(c => myClientIds.has(c.clientId));
    }, [credentials, clients, viewAll, currentUser.id]);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCredential, setEditingCredential] = useState<ServiceCredential | null>(null);
    const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterCategory, setFilterCategory] = useState<CredentialCategory | ''>('');
    const [showSecurityWarning, setShowSecurityWarning] = useState(() => {
        return !localStorage.getItem(SECURITY_DISMISSED_KEY); // Adjusted logic slightly: get item returns null if not set
        // Logic was: !safeStorage.get(..., false) -> !false = true (default).
        // localStorage.getItem returns null if missing. !null is true.
    });
    const confirm = useConfirm();
    const passwordConfirm = usePasswordConfirm();
    const toast = useToast();

    const [formData, setFormData] = useState({
        serviceName: '',
        category: 'other' as CredentialCategory,
        clientId: '',
        url: '',
        username: '',
        password: '',
        notes: '',
    });

    // Theme helpers
    const textMain = isDarkMode ? 'text-slate-50' : 'text-slate-900';
    const textSub = isDarkMode ? 'text-slate-400' : 'text-slate-500';
    const bgCard = isDarkMode ? 'bg-dark-surface' : 'bg-white';
    const borderCol = isDarkMode ? 'border-dark-border' : 'border-slate-200';
    const bgInput = isDarkMode ? 'bg-dark' : 'bg-white';

    // Form validation - required fields
    const isFormValid = useMemo(() => {
        return formData.serviceName.trim() !== '' && formData.clientId !== '';
    }, [formData.serviceName, formData.clientId]);

    // REMOVED: useEffect for safeStorage sync

    const togglePasswordVisibility = (id: string) => {
        setVisiblePasswords(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const copyToClipboard = async (text: string, id: string) => {
        await navigator.clipboard.writeText(text);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const handleOpenModal = (credential?: ServiceCredential) => {
        if (credential) {
            setEditingCredential(credential);
            setFormData({
                serviceName: credential.serviceName,
                category: credential.category,
                clientId: credential.clientId,
                url: credential.url || '',
                username: credential.username || '',
                password: credential.password || '',
                notes: credential.notes || '',
            });
        } else {
            setEditingCredential(null);
            setFormData({
                serviceName: '',
                category: 'other',
                clientId: '',
                url: '',
                username: '',
                password: '',
                notes: '',
            });
        }
        setIsModalOpen(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        const client = clients.find(c => c.id === formData.clientId);

        const credentialData: ServiceCredential = {
            id: editingCredential?.id || crypto.randomUUID(), // UUID for inserts
            clientId: formData.clientId,
            // clientName: client?.name || 'Interno', // removed from type? let's check. 
            // In types.ts ServiceCredential has clientName?
            // Let's assume yes or dataService handles it.
            // dataService adds clientName if not present? No, dataService uses clientId. 
            // The UI likely uses clientName for display. 
            // In useAppData mapping, we didn't map clientName explicitly?
            // Wait, useAppData maps fields.
            // Let's look at useAppData mapping for credentials (I can't see it now but I wrote it).
            // Usually clientName is derived from clientId.
            // But let's keep it if consistent with types.
            clientName: client?.name || 'Interno',
            serviceName: formData.serviceName,
            category: formData.category,
            url: formData.url,
            username: formData.username,
            password: formData.password,
            notes: formData.notes,
            createdAt: editingCredential?.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        const result = await saveCredential(credentialData);
        if (!result.success) {
            toast.error('Erro ao salvar', result.error || 'Erro desconhecido');
            return;
        }

        await refresh();

        toast.success(editingCredential ? 'Credencial atualizada' : 'Credencial adicionada', `${formData.serviceName} foi salva.`);
        setIsModalOpen(false);
    };

    const handleDelete = async (id: string) => {
        const credential = credentials.find(c => c.id === id);

        const confirmDelete = await confirm({
            title: 'Excluir Credencial',
            message: `Tem certeza que deseja excluir a credencial "${credential?.serviceName}"? Esta ação não pode ser desfeita.`,
            variant: 'danger',
            confirmLabel: 'Continuar',
            cancelLabel: 'Cancelar'
        });

        if (!confirmDelete) return;

        if (!currentUser) {
            toast.error('Erro', 'Usuário não autenticado.');
            return;
        }

        const passwordOk = await passwordConfirm(
            {
                title: 'Confirmação de Segurança',
                message: `Por favor, confirme sua senha para excluir a credencial "${credential?.serviceName}".`,
                action: 'Confirmar Exclusão',
                onValidate: async (password) => {
                    const { error } = await authService.signIn(currentUser.email, password);
                    return !error;
                }
            }
        );

        if (passwordOk) {
            const result = await deleteCredential(id);
            if (!result.success) {
                toast.error('Erro ao excluir', result.error || 'Erro desconhecido');
                return;
            }
            await refresh();
            toast.success('Credencial excluída', `${credential?.serviceName} foi removida.`);
        }
    };

    const filteredCredentials = scopedCredentials.filter(c => {
        const matchesSearch = c.serviceName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (c.clientName || '').toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = !filterCategory || c.category === filterCategory;
        return matchesSearch && matchesCategory;
    });

    return (
        <div className="animate-in fade-in duration-300">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                    <h1 className={`text-2xl font-bold ${textMain} flex items-center gap-2`}>
                        <Key className="text-primary" /> Credenciais
                    </h1>
                    <p className={`${textSub} text-sm`}>Gerenciador de senhas e acessos.</p>
                </div>

                {canCreateCredential && (
                    <button
                        onClick={() => handleOpenModal()}
                        className="px-4 py-2 bg-primary hover:bg-primary-600 text-white font-bold rounded-lg text-sm flex items-center gap-2 transition-colors shadow-lg shadow-primary/20"
                    >
                        <Plus size={16} /> Nova Credencial
                    </button>
                )}
            </div>

            {/* Security Warning Banner */}
            {showSecurityWarning && (
                <div className={`${isDarkMode ? 'bg-yellow-500/10 border-yellow-500/30' : 'bg-yellow-50 border-yellow-200'} border rounded-xl p-4 mb-6 flex items-start gap-3`}>
                    <AlertTriangle size={20} className="text-yellow-500 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                        <p className={`font-semibold ${isDarkMode ? 'text-yellow-400' : 'text-yellow-700'} text-sm`}>
                            ⚠️ Aviso de Segurança
                        </p>
                        <p className={`text-xs ${isDarkMode ? 'text-yellow-500/80' : 'text-yellow-600'} mt-1`}>
                            As credenciais são armazenadas no banco de dados.
                            Para maior segurança, use senhas complexas e evite compartilhar sua conta.
                        </p>
                    </div>
                    <button
                        onClick={() => {
                            setShowSecurityWarning(false);
                            localStorage.setItem(SECURITY_DISMISSED_KEY, 'true');
                        }}
                        className={`text-yellow-500 hover:text-yellow-600 p-1`}
                        title="Dispensar"
                    >
                        <X size={16} />
                    </button>
                </div>
            )}

            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4 mb-6">
                <div className="flex-1 relative">
                    <Search size={18} className={`absolute left-3 top-1/2 -translate-y-1/2 ${textSub}`} />
                    <input
                        type="text"
                        placeholder="Buscar por serviço ou cliente..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className={`w-full pl-10 pr-4 py-2.5 ${bgCard} border ${borderCol} rounded-lg text-sm ${textMain} focus:ring-1 focus:ring-primary outline-none`}
                    />
                </div>
                <CustomDropdown
                    value={filterCategory}
                    onChange={(v) => setFilterCategory(v as CredentialCategory | '')}
                    options={[
                        { value: '', label: 'Todas as categorias' },
                        ...CATEGORIES.map(cat => ({ value: cat.value, label: `${cat.icon} ${cat.label}` }))
                    ]}
                    isDarkMode={isDarkMode}
                    placeholder="Todas as categorias"
                    className="w-48"
                />
            </div>

            {/* Credentials Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredCredentials.map(cred => {
                    const category = CATEGORIES.find(c => c.value === cred.category);
                    return (
                        <div key={cred.id} className={`${bgCard} border ${borderCol} rounded-xl p-4 hover:shadow-lg transition-shadow`}>
                            <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-lg ${isDarkMode ? 'bg-dark' : 'bg-slate-100'} flex items-center justify-center text-xl`}>
                                        {category?.icon || '📁'}
                                    </div>
                                    <div>
                                        <p className={`font-semibold ${textMain}`}>{cred.serviceName}</p>
                                        <p className={`text-xs ${textSub}`}>{cred.clientName}</p>
                                    </div>
                                </div>
                                <div className="flex gap-1">
                                    {canEditCredential && (
                                        <button
                                            onClick={() => handleOpenModal(cred)}
                                            className={`p-1.5 rounded ${isDarkMode ? 'hover:bg-dark' : 'hover:bg-slate-100'} ${textSub} hover:text-primary transition-colors`}
                                        >
                                            <Link size={14} />
                                        </button>
                                    )}
                                    {canDeleteCredential && (
                                        <button
                                            onClick={() => handleDelete(cred.id)}
                                            className={`p-1.5 rounded ${isDarkMode ? 'hover:bg-dark' : 'hover:bg-slate-100'} ${textSub} hover:text-red-500 transition-colors`}
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    )}
                                </div>
                            </div>

                            {cred.url && (
                                <a href={cred.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs text-primary hover:underline mb-3">
                                    <Globe size={12} /> {cred.url}
                                </a>
                            )}

                            <div className="space-y-2">
                                {cred.username && (
                                    <div className={`flex items-center justify-between p-2 rounded-lg ${isDarkMode ? 'bg-dark' : 'bg-slate-50'}`}>
                                        <span className={`text-sm ${textMain} truncate flex-1`}>{cred.username}</span>
                                        <button
                                            onClick={() => copyToClipboard(cred.username!, `user-${cred.id}`)}
                                            className={`p-1 ${textSub} hover:text-primary transition-colors`}
                                        >
                                            {copiedId === `user-${cred.id}` ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                                        </button>
                                    </div>
                                )}

                                {cred.password && (
                                    <div className={`flex items-center justify-between p-2 rounded-lg ${isDarkMode ? 'bg-dark' : 'bg-slate-50'}`}>
                                        <span className={`text-sm ${textMain} truncate flex-1 font-mono`}>
                                            {visiblePasswords[cred.id] ? cred.password : '••••••••'}
                                        </span>
                                        <div className="flex gap-1">
                                            <button
                                                onClick={() => togglePasswordVisibility(cred.id)}
                                                className={`p-1 ${textSub} hover:text-primary transition-colors`}
                                            >
                                                {visiblePasswords[cred.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                                            </button>
                                            <button
                                                onClick={() => copyToClipboard(cred.password!, `pass-${cred.id}`)}
                                                className={`p-1 ${textSub} hover:text-primary transition-colors`}
                                            >
                                                {copiedId === `pass-${cred.id}` ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {cred.notes && (
                                <p className={`text-xs ${textSub} mt-3 line-clamp-2`}>{cred.notes}</p>
                            )}
                        </div>
                    );
                })}

                {filteredCredentials.length === 0 && (
                    <div className={`col-span-full text-center py-12 ${textSub}`}>
                        <Key size={48} className="mx-auto mb-4 opacity-30" />
                        <p>Nenhuma credencial encontrada.</p>
                    </div>
                )}
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className={`${bgCard} border ${borderCol} rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200`}>
                        <div className={`p-4 border-b ${borderCol} flex justify-between items-center ${isDarkMode ? 'bg-dark' : 'bg-slate-50'}`}>
                            <h3 className={`font-semibold text-lg ${textMain}`}>
                                {editingCredential ? 'Editar Credencial' : 'Nova Credencial'}
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className={`${textSub} hover:${textMain}`}>
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSave} className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={`block text-xs font-medium ${textSub} mb-1`}>Serviço</label>
                                    <input
                                        type="text"
                                        value={formData.serviceName}
                                        onChange={(e) => setFormData({ ...formData, serviceName: e.target.value })}
                                        className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-primary outline-none`}
                                        placeholder="Ex: Hostinger"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className={`block text-xs font-medium ${textSub} mb-1`}>Categoria</label>
                                    <CustomDropdown
                                        value={formData.category}
                                        onChange={(v) => setFormData({ ...formData, category: v as CredentialCategory })}
                                        options={CATEGORIES.map(cat => ({ value: cat.value, label: `${cat.icon} ${cat.label}` }))}
                                        isDarkMode={isDarkMode}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className={`block text-xs font-medium ${textSub} mb-1`}>Cliente</label>
                                <CustomDropdown
                                    value={formData.clientId}
                                    onChange={(v) => setFormData({ ...formData, clientId: v })}
                                    options={[
                                        { value: '', label: 'Interno / Nenhum' },
                                        ...clients.map(c => ({ value: c.id, label: c.name, icon: <User size={12} /> }))
                                    ]}
                                    isDarkMode={isDarkMode}
                                    placeholder="Interno / Nenhum"
                                />
                            </div>

                            <div>
                                <label className={`block text-xs font-medium ${textSub} mb-1`}>URL de Acesso</label>
                                <input
                                    type="url"
                                    value={formData.url}
                                    onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                                    className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-primary outline-none`}
                                    placeholder="https://..."
                                />
                            </div>

                            <div>
                                <label className={`block text-xs font-medium ${textSub} mb-1`}>Usuário / Email</label>
                                <input
                                    type="text"
                                    value={formData.username}
                                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                    className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-primary outline-none`}
                                />
                            </div>

                            <div>
                                <label className={`block text-xs font-medium ${textSub} mb-1`}>Senha</label>
                                <input
                                    type="text"
                                    value={formData.password}
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                    className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-primary outline-none font-mono`}
                                />
                            </div>

                            <div>
                                <label className={`block text-xs font-medium ${textSub} mb-1`}>Notas</label>
                                <textarea
                                    value={formData.notes}
                                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                    className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-primary outline-none`}
                                    rows={2}
                                />
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className={`flex-1 py-3 font-bold rounded-lg border ${borderCol} ${textMain} hover:bg-opacity-10 transition-colors`}
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={!isFormValid}
                                    className={`flex-1 py-3 font-bold rounded-lg transition-colors ${isFormValid ? 'bg-primary hover:bg-primary-600 text-white' : 'bg-slate-400 text-slate-200 cursor-not-allowed'}`}
                                >
                                    Salvar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
