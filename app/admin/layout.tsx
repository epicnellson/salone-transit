import { cookies } from "next/headers";
import Link from "next/link";
import { getAdminFromSession } from "@/lib/auth";
import { verifySessionToken } from "@/lib/auth";

async function getAdmin() {
  const cookieStore = await cookies();
  const session = cookieStore.get("admin_session")?.value;
  if (!session) return null;

  const token = verifySessionToken(session);
  if (!token) return null;

  return getAdminFromSession(session);
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await getAdmin();

  const navItems = [
    { href: "/admin", label: "Overview", icon: "📊" },
    { href: "/admin/bookings", label: "Bookings", icon: "🎫" },
    { href: "/admin/routes", label: "Routes", icon: "🚌" },
    { href: "/admin/waves", label: "Waves", icon: "🌊" },
    { href: "/admin/agents", label: "Agents", icon: "👤" },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <Link href="/admin" className="text-xl font-bold text-emerald-600">
                  ST Admin
                </Link>
              </div>
              <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                {navItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="inline-flex items-center px-1 pt-1 text-sm font-medium text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  >
                    <span className="mr-1">{item.icon}</span>
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
            <div className="flex items-center">
              {admin && (
                <span className="text-sm text-gray-500 mr-4">Admin</span>
              )}
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}
