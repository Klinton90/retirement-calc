import React from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface AccordionItemProps {
  id: string;
  label: string;
  icon: LucideIcon;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  style?: React.CSSProperties;
}

export const AccordionItem: React.FC<AccordionItemProps> = ({
  label,
  icon: Icon,
  isOpen,
  onToggle,
  children,
  style,
}) => {
  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden', ...style }}>
      <div
        onClick={onToggle}
        className="flex-between"
        style={{
          padding: '14px 18px',
          cursor: 'pointer',
          background: isOpen ? 'rgba(255,255,255,0.02)' : 'transparent',
          borderBottom: isOpen ? '1px solid var(--border-color)' : 'none',
          transition: 'background 0.2s',
          userSelect: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Icon size={18} className="text-secondary" />
          <span style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '0.5px' }}>{label}</span>
        </div>
        {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </div>
      {isOpen && (
        <div style={{ padding: '18px' }}>
          {children}
        </div>
      )}
    </div>
  );
};
export default AccordionItem;
