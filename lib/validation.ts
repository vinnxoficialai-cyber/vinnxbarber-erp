/**
 * Input Validation Utilities
 * Best practices for ERP data validation
 */

// CPF Validation (Brazilian Individual Taxpayer Registry)
export function validateCPF(cpf: string): boolean {
    if (!cpf) return true; // Optional field

    // Remove non-numeric characters
    const cleanCPF = cpf.replace(/\D/g, '');

    if (cleanCPF.length !== 11) return false;

    // Check for known invalid patterns
    if (/^(\d)\1+$/.test(cleanCPF)) return false;

    // Validate check digits
    let sum = 0;
    for (let i = 0; i < 9; i++) {
        sum += parseInt(cleanCPF[i]) * (10 - i);
    }
    let digit = 11 - (sum % 11);
    if (digit >= 10) digit = 0;
    if (parseInt(cleanCPF[9]) !== digit) return false;

    sum = 0;
    for (let i = 0; i < 10; i++) {
        sum += parseInt(cleanCPF[i]) * (11 - i);
    }
    digit = 11 - (sum % 11);
    if (digit >= 10) digit = 0;
    if (parseInt(cleanCPF[10]) !== digit) return false;

    return true;
}

// CNPJ Validation (Brazilian Company Registry)
export function validateCNPJ(cnpj: string): boolean {
    if (!cnpj) return true; // Optional field

    const cleanCNPJ = cnpj.replace(/\D/g, '');
    if (cleanCNPJ.length !== 14) return false;

    if (/^(\d)\1+$/.test(cleanCNPJ)) return false;

    const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

    let sum = 0;
    for (let i = 0; i < 12; i++) {
        sum += parseInt(cleanCNPJ[i]) * weights1[i];
    }
    let digit = 11 - (sum % 11);
    if (digit >= 10) digit = 0;
    if (parseInt(cleanCNPJ[12]) !== digit) return false;

    sum = 0;
    for (let i = 0; i < 13; i++) {
        sum += parseInt(cleanCNPJ[i]) * weights2[i];
    }
    digit = 11 - (sum % 11);
    if (digit >= 10) digit = 0;
    if (parseInt(cleanCNPJ[13]) !== digit) return false;

    return true;
}

// Email Validation
export function validateEmail(email: string): boolean {
    if (!email) return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// Phone Validation (Brazilian format)
export function validatePhone(phone: string): boolean {
    if (!phone) return true; // Optional field
    const cleanPhone = phone.replace(/\D/g, '');
    return cleanPhone.length >= 10 && cleanPhone.length <= 11;
}

// Password Strength Validation
export function validatePassword(password: string): { valid: boolean; message: string } {
    if (!password) return { valid: false, message: 'Senha é obrigatória' };
    if (password.length < 8) return { valid: false, message: 'Senha deve ter no mínimo 8 caracteres' };

    // Optional: Add more requirements
    // const hasUppercase = /[A-Z]/.test(password);
    // const hasLowercase = /[a-z]/.test(password);
    // const hasNumber = /\d/.test(password);

    return { valid: true, message: '' };
}

// Format CPF for display
export function formatCPF(cpf: string): string {
    const cleanCPF = cpf.replace(/\D/g, '');
    if (cleanCPF.length !== 11) return cpf;
    return cleanCPF.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

// Format CNPJ for display
export function formatCNPJ(cnpj: string): string {
    const cleanCNPJ = cnpj.replace(/\D/g, '');
    if (cleanCNPJ.length !== 14) return cnpj;
    return cleanCNPJ.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
}

// Format Phone for display
export function formatPhone(phone: string): string {
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length === 11) {
        return cleanPhone.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    } else if (cleanPhone.length === 10) {
        return cleanPhone.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
    }
    return phone;
}

// Monetary value validation
export function validateMonetaryValue(value: number): boolean {
    return typeof value === 'number' && !isNaN(value) && value >= 0;
}

// Date validation
export function validateDate(dateString: string): boolean {
    if (!dateString) return true; // Optional field
    const date = new Date(dateString);
    return !isNaN(date.getTime());
}

// Sanitize input to prevent XSS
export function sanitizeInput(input: string): string {
    if (!input) return '';
    return input
        .trim()
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;');
}

// Validate member data before save
export interface MemberValidationResult {
    valid: boolean;
    errors: string[];
}

export function validateMemberData(member: {
    name?: string;
    email?: string;
    password?: string;
    cpf?: string;
    phone?: string;
}): MemberValidationResult {
    const errors: string[] = [];

    if (!member.name || member.name.trim().length < 2) {
        errors.push('Nome deve ter no mínimo 2 caracteres');
    }

    if (!validateEmail(member.email || '')) {
        errors.push('Email inválido');
    }

    if (member.password) {
        const passwordResult = validatePassword(member.password);
        if (!passwordResult.valid) {
            errors.push(passwordResult.message);
        }
    }

    if (member.cpf && !validateCPF(member.cpf)) {
        errors.push('CPF inválido');
    }

    if (member.phone && !validatePhone(member.phone)) {
        errors.push('Telefone inválido');
    }

    return {
        valid: errors.length === 0,
        errors
    };
}
