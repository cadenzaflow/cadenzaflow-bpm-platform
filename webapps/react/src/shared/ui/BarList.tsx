import type { ReactNode } from 'react';

export interface BarItem {
  key: string;
  label: string;
  value: number;
  /** the label as link, e.g. to the process definition */
  link?: ReactNode;
}

interface BarListProps {
  items: BarItem[];
  label: string;
  /** label of the row that sums up the smaller items */
  othersLabel: string;
  /** rows shown before the rest are summed up */
  max?: number;
}

/**
 * Shares of a total as a ranked list of bars in one color, with label and
 * number as text (no pie: the names stay readable, however many there are).
 */
export function BarList({ items, label, othersLabel, max = 5 }: BarListProps) {
  const ranked = items.filter((item) => item.value > 0).sort((a, b) => b.value - a.value);
  const shown = ranked.slice(0, max);
  const rest = ranked.slice(max).reduce((sum, item) => sum + item.value, 0);
  const rows = rest > 0 ? [...shown, { key: '__others', label: othersLabel, value: rest } as BarItem] : shown;
  const largest = Math.max(1, ...rows.map((row) => row.value));

  return (
    <ul className="cz-bar-list" aria-label={label}>
      {rows.map((row) => (
        <li key={row.key} className="cz-bar-list__row" title={`${row.label}: ${row.value.toLocaleString()}`}>
          <span className="cz-bar-list__label">{row.link ?? row.label}</span>
          <span className="cz-bar-list__value">{row.value.toLocaleString()}</span>
          <span className="cz-bar-list__track" aria-hidden="true">
            <span className="cz-bar-list__bar" style={{ width: `${(row.value / largest) * 100}%` }} />
          </span>
        </li>
      ))}
    </ul>
  );
}
