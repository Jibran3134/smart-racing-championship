export function ResourceGauge({ label, value, maximum, unit = '' }: { label: string; value: number; maximum: number; unit?: string }) {
  const valid = Number.isFinite(value) && Number.isFinite(maximum) && maximum > 0;
  const bounded = valid ? Math.max(0, Math.min(maximum, value)) : 0;
  return (
    <div className={`resource-gauge ${valid && bounded / maximum < 0.25 ? 'resource-low' : ''}`}>
      <div><span>{label}</span><strong>{valid ? `${value} / ${maximum}${unit ? ` ${unit}` : ''}` : 'Unavailable'}</strong></div>
      <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={valid ? maximum : 1} aria-valuenow={bounded}>
        <span style={{ width: `${valid ? bounded / maximum * 100 : 0}%` }} />
      </div>
    </div>
  );
}
