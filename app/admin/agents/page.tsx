"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface Agent {
  id: string;
  user_id: string;
  station_location: string;
  commission_rate: number;
  created_at: string;
  user?: { phone: string; name: string };
  totalCommission: number;
  verificationCount: number;
}

export default function AdminAgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/admin/agents")
      .then((r) => {
        if (r.status === 401) { router.push("/admin/login"); return []; }
        return r.json();
      })
      .then((data) => { setAgents(data); setLoading(false); });
  }, [router]);

  if (loading) return <div className="text-center py-8 text-gray-500">Loading...</div>;

  const totalOwed = agents.reduce((sum, a) => sum + a.totalCommission, 0);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Agents</h1>
        <div className="bg-white rounded-lg shadow px-4 py-2">
          <span className="text-sm text-gray-500">Total Commission Owed:</span>
          <span className="ml-2 text-lg font-bold text-red-600">SLL {totalOwed.toLocaleString()}</span>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Station</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Commission Rate</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Verifications</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Earned</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {agents.map((agent) => (
              <tr key={agent.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 text-sm font-medium text-gray-900">
                  {agent.user?.name || "—"}
                </td>
                <td className="px-6 py-4 text-sm text-gray-700">
                  {agent.user?.phone || "—"}
                </td>
                <td className="px-6 py-4 text-sm text-gray-700">
                  {agent.station_location}
                </td>
                <td className="px-6 py-4 text-sm text-gray-700">
                  {agent.commission_rate}%
                </td>
                <td className="px-6 py-4 text-sm text-gray-700">
                  {agent.verificationCount}
                </td>
                <td className="px-6 py-4 text-sm font-medium text-emerald-600">
                  SLL {agent.totalCommission.toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {agents.length === 0 && <p className="text-center py-8 text-gray-400">No agents registered</p>}
      </div>
    </div>
  );
}
