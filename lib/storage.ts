import { supabase } from './supabase';

// Storage bucket name
const BUCKET_NAME = 'avatars';

/**
 * Upload de imagem para Supabase Storage
 * @param file - Arquivo da imagem
 * @param folder - Pasta dentro do bucket (ex: 'team', 'clients')
 * @param fileName - Nome do arquivo (opcional, usa timestamp se não fornecido)
 * @returns URL pública da imagem ou null se falhar
 */
export async function uploadImage(
    file: File,
    folder: string = 'general',
    fileName?: string
): Promise<string | null> {
    try {
        // Gera nome único se não fornecido
        const finalFileName = fileName || `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
        const filePath = `${folder}/${finalFileName}`;

        // Faz upload
        const { data, error } = await supabase.storage
            .from(BUCKET_NAME)
            .upload(filePath, file, {
                cacheControl: '3600',
                upsert: true, // Sobrescreve se existir
            });

        if (error) {
            console.error('Erro no upload:', error);
            return null;
        }

        // Retorna URL pública
        const { data: publicUrl } = supabase.storage
            .from(BUCKET_NAME)
            .getPublicUrl(data.path);

        return publicUrl.publicUrl;
    } catch (err) {
        console.error('Erro no upload:', err);
        return null;
    }
}

/**
 * Upload de imagem a partir de base64
 * @param base64 - String base64 da imagem (data:image/...;base64,...)
 * @param folder - Pasta dentro do bucket
 * @param fileName - Nome do arquivo
 * @returns URL pública da imagem ou null se falhar
 */
export async function uploadBase64Image(
    base64: string,
    folder: string = 'general',
    fileName?: string
): Promise<string | null> {
    try {
        // Extrai tipo e dados do base64
        const matches = base64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (!matches || matches.length !== 3) {
            console.error('Formato base64 inválido');
            return null;
        }

        const mimeType = matches[1];
        const base64Data = matches[2];

        // Converte base64 para Blob
        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: mimeType });

        // Determina extensão
        const extension = mimeType.split('/')[1] || 'png';
        const finalFileName = fileName || `${Date.now()}.${extension}`;
        const filePath = `${folder}/${finalFileName}`;

        // Faz upload
        const { data, error } = await supabase.storage
            .from(BUCKET_NAME)
            .upload(filePath, blob, {
                contentType: mimeType,
                cacheControl: '3600',
                upsert: true,
            });

        if (error) {
            console.error('Erro no upload base64:', error);
            return null;
        }

        // Retorna URL pública
        const { data: publicUrl } = supabase.storage
            .from(BUCKET_NAME)
            .getPublicUrl(data.path);

        return publicUrl.publicUrl;
    } catch (err) {
        console.error('Erro no upload base64:', err);
        return null;
    }
}

/**
 * Deleta imagem do Storage
 * @param url - URL pública da imagem
 * @returns true se deletou, false se falhou
 */
export async function deleteImage(url: string): Promise<boolean> {
    try {
        // Extrai path da URL
        const bucketPath = url.split(`${BUCKET_NAME}/`)[1];
        if (!bucketPath) return false;

        const { error } = await supabase.storage
            .from(BUCKET_NAME)
            .remove([bucketPath]);

        return !error;
    } catch (err) {
        console.error('Erro ao deletar imagem:', err);
        return false;
    }
}

/**
 * Verifica se a string é uma URL (não base64)
 */
export function isUrl(str: string): boolean {
    return str.startsWith('http://') || str.startsWith('https://');
}

/**
 * Verifica se a string é base64
 */
export function isBase64(str: string): boolean {
    return str.startsWith('data:image/');
}
