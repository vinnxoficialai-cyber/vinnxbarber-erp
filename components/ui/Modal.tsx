import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

/* ═══════════════════════════════════════════════════════
   Modal — WooShoes Dialog anatomy (no Radix dependency)
   
   Replicates the layout pattern from ManualOrderModal:
   ┌─────────────────────────────────┐
   │  Header (fixed)  px-6 pt-5 pb-2│
   │  ─ icon + title + description  │
   │  ─ close button (X)            │
   ├─────────────────────────────────┤
   │  Body (scrollable)             │
   │  flex-1 overflow-y-auto        │
   │  px-6 py-4 space-y-5           │
   ├─────────────────────────────────┤
   │  Footer (fixed)                │
   │  border-t p-4 bg-card          │
   └─────────────────────────────────┘
   ═══════════════════════════════════════════════════════ */

type ModalSize = 'sm' | 'md' | 'lg' | 'xl';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  icon?: React.ReactNode;
  size?: ModalSize;
  footer?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

const sizeMap: Record<ModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-2xl',
  lg: 'max-w-3xl',
  xl: 'max-w-4xl',
};

const Modal: React.FC<ModalProps> = ({
  open,
  onClose,
  title,
  description,
  icon,
  size = 'lg',
  footer,
  children,
  className = '',
}) => {
  const backdropRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === backdropRef.current) onClose();
      }}
    >
      <div
        className={`w-full ${sizeMap[size]} h-[85vh] p-0 flex flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-2xl animate-in fade-in zoom-in-95 duration-200 ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header (fixed) ── */}
        <div className="px-6 pt-5 pb-2 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {icon && <span className="flex-shrink-0">{icon}</span>}
              <h2 className="text-lg font-semibold text-foreground">{title}</h2>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
              aria-label="Fechar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          {description && (
            <p className="text-sm text-muted-foreground mt-1">{description}</p>
          )}
        </div>

        {/* ── Body (scrollable) ── */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {children}
        </div>

        {/* ── Footer (fixed) ── */}
        {footer && (
          <div className="flex-shrink-0 border-t border-border p-4 flex justify-end gap-3 bg-card">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

export { Modal };
export default Modal;
