import React, { useState } from 'react';
import { AlertCircle, ArrowRight } from 'lucide-react';
import { TeamMember } from '../types';
import { authService } from '../lib/auth';

interface LoginProps {
  onLogin: (user: TeamMember) => void;
}

export const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!isValidEmail(email)) {
      setError('E-mail inválido');
      return;
    }

    if (password.length < 6) {
      setError('Senha deve ter pelo menos 6 caracteres');
      return;
    }

    setIsLoading(true);

    try {
      const { user, error } = await authService.signIn(email, password);

      if (error) {
        throw error;
      }

      if (user) {
        setIsLoading(false);
        onLogin(authService.toTeamMember(user));
      } else {
        throw new Error('Usuário não encontrado');
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao autenticar';

      if (errorMessage.includes('Invalid login credentials')) {
        setError('E-mail ou senha incorretos');
      } else if (errorMessage.includes('Email not confirmed')) {
        setError('Por favor, confirme seu e-mail antes de fazer login');
      } else if (errorMessage.includes('User already registered')) {
        setError('Este e-mail já está cadastrado');
      } else if (errorMessage.includes('timed out')) {
        setError('Conexão lenta. Tente novamente.');
      } else {
        setError(errorMessage);
      }
      setIsLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center p-4 relative overflow-hidden font-sans"
      style={{
        backgroundColor: '#111111',
        backgroundImage: 'radial-gradient(ellipse at 50% 0%, rgba(255,255,255,0.03) 0%, transparent 60%)',
      }}
    >
      {/* Subtle noise texture overlay */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.015]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'repeat',
          backgroundSize: '128px 128px',
        }}
      />

      <div className="w-full max-w-[400px] z-10 login-fade-in">
        {/* ===== ANIMATED VINNX LOGO ===== */}
        <div className="flex justify-center mb-12">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            xmlSpace="preserve"
            width="100%"
            height="100%"
            version="1.1"
            style={{ shapeRendering: 'geometricPrecision', textRendering: 'geometricPrecision', imageRendering: 'optimizeQuality', fillRule: 'evenodd', clipRule: 'evenodd' } as unknown as React.CSSProperties}
            viewBox="0 0 13929.2 2791.21"
            className="w-64 sm:w-72 h-auto"
          >
            <g id="Camada_x0020_1">
              <g id="_1594777282896">
                <path className="svg-elem-1" d="M10575.96 2770.97c1.81,-67.93 -6.84,-759.75 0.71,-1074.33 -0.71,-312.44 187.28,-481.99 567.14,-481.99l0.12 -419.71c-284.82,0 -393.93,-2.07 -524.85,182.93 -6.84,-10.88 -90.08,-171.34 -95.66,-182.93l-406.52 0 0 1976.03 459.07 0z" />
                <path className="svg-elem-2" d="M986.96 822.41c538.09,0 974.29,436.2 974.29,974.28 0,538.09 -436.2,974.29 -974.29,974.29 -194.4,0 -363.1,-73.47 -515.13,-171.57 -268.78,-173.43 -459.15,-459.04 -459.15,-802.72 0,-538.08 436.2,-974.28 974.28,-974.28zm0 436.54c296.99,0 537.74,240.75 537.74,537.74 0,296.99 -240.75,537.74 -537.74,537.74 -296.99,0 -537.74,-240.75 -537.74,-537.74 0,-296.99 240.75,-537.74 537.74,-537.74z" />
                <path className="svg-elem-3" d="M3159.77 822.38c224.55,0 442.51,58.83 607.26,186.46 230.04,178.2 367.02,474.29 367.02,787.82 0,327.08 -181.77,618.34 -429,795.04 -159.5,113.97 -334.27,179.25 -545.29,179.25 -538.08,0 -974.28,-436.2 -974.28,-974.29 0,-538.08 436.2,-974.28 974.28,-974.28zm0 436.54c296.99,0 537.74,240.75 537.74,537.74 0,296.99 -240.75,537.74 -537.74,537.74 -296.99,0 -537.74,-240.75 -537.74,-537.74 0,-296.99 240.75,-537.74 537.74,-537.74z" />
                <path className="svg-elem-4" d="M-0 232.77l0 2539.65 445.84 -191.06 0.04 -2581.37c0,0 -437.87,229.95 -445.88,232.77z" />
                <path className="svg-elem-5" d="M4168.33 794.94l0 1975.96 -445.74 -192.01 0 -1462.39 0 -139.54c0,0 437.73,-184.83 445.74,-182.03z" />
                <path className="svg-elem-6" d="M4932.59 2770.97c1.81,-67.93 -6.84,-759.75 0.71,-1074.33 -0.71,-312.44 187.28,-481.99 567.14,-481.99l0.12 -419.71c-284.82,0 -393.93,-2.07 -524.85,182.93 -6.84,-10.88 -90.08,-171.34 -95.66,-182.93l-406.52 0 0 1976.03 459.07 0z" />
                <path className="svg-elem-7" d="M6694.19 822.41c538.08,0 974.28,436.2 974.28,974.28 0,538.09 -436.2,974.29 -974.28,974.29 -194.41,0 -363.11,-73.47 -515.14,-171.57 -268.78,-173.43 -459.15,-459.04 -459.15,-802.72 0,-538.08 436.2,-974.28 974.29,-974.28zm0 436.54c296.99,0 537.74,240.75 537.74,537.74 0,296.99 -240.75,537.74 -537.74,537.74 -296.99,0 -537.74,-240.75 -537.74,-537.74 0,-296.99 240.75,-537.74 537.74,-537.74z" />
                <path className="svg-elem-8" d="M5707.22 232.77l0 2539.65 445.84 -191.06 0.05 -2581.37c0,0 -437.87,229.95 -445.89,232.77z" />
                <path className="svg-elem-9" d="M8883.2 822.41c436.12,0 805.27,286.55 929.53,681.63 29.06,92.38 44.76,190.69 44.76,292.65 0,52.14 -4.14,103.3 -12.02,153.22l-1336.29 0.02c0,0 229.95,-437.87 232.76,-445.89l592.44 0c-95.88,-147.51 -262.12,-245.09 -451.18,-245.09 -296.99,0 -537.74,240.75 -537.74,537.74 0,296.99 240.75,537.74 537.74,537.74 205.64,0 384.29,-115.44 474.74,-285.05l322.19 307.78c-176.33,250.29 -467.49,413.82 -796.93,413.82 -194.4,0 -363.1,-73.47 -515.13,-171.57 -268.78,-173.43 -459.15,-459.04 -459.15,-802.72 0,-538.08 436.2,-974.28 974.28,-974.28z" />
                <path className="svg-elem-10" d="M12954.05 2473.8l-974.83 -1678.86 -369.05 0 1159.51 1996.27 184.37 -317.41zm-184.39 -953.1c140.47,-241.94 280.97,-483.86 421.46,-725.77l-842.93 0 421.47 725.77zm184.51 317.77c61.48,105.87 122.94,211.74 184.42,317.62l790.61 -1361.15 -369.08 0c-201.91,347.88 -403.96,695.69 -605.94,1043.53z" />
              </g>
            </g>
          </svg>
        </div>

        {/* ===== TAGLINE ===== */}
        <p className="text-center text-neutral-500 text-sm mb-10 tracking-wide">
          Sistema integrado de gestão e automação.
        </p>

        {/* ===== FORM ===== */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20">
              <AlertCircle className="text-red-400 shrink-0" size={16} />
              <p className="text-xs font-semibold text-red-400 tracking-wide">{error}</p>
            </div>
          )}

          {/* Email */}
          <div className="space-y-2">
            <label className="text-[11px] font-semibold uppercase text-neutral-500 tracking-[0.15em] ml-1">
              E-mail
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3.5 rounded-xl text-sm text-white font-medium transition-all duration-200 outline-none placeholder:text-neutral-600"
              style={{
                backgroundColor: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)';
                e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.04)';
              }}
              placeholder="voce@empresa.com"
              autoComplete="email"
            />
          </div>

          {/* Password */}
          <div className="space-y-2">
            <label className="text-[11px] font-semibold uppercase text-neutral-500 tracking-[0.15em] ml-1">
              Senha
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3.5 rounded-xl text-sm text-white font-medium transition-all duration-200 outline-none placeholder:text-neutral-600"
              style={{
                backgroundColor: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)';
                e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.04)';
              }}
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-3 py-3.5 bg-white text-black font-bold text-sm uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 transition-all duration-200 hover:bg-neutral-200 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-neutral-300 border-t-black rounded-full animate-spin" />
            ) : (
              <>
                Entrar
                <ArrowRight size={16} strokeWidth={2.5} />
              </>
            )}
          </button>
        </form>

        {/* ===== FOOTER INFO ===== */}
        <p className="mt-8 text-center text-[11px] text-neutral-600">
          Acesso restrito. Contate um administrador para obter credenciais.
        </p>

        {/* ===== COPYRIGHT ===== */}
        <p className="text-center text-neutral-700 text-[10px] font-semibold uppercase tracking-[0.2em] mt-12">
          &copy; 2025 Vinnx AI Solutions
        </p>
      </div>
    </div>
  );
};