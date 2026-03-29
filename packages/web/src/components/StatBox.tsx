interface StatBoxProps {
  variant: 'dex' | 'agi' | 'int' | 'str' | 'lf' | 'mp';
  label: string;
  value: string | number;
  sub?: string;
}

export function StatBox({ variant, label, value, sub }: StatBoxProps) {
  return (
    <div className={`c-stat c-stat--${variant}`}>
      <div className="c-stat__label t-small">{label}</div>
      <div className="c-stat__value t-h2">{String(value)}</div>
      <div className="c-stat__sub t-small">{sub ?? ' '}</div>
    </div>
  );
}
