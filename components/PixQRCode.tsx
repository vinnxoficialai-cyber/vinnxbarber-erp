import React, { useRef, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { generatePixPayload, isValidPixKey } from '../lib/pixGenerator';
import { Copy, Check, AlertCircle } from 'lucide-react';

interface PixQRCodeProps {
    pixKey: string;
    amount: number;
    recipientName: string;
    description?: string;
    transactionId?: string;
    isDarkMode?: boolean;
    size?: number;
    showCopyButton?: boolean;
}

export const PixQRCode: React.FC<PixQRCodeProps> = ({
    pixKey,
    amount,
    recipientName,
    description,
    transactionId,
    isDarkMode = false,
    size = 200,
    showCopyButton = true
}) => {
    const [copied, setCopied] = React.useState(false);
    const qrRef = useRef<HTMLDivElement>(null);

    // Generate PIX payload
    const pixPayload = React.useMemo(() => {
        if (!pixKey || !isValidPixKey(pixKey)) return null;

        return generatePixPayload({
            pixKey,
            merchantName: recipientName,
            amount,
            description,
            transactionId
        });
    }, [pixKey, amount, recipientName, description, transactionId]);

    // Copy PIX code to clipboard
    const handleCopy = useCallback(async () => {
        if (!pixPayload) return;

        try {
            await navigator.clipboard.writeText(pixPayload);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    }, [pixPayload]);

    // Invalid PIX key
    if (!pixKey || !isValidPixKey(pixKey)) {
        return (
            <div className={`flex flex-col items-center justify-center p-6 rounded-xl border-2 border-dashed ${isDarkMode ? 'border-dark-border bg-dark-surface/50' : 'border-slate-200 bg-slate-50'}`}>
                <AlertCircle className="text-amber-500 mb-2" size={32} />
                <p className={`text-sm font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                    Chave PIX inválida ou não configurada
                </p>
                <p className={`text-xs mt-1 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                    Configure a chave PIX no perfil do colaborador
                </p>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center gap-4">
            {/* QR Code Container */}
            <div
                ref={qrRef}
                className={`p-4 rounded-xl ${isDarkMode ? 'bg-white' : 'bg-white'} shadow-lg`}
            >
                <QRCodeSVG
                    value={pixPayload || ''}
                    size={size}
                    level="M"
                    includeMargin={true}
                    bgColor="#ffffff"
                    fgColor="#000000"
                />
            </div>

            {/* Amount Display */}
            <div className={`text-center ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                <p className="text-xs uppercase tracking-wide opacity-70">Valor a Pagar</p>
                <p className="text-2xl font-bold text-primary">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount)}
                </p>
            </div>

            {/* Copy Button */}
            {showCopyButton && (
                <button
                    onClick={handleCopy}
                    className={`
                        flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all
                        ${copied
                            ? 'bg-emerald-500 text-white'
                            : isDarkMode
                                ? 'bg-dark-surface border border-dark-border text-slate-300 hover:border-primary hover:text-primary'
                                : 'bg-white border border-slate-200 text-slate-600 hover:border-primary hover:text-primary'
                        }
                    `}
                >
                    {copied ? (
                        <>
                            <Check size={16} />
                            Copiado!
                        </>
                    ) : (
                        <>
                            <Copy size={16} />
                            Copiar código PIX
                        </>
                    )}
                </button>
            )}

            {/* PIX Key Display */}
            <p className={`text-xs ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                PIX: {pixKey}
            </p>
        </div>
    );
};

export default PixQRCode;
