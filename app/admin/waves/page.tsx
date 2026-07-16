"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface Wave {
  id: string;
  route_id: string;
  departure_label: string;
  capacity_estimate: number;
  active: boolean;
  created_at: string;
  route?: { origin: string; destination: string };
}

interface Route {
  id: string;
  origin: string;
  destination: string;
}

export default function AdminWavesPage() {
  const [waves, setWaves] = useState<Wave[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Wave | null>(null);
  const [form, setForm] = useState({ route_id: "", departure_label: "", capacity_estimate: 45, active: true });
  const router = useRouter();

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/waves").then((r) => r.json()),
      fetch("/api/admin/routes").then((r) => r.json()),
    ]).then(([w, r]) => {
      if (w.error === "Unauthorized") { router.push("/admin/login"); return; }
      setWaves(w);
      setRoutes(r);
      setLoading(false);
    });
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const method = editing ? "PUT" : "POST";
    const body = editing ? { ...form, id: editing.id } : form;

    const res = await fetch("/api/admin/waves", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      setShowForm(false);
      setEditing(null);
      setForm({ route_id: "", departure_label: "", capacity_estimate: 45, active: true });
      const data = await fetch("/api/admin/waves").then((r) => r.json());
      setWaves(data);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this wave?")) return;
    await fetch("/api/admin/waves", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const data = await fetch("/api/admin/waves").then((r) => r.json());
    setWaves(data);
  }

  function startEdit(wave: Wave) {
    setEditing(wave);
    setForm({ route_id: wave.route_id, departure_label: wave.departure_label, capacity_estimate: wave.capacity_estimate, active: wave.active });
    setShowForm(true);
  }

  if (loading) return <div className="text-center py-8 text-gray-500">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Waves</h1>
        <button
          onClick={() => { setShowForm(true); setEditing(null); setForm({ route_id: routes[0]?.id || "", departure_label: "", capacity_estimate: 45, active: true }); }}
          className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700"
        >
          + Add Wave
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">{editing ? "Edit Wave" : "New Wave"}</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Route</label>
                <select
                  value={form.route_id}
                  onChange={(e) => setForm({ ...form, route_id: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  required
                >
                  <option value="">Select route</option>
                  {routes.map((r) => (
                    <option key={r.id} value={r.id}>{r.origin} → {r.destination}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Departure Time</label>
                <input
                  type="text"
                  value={form.departure_label}
                  onChange={(e) => setForm({ ...form, departure_label: e.target.value })}
                  placeholder="06:00 AM"
                  className="w-full px-3 py-2 border rounded-lg"
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Capacity</label>
                <input
                  type="number"
                  value={form.capacity_estimate}
                  onChange={(e) => setForm({ ...form, capacity_estimate: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.active}
                    onChange={(e) => setForm({ ...form, active: e.target.checked })}
                    className="w-4 h-4 text-emerald-600 rounded"
                  />
                  <span className="text-sm font-medium text-gray-700">Active</span>
                </label>
              </div>
            </div>
            <div className="flex gap-2">
              <button type="submit" className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700">
                {editing ? "Update" : "Create"}
              </button>
              <button type="button" onClick={() => { setShowForm(false); setEditing(null); }} className="text-gray-600 px-4 py-2 hover:text-gray-800">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Route</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Departure</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Capacity</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {waves.map((wave) => (
              <tr key={wave.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 text-sm font-medium text-gray-900">
                  {wave.route ? `${wave.route.origin} → ${wave.route.destination}` : wave.route_id}
                </td>
                <td className="px-6 py-4 text-sm text-gray-700">{wave.departure_label}</td>
                <td className="px-6 py-4 text-sm text-gray-700">{wave.capacity_estimate}</td>
                <td className="px-6 py-4">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${wave.active ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 text-gray-800"}`}>
                    {wave.active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-6 py-4 text-right text-sm space-x-2">
                  <button onClick={() => startEdit(wave)} className="text-emerald-600 hover:text-emerald-800">Edit</button>
                  <button onClick={() => handleDelete(wave.id)} className="text-red-600 hover:text-red-800">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {waves.length === 0 && <p className="text-center py-8 text-gray-400">No waves yet</p>}
      </div>
    </div>
  );
}
