import { useEffect } from 'react';
import { useAppData } from '../context/AppDataContext';

/**
 * Hook that dynamically updates the browser favicon based on the company logo.
 * Uses the logo from app_settings.company.logo
 */
export function useDynamicFavicon() {
    const { settings } = useAppData();

    useEffect(() => {
        const logoUrl = settings?.company?.logo;
        if (logoUrl) {
            updateFavicon(logoUrl);
        }

        // Also update the document title (centralized here)
        const companyName = settings?.company?.name;
        if (companyName) {
            document.title = companyName;
        }
    }, [settings?.company?.logo, settings?.company?.name]);
}

/**
 * Updates the browser favicon to the specified URL
 */
export function updateFavicon(url: string) {
    // Remove existing favicons
    const existingLinks = document.querySelectorAll("link[rel*='icon']");
    existingLinks.forEach(link => link.remove());

    // Create new favicon link
    const link = document.createElement('link');
    link.type = 'image/x-icon';
    link.rel = 'icon';
    link.href = url;

    // Also set as shortcut icon for older browsers
    const shortcutLink = document.createElement('link');
    shortcutLink.rel = 'shortcut icon';
    shortcutLink.href = url;

    // Append to head
    document.head.appendChild(link);
    document.head.appendChild(shortcutLink);

    // Also try to set apple-touch-icon for mobile
    const appleLink = document.createElement('link');
    appleLink.rel = 'apple-touch-icon';
    appleLink.href = url;
    document.head.appendChild(appleLink);
}
