import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getCostSummary } from '../api/client';
import { DollarSign } from 'lucide-react';
import PageBanner from '../components/PageBanner';
import { useMockToggle } from '../hooks/useMockToggle';
import MockToggle from '../components/MockToggle';
import { mockCostSummary } from '../mocks';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
} from 'recharts';

export default function DashboardPage() {
  const { useMock, toggleMock } = useMockToggle('dashboard');
  const [days, setDays] = useState(30);
  const { data: liveData, isLoading } = useQuery({
    queryKey: ['cost-summary', days],
    queryFn: () => getCostSummary(days),
    enabled: !useMock,
  });
  const data = useMock ? mockCostSummary : liveData;

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <DollarSign size={24} /> Cost & Monitoring Dashboard
        </h1>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500">Time Range:</label>
            <select
              className="border rounded-lg px-2 py-1 text-sm"
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
            >
              <option value={7}>7 days</option>
              <option value={14}>14 days</option>
              <option value={30}>30 days</option>
              <option value={60}>60 days</option>
              <option value={90}>90 days</option>
            </select>
          </div>
          <MockToggle enabled={useMock} onToggle={toggleMock} />
        </div>
      </div>
      <p className="text-gray-600 text-sm mb-6">
        Track token usage, API costs, and latency trends across all operations.
      </p>

      <PageBanner
        title="How to use the Cost Dashboard"
        description="Monitor your Azure OpenAI spend, token consumption, and request volume across all deployments in real time."
        accentColor="blue"
        steps={[
          { label: 'View summary cards', detail: `Total cost (USD), tokens consumed, and API requests over the selected ${days}-day window are shown at the top.` },
          { label: 'Analyse daily cost trends', detail: 'The line chart shows day-by-day cost so you can spot spikes or unusual patterns.' },
          { label: 'Compare deployments', detail: 'The bar chart breaks cost down per model deployment so you can see which model drives the most spend.' },
        ]}
        tips={[
          'Use the Time Range selector to view costs over 7, 14, 30, 60, or 90 days.',
          'Switch to Test Data mode to explore the dashboard without live Azure charges.',
          'Run experiments, evaluations, or performance tests to generate real cost data.',
          'Costs are aggregated over the selected time window.',
        ]}
      />

      {isLoading && !useMock ? (
        <div className="text-gray-400">Loading dashboard data…</div>
      ) : !data ? (
        <div className="text-gray-400">No cost data yet. Run some experiments or tests first.</div>
      ) : (
        <div className="space-y-6">
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Card label={`Total Cost (${days}d)`} value={`$${data.total_cost_usd?.toFixed(4) ?? '0'}`} />
            <Card label="Total Tokens" value={data.total_tokens?.toLocaleString() ?? '0'} />
            <Card label="Total Requests" value={data.total_requests?.toLocaleString() ?? '0'} />
          </div>

          {/* Daily cost chart */}
          {data.daily_breakdown && data.daily_breakdown.length > 0 && (
            <div className="bg-white rounded-xl border p-4">
              <h3 className="text-sm font-semibold mb-3">Daily Cost Trend (USD)</h3>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={data.daily_breakdown}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" fontSize={11} />
                  <YAxis fontSize={11} />
                  <Tooltip />
                  <Line type="monotone" dataKey="cost_usd" stroke="#6366f1" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* By deployment */}
          {data.by_deployment && data.by_deployment.length > 0 && (
            <div className="bg-white rounded-xl border p-4">
              <h3 className="text-sm font-semibold mb-3">Cost by Deployment</h3>

              {/* Standard vs PTU summary bar */}
              {(() => {
                const stdCost = data.by_deployment.filter((d: any) => d.deployment_type !== 'PTU').reduce((s: number, d: any) => s + (d.cost_usd ?? 0), 0);
                const ptuCost = data.by_deployment.filter((d: any) => d.deployment_type === 'PTU').reduce((s: number, d: any) => s + (d.cost_usd ?? 0), 0);
                const total = stdCost + ptuCost;
                return total > 0 ? (
                  <div className="mb-4 space-y-2">
                    <div className="flex items-center gap-3 text-xs">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-100 text-blue-700 font-medium">Standard ${stdCost.toFixed(2)}</span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-purple-100 text-purple-700 font-medium">PTU ${ptuCost.toFixed(2)}</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-gray-200 flex overflow-hidden">
                      <div className="bg-blue-500 h-full" style={{ width: `${(stdCost / total) * 100}%` }} />
                      <div className="bg-purple-500 h-full" style={{ width: `${(ptuCost / total) * 100}%` }} />
                    </div>
                  </div>
                ) : null;
              })()}

              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={data.by_deployment}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="deployment" fontSize={11} />
                  <YAxis fontSize={11} />
                  <Tooltip content={({ active, payload }: any) => {
                    if (!active || !payload?.[0]) return null;
                    const d = payload[0].payload;
                    const isPTU = d.deployment_type === 'PTU';
                    return (
                      <div className="bg-white border rounded-lg shadow-lg p-3 text-xs">
                        <div className="font-semibold mb-1">{d.deployment}</div>
                        <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium mb-2 ${isPTU ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                          {isPTU ? 'PTU' : 'Standard'}
                        </span>
                        <div>Cost: ${d.cost_usd?.toFixed(4)}</div>
                        <div>Requests: {d.requests?.toLocaleString()}</div>
                        {isPTU && d.ptu_units && <div>PTU Units: {d.ptu_units}</div>}
                        {isPTU && d.ptu_hourly_rate && <div>Rate: ${d.ptu_hourly_rate}/hr</div>}
                        {isPTU && d.ptu_utilization_pct != null && <div>Utilization: {d.ptu_utilization_pct}%</div>}
                      </div>
                    );
                  }} />
                  <Legend />
                  <Bar dataKey="cost_usd" name="Cost (USD)" fill="#6366f1" />
                  <Bar dataKey="requests" name="Requests" fill="#f59e0b" />
                </BarChart>
              </ResponsiveContainer>

              {/* Deployment detail table */}
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 text-gray-600">
                    <tr>
                      <th className="px-3 py-2 text-left">Deployment</th>
                      <th className="px-3 py-2 text-center">Type</th>
                      <th className="px-3 py-2 text-right">Cost</th>
                      <th className="px-3 py-2 text-right">Requests</th>
                      <th className="px-3 py-2 text-right">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {data.by_deployment.map((d: any, i: number) => {
                      const isPTU = d.deployment_type === 'PTU';
                      return (
                        <tr key={i} className={`hover:bg-gray-50 ${isPTU ? 'border-l-2 border-l-purple-400' : ''}`}>
                          <td className="px-3 py-2 font-medium">{d.deployment}</td>
                          <td className="px-3 py-2 text-center">
                            <span className={`inline-flex px-2 py-0.5 rounded font-medium ${isPTU ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                              {isPTU ? 'PTU' : 'Standard'}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right font-mono">${d.cost_usd?.toFixed(2)}</td>
                          <td className="px-3 py-2 text-right font-mono">{d.requests?.toLocaleString()}</td>
                          <td className="px-3 py-2 text-right text-gray-500">
                            {isPTU ? (
                              <span>{d.ptu_units} PTUs · ${d.ptu_hourly_rate}/hr · {d.ptu_utilization_pct}% util</span>
                            ) : (
                              <span>Pay-per-token</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-xl border p-4">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-xl font-bold text-gray-900">{value}</p>
    </div>
  );
}
