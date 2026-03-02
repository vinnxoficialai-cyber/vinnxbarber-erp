import { supabase } from './supabase';

const BUCKET_NAME = 'avatars';

// Fixed paths for PWA icons — overwritten on each logo change
const PWA_ICON_PATHS = {
    any_192: 'public/pwa_icon_192.png',
    any_512: 'public/pwa_icon_512.png',
    maskable_192: 'public/pwa_icon_maskable_192.png',
    maskable_512: 'public/pwa_icon_maskable_512.png',
};

/**
 * Loads an image from a URL or base64 string into an HTMLImageElement
 */
function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = (e) => reject(new Error(`Failed to load image: ${e}`));
        img.src = src;
    });
}

/**
 * Renders the logo onto a canvas at the given size.
 * For "any" icons: logo centered on transparent background.
 * For "maskable" icons: logo centered with safe-zone padding on a solid background.
 *
 * Maskable icons need ~20% padding (10% on each side) because the OS crops them.
 * The safe zone is the inner 80% of the icon.
 */
function renderIcon(
    img: HTMLImageElement,
    size: number,
    maskable: boolean,
    bgColor: string = '#0f172a'
): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    if (maskable) {
        // Fill background (matches theme_color from manifest)
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, size, size);

        // Logo in the safe zone (inner 60% for good visual padding)
        const padding = size * 0.2; // 20% padding on each side = 60% logo area
        const logoArea = size - padding * 2;

        // Scale logo proportionally to fit within the safe zone
        const scale = Math.min(logoArea / img.width, logoArea / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        const x = (size - w) / 2;
        const y = (size - h) / 2;

        ctx.drawImage(img, x, y, w, h);
    } else {
        // "any" icon: transparent background, logo fills most of the space
        const padding = size * 0.05; // 5% margin
        const logoArea = size - padding * 2;

        const scale = Math.min(logoArea / img.width, logoArea / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        const x = (size - w) / 2;
        const y = (size - h) / 2;

        ctx.drawImage(img, x, y, w, h);
    }

    return canvas;
}

/**
 * Converts a canvas to a PNG Blob
 */
function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
    return new Promise((resolve, reject) => {
        canvas.toBlob(
            (blob) => {
                if (blob) resolve(blob);
                else reject(new Error('Canvas toBlob failed'));
            },
            'image/png',
            1.0
        );
    });
}

/**
 * Uploads a Blob to Supabase Storage at a fixed path (upsert)
 */
async function uploadBlob(blob: Blob, filePath: string): Promise<string | null> {
    const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(filePath, blob, {
            contentType: 'image/png',
            cacheControl: '0', // No cache — always fresh
            upsert: true,
        });

    if (error) {
        console.error(`[PWA Icons] Upload error for ${filePath}:`, error);
        return null;
    }

    const { data: publicUrl } = supabase.storage
        .from(BUCKET_NAME)
        .getPublicUrl(data.path);

    return publicUrl.publicUrl;
}

/**
 * Main function: generates 4 PWA icon variants from the company logo
 * and uploads them to fixed Supabase Storage paths.
 *
 * Returns the public URLs of the generated icons, or null if failed.
 */
export async function generateAndUploadPWAIcons(
    logoSrc: string,
    bgColor: string = '#0f172a'
): Promise<{ any192: string; any512: string; maskable192: string; maskable512: string } | null> {
    try {
        console.log('[PWA Icons] Generating icons from logo...');
        const img = await loadImage(logoSrc);

        // Generate 4 variants
        const [any192, any512, maskable192, maskable512] = await Promise.all([
            canvasToBlob(renderIcon(img, 192, false)),
            canvasToBlob(renderIcon(img, 512, false)),
            canvasToBlob(renderIcon(img, 192, true, bgColor)),
            canvasToBlob(renderIcon(img, 512, true, bgColor)),
        ]);

        // Upload all 4 to fixed paths
        const [url192, url512, urlMask192, urlMask512] = await Promise.all([
            uploadBlob(any192, PWA_ICON_PATHS.any_192),
            uploadBlob(any512, PWA_ICON_PATHS.any_512),
            uploadBlob(maskable192, PWA_ICON_PATHS.maskable_192),
            uploadBlob(maskable512, PWA_ICON_PATHS.maskable_512),
        ]);

        if (!url192 || !url512 || !urlMask192 || !urlMask512) {
            console.error('[PWA Icons] Some uploads failed');
            return null;
        }

        console.log('[PWA Icons] All 4 icons generated and uploaded successfully');
        return {
            any192: url192,
            any512: url512,
            maskable192: urlMask192,
            maskable512: urlMask512,
        };
    } catch (err) {
        console.error('[PWA Icons] Generation failed:', err);
        return null;
    }
}

/**
 * Returns the fixed public URLs for PWA icons (predictable, doesn't require DB lookup)
 */
export function getPWAIconUrls(supabaseUrl: string): {
    any192: string; any512: string;
    maskable192: string; maskable512: string;
} {
    const base = `${supabaseUrl}/storage/v1/object/public/${BUCKET_NAME}`;
    return {
        any192: `${base}/${PWA_ICON_PATHS.any_192}`,
        any512: `${base}/${PWA_ICON_PATHS.any_512}`,
        maskable192: `${base}/${PWA_ICON_PATHS.maskable_192}`,
        maskable512: `${base}/${PWA_ICON_PATHS.maskable_512}`,
    };
}
