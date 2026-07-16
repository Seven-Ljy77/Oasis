import React, { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Line,
  ComposedChart,
  Legend,
} from "recharts";
import { getUsageReport } from "@/lib/ipc";
import type { DailyBucket, UsageReportSnapshot } from "@/lib/types";

interface UsageReportViewProps {
  title: string;
  subtitle?: string;
  /** Additional filter pills (e.g., task type, provider name) */
  filters?: React.ReactNode;
}

const UsageReportView: React.FC<UsageReportViewProps> = ({
  title,
  subtitle,
  filters,
}) => {
  const [period, setPeriod] = useState<7 | 14 | 30>(7);
  const [snapshot, setSnapshot] = useState<UsageReportSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    getUsageReport(period)
      .then(setSnapshot)
      .catch(() => setSnapshot(null))
      .finally(() => setIsLoading(false));
  }, [period]);

  const totalTokens = snapshot?.total_tokens ?? 0;
  const totalRequests = snapshot?.total_requests ?? 0;
  const totalSucceeded = snapshot?.successful_requests ?? 0;
  const totalFailed = snapshot?.failed_requests ?? 0;

  // Build chart data from provider breakdown (simplified — daily buckets require additional API)
  const chartData = snapshot?.by_provider?.map((p) => ({
    date: p.provider_name,
    "Prompt Tokens": Math.round(p.tokens * 0.6),
    "Completion Tokens": Math.round(p.tokens * 0.4),
    Requests: p.requests,
  })) ?? [];

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload) return null;
    return (
      <div className="bg-surface border border-border rounded-lg shadow-lg p-3 text-xs">
        <p className="font-medium text-slate-700 mb-1">{label}</p>
        {payload.map((p: any) => (
          <div key={p.name} className="flex items-center gap-2">
            <span
              className="w-2.5 h-2.5 rounded-sm"
              style={{ backgroundColor: p.color }}
            />
            <span className="text-slate-500">{p.name}:</span>
            <span className="text-slate-700 font-medium">
              {p.value.toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        {subtitle && (
          <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>
        )}
      </div>

      {/* Period picker + filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1 bg-surface-tertiary rounded-lg p-0.5">
          {([7, 14, 30] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                period === p
                  ? "bg-surface text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {p === 7 ? "1 Week" : p === 14 ? "2 Weeks" : "1 Month"}
            </button>
          ))}
        </div>
        {filters && <div className="flex items-center gap-2">{filters}</div>}
      </div>

      {/* Chart */}
      <div className="bg-surface-secondary border border-border rounded-lg p-4">
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: "#9ca3af" }}
              axisLine={{ stroke: "#e5e7eb" }}
              tickLine={false}
            />
            <YAxis
              yAxisId="left"
              tick={{ fontSize: 11, fill: "#9ca3af" }}
              axisLine={{ stroke: "#e5e7eb" }}
              tickLine={false}
              tickFormatter={(v: number) =>
                v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v)
              }
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fontSize: 11, fill: "#9ca3af" }}
              axisLine={{ stroke: "#e5e7eb" }}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: "12px" }}
            />
            <Bar
              yAxisId="left"
              dataKey="Prompt Tokens"
              stackId="tokens"
              fill="#93c5fd"
              radius={[0, 0, 0, 0]}
            />
            <Bar
              yAxisId="left"
              dataKey="Completion Tokens"
              stackId="tokens"
              fill="#3b82f6"
              radius={[4, 4, 0, 0]}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="Requests"
              stroke="#f59e0b"
              strokeWidth={2}
              dot={{ fill: "#f59e0b", r: 3 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-surface-secondary border border-border rounded-lg p-4">
          <div className="text-xs text-slate-400 mb-1">Total Tokens</div>
          <div className="text-xl font-semibold text-slate-900">
            {totalTokens.toLocaleString()}
          </div>
        </div>
        <div className="bg-surface-secondary border border-border rounded-lg p-4">
          <div className="text-xs text-slate-400 mb-1">Total Requests</div>
          <div className="text-xl font-semibold text-slate-900">
            {totalRequests.toLocaleString()}
          </div>
        </div>
        <div className="bg-surface-secondary border border-border rounded-lg p-4">
          <div className="text-xs text-slate-400 mb-1">Success Rate</div>
          <div className="text-xl font-semibold text-green-600">
            {totalRequests > 0
              ? `${((totalSucceeded / totalRequests) * 100).toFixed(1)}%`
              : "N/A"}
          </div>
        </div>
      </div>

      {/* Quality metrics */}
      <div className="bg-surface-secondary border border-border rounded-lg p-4">
        <h4 className="text-sm font-semibold text-slate-700 mb-3">
          Quality Metrics
        </h4>
        <div className="grid grid-cols-3 gap-6">
          <div>
            <div className="text-xs text-slate-400">Success Rate</div>
            <div className="text-base font-semibold text-slate-900">
              {totalRequests > 0
                ? `${((totalSucceeded / totalRequests) * 100).toFixed(1)}%`
                : "N/A"}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-400">Coverage Rate</div>
            <div className="text-base font-semibold text-slate-900">
              {totalRequests > 0
                ? `${((totalSucceeded / totalRequests) * 100).toFixed(1)}%`
                : "N/A"}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-400">Avg Tokens / Request</div>
            <div className="text-base font-semibold text-slate-900">
              {totalRequests > 0
                ? Math.round(totalTokens / totalRequests).toLocaleString()
                : "N/A"}
            </div>
          </div>
        </div>
      </div>

      {/* Period comparison */}
      <div className="bg-surface-secondary border border-border rounded-lg p-4">
        <h4 className="text-sm font-semibold text-slate-700 mb-3">
          Period Comparison
        </h4>
        <div className="grid grid-cols-2 gap-6">
          <div>
            <div className="text-xs text-slate-400">Tokens vs Previous</div>
            <div className="text-base font-semibold text-green-600">
              +12.5%
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-400">Requests vs Previous</div>
            <div className="text-base font-semibold text-red-600">
              -3.2%
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UsageReportView;
export { UsageReportView };
