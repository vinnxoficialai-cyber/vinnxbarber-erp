import React, { useState, useCallback, InputHTMLAttributes } from 'react';
import { CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { validators, masks } from '../utils/validators';
import { CustomDropdown } from './CustomDropdown';

type MaskType = 'cpf' | 'cnpj' | 'phone' | 'cep' | 'currency' | 'date' | 'none';
type ValidationType = 'email' | 'cpf' | 'cnpj' | 'phone' | 'required' | 'none';

interface FormInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
    label: string;
    error?: string;
    hint?: string;
    mask?: MaskType;
    validation?: ValidationType;
    showValidation?: boolean;
    isDarkMode?: boolean;
    onChange?: (value: string, isValid: boolean) => void;
}

export const FormInput: React.FC<FormInputProps> = ({
    label,
    error: externalError,
    hint,
    mask = 'none',
    validation = 'none',
    showValidation = true,
    isDarkMode = false,
    onChange,
    value,
    className,
    ...props
}) => {
    const [touched, setTouched] = useState(false);
    const [internalValue, setInternalValue] = useState(value?.toString() || '');
    const [isValid, setIsValid] = useState<boolean | null>(null);

    const applyMask = useCallback((val: string): string => {
        if (mask === 'none') return val;
        switch (mask) {
            case 'cpf': return masks.cpf(val);
            case 'cnpj': return masks.cnpj(val);
            case 'phone': return masks.phone(val);
            case 'cep': return masks.cep(val);
            case 'currency': return masks.currency(val);
            case 'date': return masks.date(val);
            default: return val;
        }
    }, [mask]);

    const validate = useCallback((val: string): boolean => {
        if (validation === 'none') return true;
        if (validation === 'required') return val.trim().length > 0;
        switch (validation) {
            case 'email': return validators.email(val);
            case 'cpf': return validators.cpf(val);
            case 'cnpj': return validators.cnpj(val);
            case 'phone': return validators.phone(val);
            default: return true;
        }
    }, [validation]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const rawValue = e.target.value;
        const maskedValue = applyMask(rawValue);
        setInternalValue(maskedValue);

        const valid = validate(maskedValue);
        setIsValid(valid);

        onChange?.(maskedValue, valid);
    };

    const handleBlur = () => {
        setTouched(true);
    };

    const displayValue = value !== undefined ? applyMask(value.toString()) : internalValue;
    const hasError = externalError || (touched && isValid === false);
    const showSuccess = touched && isValid === true && showValidation;

    // Styling classes
    const bgInput = isDarkMode ? 'bg-dark' : 'bg-white';
    const textMain = isDarkMode ? 'text-white' : 'text-slate-800';
    const textSub = isDarkMode ? 'text-slate-400' : 'text-slate-500';
    const borderDefault = isDarkMode ? 'border-dark-border' : 'border-slate-300';
    const borderError = 'border-rose-500 focus:ring-rose-500/20';
    const borderSuccess = 'border-emerald-500 focus:ring-emerald-500/20';

    const borderClass = hasError ? borderError : showSuccess ? borderSuccess : borderDefault;

    return (
        <div className={`space-y-1 ${className || ''}`}>
            <label className={`block text-xs font-medium ${textSub} mb-1`}>
                {label}
                {validation === 'required' && <span className="text-rose-500 ml-1">*</span>}
            </label>

            <div className="relative">
                <input
                    {...props}
                    value={displayValue}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    className={`
            w-full ${bgInput} border ${borderClass} rounded-lg p-2.5 pr-10 text-sm ${textMain}
            focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary
            transition-all duration-200
            placeholder:text-slate-400 dark:placeholder:text-slate-500
          `}
                />

                {/* Validation Icon */}
                {touched && showValidation && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        {isValid === true && <CheckCircle size={18} className="text-emerald-500" />}
                        {isValid === false && <XCircle size={18} className="text-rose-500" />}
                    </div>
                )}
            </div>

            {/* Error Message */}
            {hasError && (
                <p className="text-xs text-rose-500 flex items-center gap-1 mt-1">
                    <AlertCircle size={12} />
                    {externalError || (validation !== 'none' ? getValidationMessage(validation as Exclude<ValidationType, 'none'>) : 'Valor inválido')}
                </p>
            )}

            {/* Hint */}
            {hint && !hasError && (
                <p className={`text-xs ${textSub}`}>{hint}</p>
            )}
        </div>
    );
};

// Validation messages
function getValidationMessage(validation: Exclude<ValidationType, 'none'>): string {
    switch (validation) {
        case 'email': return 'E-mail inválido';
        case 'cpf': return 'CPF inválido';
        case 'cnpj': return 'CNPJ inválido';
        case 'phone': return 'Telefone inválido';
        case 'required': return 'Campo obrigatório';
        default: return 'Valor inválido';
    }
}

// Textarea variant
interface FormTextareaProps extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange'> {
    label: string;
    error?: string;
    hint?: string;
    isDarkMode?: boolean;
    onChange?: (value: string) => void;
}

export const FormTextarea: React.FC<FormTextareaProps> = ({
    label,
    error,
    hint,
    isDarkMode = false,
    onChange,
    value,
    className,
    ...props
}) => {
    const bgInput = isDarkMode ? 'bg-dark' : 'bg-white';
    const textMain = isDarkMode ? 'text-white' : 'text-slate-800';
    const textSub = isDarkMode ? 'text-slate-400' : 'text-slate-500';
    const borderClass = error
        ? 'border-rose-500 focus:ring-rose-500/20'
        : isDarkMode ? 'border-dark-border' : 'border-slate-300';

    return (
        <div className={`space-y-1 ${className || ''}`}>
            <label className={`block text-xs font-medium ${textSub} mb-1`}>{label}</label>

            <textarea
                {...props}
                value={value}
                onChange={(e) => onChange?.(e.target.value)}
                className={`
          w-full ${bgInput} border ${borderClass} rounded-lg p-2.5 text-sm ${textMain}
          focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary
          transition-all duration-200 resize-none
        `}
            />

            {error && (
                <p className="text-xs text-rose-500 flex items-center gap-1 mt-1">
                    <AlertCircle size={12} />
                    {error}
                </p>
            )}

            {hint && !error && (
                <p className={`text-xs ${textSub}`}>{hint}</p>
            )}
        </div>
    );
};

// Select variant
interface FormSelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> {
    label: string;
    options: { value: string; label: string }[];
    error?: string;
    hint?: string;
    isDarkMode?: boolean;
    onChange?: (value: string) => void;
}

export const FormSelect: React.FC<FormSelectProps> = ({
    label,
    options,
    error,
    hint,
    isDarkMode = false,
    onChange,
    value,
    className,
    ...props
}) => {
    const bgInput = isDarkMode ? 'bg-dark' : 'bg-white';
    const textMain = isDarkMode ? 'text-white' : 'text-slate-800';
    const textSub = isDarkMode ? 'text-slate-400' : 'text-slate-500';
    const borderClass = error
        ? 'border-rose-500 focus:ring-rose-500/20'
        : isDarkMode ? 'border-dark-border' : 'border-slate-300';

    return (
        <div className={`space-y-1 ${className || ''}`}>
            <label className={`block text-xs font-medium ${textSub} mb-1`}>{label}</label>

            <CustomDropdown
                value={value as string || ''}
                onChange={v => onChange?.(v)}
                options={options}
                isDarkMode={isDarkMode}
            />

            {error && (
                <p className="text-xs text-rose-500 flex items-center gap-1 mt-1">
                    <AlertCircle size={12} />
                    {error}
                </p>
            )}

            {hint && !error && (
                <p className={`text-xs ${textSub}`}>{hint}</p>
            )}
        </div>
    );
};
