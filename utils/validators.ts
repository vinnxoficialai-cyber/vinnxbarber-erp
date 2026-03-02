// Validation Utilities

export const validators = {
    email: (email: string): boolean => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    },

    cpf: (cpf: string): boolean => {
        // Remove non-digits
        cpf = cpf.replace(/\D/g, '');

        if (cpf.length !== 11) return false;

        // Check if all digits are the same
        if (/^(\d)\1{10}$/.test(cpf)) return false;

        // Validate first digit
        let sum = 0;
        for (let i = 0; i < 9; i++) {
            sum += parseInt(cpf.charAt(i)) * (10 - i);
        }
        let digit = 11 - (sum % 11);
        if (digit >= 10) digit = 0;
        if (digit !== parseInt(cpf.charAt(9))) return false;

        // Validate second digit
        sum = 0;
        for (let i = 0; i < 10; i++) {
            sum += parseInt(cpf.charAt(i)) * (11 - i);
        }
        digit = 11 - (sum % 11);
        if (digit >= 10) digit = 0;
        if (digit !== parseInt(cpf.charAt(10))) return false;

        return true;
    },

    cnpj: (cnpj: string): boolean => {
        // Remove non-digits
        cnpj = cnpj.replace(/\D/g, '');

        if (cnpj.length !== 14) return false;

        // Check if all digits are the same
        if (/^(\d)\1{13}$/.test(cnpj)) return false;

        // Validate first digit
        let length = cnpj.length - 2;
        let numbers = cnpj.substring(0, length);
        const digits = cnpj.substring(length);
        let sum = 0;
        let pos = length - 7;

        for (let i = length; i >= 1; i--) {
            sum += parseInt(numbers.charAt(length - i)) * pos--;
            if (pos < 2) pos = 9;
        }

        let result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
        if (result !== parseInt(digits.charAt(0))) return false;

        // Validate second digit
        length = length + 1;
        numbers = cnpj.substring(0, length);
        sum = 0;
        pos = length - 7;

        for (let i = length; i >= 1; i--) {
            sum += parseInt(numbers.charAt(length - i)) * pos--;
            if (pos < 2) pos = 9;
        }

        result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
        if (result !== parseInt(digits.charAt(1))) return false;

        return true;
    },

    phone: (phone: string): boolean => {
        // Brazilian phone: (XX) XXXXX-XXXX or (XX) XXXX-XXXX
        const phoneRegex = /^\(\d{2}\)\s?\d{4,5}-?\d{4}$/;
        return phoneRegex.test(phone);
    }
};

// Input Masking Utilities

export const masks = {
    cpf: (value: string): string => {
        value = value.replace(/\D/g, '');
        value = value.substring(0, 11);
        value = value.replace(/(\d{3})(\d)/, '$1.$2');
        value = value.replace(/(\d{3})(\d)/, '$1.$2');
        value = value.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
        return value;
    },

    cnpj: (value: string): string => {
        value = value.replace(/\D/g, '');
        value = value.substring(0, 14);
        value = value.replace(/^(\d{2})(\d)/, '$1.$2');
        value = value.replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3');
        value = value.replace(/\.(\d{3})(\d)/, '.$1/$2');
        value = value.replace(/(\d{4})(\d)/, '$1-$2');
        return value;
    },

    phone: (value: string): string => {
        value = value.replace(/\D/g, '');
        value = value.substring(0, 11);
        value = value.replace(/^(\d{2})(\d)/g, '($1) $2');
        value = value.replace(/(\d)(\d{4})$/, '$1-$2');
        return value;
    },

    cep: (value: string): string => {
        value = value.replace(/\D/g, '');
        value = value.substring(0, 8);
        value = value.replace(/^(\d{5})(\d)/, '$1-$2');
        return value;
    },

    currency: (value: string): string => {
        value = value.replace(/\D/g, '');
        value = (parseInt(value) / 100).toFixed(2);
        value = value.replace('.', ',');
        value = value.replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.');
        return value;
    },

    date: (value: string): string => {
        value = value.replace(/\D/g, '');
        value = value.substring(0, 8);
        value = value.replace(/(\d{2})(\d)/, '$1/$2');
        value = value.replace(/(\d{2})(\d)/, '$1/$2');
        return value;
    }
};
