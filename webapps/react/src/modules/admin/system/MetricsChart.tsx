import type { MetricKey, MetricsRow } from './metrics';

const WIDTH = 720;
const HEIGHT = 220;
const AXIS = 24;

/** Grouped bars per month (oldest left), one color per metric; plain SVG, no chart library. */
export function MetricsChart({ rows, keys, title }: { rows: MetricsRow[]; keys: MetricKey[]; title: string }) {
  const max = Math.max(1, ...rows.flatMap((row) => keys.map((key) => row.sums[key])));
  const slot = (WIDTH - AXIS) / Math.max(1, rows.length);
  const bar = (slot * 0.8) / keys.length;

  return (
    <figure className="cz-metrics-chart">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT + AXIS}`} role="img" aria-label={title} preserveAspectRatio="none">
        <line className="cz-metrics-chart__axis" x1={AXIS} y1={HEIGHT} x2={WIDTH} y2={HEIGHT} />
        {rows.map((row, index) => (
          <g key={row.label} transform={`translate(${AXIS + index * slot + slot * 0.1}, 0)`}>
            {keys.map((key, keyIndex) => {
              const height = (row.sums[key] / max) * (HEIGHT - 8);
              return (
                <rect
                  key={key}
                  className={`cz-metrics-chart__bar cz-metrics-chart__bar--${key}`}
                  x={keyIndex * bar}
                  y={HEIGHT - height}
                  width={Math.max(1, bar - 2)}
                  height={height}
                  rx={2}
                >
                  <title>{`${row.label} ${key}: ${row.sums[key].toLocaleString()}`}</title>
                </rect>
              );
            })}
            <text className="cz-metrics-chart__label" x={(slot * 0.8) / 2} y={HEIGHT + 16} textAnchor="middle">
              {row.label.slice(0, 7)}
            </text>
          </g>
        ))}
      </svg>
      <figcaption className="cz-metrics-chart__legend">
        {keys.map((key) => (
          <span key={key}>
            <span className={`cz-metrics-chart__swatch cz-metrics-chart__bar--${key}`} aria-hidden="true" />
            {key}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}
