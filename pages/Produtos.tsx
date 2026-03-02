import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
    Package, Plus, Pencil, Trash2, X, Search, DollarSign,
    AlertTriangle, Box, Upload, Barcode, Truck, History,
    ArrowDownCircle, ArrowUpCircle, RotateCcw, ShoppingCart,
    Phone, Mail, Globe, Building, MapPin, User, TrendingUp,
    Image as ImageIcon, Tag, FileText, Layers, Sparkles,
    BarChart3, Calendar, Filter, Receipt, Users
} from 'lucide-react';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Product, ProductSupplier, ProductMovement, PurchaseOrder, PurchaseOrderItem, TeamMember, Comanda, ComandaItem } from '../types';
import { CustomDropdown } from '../components/CustomDropdown';
import { useConfirm } from '../components/ConfirmModal';
import { useToast } from '../components/Toast';
import {
    saveProduct, deleteProduct, saveProductSupplier, deleteProductSupplier,
    createProductMovement, getProductMovements, savePurchaseOrder, deletePurchaseOrder, getPurchaseOrders
} from '../lib/dataService';
import { uploadBase64Image, isBase64 } from '../lib/storage';
import { usePermissions } from '../hooks/usePermissions';
import { useAppData } from '../context/AppDataContext';
import { supabase } from '../lib/supabase';

interface ProdutosProps {
    isDarkMode: boolean;
    currentUser: TeamMember;
}

// Lucide icons per category — zero emojis
const CATEGORIES: { value: string; label: string; icon: React.ElementType }[] = [
    { value: 'pomada', label: 'Pomada', icon: Package },
    { value: 'gel', label: 'Gel', icon: Sparkles },
    { value: 'shampoo', label: 'Shampoo', icon: Sparkles },
    { value: 'condicionador', label: 'Condicionador', icon: Sparkles },
    { value: 'oleo', label: 'Óleo', icon: Sparkles },
    { value: 'cera', label: 'Cera', icon: Layers },
    { value: 'pos-barba', label: 'Pós-Barba', icon: Sparkles },
    { value: 'lamina', label: 'Lâmina', icon: Tag },
    { value: 'toalha', label: 'Toalha', icon: Box },
    { value: 'acessorio', label: 'Acessório', icon: Package },
    { value: 'outro', label: 'Outro', icon: Package },
];

const UNITS = [
    { value: 'un', label: 'Unidade' },
    { value: 'ml', label: 'Mililitro (ml)' },
    { value: 'g', label: 'Grama (g)' },
    { value: 'kg', label: 'Quilograma (kg)' },
    { value: 'l', label: 'Litro (l)' },
    { value: 'cx', label: 'Caixa' },
    { value: 'pct', label: 'Pacote' },
];

type PageTab = 'catalog' | 'purchases' | 'sales' | 'analytics' | 'history' | 'suppliers';

const MOVEMENT_TYPES: Record<string, { label: string; color: string; icon: React.ElementType }> = {
    entrada: { label: 'Entrada', color: 'text-emerald-500', icon: ArrowDownCircle },
    saida: { label: 'Saída', color: 'text-red-500', icon: ArrowUpCircle },
    ajuste: { label: 'Ajuste', color: 'text-amber-500', icon: RotateCcw },
    venda: { label: 'Venda', color: 'text-blue-500', icon: ShoppingCart },
};

export const Produtos: React.FC<ProdutosProps> = ({ isDarkMode, currentUser }) => {
    const { products, setProducts, comandas, permissions: contextPermissions } = useAppData();
    const { canCreate, canEdit, canDelete } = usePermissions(currentUser, contextPermissions);
    const confirm = useConfirm();
    const toast = useToast();
    const productFileRef = useRef<HTMLInputElement>(null);

    const textMain = isDarkMode ? 'text-slate-50' : 'text-slate-900';
    const textSub = isDarkMode ? 'text-slate-400' : 'text-slate-600';
    const bgCard = isDarkMode ? 'bg-dark-surface' : 'bg-white';
    const borderCol = isDarkMode ? 'border-dark-border' : 'border-slate-300';
    const bgInput = isDarkMode ? 'bg-dark' : 'bg-white';
    const shadowClass = isDarkMode ? '' : 'shadow-sm';

    const [activeTab, setActiveTab] = useState<PageTab>('catalog');
    const [searchQuery, setSearchQuery] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
    const [editingSupplierId, setEditingSupplierId] = useState<string | null>(null);
    const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);

    const [suppliers, setSuppliers] = useState<ProductSupplier[]>([]);
    const [movements, setMovements] = useState<ProductMovement[]>([]);
    const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
    const [salesItems, setSalesItems] = useState<(ComandaItem & { barberName?: string; clientName?: string; closedAt?: string })[]>([]);

    // Filters for Compras/Vendas
    const [purchaseFilter, setPurchaseFilter] = useState({ dateFrom: '', dateTo: '', nf: '', supplierId: '' });
    const [salesFilter, setSalesFilter] = useState({ dateFrom: '', dateTo: '', productId: '', barberId: '' });

    useEffect(() => {
        const load = async () => {
            const [sRes, movs, pOrders] = await Promise.all([
                supabase.from('product_suppliers').select('*').order('name'),
                getProductMovements(),
                getPurchaseOrders(),
            ]);
            setSuppliers((sRes.data || []) as ProductSupplier[]);
            setMovements(movs);
            setPurchaseOrders(pOrders);

            // Load product sales from comanda_items
            const { data: ciData } = await supabase
                .from('comanda_items')
                .select('*, comandas:comandaId(barberName, clientName, closedAt, status)')
                .eq('type', 'product')
                .order('createdAt', { ascending: false })
                .limit(500);
            if (ciData) {
                setSalesItems(ciData.map((ci: any) => ({
                    ...ci,
                    barberName: ci.comandas?.barberName || 'N/A',
                    clientName: ci.comandas?.clientName || 'Avulso',
                    closedAt: ci.comandas?.closedAt || ci.createdAt,
                })));
            }
        };
        load();
    }, []);

    const formatCurrency = (val: number) =>
        new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

    const getCatInfo = (cat?: string) => CATEGORIES.find(c => c.value === cat) || CATEGORIES[10];

    // ===== PRODUCT FORM =====
    const defaultProductForm: Omit<Product, 'id'> = {
        name: '', description: '', brand: '', category: 'pomada',
        costPrice: 0, sellPrice: 0, stock: 0, minStock: 5, active: true,
        image: undefined, barcode: undefined, unit: 'un', weight: undefined,
        notes: undefined, supplierId: undefined,
    };
    const [productForm, setProductForm] = useState(defaultProductForm);

    // ===== SUPPLIER FORM =====
    const defaultSupplierForm: Omit<ProductSupplier, 'id'> = {
        name: '', contactName: '', phone: '', email: '', website: '',
        cnpj: '', address: '', notes: '',
    };
    const [supplierForm, setSupplierForm] = useState(defaultSupplierForm);

    // ===== PURCHASE ORDER FORM =====
    const defaultPurchaseForm = {
        supplierName: '', supplierId: '' as string | undefined, nfNumber: '', orderDate: new Date().toISOString().split('T')[0],
        deliveryDate: '', status: 'pending' as 'pending' | 'received' | 'cancelled', notes: '',
    };
    const [purchaseForm, setPurchaseForm] = useState(defaultPurchaseForm);
    const [purchaseItems, setPurchaseItems] = useState<{ productId?: string; productName: string; quantity: number; unitCost: number }[]>([]);
    const [editingPurchaseId, setEditingPurchaseId] = useState<string | null>(null);

    const filteredProducts = useMemo(() =>
        products.filter(p => {
            if (categoryFilter !== 'all' && p.category !== categoryFilter) return false;
            if (searchQuery) {
                const q = searchQuery.toLowerCase();
                return p.name.toLowerCase().includes(q) || (p.brand?.toLowerCase().includes(q)) || (p.barcode?.toLowerCase().includes(q));
            }
            return true;
        }), [products, searchQuery, categoryFilter]
    );

    const stats = useMemo(() => ({
        totalProducts: products.length,
        lowStock: products.filter(p => p.active && p.stock <= p.minStock).length,
        totalValue: products.reduce((sum, p) => sum + (p.sellPrice * p.stock), 0),
        activeCount: products.filter(p => p.active).length,
    }), [products]);

    const isProductFormValid = useMemo(() => productForm.name.trim() !== '' && productForm.sellPrice > 0, [productForm.name, productForm.sellPrice]);
    const isSupplierFormValid = useMemo(() => supplierForm.name.trim() !== '', [supplierForm.name]);

    // ===== File upload handlers (exact Clients.tsx pattern) =====
    const handleTriggerProductUpload = () => { productFileRef.current?.click(); };

    const handleProductFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setProductForm(prev => ({ ...prev, image: reader.result as string }));
            };
            reader.readAsDataURL(file);
        }
    };

    const handleRemoveProductImage = () => {
        setProductForm(prev => ({ ...prev, image: undefined }));
        if (productFileRef.current) productFileRef.current.value = '';
    };

    // ===== PRODUCT CRUD =====
    const openProductModal = (product?: Product) => {
        if (product) {
            setEditingId(product.id);
            setProductForm({
                name: product.name, description: product.description || '', brand: product.brand || '',
                category: product.category, costPrice: product.costPrice, sellPrice: product.sellPrice,
                stock: product.stock, minStock: product.minStock, active: product.active,
                image: product.image, barcode: product.barcode, unit: product.unit || 'un',
                weight: product.weight, notes: product.notes, supplierId: product.supplierId,
            });
        } else {
            setEditingId(null);
            setProductForm({ ...defaultProductForm });
        }
        setIsModalOpen(true);
    };

    const handleSaveProduct = async (e: React.FormEvent) => {
        e.preventDefault();

        // Image upload (same pattern as Clients.tsx)
        let imageUrl = productForm.image;
        if (productForm.image && isBase64(productForm.image)) {
            const uploadedUrl = await uploadBase64Image(
                productForm.image,
                'products',
                `${Date.now()}_${productForm.name.replace(/[^a-zA-Z0-9]/g, '_')}`
            );
            imageUrl = uploadedUrl || undefined;
        }

        const product: Product = { id: editingId || crypto.randomUUID(), ...productForm, image: imageUrl };
        const result = await saveProduct(product);
        if (!result.success) { toast.error('Erro ao salvar', result.error || ''); return; }
        if (editingId) {
            setProducts((prev: Product[]) => prev.map(p => p.id === editingId ? product : p));
            toast.success('Produto atualizado');
        } else {
            setProducts((prev: Product[]) => [...prev, product]);
            toast.success('Produto adicionado');
        }
        setIsModalOpen(false);
    };

    const handleDeleteProduct = async (id: string) => {
        const ok = await confirm({ title: 'Excluir Produto', message: 'Tem certeza que deseja excluir este produto? O histórico de movimentações será perdido.', variant: 'danger', confirmLabel: 'Excluir', cancelLabel: 'Cancelar' });
        if (!ok) return;
        const result = await deleteProduct(id);
        if (!result.success) { toast.error('Erro', result.error || ''); return; }
        setProducts((prev: Product[]) => prev.filter(p => p.id !== id));
        toast.success('Produto excluído');
    };

    // ===== SUPPLIER CRUD =====
    const openSupplierModal = (supplier?: ProductSupplier) => {
        if (supplier) {
            setEditingSupplierId(supplier.id);
            setSupplierForm({
                name: supplier.name, contactName: supplier.contactName || '', phone: supplier.phone || '',
                email: supplier.email || '', website: supplier.website || '', cnpj: supplier.cnpj || '',
                address: supplier.address || '', notes: supplier.notes || '',
            });
        } else {
            setEditingSupplierId(null);
            setSupplierForm({ ...defaultSupplierForm });
        }
        setIsSupplierModalOpen(true);
    };

    const handleSaveSupplier = async (e: React.FormEvent) => {
        e.preventDefault();
        const supplier: ProductSupplier = { id: editingSupplierId || crypto.randomUUID(), ...supplierForm };
        const result = await saveProductSupplier(supplier);
        if (!result.success) { toast.error('Erro', result.error || ''); return; }
        if (editingSupplierId) {
            setSuppliers(prev => prev.map(s => s.id === editingSupplierId ? supplier : s));
            toast.success('Fornecedor atualizado');
        } else {
            setSuppliers(prev => [...prev, supplier]);
            toast.success('Fornecedor adicionado');
        }
        setIsSupplierModalOpen(false);
    };

    const handleDeleteSupplier = async (id: string) => {
        const ok = await confirm({ title: 'Excluir Fornecedor', message: 'Fornecedor será desvinculado dos produtos.', variant: 'danger', confirmLabel: 'Excluir', cancelLabel: 'Cancelar' });
        if (!ok) return;
        const result = await deleteProductSupplier(id);
        if (!result.success) { toast.error('Erro', result.error || ''); return; }
        setSuppliers(prev => prev.filter(s => s.id !== id));
        toast.success('Fornecedor excluído');
    };

    // ===== PURCHASE ORDER CRUD =====
    const openPurchaseModal = (order?: PurchaseOrder) => {
        if (order) {
            setEditingPurchaseId(order.id);
            setPurchaseForm({
                supplierName: order.supplierName, supplierId: order.supplierId,
                nfNumber: order.nfNumber || '', orderDate: order.orderDate?.split('T')[0] || '',
                deliveryDate: order.deliveryDate?.split('T')[0] || '',
                status: order.status, notes: order.notes || '',
            });
            setPurchaseItems((order.items || []).map(i => ({ productId: i.productId, productName: i.productName, quantity: i.quantity, unitCost: i.unitCost })));
        } else {
            setEditingPurchaseId(null);
            setPurchaseForm({ ...defaultPurchaseForm });
            setPurchaseItems([]);
        }
        setIsPurchaseModalOpen(true);
    };

    const addPurchaseItem = () => {
        setPurchaseItems(prev => [...prev, { productName: '', quantity: 1, unitCost: 0 }]);
    };

    const removePurchaseItem = (idx: number) => {
        setPurchaseItems(prev => prev.filter((_, i) => i !== idx));
    };

    const updatePurchaseItem = (idx: number, field: string, value: any) => {
        setPurchaseItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));
    };

    const purchaseTotal = useMemo(() => purchaseItems.reduce((s, i) => s + (i.quantity * i.unitCost), 0), [purchaseItems]);
    const isPurchaseFormValid = useMemo(() => purchaseForm.supplierName.trim() !== '' && purchaseItems.length > 0 && purchaseItems.every(i => i.productName.trim() !== ''), [purchaseForm, purchaseItems]);

    const handleSavePurchase = async (e: React.FormEvent) => {
        e.preventDefault();
        const id = editingPurchaseId || crypto.randomUUID();
        const order: PurchaseOrder = {
            id, ...purchaseForm, totalAmount: purchaseTotal,
            supplierId: purchaseForm.supplierId || undefined,
        };
        const items: PurchaseOrderItem[] = purchaseItems.map(i => ({
            id: crypto.randomUUID(), purchaseOrderId: id,
            productId: i.productId, productName: i.productName,
            quantity: i.quantity, unitCost: i.unitCost, totalCost: i.quantity * i.unitCost,
        }));
        const result = await savePurchaseOrder(order, items);
        if (!result.success) { toast.error('Erro', result.error || ''); return; }
        const updated = await getPurchaseOrders();
        setPurchaseOrders(updated);
        toast.success(editingPurchaseId ? 'Compra atualizada' : 'Compra registrada');
        setIsPurchaseModalOpen(false);
    };

    const handleDeletePurchase = async (id: string) => {
        const ok = await confirm({ title: 'Excluir Compra', message: 'Essa ação não pode ser desfeita. Deseja excluir?', variant: 'danger', confirmLabel: 'Excluir', cancelLabel: 'Cancelar' });
        if (!ok) return;
        const result = await deletePurchaseOrder(id);
        if (!result.success) { toast.error('Erro', result.error || ''); return; }
        setPurchaseOrders(prev => prev.filter(p => p.id !== id));
        toast.success('Compra excluída');
    };

    return (
        <div className="animate-in slide-in-from-bottom-4 duration-500 relative pb-16 md:pb-0">

            {/* ===== PRODUCT MODAL (Clients.tsx pattern) ===== */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className={`${bgCard} border ${borderCol} rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]`}>
                        <div className={`p-4 border-b ${borderCol} flex justify-between items-center ${isDarkMode ? 'bg-dark' : 'bg-slate-50'}`}>
                            <h3 className={`font-semibold text-lg ${textMain}`}>{editingId ? 'Editar Produto' : 'Novo Produto'}</h3>
                            <button onClick={() => setIsModalOpen(false)} className={`${textSub} hover:${textMain}`}><X size={20} /></button>
                        </div>
                        <form onSubmit={handleSaveProduct} className="p-6 space-y-4 overflow-y-auto custom-scrollbar flex-1">

                            {/* Image Upload (exact Clients.tsx pattern) */}
                            <div className={`flex items-center gap-4 p-4 border rounded-lg ${isDarkMode ? 'bg-dark-surface border-dark-border' : 'bg-slate-50 border-slate-200'}`}>
                                <div className={`w-20 h-20 rounded-lg border flex items-center justify-center overflow-hidden shrink-0 ${isDarkMode ? 'bg-dark border-dark-border' : 'bg-white border-slate-200'}`}>
                                    {productForm.image ? (
                                        <img src={productForm.image} alt="Preview" className="w-full h-full object-cover" />
                                    ) : (
                                        <ImageIcon size={32} className="text-slate-500" />
                                    )}
                                </div>
                                <div className="flex-1">
                                    <label className={`block text-sm font-bold ${textMain} mb-2`}>Imagem do Produto</label>
                                    <div className="flex gap-2">
                                        <input type="file" accept="image/*" ref={productFileRef} onChange={handleProductFileChange} className="hidden" />
                                        <button type="button" onClick={handleTriggerProductUpload}
                                            className="px-3 py-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/50 rounded-lg text-xs font-bold transition-colors flex items-center gap-2">
                                            <Upload size={14} /> Carregar Imagem
                                        </button>
                                        {productForm.image && (
                                            <button type="button" onClick={handleRemoveProductImage}
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
                                    <label className={`block text-xs font-medium ${textSub} mb-1 flex items-center gap-1`}><Package size={12} /> Nome do Produto</label>
                                    <input type="text" value={productForm.name} onChange={e => setProductForm({ ...productForm, name: e.target.value })}
                                        className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-primary outline-none`}
                                        placeholder="Ex: Pomada Black Fix" required />
                                </div>
                                <div>
                                    <label className={`block text-xs font-medium ${textSub} mb-1 flex items-center gap-1`}><Tag size={12} /> Marca</label>
                                    <input type="text" value={productForm.brand} onChange={e => setProductForm({ ...productForm, brand: e.target.value })}
                                        className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-primary outline-none`}
                                        placeholder="Ex: Black Fix, Don Juan" />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className={`block text-xs font-medium ${textSub} mb-1 flex items-center gap-1`}><Layers size={12} /> Categoria</label>
                                    <CustomDropdown
                                        value={productForm.category}
                                        onChange={v => setProductForm({ ...productForm, category: v })}
                                        options={CATEGORIES.map(c => ({ value: c.value, label: c.label }))}
                                        isDarkMode={isDarkMode}
                                    />
                                </div>
                                <div>
                                    <label className={`block text-xs font-medium ${textSub} mb-1 flex items-center gap-1`}><Barcode size={12} /> Código de Barras / SKU</label>
                                    <input type="text" value={productForm.barcode || ''} onChange={e => setProductForm({ ...productForm, barcode: e.target.value || undefined })}
                                        className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-primary outline-none`}
                                        placeholder="EAN ou código interno" />
                                </div>
                            </div>

                            <div>
                                <label className={`block text-xs font-medium ${textSub} mb-1 flex items-center gap-1`}><FileText size={12} /> Descrição</label>
                                <textarea value={productForm.description} onChange={e => setProductForm({ ...productForm, description: e.target.value })}
                                    rows={2} className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-primary outline-none resize-none`}
                                    placeholder="Descrição, composição, instruções de uso..." />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className={`block text-xs font-medium ${textSub} mb-1`}>Unidade</label>
                                    <CustomDropdown
                                        value={productForm.unit || 'un'}
                                        onChange={v => setProductForm({ ...productForm, unit: v })}
                                        options={UNITS.map(u => ({ value: u.value, label: u.label }))}
                                        isDarkMode={isDarkMode}
                                    />
                                </div>
                                <div>
                                    <label className={`block text-xs font-medium ${textSub} mb-1`}>Peso (g)</label>
                                    <input type="number" value={productForm.weight || ''} onChange={e => setProductForm({ ...productForm, weight: parseFloat(e.target.value) || undefined })}
                                        className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-primary outline-none`}
                                        min="0" step="0.01" placeholder="Opcional" />
                                </div>
                            </div>

                            {/* Pricing */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className={`block text-xs font-medium ${textSub} mb-1 flex items-center gap-1`}><DollarSign size={12} /> Preço Custo (R$)</label>
                                    <input type="number" value={productForm.costPrice} onChange={e => setProductForm({ ...productForm, costPrice: parseFloat(e.target.value) || 0 })}
                                        className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-primary outline-none`}
                                        min="0" step="0.01" />
                                </div>
                                <div>
                                    <label className={`block text-xs font-medium ${textSub} mb-1 flex items-center gap-1`}><DollarSign size={12} /> Preço Venda (R$)</label>
                                    <input type="number" value={productForm.sellPrice} onChange={e => setProductForm({ ...productForm, sellPrice: parseFloat(e.target.value) || 0 })}
                                        className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-primary outline-none`}
                                        required min="0" step="0.01" />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className={`block text-xs font-medium ${textSub} mb-1`}>Estoque Atual</label>
                                    <input type="number" value={productForm.stock} onChange={e => setProductForm({ ...productForm, stock: parseInt(e.target.value) || 0 })}
                                        className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-primary outline-none`}
                                        min="0" />
                                </div>
                                <div>
                                    <label className={`block text-xs font-medium ${textSub} mb-1`}>Estoque Mínimo</label>
                                    <input type="number" value={productForm.minStock} onChange={e => setProductForm({ ...productForm, minStock: parseInt(e.target.value) || 0 })}
                                        className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-primary outline-none`}
                                        min="0" />
                                </div>
                            </div>

                            {/* Margin preview (read-only, same pattern as Clients contract section) */}
                            <div className={`p-4 rounded-xl border ${isDarkMode ? 'bg-dark/50 border-dark-border' : 'bg-slate-50 border-slate-200'}`}>
                                <div className="flex justify-between items-center">
                                    <span className={`text-xs ${textSub}`}>Margem Calculada:</span>
                                    <span className={`font-bold ${(productForm.sellPrice > 0 && ((productForm.sellPrice - productForm.costPrice) / productForm.sellPrice) < 0.2) ? 'text-red-500' : 'text-emerald-500'}`}>
                                        {productForm.sellPrice > 0 ? (((productForm.sellPrice - productForm.costPrice) / productForm.sellPrice) * 100).toFixed(1) : 0}%
                                    </span>
                                </div>
                            </div>

                            {/* Supplier + Notes */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className={`block text-xs font-medium ${textSub} mb-1 flex items-center gap-1`}><Truck size={12} /> Fornecedor</label>
                                    <CustomDropdown
                                        value={productForm.supplierId || ''}
                                        onChange={v => setProductForm({ ...productForm, supplierId: v || undefined })}
                                        options={[
                                            { value: '', label: 'Sem fornecedor vinculado' },
                                            ...suppliers.map(s => ({ value: s.id, label: s.name, icon: <Truck size={12} /> }))
                                        ]}
                                        isDarkMode={isDarkMode}
                                        placeholder="Sem fornecedor vinculado"
                                    />
                                </div>
                                <div>
                                    <label className={`block text-xs font-medium ${textSub} mb-1`}>Observações Internas</label>
                                    <input type="text" value={productForm.notes || ''} onChange={e => setProductForm({ ...productForm, notes: e.target.value || undefined })}
                                        className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-primary outline-none`}
                                        placeholder="Lote, validade, notas..." />
                                </div>
                            </div>

                            <button type="submit" disabled={!isProductFormValid}
                                className={`w-full py-3 font-bold rounded-lg transition-colors mt-2 shadow-lg ${isProductFormValid ? 'bg-primary hover:bg-primary-600 text-white shadow-primary/20' : 'bg-slate-400 text-slate-200 cursor-not-allowed shadow-none'}`}>
                                {editingId ? 'Salvar Produto' : 'Cadastrar Produto'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* ===== SUPPLIER MODAL ===== */}
            {isSupplierModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className={`${bgCard} border ${borderCol} rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]`}>
                        <div className={`p-4 border-b ${borderCol} flex justify-between items-center ${isDarkMode ? 'bg-dark' : 'bg-slate-50'}`}>
                            <h3 className={`font-semibold text-lg ${textMain}`}>{editingSupplierId ? 'Editar Fornecedor' : 'Novo Fornecedor'}</h3>
                            <button onClick={() => setIsSupplierModalOpen(false)} className={`${textSub} hover:${textMain}`}><X size={20} /></button>
                        </div>
                        <form onSubmit={handleSaveSupplier} className="p-6 space-y-4 overflow-y-auto custom-scrollbar flex-1">
                            <div>
                                <label className={`block text-xs font-medium ${textSub} mb-1 flex items-center gap-1`}><Building size={12} /> Nome da Empresa</label>
                                <input type="text" value={supplierForm.name} onChange={e => setSupplierForm({ ...supplierForm, name: e.target.value })}
                                    className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-primary outline-none`}
                                    placeholder="Ex: Distribuidora ABC" required />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className={`block text-xs font-medium ${textSub} mb-1 flex items-center gap-1`}><User size={12} /> Pessoa de Contato</label>
                                    <input type="text" value={supplierForm.contactName} onChange={e => setSupplierForm({ ...supplierForm, contactName: e.target.value })}
                                        className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-primary outline-none`} />
                                </div>
                                <div>
                                    <label className={`block text-xs font-medium ${textSub} mb-1 flex items-center gap-1`}><Building size={12} /> CNPJ</label>
                                    <input type="text" value={supplierForm.cnpj} onChange={e => setSupplierForm({ ...supplierForm, cnpj: e.target.value })}
                                        className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-primary outline-none`} />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className={`block text-xs font-medium ${textSub} mb-1 flex items-center gap-1`}><Phone size={12} /> Telefone</label>
                                    <input type="text" value={supplierForm.phone} onChange={e => setSupplierForm({ ...supplierForm, phone: e.target.value })}
                                        className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-primary outline-none`} />
                                </div>
                                <div>
                                    <label className={`block text-xs font-medium ${textSub} mb-1 flex items-center gap-1`}><Mail size={12} /> E-mail</label>
                                    <input type="email" value={supplierForm.email} onChange={e => setSupplierForm({ ...supplierForm, email: e.target.value })}
                                        className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-primary outline-none`} />
                                </div>
                            </div>
                            <div>
                                <label className={`block text-xs font-medium ${textSub} mb-1 flex items-center gap-1`}><Globe size={12} /> Website</label>
                                <input type="text" value={supplierForm.website} onChange={e => setSupplierForm({ ...supplierForm, website: e.target.value })}
                                    className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-primary outline-none`} />
                            </div>
                            <div>
                                <label className={`block text-xs font-medium ${textSub} mb-1 flex items-center gap-1`}><MapPin size={12} /> Endereço</label>
                                <input type="text" value={supplierForm.address} onChange={e => setSupplierForm({ ...supplierForm, address: e.target.value })}
                                    className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-primary outline-none`} />
                            </div>
                            <div>
                                <label className={`block text-xs font-medium ${textSub} mb-1`}>Observações</label>
                                <textarea value={supplierForm.notes} onChange={e => setSupplierForm({ ...supplierForm, notes: e.target.value })}
                                    rows={2} className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-primary outline-none resize-none`} />
                            </div>
                            <button type="submit" disabled={!isSupplierFormValid}
                                className={`w-full py-3 font-bold rounded-lg transition-colors mt-2 shadow-lg ${isSupplierFormValid ? 'bg-primary hover:bg-primary-600 text-white shadow-primary/20' : 'bg-slate-400 text-slate-200 cursor-not-allowed shadow-none'}`}>
                                {editingSupplierId ? 'Salvar Fornecedor' : 'Cadastrar Fornecedor'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* ===== PURCHASE ORDER MODAL ===== */}
            {isPurchaseModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className={`${bgCard} border ${borderCol} rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]`}>
                        <div className={`p-4 border-b ${borderCol} flex justify-between items-center ${isDarkMode ? 'bg-dark' : 'bg-slate-50'}`}>
                            <h3 className={`font-semibold text-lg ${textMain}`}>{editingPurchaseId ? 'Editar Compra' : 'Nova Compra'}</h3>
                            <button onClick={() => setIsPurchaseModalOpen(false)} className={`${textSub} hover:${textMain}`}><X size={20} /></button>
                        </div>
                        <form onSubmit={handleSavePurchase} className="p-6 space-y-4 overflow-y-auto custom-scrollbar flex-1">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className={`block text-xs font-medium ${textSub} mb-1 flex items-center gap-1`}><Truck size={12} /> Fornecedor</label>
                                    <CustomDropdown
                                        value={purchaseForm.supplierId || ''}
                                        onChange={v => {
                                            const sup = suppliers.find(s => s.id === v);
                                            setPurchaseForm(p => ({ ...p, supplierId: v || undefined, supplierName: sup?.name || p.supplierName }));
                                        }}
                                        options={[
                                            { value: '', label: 'Selecionar...' },
                                            ...suppliers.map(s => ({ value: s.id, label: s.name, icon: <Truck size={12} /> }))
                                        ]}
                                        isDarkMode={isDarkMode}
                                        placeholder="Selecionar..."
                                    />
                                </div>
                                <div>
                                    <label className={`block text-xs font-medium ${textSub} mb-1 flex items-center gap-1`}><Building size={12} /> Nome Fornecedor (manual)</label>
                                    <input type="text" value={purchaseForm.supplierName} onChange={e => setPurchaseForm(p => ({ ...p, supplierName: e.target.value }))}
                                        className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-primary outline-none`}
                                        placeholder="Nome do fornecedor" required />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className={`block text-xs font-medium ${textSub} mb-1 flex items-center gap-1`}><Receipt size={12} /> Nº NF</label>
                                    <input type="text" value={purchaseForm.nfNumber} onChange={e => setPurchaseForm(p => ({ ...p, nfNumber: e.target.value }))}
                                        className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-primary outline-none`}
                                        placeholder="Opcional" />
                                </div>
                                <div>
                                    <label className={`block text-xs font-medium ${textSub} mb-1 flex items-center gap-1`}><Calendar size={12} /> Data Pedido</label>
                                    <input type="date" value={purchaseForm.orderDate} onChange={e => setPurchaseForm(p => ({ ...p, orderDate: e.target.value }))}
                                        className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-primary outline-none`} required />
                                </div>
                                <div>
                                    <label className={`block text-xs font-medium ${textSub} mb-1`}>Status</label>
                                    <CustomDropdown
                                        value={purchaseForm.status}
                                        onChange={v => setPurchaseForm(p => ({ ...p, status: v as any }))}
                                        options={[
                                            { value: 'pending', label: 'Pendente', dot: 'bg-amber-500' },
                                            { value: 'received', label: 'Recebido', dot: 'bg-emerald-500' },
                                            { value: 'cancelled', label: 'Cancelado', dot: 'bg-red-500' },
                                        ]}
                                        isDarkMode={isDarkMode}
                                    />
                                </div>
                            </div>

                            {/* Items List */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className={`text-xs font-bold ${textMain} flex items-center gap-1`}><Package size={12} /> Itens da Compra</label>
                                    <button type="button" onClick={addPurchaseItem}
                                        className="px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/50 rounded-lg text-xs font-bold flex items-center gap-1">
                                        <Plus size={12} /> Adicionar Item
                                    </button>
                                </div>
                                {purchaseItems.length === 0 ? (
                                    <div className={`p-4 text-center border rounded-lg ${isDarkMode ? 'border-dark-border' : 'border-slate-200'} ${textSub} text-xs`}>
                                        Nenhum item. Clique em "Adicionar Item".
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {purchaseItems.map((item, idx) => (
                                            <div key={idx} className={`grid grid-cols-12 gap-2 items-end p-3 border rounded-lg ${isDarkMode ? 'border-dark-border bg-dark/50' : 'border-slate-200 bg-slate-50'}`}>
                                                <div className="col-span-5">
                                                    <label className={`text-[10px] ${textSub}`}>Produto</label>
                                                    <CustomDropdown value={item.productId || ''} onChange={v => {
                                                        const prod = products.find(p => p.id === v);
                                                        updatePurchaseItem(idx, 'productId', v || undefined);
                                                        if (prod) { updatePurchaseItem(idx, 'productName', prod.name); updatePurchaseItem(idx, 'unitCost', prod.costPrice); }
                                                    }} options={[{ value: '', label: 'Manual...' }, ...products.map(p => ({ value: p.id, label: p.name }))]} isDarkMode={isDarkMode} />
                                                    {!item.productId && (
                                                        <input type="text" value={item.productName} onChange={e => updatePurchaseItem(idx, 'productName', e.target.value)}
                                                            className={`w-full mt-1 ${bgInput} border ${borderCol} rounded p-1.5 text-xs ${textMain}`} placeholder="Nome do produto" />
                                                    )}
                                                </div>
                                                <div className="col-span-2">
                                                    <label className={`text-[10px] ${textSub}`}>Qtd</label>
                                                    <input type="number" value={item.quantity} onChange={e => updatePurchaseItem(idx, 'quantity', parseInt(e.target.value) || 1)}
                                                        className={`w-full ${bgInput} border ${borderCol} rounded p-1.5 text-xs ${textMain}`} min="1" />
                                                </div>
                                                <div className="col-span-2">
                                                    <label className={`text-[10px] ${textSub}`}>Custo Un.</label>
                                                    <input type="number" value={item.unitCost} onChange={e => updatePurchaseItem(idx, 'unitCost', parseFloat(e.target.value) || 0)}
                                                        className={`w-full ${bgInput} border ${borderCol} rounded p-1.5 text-xs ${textMain}`} min="0" step="0.01" />
                                                </div>
                                                <div className="col-span-2">
                                                    <label className={`text-[10px] ${textSub}`}>Subtotal</label>
                                                    <div className={`p-1.5 text-xs font-bold ${textMain}`}>{formatCurrency(item.quantity * item.unitCost)}</div>
                                                </div>
                                                <div className="col-span-1 flex justify-center">
                                                    <button type="button" onClick={() => removePurchaseItem(idx)} className="text-red-500 hover:text-red-400 p-1"><Trash2 size={14} /></button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Total */}
                            <div className={`p-4 rounded-xl border ${isDarkMode ? 'bg-dark/50 border-dark-border' : 'bg-slate-50 border-slate-200'}`}>
                                <div className="flex justify-between items-center">
                                    <span className={`text-sm font-bold ${textMain}`}>Total da Compra:</span>
                                    <span className="text-lg font-bold text-primary">{formatCurrency(purchaseTotal)}</span>
                                </div>
                            </div>

                            <div>
                                <label className={`block text-xs font-medium ${textSub} mb-1`}>Observações</label>
                                <textarea value={purchaseForm.notes} onChange={e => setPurchaseForm(p => ({ ...p, notes: e.target.value }))}
                                    rows={2} className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-primary outline-none resize-none`} />
                            </div>

                            <button type="submit" disabled={!isPurchaseFormValid}
                                className={`w-full py-3 font-bold rounded-lg transition-colors mt-2 shadow-lg ${isPurchaseFormValid ? 'bg-primary hover:bg-primary-600 text-white shadow-primary/20' : 'bg-slate-400 text-slate-200 cursor-not-allowed shadow-none'}`}>
                                {editingPurchaseId ? 'Salvar Compra' : 'Registrar Compra'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* ===== HEADER ===== */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className={`text-2xl font-bold ${textMain}`}>Produtos</h1>
                    <p className={`${textSub} text-sm`}>Estoque, fornecedores e movimentações.</p>
                </div>
                <div className="flex gap-3">
                    {activeTab === 'catalog' && (
                        <>
                            <div className="relative flex-1 md:flex-none">
                                <Search className={`absolute left-3 top-1/2 -translate-y-1/2 ${textSub}`} size={18} />
                                <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Buscar produto..."
                                    className={`pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary w-full md:w-64 ${isDarkMode ? 'bg-dark border-dark-border text-slate-200 placeholder:text-slate-600' : 'bg-white border-slate-300 text-slate-700 placeholder:text-slate-400'}`} />
                            </div>
                            {canCreate('/products') && (
                                <button onClick={() => openProductModal()}
                                    className="px-4 py-2 bg-primary hover:bg-primary-600 text-white font-semibold rounded-lg text-sm transition-colors flex items-center gap-2 whitespace-nowrap">
                                    <Plus size={18} /> <span className="hidden md:inline">Novo Produto</span>
                                    <span className="md:hidden">Novo</span>
                                </button>
                            )}
                        </>
                    )}
                    {activeTab === 'purchases' && canCreate('/products') && (
                        <button onClick={() => openPurchaseModal()}
                            className="px-4 py-2 bg-primary hover:bg-primary-600 text-white font-semibold rounded-lg text-sm transition-colors flex items-center gap-2 whitespace-nowrap">
                            <Plus size={18} /> <span className="hidden md:inline">Nova Compra</span>
                            <span className="md:hidden">Nova</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                {[
                    { label: 'Total', value: stats.totalProducts.toString(), icon: Package, color: 'text-primary' },
                    { label: 'Ativos', value: stats.activeCount.toString(), icon: Box, color: 'text-emerald-500' },
                    { label: 'Estoque Baixo', value: stats.lowStock.toString(), icon: AlertTriangle, color: stats.lowStock > 0 ? 'text-amber-500' : 'text-slate-400' },
                    { label: 'Valor em Estoque', value: formatCurrency(stats.totalValue), icon: DollarSign, color: 'text-blue-500' },
                ].map((s, i) => {
                    const Icon = s.icon;
                    return (
                        <div key={i} className={`${bgCard} border ${borderCol} rounded-xl p-4 flex items-center gap-3`}>
                            <div className={`p-2 rounded-lg ${isDarkMode ? 'bg-dark' : 'bg-slate-100'} ${s.color}`}><Icon size={18} /></div>
                            <div><p className={`text-xs ${textSub}`}>{s.label}</p><p className={`font-bold ${textMain} text-sm`}>{s.value}</p></div>
                        </div>
                    );
                })}
            </div>

            {/* Tabs */}
            <div className={`flex gap-1 mb-6 p-1 rounded-lg ${isDarkMode ? 'bg-dark' : 'bg-slate-100'} w-fit overflow-x-auto`}>
                {([
                    { id: 'catalog' as PageTab, label: 'Catálogo', icon: Package },
                    { id: 'purchases' as PageTab, label: 'Compras', icon: Receipt },
                    { id: 'sales' as PageTab, label: 'Vendas', icon: ShoppingCart },
                    { id: 'analytics' as PageTab, label: 'Analytics', icon: BarChart3 },
                    { id: 'history' as PageTab, label: 'Histórico', icon: History },
                    { id: 'suppliers' as PageTab, label: 'Fornecedores', icon: Truck },
                ]).map(tab => {
                    const TabIcon = tab.icon;
                    return (
                        <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                            className={`px-3 py-2 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap ${activeTab === tab.id
                                ? `${bgCard} ${textMain} shadow-sm` : `${textSub} hover:${textMain}`}`}>
                            <TabIcon size={14} /> {tab.label}
                        </button>
                    );
                })}
            </div>

            {/* ===== TAB: CATALOG ===== */}
            {activeTab === 'catalog' && (
                <>
                    {/* Category filter pills */}
                    <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
                        <button onClick={() => setCategoryFilter('all')}
                            className={`px-4 py-1.5 rounded-full text-xs font-medium border whitespace-nowrap transition-colors ${categoryFilter === 'all' ? 'bg-primary text-white border-primary' : `${borderCol} ${textSub} hover:border-primary/50`}`}>
                            Todos
                        </button>
                        {CATEGORIES.map(c => {
                            const CatIcon = c.icon;
                            return (
                                <button key={c.value} onClick={() => setCategoryFilter(c.value)}
                                    className={`px-4 py-1.5 rounded-full text-xs font-medium border whitespace-nowrap transition-colors flex items-center gap-1.5 ${categoryFilter === c.value ? 'bg-primary text-white border-primary' : `${borderCol} ${textSub} hover:border-primary/50`}`}>
                                    <CatIcon size={12} /> {c.label}
                                </button>
                            );
                        })}
                    </div>

                    {/* Mobile Cards */}
                    <div className="md:hidden grid grid-cols-1 gap-4">
                        {filteredProducts.map(p => {
                            const margin = p.sellPrice > 0 ? ((p.sellPrice - p.costPrice) / p.sellPrice) * 100 : 0;
                            const isLow = p.stock <= p.minStock;
                            const cat = getCatInfo(p.category);
                            const CatIcon = cat.icon;
                            const supplier = p.supplierId ? suppliers.find(s => s.id === p.supplierId) : null;
                            return (
                                <div key={p.id} className={`${bgCard} border ${borderCol} p-4 rounded-xl ${shadowClass} animate-in fade-in duration-300`}>
                                    <div className="flex items-start gap-3 mb-3">
                                        {p.image ? (
                                            <img src={p.image} alt={p.name} className={`w-14 h-14 rounded-lg object-cover border ${isDarkMode ? 'border-dark-border' : 'border-slate-200'}`} />
                                        ) : (
                                            <div className={`w-14 h-14 rounded-lg flex items-center justify-center border ${isDarkMode ? 'bg-dark border-dark-border text-primary' : 'bg-slate-100 border-slate-200 text-primary'}`}>
                                                <CatIcon size={22} />
                                            </div>
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <h3 className={`font-bold ${textMain} truncate`}>{p.name}</h3>
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className={`px-2 py-0.5 rounded text-[10px] border font-medium ${isDarkMode ? 'bg-slate-700 text-slate-300 border-slate-600' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                                                    {cat.label}
                                                </span>
                                                {p.brand && <span className={`text-xs ${textSub}`}>{p.brand}</span>}
                                            </div>
                                            {supplier && <span className={`text-[10px] ${textSub} flex items-center gap-1 mt-0.5`}><Truck size={10} />{supplier.name}</span>}
                                        </div>
                                    </div>
                                    <div className={`grid grid-cols-3 gap-2 py-3 border-t border-b ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                                        <div>
                                            <span className={`text-[10px] uppercase ${textSub} block mb-1`}>Venda</span>
                                            <span className={`font-bold ${textMain} text-sm`}>{formatCurrency(p.sellPrice)}</span>
                                        </div>
                                        <div>
                                            <span className={`text-[10px] uppercase ${textSub} block mb-1`}>Margem</span>
                                            <span className={`text-sm font-bold ${margin >= 50 ? 'text-emerald-500' : margin >= 20 ? 'text-yellow-500' : 'text-red-500'}`}>{margin.toFixed(0)}%</span>
                                        </div>
                                        <div>
                                            <span className={`text-[10px] uppercase ${textSub} block mb-1`}>Estoque</span>
                                            <span className={`text-sm font-bold ${isLow ? 'text-amber-500' : textMain}`}>
                                                {p.stock}{isLow && <AlertTriangle size={10} className="inline ml-1" />}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex gap-2 pt-3">
                                        {canEdit('/products') && (
                                            <button onClick={() => openProductModal(p)}
                                                className={`flex-1 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wide border transition-colors flex items-center justify-center gap-1 ${isDarkMode ? 'border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-white' : 'border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}>
                                                <Pencil size={12} /> Editar
                                            </button>
                                        )}
                                        {canDelete('/products') && (
                                            <button onClick={() => handleDeleteProduct(p.id)}
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
                                    <th className="px-6 py-4">Produto</th>
                                    <th className="px-6 py-4">Categoria</th>
                                    <th className="px-6 py-4">Venda</th>
                                    <th className="px-6 py-4">Custo</th>
                                    <th className="px-6 py-4">Margem</th>
                                    <th className="px-6 py-4">Estoque</th>
                                    <th className="px-6 py-4">Fornecedor</th>
                                    <th className="px-6 py-4 text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody className={`divide-y ${isDarkMode ? 'divide-slate-800' : 'divide-slate-200'}`}>
                                {filteredProducts.map(p => {
                                    const margin = p.sellPrice > 0 ? ((p.sellPrice - p.costPrice) / p.sellPrice) * 100 : 0;
                                    const isLow = p.stock <= p.minStock;
                                    const cat = getCatInfo(p.category);
                                    const CatIcon = cat.icon;
                                    const supplier = p.supplierId ? suppliers.find(s => s.id === p.supplierId) : null;
                                    return (
                                        <tr key={p.id} className={`${isDarkMode ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50'} transition-colors`}>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    {p.image ? (
                                                        <img src={p.image} alt="" className={`w-10 h-10 rounded-lg object-cover border ${isDarkMode ? 'border-dark-border' : 'border-slate-200'}`} />
                                                    ) : (
                                                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center border ${isDarkMode ? 'bg-dark border-dark-border text-primary' : 'bg-slate-100 border-slate-200 text-primary'}`}>
                                                            <CatIcon size={18} />
                                                        </div>
                                                    )}
                                                    <div>
                                                        <span className={`font-medium ${textMain}`}>{p.name}</span>
                                                        {p.brand && <span className={`text-xs ${textSub} block`}>{p.brand}</span>}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4"><span className={`px-2 py-1 rounded text-xs border ${isDarkMode ? 'bg-slate-700 text-slate-300 border-slate-600' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>{cat.label}</span></td>
                                            <td className={`px-6 py-4 font-medium ${textMain}`}>{formatCurrency(p.sellPrice)}</td>
                                            <td className={`px-6 py-4 ${textSub}`}>{formatCurrency(p.costPrice)}</td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${margin >= 50 ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : margin >= 20 ? 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'}`}>
                                                    {margin.toFixed(0)}%
                                                </span>
                                            </td>
                                            <td className="px-6 py-4"><span className={`font-medium ${isLow ? 'text-amber-500' : textMain}`}>{p.stock}{isLow && <AlertTriangle size={12} className="inline ml-1 text-amber-500" />}</span></td>
                                            <td className={`px-6 py-4 ${textSub} text-xs`}>{supplier?.name || '—'}</td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex justify-end gap-2">
                                                    {canEdit('/products') && <button onClick={() => openProductModal(p)} className="text-primary hover:text-primary-600 font-medium text-xs hover:underline">Editar</button>}
                                                    {canDelete('/products') && <button onClick={() => handleDeleteProduct(p.id)} className="text-red-500 hover:text-red-400 font-medium text-xs hover:underline">Excluir</button>}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {filteredProducts.length === 0 && (
                        <div className={`p-8 text-center ${textSub}`}>
                            <Package size={48} className="mx-auto mb-3 opacity-20" />
                            <p>Nenhum produto encontrado{searchQuery ? ` para "${searchQuery}"` : ''}.</p>
                        </div>
                    )}
                </>
            )}

            {/* ===== TAB: PURCHASES (Compras) ===== */}
            {activeTab === 'purchases' && (() => {
                const filtered = purchaseOrders.filter(po => {
                    if (purchaseFilter.nf && !po.nfNumber?.toLowerCase().includes(purchaseFilter.nf.toLowerCase())) return false;
                    if (purchaseFilter.supplierId && po.supplierId !== purchaseFilter.supplierId) return false;
                    if (purchaseFilter.dateFrom && po.orderDate < purchaseFilter.dateFrom) return false;
                    if (purchaseFilter.dateTo && po.orderDate > purchaseFilter.dateTo + 'T23:59:59') return false;
                    return true;
                });
                return (
                    <>
                        <div className={`${bgCard} border ${borderCol} rounded-xl p-4 mb-4 ${shadowClass}`}>
                            <div className="flex items-center gap-2 mb-3">
                                <Filter size={14} className="text-primary" />
                                <span className={`text-xs font-bold ${textMain}`}>Filtros</span>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                <input type="date" value={purchaseFilter.dateFrom} onChange={e => setPurchaseFilter(p => ({ ...p, dateFrom: e.target.value }))}
                                    className={`${bgInput} border ${borderCol} rounded-lg p-2 text-xs ${textMain} focus:ring-1 focus:ring-primary outline-none`} />
                                <input type="date" value={purchaseFilter.dateTo} onChange={e => setPurchaseFilter(p => ({ ...p, dateTo: e.target.value }))}
                                    className={`${bgInput} border ${borderCol} rounded-lg p-2 text-xs ${textMain} focus:ring-1 focus:ring-primary outline-none`} />
                                <input type="text" placeholder="N\u00ba NF" value={purchaseFilter.nf} onChange={e => setPurchaseFilter(p => ({ ...p, nf: e.target.value }))}
                                    className={`${bgInput} border ${borderCol} rounded-lg p-2 text-xs ${textMain} focus:ring-1 focus:ring-primary outline-none`} />
                                <CustomDropdown
                                    value={purchaseFilter.supplierId}
                                    onChange={v => setPurchaseFilter(p => ({ ...p, supplierId: v }))}
                                    options={[
                                        { value: '', label: 'Todos Fornecedores' },
                                        ...suppliers.map(s => ({ value: s.id, label: s.name }))
                                    ]}
                                    isDarkMode={isDarkMode}
                                    placeholder="Todos Fornecedores"
                                />
                            </div>
                        </div>
                        <div className={`${bgCard} border ${borderCol} ${shadowClass} rounded-xl overflow-hidden`}>
                            <table className="w-full text-left text-sm text-slate-400">
                                <thead className={`${isDarkMode ? 'bg-slate-950 text-slate-200' : 'bg-slate-50 text-slate-700'} uppercase font-medium`}>
                                    <tr>
                                        <th className="px-6 py-4">Data</th>
                                        <th className="px-6 py-4">NF</th>
                                        <th className="px-6 py-4">Fornecedor</th>
                                        <th className="px-6 py-4">Itens</th>
                                        <th className="px-6 py-4">Total</th>
                                        <th className="px-6 py-4">Status</th>
                                        <th className="px-6 py-4 text-right">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className={`divide-y ${isDarkMode ? 'divide-slate-800' : 'divide-slate-200'}`}>
                                    {filtered.length === 0 ? (
                                        <tr><td colSpan={7} className={`px-6 py-12 text-center ${textSub}`}>
                                            <Receipt size={32} className="mx-auto mb-2 opacity-30" />Nenhuma compra registrada.
                                        </td></tr>
                                    ) : filtered.map(po => (
                                        <tr key={po.id} className={`${isDarkMode ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50'}`}>
                                            <td className={`px-6 py-3 text-xs ${textSub}`}>{new Date(po.orderDate).toLocaleDateString('pt-BR')}</td>
                                            <td className={`px-6 py-3 font-medium ${textMain}`}>{po.nfNumber || '—'}</td>
                                            <td className={`px-6 py-3 ${textSub}`}>{po.supplierName}</td>
                                            <td className={`px-6 py-3 ${textSub}`}>{po.items?.length || 0}</td>
                                            <td className={`px-6 py-3 font-bold ${textMain}`}>{formatCurrency(po.totalAmount)}</td>
                                            <td className="px-6 py-3">
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${po.status === 'received' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' :
                                                    po.status === 'cancelled' ? 'bg-red-500/10 text-red-500 border border-red-500/20' :
                                                        'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                                                    }`}>{po.status === 'received' ? 'Recebido' : po.status === 'cancelled' ? 'Cancelado' : 'Pendente'}</span>
                                            </td>
                                            <td className="px-6 py-3 text-right">
                                                <div className="flex justify-end gap-2">
                                                    <button onClick={() => openPurchaseModal(po)} className="text-primary hover:text-primary-600 font-medium text-xs hover:underline">Editar</button>
                                                    <button onClick={() => handleDeletePurchase(po.id)} className="text-red-500 hover:text-red-400 font-medium text-xs hover:underline">Excluir</button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                );
            })()}

            {/* ===== TAB: SALES (Vendas) ===== */}
            {activeTab === 'sales' && (() => {
                const barbers = [...new Set(salesItems.map(s => s.barberName).filter(Boolean))];
                const filtered = salesItems.filter(si => {
                    if (salesFilter.productId && si.itemId !== salesFilter.productId) return false;
                    if (salesFilter.barberId && si.barberName !== salesFilter.barberId) return false;
                    if (salesFilter.dateFrom && (si.closedAt || '') < salesFilter.dateFrom) return false;
                    if (salesFilter.dateTo && (si.closedAt || '') > salesFilter.dateTo + 'T23:59:59') return false;
                    return true;
                });
                const totalRevenue = filtered.reduce((s, i) => s + i.totalPrice, 0);
                const totalQty = filtered.reduce((s, i) => s + i.quantity, 0);
                return (
                    <>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
                            <div className={`${bgCard} border ${borderCol} rounded-xl p-4 flex items-center gap-3`}>
                                <div className={`p-2 rounded-lg ${isDarkMode ? 'bg-dark' : 'bg-slate-100'} text-primary`}><DollarSign size={18} /></div>
                                <div><p className={`text-xs ${textSub}`}>Faturamento</p><p className={`font-bold ${textMain} text-sm`}>{formatCurrency(totalRevenue)}</p></div>
                            </div>
                            <div className={`${bgCard} border ${borderCol} rounded-xl p-4 flex items-center gap-3`}>
                                <div className={`p-2 rounded-lg ${isDarkMode ? 'bg-dark' : 'bg-slate-100'} text-emerald-500`}><ShoppingCart size={18} /></div>
                                <div><p className={`text-xs ${textSub}`}>Itens Vendidos</p><p className={`font-bold ${textMain} text-sm`}>{totalQty}</p></div>
                            </div>
                            <div className={`${bgCard} border ${borderCol} rounded-xl p-4 flex items-center gap-3`}>
                                <div className={`p-2 rounded-lg ${isDarkMode ? 'bg-dark' : 'bg-slate-100'} text-blue-500`}><TrendingUp size={18} /></div>
                                <div><p className={`text-xs ${textSub}`}>Ticket Médio</p><p className={`font-bold ${textMain} text-sm`}>{totalQty > 0 ? formatCurrency(totalRevenue / totalQty) : 'R$ 0'}</p></div>
                            </div>
                        </div>
                        <div className={`${bgCard} border ${borderCol} rounded-xl p-4 mb-4 ${shadowClass}`}>
                            <div className="flex items-center gap-2 mb-3"><Filter size={14} className="text-primary" /><span className={`text-xs font-bold ${textMain}`}>Filtros</span></div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                <input type="date" value={salesFilter.dateFrom} onChange={e => setSalesFilter(p => ({ ...p, dateFrom: e.target.value }))}
                                    className={`${bgInput} border ${borderCol} rounded-lg p-2 text-xs ${textMain} focus:ring-1 focus:ring-primary outline-none`} />
                                <input type="date" value={salesFilter.dateTo} onChange={e => setSalesFilter(p => ({ ...p, dateTo: e.target.value }))}
                                    className={`${bgInput} border ${borderCol} rounded-lg p-2 text-xs ${textMain} focus:ring-1 focus:ring-primary outline-none`} />
                                <CustomDropdown
                                    value={salesFilter.productId}
                                    onChange={v => setSalesFilter(p => ({ ...p, productId: v }))}
                                    options={[
                                        { value: '', label: 'Todos Produtos' },
                                        ...products.map(p => ({ value: p.id, label: p.name }))
                                    ]}
                                    isDarkMode={isDarkMode}
                                    placeholder="Todos Produtos"
                                />
                                <CustomDropdown
                                    value={salesFilter.barberId}
                                    onChange={v => setSalesFilter(p => ({ ...p, barberId: v }))}
                                    options={[
                                        { value: '', label: 'Todos Barbeiros' },
                                        ...barbers.map(b => ({ value: b!, label: b! }))
                                    ]}
                                    isDarkMode={isDarkMode}
                                    placeholder="Todos Barbeiros"
                                />
                            </div>
                        </div>
                        <div className={`${bgCard} border ${borderCol} ${shadowClass} rounded-xl overflow-hidden`}>
                            <table className="w-full text-left text-sm text-slate-400">
                                <thead className={`${isDarkMode ? 'bg-slate-950 text-slate-200' : 'bg-slate-50 text-slate-700'} uppercase font-medium`}>
                                    <tr><th className="px-6 py-4">Data</th><th className="px-6 py-4">Produto</th><th className="px-6 py-4">Qtd</th><th className="px-6 py-4">Valor</th><th className="px-6 py-4">Barbeiro</th><th className="px-6 py-4">Cliente</th></tr>
                                </thead>
                                <tbody className={`divide-y ${isDarkMode ? 'divide-slate-800' : 'divide-slate-200'}`}>
                                    {filtered.length === 0 ? (
                                        <tr><td colSpan={6} className={`px-6 py-12 text-center ${textSub}`}><ShoppingCart size={32} className="mx-auto mb-2 opacity-30" />Nenhuma venda registrada.</td></tr>
                                    ) : filtered.slice(0, 100).map((si, i) => (
                                        <tr key={si.id || i} className={`${isDarkMode ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50'}`}>
                                            <td className={`px-6 py-3 text-xs ${textSub}`}>{si.closedAt ? new Date(si.closedAt).toLocaleDateString('pt-BR') : '—'}</td>
                                            <td className={`px-6 py-3 font-medium ${textMain}`}>{si.name}</td>
                                            <td className={`px-6 py-3 ${textSub}`}>{si.quantity}</td>
                                            <td className={`px-6 py-3 font-bold text-emerald-500`}>{formatCurrency(si.totalPrice)}</td>
                                            <td className={`px-6 py-3 ${textSub}`}>{si.barberName}</td>
                                            <td className={`px-6 py-3 ${textSub}`}>{si.clientName}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                );
            })()}

            {/* ===== TAB: ANALYTICS ===== */}
            {activeTab === 'analytics' && (() => {
                const now = new Date();
                const thisMonth = now.getMonth();
                const thisYear = now.getFullYear();
                const monthSales = salesItems.filter(si => { const d = new Date(si.closedAt || ''); return d.getMonth() === thisMonth && d.getFullYear() === thisYear; });
                const monthRevenue = monthSales.reduce((s, i) => s + i.totalPrice, 0);
                const monthQty = monthSales.reduce((s, i) => s + i.quantity, 0);
                const avgMargin = products.length > 0 ? products.reduce((s, p) => s + (p.sellPrice > 0 ? ((p.sellPrice - p.costPrice) / p.sellPrice) * 100 : 0), 0) / products.length : 0;
                const totalStock = products.reduce((s, p) => s + p.stock, 0);
                const totalSalesQty = salesItems.reduce((s, i) => s + i.quantity, 0);
                const turnover = totalStock > 0 ? (totalSalesQty / totalStock).toFixed(1) : '0';

                // Monthly chart (12 months)
                const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
                const chartData = months.map((name, idx) => {
                    const ms = salesItems.filter(si => { const d = new Date(si.closedAt || ''); return d.getMonth() === idx && d.getFullYear() === thisYear; });
                    return { name, receita: ms.reduce((s, i) => s + i.totalPrice, 0) };
                });

                // Top 5 products
                const prodMap: Record<string, { name: string; qty: number; revenue: number }> = {};
                salesItems.forEach(si => {
                    if (!prodMap[si.itemId]) prodMap[si.itemId] = { name: si.name, qty: 0, revenue: 0 };
                    prodMap[si.itemId].qty += si.quantity;
                    prodMap[si.itemId].revenue += si.totalPrice;
                });
                const topProducts = Object.values(prodMap).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
                const topColors = ['#00bf62', '#3b82f6', '#f59e0b', '#8b5cf6', '#ef4444'];

                // Barber ranking
                const barberMap: Record<string, { name: string; qty: number; revenue: number }> = {};
                salesItems.forEach(si => {
                    const bn = si.barberName || 'N/A';
                    if (!barberMap[bn]) barberMap[bn] = { name: bn, qty: 0, revenue: 0 };
                    barberMap[bn].qty += si.quantity;
                    barberMap[bn].revenue += si.totalPrice;
                });
                const barberRanking = Object.values(barberMap).sort((a, b) => b.revenue - a.revenue);

                // Category distribution
                const catMap: Record<string, number> = {};
                salesItems.forEach(si => {
                    const prod = products.find(p => p.id === si.itemId);
                    const cat = prod?.category || 'outro';
                    catMap[cat] = (catMap[cat] || 0) + si.totalPrice;
                });
                const catData = Object.entries(catMap).map(([cat, val]) => ({ name: (CATEGORIES.find(c => c.value === cat)?.label || cat), value: val })).sort((a, b) => b.value - a.value);

                // Idle products (no sales in last 30 days)
                const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
                const recentSoldIds = new Set(salesItems.filter(si => (si.closedAt || '') >= thirtyDaysAgo).map(si => si.itemId));
                const idleProducts = products.filter(p => p.active && !recentSoldIds.has(p.id));

                return (
                    <div className="space-y-6">
                        {/* KPI Cards */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {[
                                { label: 'Faturamento (Mês)', value: formatCurrency(monthRevenue), icon: DollarSign, color: 'text-primary' },
                                { label: 'Itens Vendidos (Mês)', value: monthQty.toString(), icon: ShoppingCart, color: 'text-emerald-500' },
                                { label: 'Giro de Estoque', value: turnover + 'x', icon: RotateCcw, color: 'text-blue-500' },
                                { label: 'Margem Média', value: avgMargin.toFixed(1) + '%', icon: TrendingUp, color: avgMargin >= 30 ? 'text-emerald-500' : 'text-amber-500' },
                            ].map((kpi, i) => {
                                const Icon = kpi.icon; return (
                                    <div key={i} className={`${bgCard} border ${borderCol} rounded-xl p-4 flex items-center gap-3`}>
                                        <div className={`p-2 rounded-lg ${isDarkMode ? 'bg-dark' : 'bg-slate-100'} ${kpi.color}`}><Icon size={18} /></div>
                                        <div><p className={`text-xs ${textSub}`}>{kpi.label}</p><p className={`font-bold ${textMain} text-sm`}>{kpi.value}</p></div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Charts Grid */}
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                            {/* Revenue Chart */}
                            <div className={`${bgCard} border ${borderCol} p-6 rounded-xl ${shadowClass}`}>
                                <h3 className={`text-sm font-bold ${textMain} mb-4 flex items-center gap-2`}><BarChart3 size={16} className="text-primary" /> Faturamento Mensal — {thisYear}</h3>
                                <div className="h-56">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={chartData}>
                                            <defs><linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#00bf62" stopOpacity={0.15} /><stop offset="95%" stopColor="#00bf62" stopOpacity={0} /></linearGradient></defs>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#27272a" opacity={0.3} />
                                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                                            <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                                            <Tooltip contentStyle={{ backgroundColor: '#18181b', borderRadius: '8px', border: '1px solid #27272a', color: '#fff', fontSize: 12 }} formatter={(v: number) => [formatCurrency(v), 'Receita']} />
                                            <Area type="monotone" dataKey="receita" stroke="#00bf62" strokeWidth={2} fillOpacity={1} fill="url(#colorRev)" />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* Top Products Bar Chart */}
                            <div className={`${bgCard} border ${borderCol} p-6 rounded-xl ${shadowClass}`}>
                                <h3 className={`text-sm font-bold ${textMain} mb-4 flex items-center gap-2`}><Package size={16} className="text-primary" /> Top 5 Produtos (Receita)</h3>
                                {topProducts.length === 0 ? (
                                    <div className={`h-56 flex items-center justify-center ${textSub}`}><ShoppingCart size={32} className="opacity-20 mr-2" /> Sem dados de vendas</div>
                                ) : (
                                    <div className="h-56">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={topProducts} layout="vertical">
                                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#27272a" opacity={0.3} />
                                                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                                                <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} width={100} />
                                                <Tooltip contentStyle={{ backgroundColor: '#18181b', borderRadius: '8px', border: '1px solid #27272a', color: '#fff', fontSize: 12 }} formatter={(v: number) => [formatCurrency(v), 'Receita']} />
                                                <Bar dataKey="revenue" radius={[0, 4, 4, 0]}>{topProducts.map((_, i) => <Cell key={i} fill={topColors[i]} />)}</Bar>
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Rankings */}
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                            {/* Barber Ranking */}
                            <div className={`${bgCard} border ${borderCol} p-6 rounded-xl ${shadowClass}`}>
                                <h3 className={`text-sm font-bold ${textMain} mb-4 flex items-center gap-2`}><Users size={16} className="text-primary" /> Ranking Barbeiros (Vendas de Produto)</h3>
                                {barberRanking.length === 0 ? (
                                    <p className={`text-xs ${textSub} text-center py-6`}>Sem dados</p>
                                ) : (
                                    <div className="space-y-3">
                                        {barberRanking.slice(0, 8).map((b, i) => (
                                            <div key={b.name} className="flex items-center gap-3">
                                                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${i === 0 ? 'bg-amber-500/20 text-amber-500' : i === 1 ? 'bg-slate-300/20 text-slate-400' : i === 2 ? 'bg-amber-700/20 text-amber-700' : `${isDarkMode ? 'bg-dark text-slate-500' : 'bg-slate-100 text-slate-500'}`}`}>{i + 1}</span>
                                                <div className="flex-1">
                                                    <div className="flex justify-between items-baseline">
                                                        <span className={`text-sm font-medium ${textMain}`}>{b.name}</span>
                                                        <span className="text-xs font-bold text-primary">{formatCurrency(b.revenue)}</span>
                                                    </div>
                                                    <div className="h-1.5 mt-1 rounded-full overflow-hidden" style={{ background: isDarkMode ? '#1e293b' : '#e2e8f0' }}>
                                                        <div className="h-full bg-primary rounded-full" style={{ width: `${barberRanking[0].revenue > 0 ? (b.revenue / barberRanking[0].revenue) * 100 : 0}%` }} />
                                                    </div>
                                                </div>
                                                <span className={`text-[10px] ${textSub}`}>{b.qty} un</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Category Distribution + Idle Products */}
                            <div className="space-y-6">
                                {/* Categories */}
                                <div className={`${bgCard} border ${borderCol} p-6 rounded-xl ${shadowClass}`}>
                                    <h3 className={`text-sm font-bold ${textMain} mb-4 flex items-center gap-2`}><Layers size={16} className="text-primary" /> Vendas por Categoria</h3>
                                    {catData.length === 0 ? (
                                        <p className={`text-xs ${textSub} text-center py-4`}>Sem dados</p>
                                    ) : (
                                        <div className="space-y-2">
                                            {catData.slice(0, 6).map((c, i) => {
                                                const total = catData.reduce((s, v) => s + v.value, 0);
                                                const pct = total > 0 ? (c.value / total * 100) : 0;
                                                return (
                                                    <div key={c.name} className="flex items-center gap-3">
                                                        <span className={`text-xs w-24 truncate ${textSub}`}>{c.name}</span>
                                                        <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: isDarkMode ? '#1e293b' : '#e2e8f0' }}>
                                                            <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: topColors[i % topColors.length] }} />
                                                        </div>
                                                        <span className={`text-xs font-bold ${textMain} w-16 text-right`}>{formatCurrency(c.value)}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>

                                {/* Idle Products */}
                                <div className={`${bgCard} border ${borderCol} p-6 rounded-xl ${shadowClass}`}>
                                    <h3 className={`text-sm font-bold ${textMain} mb-3 flex items-center gap-2`}><AlertTriangle size={16} className="text-amber-500" /> Produtos Parados ({idleProducts.length})</h3>
                                    <p className={`text-[10px] ${textSub} mb-3`}>Sem vendas nos últimos 30 dias</p>
                                    {idleProducts.length === 0 ? (
                                        <p className={`text-xs text-emerald-500 text-center py-2`}>Todos os produtos tiveram vendas recentemente!</p>
                                    ) : (
                                        <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                                            {idleProducts.slice(0, 10).map(p => (
                                                <div key={p.id} className={`flex items-center justify-between py-1.5 px-2 rounded ${isDarkMode ? 'hover:bg-dark' : 'hover:bg-slate-50'}`}>
                                                    <span className={`text-xs ${textMain} truncate flex-1`}>{p.name}</span>
                                                    <span className={`text-[10px] ${textSub} ml-2`}>Estoque: {p.stock}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* ===== TAB: HISTORY ===== */}
            {activeTab === 'history' && (
                <div className={`${bgCard} border ${borderCol} ${shadowClass} rounded-xl overflow-hidden`}>
                    <table className="w-full text-left text-sm text-slate-400">
                        <thead className={`${isDarkMode ? 'bg-slate-950 text-slate-200' : 'bg-slate-50 text-slate-700'} uppercase font-medium`}>
                            <tr>
                                <th className="px-6 py-4">Data</th>
                                <th className="px-6 py-4">Produto</th>
                                <th className="px-6 py-4">Tipo</th>
                                <th className="px-6 py-4">Qtd</th>
                                <th className="px-6 py-4">Anterior</th>
                                <th className="px-6 py-4">Novo</th>
                                <th className="px-6 py-4">Motivo</th>
                            </tr>
                        </thead>
                        <tbody className={`divide-y ${isDarkMode ? 'divide-slate-800' : 'divide-slate-200'}`}>
                            {movements.length === 0 ? (
                                <tr><td colSpan={7} className={`px-6 py-12 text-center ${textSub}`}>
                                    <History size={32} className="mx-auto mb-2 opacity-30" />
                                    Nenhuma movimentação registrada.
                                </td></tr>
                            ) : movements.map(m => {
                                const mt = MOVEMENT_TYPES[m.type] || MOVEMENT_TYPES.ajuste;
                                const MIcon = mt.icon;
                                const product = products.find(p => p.id === m.productId);
                                return (
                                    <tr key={m.id} className={`${isDarkMode ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50'}`}>
                                        <td className={`px-6 py-3 text-xs ${textSub}`}>{new Date(m.createdAt || '').toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                                        <td className={`px-6 py-3 font-medium ${textMain}`}>{product?.name || m.productId.slice(0, 8)}</td>
                                        <td className="px-6 py-3"><span className={`flex items-center gap-1 text-xs font-medium ${mt.color}`}><MIcon size={14} />{mt.label}</span></td>
                                        <td className={`px-6 py-3 font-bold ${m.quantity > 0 ? 'text-emerald-500' : 'text-red-500'}`}>{m.quantity > 0 ? '+' : ''}{m.quantity}</td>
                                        <td className={`px-6 py-3 ${textSub}`}>{m.previousStock}</td>
                                        <td className={`px-6 py-3 font-medium ${textMain}`}>{m.newStock}</td>
                                        <td className={`px-6 py-3 text-xs ${textSub}`}>{m.reason || '—'}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* ===== TAB: SUPPLIERS ===== */}
            {activeTab === 'suppliers' && (
                <>
                    <div className="flex justify-end mb-4">
                        <button onClick={() => openSupplierModal()}
                            className="px-4 py-2 bg-primary hover:bg-primary-600 text-white font-semibold rounded-lg text-sm flex items-center gap-2">
                            <Plus size={18} /> Novo Fornecedor
                        </button>
                    </div>
                    {suppliers.length === 0 ? (
                        <div className={`p-8 text-center ${textSub}`}>
                            <Truck size={48} className="mx-auto mb-3 opacity-20" />
                            <p>Nenhum fornecedor cadastrado.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {suppliers.map(s => {
                                const linkedProducts = products.filter(p => p.supplierId === s.id).length;
                                return (
                                    <div key={s.id} className={`${bgCard} border ${borderCol} rounded-xl p-5 ${shadowClass} animate-in fade-in duration-300`}>
                                        <div className="flex items-start justify-between mb-3">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm border ${isDarkMode ? 'bg-dark border-dark-border text-primary' : 'bg-slate-100 border-slate-200 text-primary'}`}>
                                                    {s.name[0]?.toUpperCase()}
                                                </div>
                                                <div>
                                                    <h3 className={`font-bold ${textMain}`}>{s.name}</h3>
                                                    {s.contactName && <p className={`text-xs ${textSub} flex items-center gap-1`}><User size={10} />{s.contactName}</p>}
                                                </div>
                                            </div>
                                            <div className="flex gap-1">
                                                <button onClick={() => openSupplierModal(s)} className={`p-2 rounded-lg transition-colors ${isDarkMode ? 'text-slate-600 hover:text-primary hover:bg-dark-surface' : 'text-slate-400 hover:text-primary hover:bg-slate-100'}`}>
                                                    <Pencil size={14} />
                                                </button>
                                                <button onClick={() => handleDeleteSupplier(s.id)} className={`p-2 rounded-lg transition-colors ${isDarkMode ? 'text-slate-600 hover:text-red-500 hover:bg-dark-surface' : 'text-slate-400 hover:text-red-500 hover:bg-slate-100'}`}>
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </div>
                                        <div className="space-y-1.5">
                                            {s.phone && <p className={`text-xs ${textSub} flex items-center gap-2`}><Phone size={12} />{s.phone}</p>}
                                            {s.email && <p className={`text-xs ${textSub} flex items-center gap-2`}><Mail size={12} />{s.email}</p>}
                                            {s.cnpj && <p className={`text-xs ${textSub} flex items-center gap-2`}><Building size={12} />{s.cnpj}</p>}
                                            {s.website && <p className="text-xs text-primary flex items-center gap-2"><Globe size={12} />{s.website}</p>}
                                            {s.address && <p className={`text-xs ${textSub} flex items-center gap-2`}><MapPin size={12} />{s.address}</p>}
                                        </div>
                                        <div className={`mt-3 pt-3 border-t ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                                            <span className={`text-xs ${textSub} flex items-center gap-1`}>
                                                <Package size={10} /> {linkedProducts} produto{linkedProducts !== 1 ? 's' : ''} vinculado{linkedProducts !== 1 ? 's' : ''}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </>
            )}
        </div>
    );
};
