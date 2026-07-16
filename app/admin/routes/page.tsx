"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface Route {
  id: string;
  origin: string;
  destination: string;
  price_per_seat: number;
  active: boolean;
  created_at: string;
}

export default function AdminRoutesPage() {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Route | null>(null);
  const [form, setForm] = useState({ origin: "", destination: "", price_per_seat: 150000, active: true });
  const router = useRouter();

  useEffect(() => {
    fetchRoutes();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchRoutes() {
    const res = await fetch("/api/admin/routes");
    if (res.status === 401) { router.push("/admin/login"); return; }
    const data = await res.json();
    setRoutes(data);
    setLoading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const method = editing ? "PUT" : "POST";
    const body = editing ? { ...form, id: editing.id } : form;

    const res = await fetch("/api/admin/routes", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      setShowForm(false);
      setEditing(null);
      setForm({ origin: "", destination: "", price_per_seat: 150000, active: true });
      fetchRoutes();
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this route?")) return;
    await fetch("/api/admin/routes", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    fetchRoutes();
  }

  function startEdit(route: Route) {
    setEditing(route);
    setForm({ origin: route.origin, destination: route.destination, price_per_seat: route.price_per_seat, active: route.active });
    setShowForm(true);
  }

  if (loading) return <div className="text-center py-8 text-gray-500">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Routes</h1>
        <button
          onClick={() => { setShowForm(true); setEditing(null); setForm({ origin: "", destination: "", price_per_seat: 150000, active: true }); }}
          className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700"
        >
          + Add Route
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">{editing ? "Edit Route" : "New Route"}</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Origin</label>
                <input
                  type="text"
                  value={form.origin}
                  onChange={(e) => setForm({ ...form, origin: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Destination</label>
                <input
                  type="text"
                  value={form.destination}
                  onChange={(e) => setForm({ ...form, destination: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Price per Seat (SLL)</label>
                <input
                  type="number"
                  value={form.price_per_seat}
                  onChange={(e) => setForm({ ...form, price_per_seat: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border rounded-lg"
                  required
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
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Origin</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Destination</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Price/Seat</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {routes.map((route) => (
              <tr key={route.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 text-sm font-medium text-gray-900">{route.origin}</td>
                <td className="px-6 py-4 text-sm text-gray-700">{route.destination}</td>
                <td className="px-6 py-4 text-sm text-gray-700">SLL {route.price_per_seat.toLocaleString()}</td>
                <td className="px-6 py-4">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${route.active ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 text-gray-800"}`}>
                    {route.active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-6 py-4 text-right text-sm space-x-2">
                  <button onClick={() => startEdit(route)} className="text-emerald-600 hover:text-emerald-800">Edit</button>
                  <button onClick={() => handleDelete(route.id)} className="text-red-600 hover:text-red-800">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {routes.length === 0 && <p className="text-center py-8 text-gray-400">No routes yet</p>}
      </div>
    </div>
  );
}
