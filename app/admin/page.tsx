"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface Stats {
  todayBookings: number;
  totalBookings: number;
  todayRevenue: number;
  totalRevenue: number;
  verificationRate: number;
  noShowRate: number;
  dailyBookings: { date: string; label: string; value: number }[];
  dailyRevenue: { date: string; label: string; value: number }[];
}

function StatCard({ label, value, subtitle, color }: {
  label: string;
  value: string | number;
  subtitle?: string;
  color?: string;
}) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className={`text-3xl font-bold mt-2 ${color || "text-gray-900"}`}>{value}</p>
      {subtitle && <p className="text-sm text-gray-400 mt-1">{subtitle}</p>}
    </div>
  );
}

function MiniBarChart({ data, color = "#059669" }: { data: { label: string; value: number }[]; color?: string }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="flex items-end gap-1 h-32">
      {data.map((item, i) => (
        <div key={i} className="flex-1 flex flex-col items-center justify-end h-full group relative">
          <div className="absolute -top-6 hidden group-hover:block bg-gray-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10">
            {item.label}: {item.value.toLocaleString()}
          </div>
          <div
            className="w-full rounded-t transition-all duration-300 hover:opacity-80"
            style={{
              height: `${Math.max((item.value / max) * 100, 2)}%`,
              backgroundColor: color,
            }}
          />
        </div>
      ))}
    </div>
  );
}

export default function AdminOverviewPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/admin/stats")
      .then((r) => {
        if (r.status === 401) {
          router.push("/admin/login");
          return;
        }
        return r.json();
      })
      .then((data) => {
        if (data) {
          setStats(data);
          setLoading(false);
        }
      })
      .catch(() => setLoading(false));
  }, [router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading dashboard...</div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Failed to load stats</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Dashboard Overview</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Today's Bookings"
          value={stats.todayBookings}
          color="text-emerald-600"
        />
        <StatCard
          label="Today's Revenue"
          value={`SLL ${(stats.todayRevenue / 1000).toFixed(0)}k`}
          color="text-blue-600"
        />
        <StatCard
          label="Verification Rate"
          value={`${stats.verificationRate}%`}
          subtitle="of paid bookings verified"
          color="text-emerald-600"
        />
        <StatCard
          label="No-Show Rate"
          value={`${stats.noShowRate}%`}
          subtitle="paid but past departure"
          color="text-red-600"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Daily Bookings</h2>
          {stats.dailyBookings.length > 0 ? (
            <>
              <MiniBarChart data={stats.dailyBookings} color="#059669" />
              <div className="flex justify-between mt-2">
                {stats.dailyBookings.map((d, i) => (
                  <span key={i} className="text-xs text-gray-400 flex-1 text-center">{d.label}</span>
                ))}
              </div>
            </>
          ) : (
            <p className="text-gray-400 text-center py-8">No data yet</p>
          )}
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Daily Revenue</h2>
          {stats.dailyRevenue.length > 0 ? (
            <>
              <MiniBarChart
                data={stats.dailyRevenue.map((d) => ({ ...d, value: d.value / 1000 }))}
                color="#3B82F6"
              />
              <div className="flex justify-between mt-2">
                {stats.dailyRevenue.map((d, i) => (
                  <span key={i} className="text-xs text-gray-400 flex-1 text-center">{d.label}</span>
                ))}
              </div>
              <p className="text-xs text-gray-400 text-center mt-1">Revenue in SLL (thousands)</p>
            </>
          ) : (
            <p className="text-gray-400 text-center py-8">No data yet</p>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Summary</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Total Bookings:</span>
            <span className="ml-2 font-medium">{stats.totalBookings}</span>
          </div>
          <div>
            <span className="text-gray-500">Total Revenue:</span>
            <span className="ml-2 font-medium">SLL {(stats.totalRevenue / 1000).toFixed(0)}k</span>
          </div>
        </div>
      </div>
    </div>
  );
}
