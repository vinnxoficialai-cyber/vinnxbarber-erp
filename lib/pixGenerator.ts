/**
 * PIX EMV Payload Generator
 * Generates PIX payment QR code data following Brazilian Central Bank BR Code standard
 * Reference: Manual de Padrões para Iniciação do Pix v2.8.0 (BACEN)
 * EMV® QR Code Specification for Payment Systems - Merchant Presented Mode
 */

/**
 * CRC16-CCITT (0xFFFF) calculation for PIX payload
 * Polynomial: 0x1021, Initial: 0xFFFF
 */
function crc16CCITT(str: string): string {
    let crc = 0xFFFF;
    const polynomial = 0x1021;

    for (let i = 0; i < str.length; i++) {
        crc ^= (str.charCodeAt(i) << 8);
        for (let j = 0; j < 8; j++) {
            if ((crc & 0x8000) !== 0) {
                crc = ((crc << 1) ^ polynomial) & 0xFFFF;
            } else {
                crc = (crc << 1) & 0xFFFF;
            }
        }
    }

    return (crc & 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
}

/**
 * Format EMV TLV field: ID(2 digits) + Length(2 digits) + Value
 */
function formatField(id: string, value: string): string {
    const length = value.length.toString().padStart(2, '0');
    return `${id}${length}${value}`;
}

/**
 * Remove accents/diacritics and non-ASCII characters for PIX payload compatibility.
 * PIX payload must contain only ASCII characters.
 */
function sanitizeForPix(str: string): string {
    return str
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove combining diacritical marks
        .replace(/[^\x20-\x7E]/g, '')    // Remove any remaining non-ASCII
        .trim();
}

/**
 * Detect PIX key type based on format
 */
function detectPixKeyType(key: string): 'CPF' | 'CNPJ' | 'EMAIL' | 'PHONE' | 'EVP' {
    const cleanKey = key.replace(/[\s.\-\/()]/g, '');

    // CPF: exactly 11 digits
    if (/^\d{11}$/.test(cleanKey)) return 'CPF';

    // CNPJ: exactly 14 digits
    if (/^\d{14}$/.test(cleanKey)) return 'CNPJ';

    // Phone: +55 followed by DDD(2) + number(8-9)
    if (/^\+?55\d{10,11}$/.test(cleanKey) || /^\d{10,11}$/.test(cleanKey)) return 'PHONE';

    // Email
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(key.trim())) return 'EMAIL';

    // EVP (Endereço Virtual de Pagamento) - UUID v4 format
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key.trim())) return 'EVP';

    // Default to EVP for unknown formats
    return 'EVP';
}

/**
 * Format PIX key correctly for the payload.
 * Phone keys MUST have +55 prefix per BACEN spec.
 * CPF/CNPJ must be digits only (no formatting).
 * Email must be lowercase.
 * EVP (UUID) must be lowercase.
 */
function formatPixKey(key: string, type: string): string {
    const cleanKey = key.replace(/[\s.\-\/()]/g, '');

    switch (type) {
        case 'PHONE': {
            // Must always include country code +55
            if (cleanKey.startsWith('+55')) return cleanKey;
            if (cleanKey.startsWith('55') && cleanKey.length >= 12) return `+${cleanKey}`;
            return `+55${cleanKey}`;
        }
        case 'CPF':
        case 'CNPJ':
            return cleanKey; // Digits only
        case 'EMAIL':
            return key.trim().toLowerCase();
        case 'EVP':
            return key.trim().toLowerCase();
        default:
            return key.trim();
    }
}

export interface PixPayloadOptions {
    pixKey: string;
    merchantName: string;
    merchantCity?: string;
    amount?: number;
    transactionId?: string;
    description?: string;
}

/**
 * Generate PIX EMV payload for QR Code (BR Code Static)
 * 
 * Payload structure (field IDs):
 *   00 - Payload Format Indicator (fixed "01")
 *   01 - Point of Initiation Method ("11" = static, "12" = dynamic/single-use)
 *   26 - Merchant Account Information (contains PIX key + GUI)
 *     26.00 - GUI: "br.gov.bcb.pix"
 *     26.01 - PIX Key (chave)
 *     26.02 - Description (optional, max 25 chars)
 *   52 - Merchant Category Code (MCC, "0000" = not specified)
 *   53 - Transaction Currency ("986" = BRL)
 *   54 - Transaction Amount (optional for static, format: "0.00")
 *   58 - Country Code ("BR")
 *   59 - Merchant Name (max 25 chars, ASCII only)
 *   60 - Merchant City (max 15 chars, ASCII only)
 *   62 - Additional Data Field Template
 *     62.05 - Reference Label / TXID (mandatory: "***" if not specified for static)
 *   63 - CRC16 (always last field)
 */
export function generatePixPayload(options: PixPayloadOptions): string {
    const {
        pixKey,
        merchantName,
        merchantCity = 'SAO PAULO',
        amount,
        transactionId,
        description
    } = options;

    // Detect key type and format appropriately
    const keyType = detectPixKeyType(pixKey);
    const formattedKey = formatPixKey(pixKey, keyType);

    let payload = '';

    // ID 00 - Payload Format Indicator (mandatory, fixed "01")
    payload += formatField('00', '01');

    // ID 01 - Point of Initiation Method
    // "11" = static QR (reusable), "12" = dynamic QR (intended for single use)
    // We are generating a Static QR Code (offline, based on Key), so it must always be "11"
    payload += formatField('01', '11');

    // ID 26 - Merchant Account Information (PIX specific)
    let merchantAccount = '';
    // Subcampo 00 - GUI (Globally Unique Identifier for PIX)
    merchantAccount += formatField('00', 'br.gov.bcb.pix');
    // Subcampo 01 - Chave PIX
    merchantAccount += formatField('01', formattedKey);
    // Subcampo 02 - Description REMOVED for better compatibility (often causes issues in static QRs)
    payload += formatField('26', merchantAccount);

    // ID 52 - Merchant Category Code (MCC) - "0000" = não informado
    payload += formatField('52', '0000');

    // ID 53 - Transaction Currency - "986" = BRL (ISO 4217)
    payload += formatField('53', '986');

    // ID 54 - Transaction Amount (optional, decimal with dot separator)
    if (amount && amount > 0) {
        const amountStr = amount.toFixed(2);
        payload += formatField('54', amountStr);
    }

    // ID 58 - Country Code - "BR"
    payload += formatField('58', 'BR');

    // ID 59 - Merchant Name (max 25 chars, ASCII, uppercase)
    const cleanName = sanitizeForPix(merchantName).substring(0, 25).toUpperCase();
    payload += formatField('59', cleanName || 'PAGAMENTO');

    // ID 60 - Merchant City (max 15 chars, ASCII, uppercase)
    const cleanCity = sanitizeForPix(merchantCity).substring(0, 15).toUpperCase();
    payload += formatField('60', cleanCity || 'SAO PAULO');

    // ID 62 - Additional Data Field Template (MANDATORY per BR Code spec)
    // Subcampo 05 - Reference Label / TXID
    // For static QR: "***" means no TXID defined (BACEN convention)
    // For static QR with custom TXID: max 25 chars, alphanumeric only
    let additionalData = '';
    if (transactionId && transactionId.trim().length > 0) {
        // Clean transaction ID: only alphanumeric, max 25 chars
        const cleanTxId = transactionId.replace(/[^a-zA-Z0-9]/g, '').substring(0, 25);
        additionalData += formatField('05', cleanTxId || '***');
    } else {
        // MANDATORY: use "***" to indicate no TXID defined
        additionalData += formatField('05', '***');
    }
    payload += formatField('62', additionalData);

    // ID 63 - CRC16 (MUST be the last field)
    // Append the CRC field ID "63" and length "04", then compute CRC over entire payload
    payload += '6304';
    const crc = crc16CCITT(payload);
    payload += crc;

    return payload;
}

/**
 * Generate copy-paste PIX code (same as QR payload for static codes)
 */
export function generatePixCopyPaste(options: PixPayloadOptions): string {
    return generatePixPayload(options);
}

/**
 * Validate PIX key format
 */
export function isValidPixKey(key: string): boolean {
    if (!key || key.trim() === '') return false;

    const cleanKey = key.replace(/[\s.\-\/()]/g, '');

    // CPF: 11 digits
    if (/^\d{11}$/.test(cleanKey)) return true;

    // CNPJ: 14 digits
    if (/^\d{14}$/.test(cleanKey)) return true;

    // Phone: with or without +55, 10-11 digit number
    if (/^(\+?55)?\d{10,11}$/.test(cleanKey)) return true;

    // Email
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(key.trim())) return true;

    // EVP (UUID v4)
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key.trim())) return true;

    return false;
}
