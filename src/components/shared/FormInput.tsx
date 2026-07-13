import React from 'react';

export interface FormInputProps {
  label?: string;
  type?: 'text' | 'number' | 'checkbox' | 'range' | 'select';
  value: any;
  onChange: (val: any) => void;
  id?: string;
  prefix?: string;
  suffix?: string;
  helperText?: string;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  placeholder?: string;
  options?: { value: any; label: string }[];
  style?: React.CSSProperties;
  inputStyle?: React.CSSProperties;
  labelStyle?: React.CSSProperties;
}

export const FormInput: React.FC<FormInputProps> = ({
  label,
  type = 'text',
  value,
  onChange,
  id,
  prefix,
  suffix,
  helperText,
  min,
  max,
  step,
  disabled = false,
  placeholder,
  options = [],
  style,
  inputStyle,
  labelStyle,
}) => {
  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    width: '100%',
    ...style,
  };

  const labelElemStyle: React.CSSProperties = {
    fontSize: '12px',
    fontWeight: 600,
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    ...labelStyle,
  };

  if (type === 'checkbox') {
    return (
      <div className="flex-row" style={{ alignItems: 'center', gap: '8px', marginBottom: '8px', ...style }}>
        <input
          type="checkbox"
          id={id}
          checked={!!value}
          disabled={disabled}
          onChange={e => onChange(e.target.checked)}
          style={{ width: 'auto', cursor: 'pointer', ...inputStyle }}
        />
        {label && (
          <label htmlFor={id} style={{ fontSize: '13px', cursor: 'pointer', userSelect: 'none', fontWeight: 500, ...labelStyle }}>
            {label}
          </label>
        )}
      </div>
    );
  }

  if (type === 'range') {
    return (
      <div style={containerStyle}>
        {label && <label style={labelElemStyle}>{label}</label>}
        <div className="flex-row" style={{ alignItems: 'center' }}>
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            disabled={disabled}
            onChange={e => onChange(Number(e.target.value))}
            style={{ flex: 1, ...inputStyle }}
          />
          {suffix && (
            <span style={{ width: '40px', textAlign: 'right', fontSize: '14px', fontWeight: 600 }}>
              {value}{suffix}
            </span>
          )}
        </div>
        {helperText && <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>{helperText}</p>}
      </div>
    );
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const rawVal = e.target.value;
    if (rawVal === '') {
      onChange(0);
    } else {
      onChange(type === 'number' ? Number(rawVal) : rawVal);
    }
  };

  return (
    <div className="input-group" style={style}>
      {label && <label style={labelElemStyle}>{label}</label>}
      {prefix || suffix ? (
        <div className="flex-row">
          {prefix && <span style={{ color: 'var(--text-secondary)' }}>{prefix}</span>}
          {type === 'select' ? (
            <select
              value={value}
              disabled={disabled}
              onChange={handleChange}
              style={inputStyle}
            >
              {options.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          ) : (
            <input
              type={type}
              value={value || ''}
              disabled={disabled}
              placeholder={placeholder}
              min={min}
              max={max}
              step={step}
              onChange={handleChange}
              style={inputStyle}
            />
          )}
          {suffix && <span style={{ color: 'var(--text-secondary)' }}>{suffix}</span>}
        </div>
      ) : type === 'select' ? (
        <select
          value={value}
          disabled={disabled}
          onChange={handleChange}
          style={inputStyle}
        >
          {options.map(opt => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          type={type}
          value={value || ''}
          disabled={disabled}
          placeholder={placeholder}
          min={min}
          max={max}
          step={step}
          onChange={handleChange}
          style={inputStyle}
        />
      )}
      {helperText && <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>{helperText}</p>}
    </div>
  );
};
export default FormInput;
