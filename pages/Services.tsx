import React, { useState, useMemo, useRef } from 'react';
import {
  Layers, Plus, Pencil, Trash2, X, Search, DollarSign,
  Clock, Percent, Globe, Scissors, Sparkles, Eye,
  Palette, Baby, MoreHorizontal, Upload, Tag,
  Image as ImageIcon, CalendarClock, Users2, ToggleRight
} from 'lucide-react';
import { Service, TeamMember } from '../types';
import { CustomDropdown } from '../components/CustomDropdown';
import { useConfirm } from '../components/ConfirmModal';
import { useToast } from '../components/Toast';
import { saveService, deleteService } from '../lib/dataService';
import { uploadBase64Image, isBase64 } from '../lib/storage';
import { usePermissions } from '../hooks/usePermissions';
import { useAppData } from '../context/AppDataContext';

interface ServicesProps {
  services: Service[];
  setServices: (s: Service[]) => void;
  isDarkMode: boolean;
  currentUser: TeamMember;
}

// Lucide icons per category — zero emojis
const SERVICE_CATEGORIES: { value: string; label: string; icon: React.ElementType }[] = [
  { value: 'corte', label: 'Cabelo', icon: Scissors },
  { value: 'barba', label: 'Barba', icon: Sparkles },
  { value: 'combo', label: 'Combo', icon: Layers },
  { value: 'tratamento', label: 'Tratamento', icon: Sparkles },
  { value: 'sobrancelha', label: 'Sobrancelha', icon: Eye },
  { value: 'coloracao', label: 'Coloração', icon: Palette },
  { value: 'infantil', label: 'Infantil', icon: Baby },
  { value: 'outro', label: 'Outro', icon: MoreHorizontal },
];

const DURATION_OPTIONS = [15, 20, 30, 40, 45, 60, 75, 90, 120];

const RETURN_FORECAST_OPTIONS = [
  { value: 7, label: '7 dias' },
  { value: 15, label: '15 dias' },
  { value: 21, label: '21 dias' },
  { value: 30, label: '30 dias' },
  { value: 45, label: '45 dias' },
  { value: 60, label: '60 dias' },
  { value: 90, label: '90 dias' },
];

export const Services: React.FC<ServicesProps> = ({ services, setServices, isDarkMode, currentUser }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const confirm = useConfirm();
  const toast = useToast();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // File upload ref (same pattern as Clients.tsx)
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { permissions: contextPermissions } = useAppData();
  const { canCreate, canEdit, canDelete } = usePermissions(currentUser, contextPermissions);
  const canCreateService = canCreate('/services');
  const canEditService = canEdit('/services');
  const canDeleteService = canDelete('/services');

  // Theme (exact same tokens as Clients.tsx)
  const textMain = isDarkMode ? 'text-slate-50' : 'text-slate-900';
  const textSub = isDarkMode ? 'text-slate-400' : 'text-slate-600';
  const bgCard = isDarkMode ? 'bg-dark-surface' : 'bg-white';
  const borderCol = isDarkMode ? 'border-dark-border' : 'border-slate-300';
  const bgInput = isDarkMode ? 'bg-dark' : 'bg-white';
  const shadowClass = isDarkMode ? '' : 'shadow-sm';

  type ServiceForm = Omit<Service, 'id'>;
  const defaultForm: ServiceForm = {
    name: '', description: '', price: 0, cost: 0,
    type: 'One-Time', active: true, duration: 30,
    category: 'corte', commission: 50, assistantCommission: 0,
    priceVaries: false, returnForecast: 30,
    allowsOnlineBooking: true, registerAllProfessionals: true,
    image: undefined,
  };

  const [formData, setFormData] = useState<ServiceForm>(defaultForm);

  const filteredServices = useMemo(() =>
    services.filter(s => {
      if (categoryFilter !== 'all' && s.category !== categoryFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q);
      }
      return true;
    }),
    [services, searchQuery, categoryFilter]
  );

  const stats = useMemo(() => ({
    total: services.length,
    active: services.filter(s => s.active).length,
    avgPrice: services.length > 0 ? services.reduce((sum, s) => sum + s.price, 0) / services.length : 0,
    onlineBookable: services.filter(s => s.allowsOnlineBooking).length,
  }), [services]);

  const isFormValid = useMemo(() =>
    formData.name.trim() !== '' && formData.price > 0,
    [formData.name, formData.price]
  );

  const openModal = (service?: Service) => {
    if (service) {
      setEditingId(service.id);
      setFormData({
        name: service.name, description: service.description,
        price: service.price, cost: service.cost, type: service.type,
        active: service.active, duration: service.duration ?? 30,
        category: service.category || 'corte',
        commission: service.commission ?? 50,
        assistantCommission: service.assistantCommission ?? 0,
        priceVaries: service.priceVaries ?? false,
        returnForecast: service.returnForecast ?? 30,
        allowsOnlineBooking: service.allowsOnlineBooking ?? true,
        registerAllProfessionals: service.registerAllProfessionals ?? true,
        image: service.image,
      });
    } else {
      setEditingId(null);
      setFormData({ ...defaultForm });
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    // Image upload (same pattern as Clients.tsx)
    let imageUrl = formData.image;
    if (formData.image && isBase64(formData.image)) {
      const uploadedUrl = await uploadBase64Image(
        formData.image,
        'services',
        `${Date.now()}_${formData.name.replace(/[^a-zA-Z0-9]/g, '_')}`
      );
      if (uploadedUrl) {
        imageUrl = uploadedUrl;
      } else {
        imageUrl = undefined;
      }
    }

    const newService: Service = {
      id: editingId || crypto.randomUUID(),
      ...formData,
      image: imageUrl,
    };

    const result = await saveService(newService);
    if (!result.success) {
      toast.error('Erro ao salvar', result.error || 'Erro desconhecido');
      return;
    }

    if (editingId) {
      setServices(services.map(s => s.id === editingId ? newService : s));
      toast.success('Serviço atualizado');
    } else {
      setServices([...services, newService]);
      toast.success('Serviço criado');
    }
    setIsModalOpen(false);
  };

  const handleDelete = async (id: string) => {
    const ok = await confirm({
      title: 'Excluir Serviço',
      message: 'Tem certeza que deseja excluir este serviço? Esta ação não pode ser desfeita.',
      variant: 'danger',
      confirmLabel: 'Excluir',
      cancelLabel: 'Cancelar'
    });
    if (ok) {
      const result = await deleteService(id);
      if (!result.success) {
        toast.error('Erro ao excluir', result.error || 'Erro desconhecido');
        return;
      }
      setServices(services.filter(s => s.id !== id));
      toast.success('Serviço excluído');
    }
  };

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  // File upload handlers (exact Clients.tsx pattern)
  const handleTriggerFileUpload = () => { fileInputRef.current?.click(); };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, image: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    setFormData(prev => ({ ...prev, image: undefined }));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Toggle component
  const Toggle = ({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) => (
    <button type="button" onClick={() => onChange(!value)} className="flex items-center gap-3 w-full group">
      <div className={`relative w-11 h-6 rounded-full transition-colors ${value ? 'bg-primary' : isDarkMode ? 'bg-slate-700' : 'bg-slate-300'}`}>
        <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${value ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
      </div>
      <span className={`text-sm ${textMain} group-hover:text-primary transition-colors`}>{label}</span>
    </button>
  );

  const getCategoryInfo = (cat?: string) => SERVICE_CATEGORIES.find(c => c.value === cat) || SERVICE_CATEGORIES[7];

  return (
    <div className="animate-in slide-in-from-bottom-4 duration-500 relative pb-16 md:pb-0">

      {/* ========= MODAL ========= */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className={`${bgCard} border ${borderCol} rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]`}>
            {/* Header */}
            <div className={`p-4 border-b ${borderCol} flex justify-between items-center ${isDarkMode ? 'bg-dark' : 'bg-slate-50'}`}>
              <h3 className={`font-semibold text-lg ${textMain}`}>
                {editingId ? 'Editar Serviço' : 'Novo Serviço'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className={`${textSub} hover:${textMain}`}>
                <X size={20} />
              </button>
            </div>

            {/* Body - scrollable */}
            <form onSubmit={handleSave} className="p-6 space-y-5 overflow-y-auto custom-scrollbar flex-1">

              {/* Image Upload Section (exact Clients.tsx pattern) */}
              <div className={`flex items-center gap-4 p-4 border rounded-lg ${isDarkMode ? 'bg-dark-surface border-dark-border' : 'bg-slate-50 border-slate-200'}`}>
                <div className={`w-20 h-20 rounded-lg border flex items-center justify-center overflow-hidden shrink-0 ${isDarkMode ? 'bg-dark border-dark-border' : 'bg-white border-slate-200'}`}>
                  {formData.image ? (
                    <img src={formData.image} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon size={32} className="text-slate-500" />
                  )}
                </div>
                <div className="flex-1">
                  <label className={`block text-sm font-bold ${textMain} mb-2`}>Imagem do Serviço</label>
                  <div className="flex gap-2">
                    <input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
                    <button type="button" onClick={handleTriggerFileUpload}
                      className="px-3 py-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/50 rounded-lg text-xs font-bold transition-colors flex items-center gap-2">
                      <Upload size={14} /> Carregar Imagem
                    </button>
                    {formData.image && (
                      <button type="button" onClick={handleRemoveImage}
                        className="px-3 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/50 rounded-lg text-xs font-bold transition-colors flex items-center gap-2">
                        <Trash2 size={14} /> Remover
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-2">Formatos suportados: JPG, PNG.</p>
                </div>
              </div>

              {/* Basic Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={`block text-xs font-medium ${textSub} mb-1 flex items-center gap-1`}>
                    <Scissors size={12} /> Nome do Serviço
                  </label>
                  <input type="text" value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-primary outline-none`}
                    placeholder="Ex: Corte Masculino, Barba Premium" required />
                </div>
                <div>
                  <label className={`block text-xs font-medium ${textSub} mb-1 flex items-center gap-1`}>
                    <Tag size={12} /> Categoria
                  </label>
                  <CustomDropdown
                    value={formData.category}
                    onChange={v => setFormData({ ...formData, category: v })}
                    options={SERVICE_CATEGORIES.map(c => ({ value: c.value, label: c.label }))}
                    isDarkMode={isDarkMode}
                  />
                </div>
              </div>

              <div>
                <label className={`block text-xs font-medium ${textSub} mb-1`}>Descrição</label>
                <textarea value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Descreva o que está incluso, diferenciais e regras do serviço..."
                  rows={3}
                  className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-primary outline-none resize-none`} />
              </div>

              {/* Duration + Return */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={`block text-xs font-medium ${textSub} mb-1 flex items-center gap-1`}>
                    <Clock size={12} /> Tempo de Serviço
                  </label>
                  <CustomDropdown
                    value={String(formData.duration)}
                    onChange={v => setFormData({ ...formData, duration: parseInt(v) })}
                    options={DURATION_OPTIONS.map(d => ({ value: String(d), label: `${d} min` }))}
                    isDarkMode={isDarkMode}
                    icon={<Clock size={12} />}
                  />
                </div>
                <div>
                  <label className={`block text-xs font-medium ${textSub} mb-1 flex items-center gap-1`}>
                    <CalendarClock size={12} /> Previsão de Retorno
                  </label>
                  <CustomDropdown
                    value={String(formData.returnForecast ?? 30)}
                    onChange={v => setFormData({ ...formData, returnForecast: parseInt(v) })}
                    options={RETURN_FORECAST_OPTIONS.map(r => ({ value: String(r.value), label: r.label }))}
                    isDarkMode={isDarkMode}
                    icon={<CalendarClock size={12} />}
                  />
                  <p className={`text-[10px] ${textSub} mt-1 italic`}>Intervalo estimado para o cliente retornar.</p>
                </div>
              </div>

              {/* Pricing */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={`block text-xs font-medium ${textSub} mb-1 flex items-center gap-1`}>
                    <DollarSign size={12} /> Preço (R$)
                  </label>
                  <input type="number" value={formData.price}
                    onChange={e => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                    className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-primary outline-none`}
                    required min="0" step="0.01" />
                </div>
                <div>
                  <label className={`block text-xs font-medium ${textSub} mb-1 flex items-center gap-1`}>
                    <DollarSign size={12} /> Custo Operacional (R$)
                  </label>
                  <input type="number" value={formData.cost}
                    onChange={e => setFormData({ ...formData, cost: parseFloat(e.target.value) || 0 })}
                    className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-primary outline-none`}
                    min="0" step="0.01" />
                </div>
              </div>

              {/* Price varies toggle */}
              <Toggle
                value={formData.priceVaries ?? false}
                onChange={v => setFormData({ ...formData, priceVaries: v })}
                label="Preço varia (depende de tamanho, técnica ou personalização)"
              />

              {/* Commissions */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={`block text-xs font-medium ${textSub} mb-1 flex items-center gap-1`}>
                    <Percent size={12} /> Comissão Profissional (%)
                  </label>
                  <input type="number" value={formData.commission ?? 50}
                    onChange={e => setFormData({ ...formData, commission: parseFloat(e.target.value) || 0 })}
                    className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-primary outline-none`}
                    min="0" max="100" step="0.5" />
                </div>
                <div>
                  <label className={`block text-xs font-medium ${textSub} mb-1 flex items-center gap-1`}>
                    <Percent size={12} /> Comissão Assistente (%)
                  </label>
                  <input type="number" value={formData.assistantCommission ?? 0}
                    onChange={e => setFormData({ ...formData, assistantCommission: parseFloat(e.target.value) || 0 })}
                    className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-primary outline-none`}
                    min="0" max="100" step="0.5" />
                </div>
              </div>

              {/* Margin/Commission Preview (read-only, same pattern as Clients contract section) */}
              <div className={`p-5 rounded-xl border space-y-3 ${isDarkMode ? 'bg-dark/50 border-dark-border' : 'bg-slate-50 border-slate-200'}`}>
                <h4 className="text-sm font-bold text-primary flex items-center gap-2">
                  <DollarSign size={16} /> Prévia Financeira (Automática)
                </h4>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className={`block text-xs font-medium ${textSub} mb-1`}>Margem</label>
                    <div className={`w-full border rounded-lg py-2.5 px-3 text-sm font-bold cursor-not-allowed ${isDarkMode ? 'bg-dark border-dark-border' : 'bg-slate-100 border-slate-200'} ${(formData.price > 0 && ((formData.price - formData.cost) / formData.price) < 0.2) ? 'text-red-500' : 'text-emerald-500'}`}>
                      {formData.price > 0 ? (((formData.price - formData.cost) / formData.price) * 100).toFixed(1) : 0}%
                    </div>
                  </div>
                  <div>
                    <label className={`block text-xs font-medium ${textSub} mb-1`}>Repasse Barbeiro</label>
                    <div className={`w-full border rounded-lg py-2.5 px-3 text-sm font-medium text-blue-500 cursor-not-allowed ${isDarkMode ? 'bg-dark border-dark-border' : 'bg-slate-100 border-slate-200'}`}>
                      {formatCurrency(formData.price * ((formData.commission ?? 50) / 100))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-primary/70 mb-1">Lucro Líq.</label>
                    <div className={`w-full border border-primary/20 rounded-lg py-2.5 px-3 text-sm text-primary font-bold cursor-not-allowed ${isDarkMode ? 'bg-dark' : 'bg-slate-100'}`}>
                      {formatCurrency(formData.price - formData.cost - (formData.price * ((formData.commission ?? 50) / 100)))}
                    </div>
                  </div>
                </div>
                <p className={`text-[10px] ${textSub} italic text-center pt-1`}>
                  Valores calculados automaticamente com base no preço, custo e comissão.
                </p>
              </div>

              {/* Toggles */}
              <div className="space-y-3">
                <Toggle value={formData.allowsOnlineBooking ?? true}
                  onChange={v => setFormData({ ...formData, allowsOnlineBooking: v })}
                  label="Permite agendar online (visível para clientes)" />
                <Toggle value={formData.registerAllProfessionals ?? true}
                  onChange={v => setFormData({ ...formData, registerAllProfessionals: v })}
                  label="Cadastrar para todos profissionais automaticamente" />
                <Toggle value={formData.active}
                  onChange={v => setFormData({ ...formData, active: v })}
                  label="Serviço ativo (visível no catálogo e na comanda)" />
              </div>

              {/* Submit (exact Clients.tsx pattern) */}
              <button type="submit" disabled={!isFormValid}
                className={`w-full py-3 font-bold rounded-lg transition-colors mt-2 shadow-lg ${isFormValid ? 'bg-primary hover:bg-primary-600 text-white shadow-primary/20' : 'bg-slate-400 text-slate-200 cursor-not-allowed shadow-none'}`}>
                {editingId ? 'Salvar Serviço' : 'Cadastrar Serviço'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ========= HEADER ========= */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className={`text-2xl font-bold ${textMain}`}>Serviços & Preços</h1>
          <p className={`${textSub} text-sm`}>Gerencie o catálogo de serviços oferecidos.</p>
        </div>
        <div className="flex gap-3">
          <div className="relative flex-1 md:flex-none">
            <Search className={`absolute left-3 top-1/2 -translate-y-1/2 ${textSub}`} size={18} />
            <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              placeholder="Buscar serviço..."
              className={`pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary w-full md:w-64 ${isDarkMode ? 'bg-dark border-dark-border text-slate-200 placeholder:text-slate-600' : 'bg-white border-slate-300 text-slate-700 placeholder:text-slate-400'}`} />
          </div>
          {canCreateService && (
            <button onClick={() => openModal()}
              className="px-4 py-2 bg-primary hover:bg-primary-600 text-white font-semibold rounded-lg text-sm transition-colors flex items-center gap-2 whitespace-nowrap">
              <Plus size={18} /> <span className="hidden md:inline">Novo Serviço</span>
              <span className="md:hidden">Novo</span>
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Total', value: stats.total.toString(), icon: Layers, color: 'text-primary' },
          { label: 'Ativos', value: stats.active.toString(), icon: Sparkles, color: 'text-emerald-500' },
          { label: 'Preço Médio', value: formatCurrency(stats.avgPrice), icon: DollarSign, color: 'text-blue-500' },
          { label: 'Agendável Online', value: stats.onlineBookable.toString(), icon: Globe, color: 'text-amber-500' },
        ].map((s, i) => {
          const Icon = s.icon;
          return (
            <div key={i} className={`${bgCard} border ${borderCol} rounded-xl p-4 flex items-center gap-3`}>
              <div className={`p-2 rounded-lg ${isDarkMode ? 'bg-dark' : 'bg-slate-100'} ${s.color}`}><Icon size={18} /></div>
              <div>
                <p className={`text-xs ${textSub}`}>{s.label}</p>
                <p className={`font-bold ${textMain} text-sm`}>{s.value}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Category Filter Pills */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        <button onClick={() => setCategoryFilter('all')}
          className={`px-4 py-1.5 rounded-full text-xs font-medium border whitespace-nowrap transition-colors ${categoryFilter === 'all' ? 'bg-primary text-white border-primary' : `${borderCol} ${textSub} hover:border-primary/50`}`}>
          Todos
        </button>
        {SERVICE_CATEGORIES.map(c => {
          const CatIcon = c.icon;
          return (
            <button key={c.value} onClick={() => setCategoryFilter(c.value)}
              className={`px-4 py-1.5 rounded-full text-xs font-medium border whitespace-nowrap transition-colors flex items-center gap-1.5 ${categoryFilter === c.value ? 'bg-primary text-white border-primary' : `${borderCol} ${textSub} hover:border-primary/50`}`}>
              <CatIcon size={12} /> {c.label}
            </button>
          );
        })}
      </div>

      <div className="space-y-4">
        {/* Mobile Cards */}
        <div className="md:hidden grid grid-cols-1 gap-4">
          {filteredServices.map(s => {
            const margin = s.price > 0 ? ((s.price - s.cost) / s.price) * 100 : 0;
            const cat = getCategoryInfo(s.category);
            const CatIcon = cat.icon;
            return (
              <div key={s.id} className={`${bgCard} border ${borderCol} p-4 rounded-xl ${shadowClass} animate-in fade-in duration-300`}>
                <div className="flex justify-between items-start gap-2 mb-3">
                  <div className="flex items-center gap-3">
                    {s.image ? (
                      <img src={s.image} alt={s.name} className={`w-12 h-12 rounded-lg object-cover border shadow-sm ${isDarkMode ? 'border-dark-border' : 'border-slate-200'}`} />
                    ) : (
                      <div className={`w-12 h-12 rounded-lg flex items-center justify-center border shadow-sm ${isDarkMode ? 'bg-dark border-dark-border text-primary' : 'bg-slate-100 border-slate-200 text-primary'}`}>
                        <CatIcon size={20} />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className={`font-bold ${textMain} truncate`}>{s.name}</h3>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-2 py-0.5 rounded text-[10px] border uppercase font-medium ${isDarkMode ? 'bg-slate-700 text-slate-300 border-slate-600' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                          {cat.label}
                        </span>
                        <span className={`text-xs ${textSub} flex items-center gap-1`}><Clock size={10} /> {s.duration || 30}min</span>
                      </div>
                    </div>
                  </div>
                  {!s.active && (
                    <span className="px-2 py-0.5 rounded text-[10px] bg-red-500/10 text-red-500 border border-red-500/20">Inativo</span>
                  )}
                </div>

                {/* Stats Grid */}
                <div className={`grid grid-cols-4 gap-2 py-3 border-t border-b ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                  <div>
                    <span className={`text-[10px] uppercase ${textSub} block mb-1`}>Preço</span>
                    <span className={`font-bold ${textMain} text-sm`}>{formatCurrency(s.price)}</span>
                  </div>
                  <div>
                    <span className={`text-[10px] uppercase ${textSub} block mb-1`}>Margem</span>
                    <span className={`text-sm font-bold ${margin >= 50 ? 'text-emerald-500' : margin >= 20 ? 'text-yellow-500' : 'text-red-500'}`}>
                      {margin.toFixed(0)}%
                    </span>
                  </div>
                  <div>
                    <span className={`text-[10px] uppercase ${textSub} block mb-1`}>Comissão</span>
                    <span className="text-sm font-medium text-blue-500">{s.commission ?? 50}%</span>
                  </div>
                  <div>
                    <span className={`text-[10px] uppercase ${textSub} block mb-1`}>Retorno</span>
                    <span className={`text-sm ${textSub}`}>{s.returnForecast ?? 30}d</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-2">
                  {s.allowsOnlineBooking && (
                    <span className={`text-[10px] px-2 py-0.5 rounded border flex items-center gap-1 ${isDarkMode ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-emerald-50 text-emerald-600 border-emerald-200'}`}>
                      <Globe size={10} /> Online
                    </span>
                  )}
                  {s.priceVaries && (
                    <span className={`text-[10px] px-2 py-0.5 rounded border ${isDarkMode ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-amber-50 text-amber-600 border-amber-200'}`}>
                      Preço variável
                    </span>
                  )}
                </div>

                <div className="flex gap-2 pt-3">
                  {canEditService && (
                    <button onClick={() => openModal(s)}
                      className={`flex-1 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wide border transition-colors flex items-center justify-center gap-1 ${isDarkMode ? 'border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-white' : 'border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}>
                      <Pencil size={12} /> Editar
                    </button>
                  )}
                  {canDeleteService && (
                    <button onClick={() => handleDelete(s.id)}
                      className={`py-2.5 px-4 rounded-lg text-xs font-bold uppercase tracking-wide border transition-colors flex items-center justify-center gap-1 ${isDarkMode ? 'border-red-900/50 text-red-500 hover:bg-red-900/20' : 'border-red-200 text-red-500 hover:bg-red-50'}`}>
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Desktop Table */}
        <div className={`hidden md:block ${bgCard} border ${borderCol} ${shadowClass} rounded-xl overflow-hidden`}>
          <table className="w-full text-left text-sm text-slate-400">
            <thead className={`${isDarkMode ? 'bg-slate-950 text-slate-200' : 'bg-slate-50 text-slate-700'} uppercase font-medium`}>
              <tr>
                <th className="px-6 py-4">Serviço</th>
                <th className="px-6 py-4">Tempo</th>
                <th className="px-6 py-4">Preço</th>
                <th className="px-6 py-4">Margem</th>
                <th className="px-6 py-4">Comissão</th>
                <th className="px-6 py-4">Retorno</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDarkMode ? 'divide-slate-800' : 'divide-slate-200'}`}>
              {filteredServices.map(s => {
                const margin = s.price > 0 ? ((s.price - s.cost) / s.price) * 100 : 0;
                const cat = getCategoryInfo(s.category);
                const CatIcon = cat.icon;
                return (
                  <tr key={s.id} className={`${isDarkMode ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50'} transition-colors`}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {s.image ? (
                          <img src={s.image} alt="" className={`w-10 h-10 rounded-lg object-cover border ${isDarkMode ? 'border-dark-border' : 'border-slate-200'}`} />
                        ) : (
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center border ${isDarkMode ? 'bg-dark border-dark-border text-primary' : 'bg-slate-100 border-slate-200 text-primary'}`}>
                            <CatIcon size={18} />
                          </div>
                        )}
                        <div>
                          <span className={`font-medium ${textMain}`}>{s.name}</span>
                          <span className={`text-xs ${textSub} block`}>{cat.label}</span>
                        </div>
                      </div>
                    </td>
                    <td className={`px-6 py-4 ${textSub}`}>
                      <span className="flex items-center gap-1"><Clock size={12} /> {s.duration || 30}min</span>
                    </td>
                    <td className={`px-6 py-4 font-medium ${textMain}`}>
                      {formatCurrency(s.price)}
                      {s.priceVaries && <span className="text-amber-500 text-xs ml-1">~</span>}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${margin >= 50 ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : margin >= 20 ? 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'}`}>
                        {margin.toFixed(0)}%
                      </span>
                    </td>
                    <td className={`px-6 py-4 text-blue-500 font-medium`}>{s.commission ?? 50}%</td>
                    <td className={`px-6 py-4 ${textSub}`}>{s.returnForecast ?? 30}d</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5">
                        {s.allowsOnlineBooking && (
                          <span title="Agendável Online" className={`p-1 rounded ${isDarkMode ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-600'}`}>
                            <Globe size={12} />
                          </span>
                        )}
                        <span className={`w-2 h-2 rounded-full ${s.active ? 'bg-emerald-500' : 'bg-red-500'}`} />
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        {canEditService && (
                          <button onClick={() => openModal(s)} className="text-primary hover:text-primary-600 font-medium text-xs hover:underline">
                            Editar
                          </button>
                        )}
                        {canDeleteService && (
                          <button onClick={() => handleDelete(s.id)} className="text-red-500 hover:text-red-400 font-medium text-xs hover:underline">
                            Excluir
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {filteredServices.length === 0 && (
        <div className={`p-8 text-center ${textSub}`}>
          <Scissors size={48} className="mx-auto mb-3 opacity-20" />
          <p>Nenhum serviço encontrado{searchQuery ? ` para "${searchQuery}"` : ''}.</p>
        </div>
      )}
    </div>
  );
};