"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

interface Booking {
  id: string;
  ticket_code: string;
  passenger_name: string;
  passenger_phone: string;
  seat_count: number;
  total_amount: number;
  status: string;
  created_at: string;
  route?: { id: string; origin: string; destination: string };
  wave?: { departure_label: string };
}

interface Route {
  id: string;
  origin: string;
  destination: string;
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  paid: "bg-emerald-100 text-emerald-800",
  verified: "bg-blue-100 text-blue-800",
  expired: "bg-gray-100 text-gray-800",
  cancelled: "bg-red-100 text-red-800",
};

export default function AdminBookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const router = useRouter();

  const [filters, setFilters] = useState({
    status: "",
    route_id: "",
    date_from: "",
    date_to: "",
  });

  const fetchBookings = useCallback(async () => {
    const params = new URLSearchParams();
    if (filters.status) params.set("status", filters.status);
    if (filters.route_id) params.set("route_id", filters.route_id);
    if (filters.date_from) params.set("date_from", filters.date_from);
    if (filters.date_to) params.set("date_to", filters.date_to);
    params.set("page", page.toString());

    const res = await fetch(`/api/admin/bookings?${params}`);
    if (res.status === 401) { router.push("/admin/login"); return; }
    const data = await res.json();

    setBookings(data.bookings);
    setTotalPages(data.totalPages);
    setTotal(data.total);
  }, [filters, page, router]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetch("/api/admin/routes").then((r) => r.json()).then(setRoutes);
  }, []);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Bookings</h1>
        <span className="text-sm text-gray-500">{total} total bookings</span>
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
            <select
              value={filters.status}
              onChange={(e) => { setFilters({ ...filters, status: e.target.value }); setPage(1); }}
              className="w-full px-3 py-2 border rounded-lg text-sm"
            >
              <option value="">All</option>
              <option value="pending">Pending</option>
              <option value="paid">Paid</option>
              <option value="verified">Verified</option>
              <option value="expired">Expired</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Route</label>
            <select
              value={filters.route_id}
              onChange={(e) => { setFilters({ ...filters, route_id: e.target.value }); setPage(1); }}
              className="w-full px-3 py-2 border rounded-lg text-sm"
            >
              <option value="">All</option>
              {routes.map((r) => (
                <option key={r.id} value={r.id}>{r.origin} → {r.destination}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">From</label>
            <input
              type="date"
              value={filters.date_from}
              onChange={(e) => { setFilters({ ...filters, date_from: e.target.value }); setPage(1); }}
              className="w-full px-3 py-2 border rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">To</label>
            <input
              type="date"
              value={filters.date_to}
              onChange={(e) => { setFilters({ ...filters, date_to: e.target.value }); setPage(1); }}
              className="w-full px-3 py-2 border rounded-lg text-sm"
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ticket</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Passenger</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Route</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Wave</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Seats</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {bookings.map((b) => (
                <tr key={b.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-mono text-gray-900">{b.ticket_code || "—"}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{b.passenger_name}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {b.route ? `${b.route.origin} → ${b.route.destination}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">{b.wave?.departure_label || "—"}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{b.seat_count}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">SLL {b.total_amount.toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${STATUS_COLORS[b.status] || "bg-gray-100 text-gray-800"}`}>
                      {b.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {new Date(b.created_at).toLocaleDateString("en-SL")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {bookings.length === 0 && <p className="text-center py-8 text-gray-400">No bookings found</p>}

        {totalPages > 1 && (
          <div className="flex justify-between items-center px-4 py-3 border-t">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1 text-sm border rounded disabled:opacity-50"
            >
              Previous
            </button>
            <span className="text-sm text-gray-500">Page {page} of {totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1 text-sm border rounded disabled:opacity-50"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
