"use client";

interface BarChartProps {
  data: { label: string; value: number }[];
  maxValue?: number;
  color?: string;
  height?: number;
}

export function BarChart({
  data,
  maxValue: maxProp,
  color = "#059669",
  height = 200,
}: BarChartProps) {
  const maxValue = maxProp || Math.max(...data.map((d) => d.value), 1);

  return (
    <div className="w-full">
      <div
        className="flex items-end gap-1"
        style={{ height: `${height}px` }}
      >
        {data.map((item, i) => (
          <div key={i} className="flex-1 flex flex-col items-center justify-end h-full">
            <div
              className="w-full rounded-t transition-all duration-300"
              style={{
                height: `${Math.max((item.value / maxValue) * 100, 2)}%`,
                backgroundColor: color,
                opacity: 0.8,
              }}
              title={`${item.label}: ${item.value}`}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-1 mt-2">
        {data.map((item, i) => (
          <div key={i} className="flex-1 text-center">
            <span className="text-xs text-gray-500 truncate block">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

interface LineChartProps {
  data: { label: string; values: number[] }[];
  labels: string[];
  colors?: string[];
  height?: number;
}

export function LineChart({
  data,
  labels,
  colors = ["#059669", "#3B82F6"],
  height = 200,
}: LineChartProps) {
  const allValues = data.flatMap((d) => d.values);
  const maxValue = Math.max(...allValues, 1);

  return (
    <div className="w-full">
      <div className="relative" style={{ height: `${height}px` }}>
        <svg
          viewBox={`0 0 ${labels.length * 40} ${height}`}
          className="w-full h-full"
          preserveAspectRatio="none"
        >
          {data.map((series, si) => {
            const points = series.values.map((v, i) => {
              const x = (i / (labels.length - 1 || 1)) * 100;
              const y = 100 - (v / maxValue) * 100;
              return `${x},${y}`;
            }).join(" ");

            return (
              <g key={si}>
                <polyline
                  points={points}
                  fill="none"
                  stroke={colors[si % colors.length]}
                  strokeWidth="2"
                  vectorEffect="non-scaling-stroke"
                />
                {series.values.map((v, i) => {
                  const x = (i / (labels.length - 1 || 1)) * 100;
                  const y = 100 - (v / maxValue) * 100;
                  return (
                    <circle
                      key={i}
                      cx={`${x}%`}
                      cy={`${y}%`}
                      r="3"
                      fill={colors[si % colors.length]}
                    />
                  );
                })}
              </g>
            );
          })}
        </svg>
      </div>
      <div className="flex justify-between mt-2 px-1">
        {labels.map((label, i) => (
          <span key={i} className="text-xs text-gray-500">{label}</span>
        ))}
      </div>
      <div className="flex gap-4 mt-2 justify-center">
        {data.map((series, i) => (
          <div key={i} className="flex items-center gap-1">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: colors[i % colors.length] }}
            />
            <span className="text-xs text-gray-600">{series.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
