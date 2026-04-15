import { useMemo } from 'react';
import { useAppData } from '../context/AppDataContext';
import { useSelectedUnit } from '../context/UnitContext';
import {
    Client, TeamMember, Service, CalendarEvent, Comanda,
    Product, Transaction
} from '../types';

/**
 * Hook that provides unit-filtered versions of all major data lists.
 * When selectedUnitId === 'all', returns all data (unfiltered).
 * When a specific unit is selected, filters each list by unitId.
 * Members are filtered via the unit_members N:N relationship.
 */
export function useFilteredData() {
    const {
        clients, members, services, calendarEvents,
        comandas, products, transactions, unitMembers,
    } = useAppData();

    const { selectedUnitId, isFiltering } = useSelectedUnit();

    // Members: Admin/Manager always global; others filtered via unit_members N:N table
    const filteredMembers = useMemo<TeamMember[]>(() => {
        if (!isFiltering) return members;
        const linkedUserIds = new Set(
            unitMembers
                .filter(um => um.unitId === selectedUnitId)
                .map(um => um.userId)
        );
        return members.filter(m => {
            // Admin and Manager always appear in all units
            if (m.role === 'Admin' || m.role === 'Manager') return true;
            // Others only if linked via unit_members
            return linkedUserIds.has(m.id);
        });
    }, [members, unitMembers, selectedUnitId, isFiltering]);

    // Clients: filtered by unitId field (no unitId = only visible in "Todas")
    const filteredClients = useMemo<Client[]>(() => {
        if (!isFiltering) return clients;
        return clients.filter(c => c.unitId === selectedUnitId);
    }, [clients, selectedUnitId, isFiltering]);

    // Services: filtered by unitId field
    const filteredServices = useMemo<Service[]>(() => {
        if (!isFiltering) return services;
        return services.filter(s => s.unitId === selectedUnitId || !s.unitId);
    }, [services, selectedUnitId, isFiltering]);

    // Calendar Events: filtered by unitId field
    const filteredCalendarEvents = useMemo<CalendarEvent[]>(() => {
        if (!isFiltering) return calendarEvents;
        return calendarEvents.filter(e => e.unitId === selectedUnitId || !e.unitId);
    }, [calendarEvents, selectedUnitId, isFiltering]);

    // Comandas: filtered by unitId field
    const filteredComandas = useMemo<Comanda[]>(() => {
        if (!isFiltering) return comandas;
        return comandas.filter(c => c.unitId === selectedUnitId || !c.unitId);
    }, [comandas, selectedUnitId, isFiltering]);

    // Products: filtered by unitId field
    const filteredProducts = useMemo<Product[]>(() => {
        if (!isFiltering) return products;
        return products.filter(p => p.unitId === selectedUnitId || !p.unitId);
    }, [products, selectedUnitId, isFiltering]);

    // Transactions: filtered by unitId field
    const filteredTransactions = useMemo<Transaction[]>(() => {
        if (!isFiltering) return transactions;
        return transactions.filter(t => t.unitId === selectedUnitId || !t.unitId);
    }, [transactions, selectedUnitId, isFiltering]);

    return {
        filteredMembers,
        filteredClients,
        filteredServices,
        filteredCalendarEvents,
        filteredComandas,
        filteredProducts,
        filteredTransactions,
        selectedUnitId,
        isFiltering,
    };
}
