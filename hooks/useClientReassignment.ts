import { useEffect, useRef, useCallback, useState } from 'react';
import { useAppData } from '../context/AppDataContext';
import { useFilteredData } from './useFilteredData';
import { saveClient } from '../lib/dataService';
import { ClientUnitSettings, Client } from '../types';

const SETTINGS_KEY = 'client_unit_settings_v1';

const DEFAULT_SETTINGS: ClientUnitSettings = {
    autoReassignEnabled: true,
    reassignWindowDays: 60,
    reassignMinAppointments: 3,
    reassignThresholdPercent: 60,
    notifyOnReassign: true,
};

export function getClientUnitSettings(): ClientUnitSettings {
    try {
        const raw = localStorage.getItem(SETTINGS_KEY);
        if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    } catch { /* ignore */ }
    return { ...DEFAULT_SETTINGS };
}

export function saveClientUnitSettings(settings: ClientUnitSettings): void {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

/**
 * Hook that runs the client auto-reassignment logic.
 * Runs every 5 minutes (or on-demand).
 * 
 * Algorithm:
 * 1. For each client with unitId defined
 * 2. Get appointments from the last [reassignWindowDays] days
 * 3. Group by unitId of the appointment
 * 4. If the unit with most appointments != client's unitId:
 *    a. Count >= reassignMinAppointments?
 *    b. Percentage >= reassignThresholdPercent?
 *    c. If both YES -> update client.unitId
 */
export function useClientReassignment(
    onReassign?: (client: Client, fromUnit: string, toUnit: string) => void
) {
    const { clients, calendarEvents, setClients, refresh } = useAppData();
    const [lastRunResult, setLastRunResult] = useState<{
        checked: number;
        reassigned: number;
        timestamp: string;
    } | null>(null);

    const runReassignment = useCallback(async () => {
        const settings = getClientUnitSettings();
        if (!settings.autoReassignEnabled) return;

        const now = new Date();
        const windowStart = new Date(now);
        windowStart.setDate(windowStart.getDate() - settings.reassignWindowDays);

        // Filter appointments within the window
        const recentEvents = calendarEvents.filter(e => {
            if (!e.unitId) return false;
            const eventDate = new Date(e.year, e.month, e.date);
            return eventDate >= windowStart && eventDate <= now;
        });

        let reassignedCount = 0;
        const updatedClients: Client[] = [];

        for (const client of clients) {
            if (!client.unitId) continue; // Client not assigned to any unit

            // Get appointments for this client
            const clientEvents = recentEvents.filter(e =>
                e.client === client.id || e.client === client.name
            );

            if (clientEvents.length === 0) continue;

            // Group by unitId
            const unitCounts: Record<string, number> = {};
            for (const ev of clientEvents) {
                if (ev.unitId) {
                    unitCounts[ev.unitId] = (unitCounts[ev.unitId] || 0) + 1;
                }
            }

            // Find unit with most appointments
            let maxUnit = client.unitId;
            let maxCount = 0;
            for (const [unitId, count] of Object.entries(unitCounts)) {
                if (count > maxCount) {
                    maxCount = count;
                    maxUnit = unitId;
                }
            }

            // Check if different from current unit
            if (maxUnit === client.unitId) continue;

            // Check minimum appointments threshold
            if (maxCount < settings.reassignMinAppointments) continue;

            // Check percentage threshold
            const totalEvents = clientEvents.length;
            const percentage = (maxCount / totalEvents) * 100;
            if (percentage < settings.reassignThresholdPercent) continue;

            // All conditions met -- reassign
            const oldUnit = client.unitId;
            const updatedClient = { ...client, unitId: maxUnit };

            const result = await saveClient(updatedClient);
            if (result.success) {
                reassignedCount++;
                updatedClients.push(updatedClient);
                onReassign?.(updatedClient, oldUnit, maxUnit);
            }
        }

        if (reassignedCount > 0) {
            // Update local state
            setClients(clients.map(c => {
                const updated = updatedClients.find(u => u.id === c.id);
                return updated || c;
            }));
        }

        setLastRunResult({
            checked: clients.filter(c => !!c.unitId).length,
            reassigned: reassignedCount,
            timestamp: now.toISOString(),
        });
    }, [clients, calendarEvents, setClients, onReassign]);

    // Auto-run every 5 minutes
    useEffect(() => {
        const settings = getClientUnitSettings();
        if (!settings.autoReassignEnabled) return;

        // Initial run after 30 seconds (give data time to load)
        const initialTimeout = setTimeout(() => {
            runReassignment();
        }, 30_000);

        // Then every 5 minutes
        const interval = setInterval(() => {
            runReassignment();
        }, 5 * 60 * 1000);

        return () => {
            clearTimeout(initialTimeout);
            clearInterval(interval);
        };
    }, [runReassignment]);

    return {
        runReassignment,
        lastRunResult,
        settings: getClientUnitSettings(),
    };
}
