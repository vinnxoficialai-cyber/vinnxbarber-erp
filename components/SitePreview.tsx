import React from 'react';
import { SiteSettings, Service } from '../types';
import { MapPin, Phone, Clock, Star, Users, Tag, MessageCircle, Instagram, ChevronRight, Scissors } from 'lucide-react';

interface SitePreviewProps {
    settings: SiteSettings;
    services: Service[];
}

export const SitePreview: React.FC<SitePreviewProps> = ({ settings, services }) => {
    const color = settings.primaryColor || '#00bf62';
    const visibleServices = services.filter(s => settings.visibleServiceIds.includes(s.id) && s.active);
    const hours = settings.businessHours || [];
    const sections = settings.sectionsVisible || { reviews: true, team: true, promotions: false, social: true };

    return (
        <div className="relative flex flex-col items-center">
            {/* iPhone Frame Container — proportional to SVG viewBox 363×750 */}
            <div className="relative w-[280px] h-[578px]">
                {/* SVG Frame */}
                <img
                    src="/iphone.svg"
                    alt="Phone frame"
                    className="absolute inset-0 w-full h-full z-10 pointer-events-none"
                />

                {/* Inner content area — inset to sit within the iPhone bezel */}
                <div
                    className="absolute z-0 overflow-hidden rounded-[36px]"
                    style={{ top: 14, bottom: 14, left: 16, right: 16 }}
                >
                    <div
                        className="w-full h-full overflow-y-auto bg-white"
                        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                    >
                        {/* Hide webkit scrollbar via inline trick */}
                        <style>{`.site-preview-scroll::-webkit-scrollbar { display: none; }`}</style>

                        {/* ── HERO SECTION ── */}
                        <div
                            className="relative w-full flex flex-col items-center justify-center text-center"
                            style={{
                                minHeight: 180,
                                background: settings.heroImageUrl
                                    ? `linear-gradient(to bottom, rgba(0,0,0,0.45), rgba(0,0,0,0.65)), url(${settings.heroImageUrl}) center/cover no-repeat`
                                    : `linear-gradient(135deg, ${color}, ${color}dd, #1a1a2e)`,
                            }}
                        >
                            {/* Logo */}
                            {settings.logoUrl ? (
                                <img src={settings.logoUrl} alt="Logo" className="w-10 h-10 object-contain rounded-lg mb-1.5 shadow-lg" />
                            ) : (
                                <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-1.5 shadow-lg" style={{ background: color }}>
                                    <Scissors size={18} className="text-white" />
                                </div>
                            )}

                            {/* Name & Slogan */}
                            <h1 className="text-white font-bold text-sm leading-tight px-4 drop-shadow-lg">
                                {settings.businessName || 'Nome do Salão'}
                            </h1>
                            <p className="text-white/70 text-[9px] mt-0.5 px-6">
                                {settings.slogan || 'Seu slogan aparece aqui'}
                            </p>

                            {/* CTA Button */}
                            <button
                                className="mt-3 px-5 py-1.5 rounded-full text-white font-bold text-[10px] shadow-lg transition-transform hover:scale-105"
                                style={{ background: color }}
                            >
                                {settings.ctaButtonText || 'Agendar Agora'}
                            </button>
                        </div>

                        {/* ── SERVICES SECTION ── */}
                        {visibleServices.length > 0 && (
                            <div className="px-3 py-3">
                                <h2 className="font-bold text-[10px] text-slate-800 uppercase tracking-wider mb-2 flex items-center gap-1">
                                    <Scissors size={9} style={{ color }} /> Nossos Serviços
                                </h2>
                                <div className="space-y-1.5">
                                    {visibleServices.slice(0, 5).map(svc => (
                                        <div key={svc.id} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
                                            <div className="flex items-center gap-1.5">
                                                <div className="w-6 h-6 rounded flex items-center justify-center" style={{ background: `${color}15` }}>
                                                    <Scissors size={10} style={{ color }} />
                                                </div>
                                                <div>
                                                    <p className="text-[9px] font-semibold text-slate-800">{svc.name}</p>
                                                    <p className="text-[7px] text-slate-400">{svc.duration || 30} min</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <span className="text-[9px] font-bold" style={{ color }}>
                                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(svc.price)}
                                                </span>
                                                <ChevronRight size={8} className="text-slate-300" />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* ── HOURS SECTION ── */}
                        {hours.length > 0 && (
                            <div className="px-3 py-2">
                                <h2 className="font-bold text-[10px] text-slate-800 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                                    <Clock size={9} style={{ color }} /> Horários
                                </h2>
                                <div className="space-y-0.5">
                                    {hours.map((h, i) => (
                                        <div key={i} className={`flex justify-between text-[8px] py-0.5 px-1.5 rounded ${h.open ? 'text-slate-700' : 'text-slate-300 line-through'}`}>
                                            <span className="capitalize font-medium">{h.day}</span>
                                            <span>{h.open ? `${h.start} - ${h.end}` : 'Fechado'}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* ── LOCATION SECTION ── */}
                        {settings.address && (
                            <div className="px-3 py-2">
                                <h2 className="font-bold text-[10px] text-slate-800 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                                    <MapPin size={9} style={{ color }} /> Localização
                                </h2>
                                <p className="text-[8px] text-slate-500 leading-relaxed">{settings.address}</p>
                                {settings.phone && (
                                    <p className="text-[8px] text-slate-500 mt-0.5 flex items-center gap-0.5">
                                        <Phone size={7} /> {settings.phone}
                                    </p>
                                )}
                            </div>
                        )}

                        {/* ── REVIEWS SECTION (conditional) ── */}
                        {sections.reviews && (
                            <div className="px-3 py-2">
                                <h2 className="font-bold text-[10px] text-slate-800 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                                    <Star size={9} style={{ color }} /> Avaliações
                                </h2>
                                <div className="flex items-center gap-0.5 mb-1.5">
                                    {[1, 2, 3, 4, 5].map(s => (
                                        <Star key={s} size={10} fill={color} stroke={color} />
                                    ))}
                                    <span className="text-[8px] text-slate-400 ml-1">5.0 (128 avaliações)</span>
                                </div>
                                <div className="bg-slate-50 rounded-lg p-1.5 border border-slate-100">
                                    <p className="text-[7px] text-slate-500 italic">"Excelente atendimento! Profissionais de primeira."</p>
                                    <p className="text-[6px] text-slate-400 mt-0.5">— Cliente satisfeito</p>
                                </div>
                            </div>
                        )}

                        {/* ── TEAM SECTION (conditional) ── */}
                        {sections.team && (
                            <div className="px-3 py-2">
                                <h2 className="font-bold text-[10px] text-slate-800 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                                    <Users size={9} style={{ color }} /> Nossa Equipe
                                </h2>
                                <div className="flex gap-2">
                                    {[1, 2, 3].map(i => (
                                        <div key={i} className="flex flex-col items-center">
                                            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center border-2" style={{ borderColor: color }}>
                                                <Users size={10} className="text-slate-400" />
                                            </div>
                                            <span className="text-[6px] text-slate-500 mt-0.5">Profissional</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* ── PROMOTIONS SECTION (conditional) ── */}
                        {sections.promotions && (
                            <div className="px-3 py-2">
                                <h2 className="font-bold text-[10px] text-slate-800 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                                    <Tag size={9} style={{ color }} /> Promoções
                                </h2>
                                <div className="rounded-lg p-2 text-white text-center" style={{ background: `linear-gradient(135deg, ${color}, ${color}bb)` }}>
                                    <p className="text-[9px] font-bold">Corte + Barba</p>
                                    <p className="text-[7px] opacity-80">por apenas R$ 59,90</p>
                                </div>
                            </div>
                        )}

                        {/* ── SOCIAL SECTION (conditional) ── */}
                        {sections.social && (settings.whatsappEnabled || settings.instagramHandle) && (
                            <div className="px-3 py-2 pb-4">
                                <h2 className="font-bold text-[10px] text-slate-800 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                                    Redes Sociais
                                </h2>
                                <div className="flex gap-1.5">
                                    {settings.whatsappEnabled && settings.whatsappNumber && (
                                        <div className="flex items-center gap-1 bg-green-50 border border-green-200 rounded-lg px-2 py-1">
                                            <MessageCircle size={8} className="text-green-600" />
                                            <span className="text-[7px] font-medium text-green-700">WhatsApp</span>
                                        </div>
                                    )}
                                    {settings.instagramHandle && (
                                        <div className="flex items-center gap-1 bg-pink-50 border border-pink-200 rounded-lg px-2 py-1">
                                            <Instagram size={8} className="text-pink-600" />
                                            <span className="text-[7px] font-medium text-pink-700">@{settings.instagramHandle}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Footer */}
                        <div className="px-3 py-2 bg-slate-50 border-t border-slate-100 text-center">
                            <p className="text-[6px] text-slate-400">
                                Powered by VINNX • Agendamento Online
                            </p>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
};
