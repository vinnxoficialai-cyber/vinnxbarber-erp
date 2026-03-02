import React, { useState, useEffect, useRef, useLayoutEffect, useCallback } from 'react';
import { Building2, ChevronDown, Globe, Check } from 'lucide-react';
import { useSelectedUnit } from '../context/UnitContext';

interface UnitSelectorProps {
    isDarkMode: boolean;
}

const STATUS_DOT: Record<string, string> = {
    active: 'bg-emerald-500',
    inactive: 'bg-red-500',
    opening: 'bg-blue-500',
};

export const UnitSelector: React.FC<UnitSelectorProps> = ({ isDarkMode }) => {
    const { selectedUnitId, setSelectedUnitId, units } = useSelectedUnit();
    const [open, setOpen] = useState(false);
    const [transitioning, setTransitioning] = useState(false);

    // Refs for sliding pill indicator
    const containerRef = useRef<HTMLDivElement>(null);
    const buttonRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
    const [pillStyle, setPillStyle] = useState<{ left: number; width: number }>({ left: 0, width: 0 });
    const [pillReady, setPillReady] = useState(false);

    const setButtonRef = useCallback((id: string, el: HTMLButtonElement | null) => {
        if (el) {
            buttonRefs.current.set(id, el);
        } else {
            buttonRefs.current.delete(id);
        }
    }, []);

    // Measure and update pill indicator position
    const updatePillPosition = useCallback(() => {
        const container = containerRef.current;
        const btn = buttonRefs.current.get(selectedUnitId);
        if (!container || !btn) return;

        const containerRect = container.getBoundingClientRect();
        const btnRect = btn.getBoundingClientRect();

        setPillStyle({
            left: btnRect.left - containerRect.left,
            width: btnRect.width,
        });

        if (!pillReady) {
            // First render: skip animation
            requestAnimationFrame(() => setPillReady(true));
        }
    }, [selectedUnitId, pillReady]);

    useLayoutEffect(() => {
        updatePillPosition();
    }, [updatePillPosition]);

    // Re-measure on window resize
    useEffect(() => {
        window.addEventListener('resize', updatePillPosition);
        return () => window.removeEventListener('resize', updatePillPosition);
    }, [updatePillPosition]);

    // Close dropdown on outside click
    useEffect(() => {
        if (!open) return;
        const handler = () => setOpen(false);
        document.addEventListener('click', handler);
        return () => document.removeEventListener('click', handler);
    }, [open]);

    // No units → don't render
    if (units.length === 0) return null;

    const activeUnits = units.filter(u => u.status !== 'inactive');
    const usePills = activeUnits.length <= 3;

    const handleSelect = (id: string) => {
        if (id === selectedUnitId) return;
        setTransitioning(true);
        setSelectedUnitId(id);
        setOpen(false);
        setTimeout(() => setTransitioning(false), 300);
    };

    const selectedLabel = selectedUnitId === 'all'
        ? 'Todas'
        : (units.find(u => u.id === selectedUnitId)?.tradeName || units.find(u => u.id === selectedUnitId)?.name || 'Unidade');

    // ═══ PILL MODE (≤3 units) ═══
    if (usePills) {
        return (
            <div className="flex items-center relative">
                <div
                    ref={containerRef}
                    className={`flex items-center p-0.5 rounded-full relative ${isDarkMode ? 'bg-white/[0.06] border border-white/[0.08]' : 'bg-slate-100 border border-slate-200/80'}`}
                >
                    {/* Sliding pill indicator */}
                    <div
                        className={`absolute top-0.5 bottom-0.5 rounded-full ${isDarkMode ? 'bg-white/[0.12] shadow-sm' : 'bg-white shadow-sm'}`}
                        style={{
                            left: pillStyle.left,
                            width: pillStyle.width,
                            transition: pillReady ? 'left 0.35s cubic-bezier(0.4, 0, 0.2, 1), width 0.35s cubic-bezier(0.4, 0, 0.2, 1)' : 'none',
                        }}
                    />

                    {/* "Todas" pill */}
                    <button
                        ref={(el) => setButtonRef('all', el)}
                        onClick={() => handleSelect('all')}
                        className={`relative z-[1] px-3 py-1.5 rounded-full text-[11px] font-semibold transition-colors duration-200 flex items-center gap-1.5 whitespace-nowrap ${selectedUnitId === 'all'
                            ? `${isDarkMode ? 'text-white' : 'text-slate-900'}`
                            : `${isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`
                            }`}
                    >
                        <Globe size={11} />
                        Todas
                    </button>

                    {/* Unit pills */}
                    {activeUnits.map(u => (
                        <button
                            key={u.id}
                            ref={(el) => setButtonRef(u.id, el)}
                            onClick={() => handleSelect(u.id)}
                            className={`relative z-[1] px-3 py-1.5 rounded-full text-[11px] font-semibold transition-colors duration-200 flex items-center gap-1.5 whitespace-nowrap ${selectedUnitId === u.id
                                ? `${isDarkMode ? 'text-white' : 'text-slate-900'}`
                                : `${isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`
                                }`}
                            title={u.name}
                        >
                            <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[u.status] || 'bg-slate-400'}`} />
                            {u.tradeName || u.name}
                        </button>
                    ))}
                </div>
            </div>
        );
    }

    // ═══ DROPDOWN MODE (>3 units or mobile) ═══
    return (
        <div className="relative" onClick={e => e.stopPropagation()}>
            {/* Shimmer overlay */}
            {transitioning && (
                <div className="absolute inset-0 z-10 rounded-lg overflow-hidden">
                    <div className={`absolute inset-0 ${isDarkMode ? 'bg-slate-700/30' : 'bg-slate-200/50'} animate-pulse rounded-lg`} />
                </div>
            )}

            {/* Trigger */}
            <button
                onClick={() => setOpen(!open)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all border ${isDarkMode
                    ? 'bg-white/[0.06] border-white/[0.08] text-slate-200 hover:border-white/20'
                    : 'bg-slate-100 border-slate-200/80 text-slate-700 hover:border-slate-300'
                    } ${open ? (isDarkMode ? 'ring-1 ring-white/10 border-white/20' : 'ring-1 ring-slate-300 border-slate-300') : ''}`}
            >
                <Building2 size={13} className={isDarkMode ? 'text-slate-400' : 'text-slate-500'} />
                {selectedUnitId !== 'all' && (
                    <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[units.find(u => u.id === selectedUnitId)?.status || ''] || 'bg-slate-400'}`} />
                )}
                <span className="max-w-[120px] truncate">{selectedLabel}</span>
                <ChevronDown size={12} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown */}
            {open && (
                <div className={`absolute top-full right-0 mt-1 min-w-[200px] rounded-xl border shadow-xl z-50 py-1 ${isDarkMode ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-slate-200'
                    }`}>
                    {/* "Todas" option */}
                    <button
                        onClick={() => handleSelect('all')}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs transition-colors ${selectedUnitId === 'all'
                            ? 'text-primary font-bold'
                            : `${isDarkMode ? 'text-slate-300 hover:bg-zinc-800' : 'text-slate-700 hover:bg-slate-50'}`
                            }`}
                    >
                        <Globe size={13} className={selectedUnitId === 'all' ? 'text-primary' : ''} />
                        <span className="flex-1 text-left">Todas as Unidades</span>
                        {selectedUnitId === 'all' && <Check size={13} className="text-primary" />}
                    </button>

                    <div className={`my-1 h-px ${isDarkMode ? 'bg-zinc-800' : 'bg-slate-100'}`} />

                    {/* Unit options */}
                    {units.filter(u => u.status !== 'inactive').map(u => (
                        <button
                            key={u.id}
                            onClick={() => handleSelect(u.id)}
                            className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs transition-colors ${selectedUnitId === u.id
                                ? 'text-primary font-bold'
                                : `${isDarkMode ? 'text-slate-300 hover:bg-zinc-800' : 'text-slate-700 hover:bg-slate-50'}`
                                }`}
                        >
                            <span className={`w-2 h-2 rounded-full ${STATUS_DOT[u.status] || 'bg-slate-400'}`} />
                            <span className="flex-1 text-left truncate">{u.tradeName || u.name}</span>
                            <span className={`text-[10px] ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>{u.city}</span>
                            {selectedUnitId === u.id && <Check size={13} className="text-primary" />}
                        </button>
                    ))}

                    {/* Inactive units (collapsed) */}
                    {units.filter(u => u.status === 'inactive').length > 0 && (
                        <>
                            <div className={`my-1 h-px ${isDarkMode ? 'bg-zinc-800' : 'bg-slate-100'}`} />
                            <div className={`px-3 py-1 text-[9px] uppercase font-bold tracking-wider ${isDarkMode ? 'text-slate-600' : 'text-slate-400'}`}>Inativas</div>
                            {units.filter(u => u.status === 'inactive').map(u => (
                                <button
                                    key={u.id}
                                    onClick={() => handleSelect(u.id)}
                                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs opacity-50 ${isDarkMode ? 'text-slate-400 hover:bg-zinc-800' : 'text-slate-500 hover:bg-slate-50'}`}
                                >
                                    <span className="w-2 h-2 rounded-full bg-red-500" />
                                    <span className="flex-1 text-left truncate">{u.tradeName || u.name}</span>
                                </button>
                            ))}
                        </>
                    )}
                </div>
            )}
        </div>
    );
};
