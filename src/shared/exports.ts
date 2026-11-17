export type ExportCell = string | number | boolean | null | undefined;

/** RFC 4180 quoting. Neutralize spreadsheet formulas in text cells only. */
export function toCsv(columns: readonly string[], rows: readonly (readonly ExportCell[])[]): string {
  const cell = (value: ExportCell) => {
    let text = value === null || value === undefined ? '' : String(value);
    if (typeof value === 'string' && /^[\s]*[=+@-]/.test(text)) text = `'${text}`;
    return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };
  return [columns, ...rows].map((row) => row.map(cell).join(',')).join('\r\n') + '\r\n';
}

export function toJson(value: unknown): string { return JSON.stringify(value, null, 2) + '\n'; }
