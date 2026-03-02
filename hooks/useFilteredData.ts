import { useMemo } from 'react';
import { useAppData } from '../context/AppDataContext';
import { useSelectedUnit } from '../context/UnitContext';

/**
 * useFilteredData — Unit-filtered data hook
 * 
 * Applies unit-level filtering to operational data.
 * Usage: replace useAppData() with useFilteredData() in pages that need unit filtering.
 * 
 * Filtered entities:
 *   - comandas (by unitId)
 *   - transactions (by unitId)
 *   - products (null unitId = global, shown in all)
 *   - services (null unitId = global, shown in all)
 *   - clients (derived: only those attended at the selected unit)
 *   - members (derived: only those assigned via unit_members)
 * 
 * Global (not filtered):
 *   - settings, permissions, notifications, etc.
 */
export function useFilteredData() {
    const data = useAppData();
    const { selectedUnitId } = useSelectedUnit();

    return useMemo(() => {
        // 'all' = no filtering, return everything
        if (selectedUnitId === 'all') return data;

        // Filter operational entities by unitId
        const filteredComandas = data.comandas.filter(c => c.unitId === selectedUnitId);
        const filteredTransactions = data.transactions.filter(t => (t as any).unitId === selectedUnitId);
        const filteredProducts = data.products.filter(p => !p.unitId || p.unitId === selectedUnitId);
        // Services: null unitId = global (show in all), specific unitId = unit-exclusive
        const filteredServices = data.services.filter(s => !s.unitId || s.unitId === selectedUnitId);

        // Derived: clients who have been attended at this unit (via comandas)
        const unitClientIds = new Set(filteredComandas.filter(c => c.clientId).map(c => c.clientId));
        const filteredClients = data.clients.filter(c => unitClientIds.has(c.id));

        // Derived: members assigned to this unit (via unit_members)
        const unitMemberUserIds = new Set(
            data.unitMembers
                .filter(um => um.unitId === selectedUnitId)
                .map(um => um.userId)
        );
        const filteredMembers = data.members.filter(m => unitMemberUserIds.has(m.id));

        return {
            ...data,
            comandas: filteredComandas,
            transactions: filteredTransactions,
            products: filteredProducts,
            services: filteredServices,
            clients: filteredClients,
            members: filteredMembers,
        };
    }, [data, selectedUnitId]);
}
