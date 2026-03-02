/**
 * Weather Service — Open-Meteo API (free, no API key)
 * Uses browser geolocation with fallback
 */

interface WeatherData {
    temperature: number;
    weatherCode: number;
    cityName: string;
    description: string;
    icon: string; // emoji-like identifier
    isDay: boolean;
}

// WMO Weather Codes → descriptions + icons
const WEATHER_CODES: Record<number, { desc: string; iconDay: string; iconNight: string }> = {
    0: { desc: 'Céu limpo', iconDay: '☀️', iconNight: '🌙' },
    1: { desc: 'Predominantemente limpo', iconDay: '🌤️', iconNight: '🌙' },
    2: { desc: 'Parcialmente nublado', iconDay: '⛅', iconNight: '☁️' },
    3: { desc: 'Nublado', iconDay: '☁️', iconNight: '☁️' },
    45: { desc: 'Neblina', iconDay: '🌫️', iconNight: '🌫️' },
    48: { desc: 'Geada', iconDay: '🌫️', iconNight: '🌫️' },
    51: { desc: 'Garoa leve', iconDay: '🌦️', iconNight: '🌧️' },
    53: { desc: 'Garoa moderada', iconDay: '🌦️', iconNight: '🌧️' },
    55: { desc: 'Garoa forte', iconDay: '🌧️', iconNight: '🌧️' },
    61: { desc: 'Chuva leve', iconDay: '🌦️', iconNight: '🌧️' },
    63: { desc: 'Chuva moderada', iconDay: '🌧️', iconNight: '🌧️' },
    65: { desc: 'Chuva forte', iconDay: '🌧️', iconNight: '🌧️' },
    71: { desc: 'Neve leve', iconDay: '🌨️', iconNight: '🌨️' },
    73: { desc: 'Neve moderada', iconDay: '🌨️', iconNight: '🌨️' },
    75: { desc: 'Neve forte', iconDay: '❄️', iconNight: '❄️' },
    80: { desc: 'Pancadas leves', iconDay: '🌦️', iconNight: '🌧️' },
    81: { desc: 'Pancadas moderadas', iconDay: '🌧️', iconNight: '🌧️' },
    82: { desc: 'Pancadas fortes', iconDay: '⛈️', iconNight: '⛈️' },
    95: { desc: 'Trovoada', iconDay: '⛈️', iconNight: '⛈️' },
    96: { desc: 'Trovoada com granizo', iconDay: '⛈️', iconNight: '⛈️' },
    99: { desc: 'Trovoada forte', iconDay: '⛈️', iconNight: '⛈️' },
};

function getWeatherInfo(code: number, isDay: boolean) {
    const info = WEATHER_CODES[code] || WEATHER_CODES[3];
    return {
        description: info.desc,
        icon: isDay ? info.iconDay : info.iconNight,
    };
}

/**
 * Get user coordinates via browser Geolocation API
 */
function getUserCoordinates(): Promise<{ lat: number; lon: number }> {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error('Geolocation not supported'));
            return;
        }
        navigator.geolocation.getCurrentPosition(
            pos => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
            err => reject(err),
            { timeout: 8000, enableHighAccuracy: false }
        );
    });
}

/**
 * Reverse geocode coordinates to city name via Nominatim (OpenStreetMap)
 */
async function reverseGeocode(lat: number, lon: number): Promise<string> {
    try {
        const resp = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=pt`,
            { headers: { 'User-Agent': 'VinnxBarberERP/1.0' } }
        );
        if (!resp.ok) return 'Localização atual';
        const data = await resp.json();
        const addr = data.address;
        if (addr) {
            const city = addr.city || addr.town || addr.village || addr.municipality || '';
            const state = addr.state || '';
            if (city && state) return `${city}, ${state}`;
            if (city) return city;
        }
        return data.display_name?.split(',')[0] || 'Localização atual';
    } catch {
        return 'Localização atual';
    }
}

/**
 * Get city name coordinates via Open-Meteo Geocoding
 */
async function geocodeCity(cityName: string): Promise<{ lat: number; lon: number; name: string } | null> {
    try {
        const resp = await fetch(
            `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityName)}&count=1&language=pt`
        );
        if (!resp.ok) return null;
        const data = await resp.json();
        if (data.results && data.results.length > 0) {
            const r = data.results[0];
            return { lat: r.latitude, lon: r.longitude, name: r.admin1 ? `${r.name}, ${r.admin1}` : r.name };
        }
        return null;
    } catch {
        return null;
    }
}

/**
 * Fetch current weather from Open-Meteo
 */
async function fetchWeather(lat: number, lon: number): Promise<Omit<WeatherData, 'cityName'>> {
    const resp = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`
    );
    if (!resp.ok) throw new Error('Weather API error');
    const data = await resp.json();
    const cw = data.current_weather;
    const isDay = cw.is_day === 1;
    const info = getWeatherInfo(cw.weathercode, isDay);
    return {
        temperature: Math.round(cw.temperature),
        weatherCode: cw.weathercode,
        description: info.description,
        icon: info.icon,
        isDay,
    };
}

/**
 * Main function: Get weather data with geolocation or fallback city
 */
export async function getWeatherData(fallbackCity?: string): Promise<WeatherData | null> {
    try {
        // Try browser geolocation first
        let lat: number, lon: number, cityName: string;

        try {
            const coords = await getUserCoordinates();
            lat = coords.lat;
            lon = coords.lon;
            cityName = await reverseGeocode(lat, lon);
        } catch {
            // Fallback to configured city
            if (fallbackCity) {
                const geo = await geocodeCity(fallbackCity);
                if (!geo) return null;
                lat = geo.lat;
                lon = geo.lon;
                cityName = geo.name;
            } else {
                // Default to São Paulo
                lat = -23.55;
                lon = -46.63;
                cityName = 'São Paulo, SP';
            }
        }

        const weather = await fetchWeather(lat, lon);
        return { ...weather, cityName };
    } catch {
        return null;
    }
}
