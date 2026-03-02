import React, { createContext, useContext, useState, useCallback, useMemo, ReactNode, useEffect } from 'react';
import { Unit } from '../types';
import { useAppData } from './AppDataContext';

interface UnitContextType {
    selectedUnitId: string; // 'all' | uuid
    setSelectedUnitId: (id: string) => void;
    selectedUnit: Unit | null;
    isFiltering: boolean;
    units: Unit[];
}

const UnitContext = createContext<UnitContextType | null>(null);

const STORAGE_KEY = 'vinnx_selected_unit';

export const UnitProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { units } = useAppData();

    const [selectedUnitId, setSelectedUnitIdState] = useState<string>(() => {
        try {
            return localStorage.getItem(STORAGE_KEY) || 'all';
        } catch {
            return 'all';
        }
    });

    const setSelectedUnitId = useCallback((id: string) => {
        setSelectedUnitIdState(id);
        try {
            localStorage.setItem(STORAGE_KEY, id);
        } catch { /* ignore */ }
    }, []);

    // If the selected unit was deleted, reset to 'all'
    useEffect(() => {
        if (selectedUnitId !== 'all' && units.length > 0) {
            const exists = units.some(u => u.id === selectedUnitId);
            if (!exists) {
                setSelectedUnitId('all');
            }
        }
    }, [units, selectedUnitId, setSelectedUnitId]);

    const selectedUnit = useMemo(() => {
        if (selectedUnitId === 'all') return null;
        return units.find(u => u.id === selectedUnitId) || null;
    }, [units, selectedUnitId]);

    const isFiltering = selectedUnitId !== 'all';

    const value = useMemo(() => ({
        selectedUnitId,
        setSelectedUnitId,
        selectedUnit,
        isFiltering,
        units,
    }), [selectedUnitId, setSelectedUnitId, selectedUnit, isFiltering, units]);

    return (
        <UnitContext.Provider value={value}>
            {children}
        </UnitContext.Provider>
    );
};

export const useSelectedUnit = () => {
    const context = useContext(UnitContext);
    if (!context) {
        throw new Error('useSelectedUnit must be used within a UnitProvider');
    }
    return context;
};
