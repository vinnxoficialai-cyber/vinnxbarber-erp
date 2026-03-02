// Utilitários do ERP

/**
 * Wrapper seguro para localStorage com tratamento de erros
 */
export const safeStorage = {
    get: <T>(key: string, fallback: T): T => {
        try {
            const item = localStorage.getItem(key);
            if (!item) return fallback;
            return JSON.parse(item) as T;
        } catch (error) {
            console.error(`Erro ao ler ${key} do localStorage:`, error);
            return fallback;
        }
    },

    set: <T>(key: string, value: T): boolean => {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (error) {
            console.error(`Erro ao salvar ${key} no localStorage:`, error);
            // Possível localStorage cheio
            if (error instanceof DOMException && error.name === 'QuotaExceededError') {
                alert('Armazenamento local cheio! Alguns dados podem não ser salvos.');
            }
            return false;
        }
    },

    remove: (key: string): boolean => {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (error) {
            console.error(`Erro ao remover ${key} do localStorage:`, error);
            return false;
        }
    }
};

/**
 * Validação de formulários
 */
export const validators = {
    required: (value: string | number | null | undefined, fieldName: string): string | null => {
        if (value === null || value === undefined || value === '') {
            return `${fieldName} é obrigatório`;
        }
        return null;
    },

    email: (value: string): string | null => {
        if (!value) return null;
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
            return 'Email inválido';
        }
        return null;
    },

    phone: (value: string): string | null => {
        if (!value) return null;
        const phoneRegex = /^[\d\s\-\(\)]+$/;
        if (!phoneRegex.test(value) || value.replace(/\D/g, '').length < 10) {
            return 'Telefone inválido';
        }
        return null;
    },

    minValue: (value: number, min: number, fieldName: string): string | null => {
        if (value < min) {
            return `${fieldName} deve ser no mínimo ${min}`;
        }
        return null;
    },

    positiveNumber: (value: number, fieldName: string): string | null => {
        if (value <= 0) {
            return `${fieldName} deve ser maior que zero`;
        }
        return null;
    },

    dateRange: (startDate: string, endDate: string): string | null => {
        if (!startDate || !endDate) return null;
        if (new Date(startDate) > new Date(endDate)) {
            return 'Data inicial deve ser anterior à data final';
        }
        return null;
    },

    futureDate: (date: string, fieldName: string): string | null => {
        if (!date) return null;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (new Date(date) < today) {
            return `${fieldName} deve ser uma data futura`;
        }
        return null;
    }
};

/**
 * Função de confirmação de exclusão com estilo customizado
 */
export const confirmDelete = (itemName: string): boolean => {
    return window.confirm(`Tem certeza que deseja excluir "${itemName}"?\n\nEsta ação não pode ser desfeita.`);
};

/**
 * Formata valores monetários
 */
export const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

/**
 * Formata datas
 */
export const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('pt-BR');
};

/**
 * Formata data e hora
 */
export const formatDateTime = (dateString: string): string => {
    return new Date(dateString).toLocaleString('pt-BR');
};
