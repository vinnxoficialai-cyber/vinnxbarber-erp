import React from 'react';
import { LucideIcon, ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string;
  trend?: number;
  trendDirection?: 'up' | 'down';
  Icon: LucideIcon;
  color?: string; // Tailwind text color class
  bgIconColor?: string; // Optional specific BG for icon
  subtitle?: string; // Optional context line below value
}

export const StatCard: React.FC<StatCardProps> = ({ label, value, trend, trendDirection, Icon, color = "text-primary", bgIconColor, subtitle }) => {
  // Derive icon bg: if bgIconColor provided use it, else build from color
  const iconBg = bgIconColor || 'bg-primary/15';

  return (
    <div className="dash-card bg-card p-4 flex flex-col h-full">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <h3 className="text-2xl font-bold text-foreground mt-1">{value}</h3>
          {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-full ${iconBg}`}>
          <Icon size={20} className={color} />
        </div>
      </div>
      {trend !== undefined && (
        <div className="mt-auto pt-2.5 flex items-center text-sm whitespace-nowrap">
          <span className={`flex items-center font-medium ${trendDirection === 'up' ? 'text-emerald-400' : 'text-red-400'}`}>
            {trendDirection === 'up' ? <ArrowUpRight size={16} className="mr-1" /> : <ArrowDownRight size={16} className="mr-1" />}
            {trend}%
          </span>
          <span className="text-muted-foreground ml-2">vs. mês anterior</span>
        </div>
      )}
    </div>
  );
};