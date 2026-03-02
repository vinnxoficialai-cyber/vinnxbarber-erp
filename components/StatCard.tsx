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
  return (
    <div className="dash-card bg-white dark:bg-dark-surface p-4 flex flex-col h-full">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</p>
          <h3 className="text-2xl font-bold text-slate-800 dark:text-white mt-1">{value}</h3>
          {subtitle && <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
        <Icon size={20} className={`${color} opacity-60`} />
      </div>
      {trend !== undefined && (
        <div className="mt-auto pt-2.5 flex items-center text-sm whitespace-nowrap">
          <span className={`flex items-center font-medium ${trendDirection === 'up' ? 'text-primary' : 'text-rose-600'}`}>
            {trendDirection === 'up' ? <ArrowUpRight size={16} className="mr-1" /> : <ArrowDownRight size={16} className="mr-1" />}
            {trend}%
          </span>
          <span className="text-slate-400 dark:text-slate-500 ml-2">vs. mês anterior</span>
        </div>
      )}
    </div>
  );
};