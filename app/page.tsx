import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-600 to-blue-800 text-white">
      <header className="container mx-auto px-4 py-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Salone Transit</h1>
        <nav className="flex gap-4 text-sm">
          <Link href="/book" className="hover:underline">
            Book Now
          </Link>
          <Link href="/agent/login" className="hover:underline">
            Agent Login
          </Link>
        </nav>
      </header>

      <main className="container mx-auto px-4 py-16 flex flex-col items-center text-center gap-8">
        <h2 className="text-4xl sm:text-5xl font-extrabold leading-tight">
          Freetown → Bo
        </h2>
        <p className="text-lg sm:text-xl text-blue-100 max-w-xl">
          Reliable inter-city bus booking for Sierra Leone. Reserve your seat,
          pay with mobile money, and get verified at the station.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 mt-4">
          <Link
            href="/book"
            className="rounded-full bg-white text-blue-700 font-semibold px-8 py-3 hover:bg-blue-50 transition-colors"
          >
            Book a Seat
          </Link>
          <Link
            href="/agent/login"
            className="rounded-full border-2 border-white text-white font-semibold px-8 py-3 hover:bg-white/10 transition-colors"
          >
            Agent Portal
          </Link>
        </div>

        <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-8 text-left max-w-3xl w-full">
          <div className="bg-white/10 rounded-xl p-6">
            <h3 className="font-bold text-lg mb-2">Mobile Money</h3>
            <p className="text-blue-100 text-sm">
              Pay securely with Orange Money or Africell Money — no card needed.
            </p>
          </div>
          <div className="bg-white/10 rounded-xl p-6">
            <h3 className="font-bold text-lg mb-2">Instant Ticket</h3>
            <p className="text-blue-100 text-sm">
              Get your ticket code instantly via SMS after payment confirmation.
            </p>
          </div>
          <div className="bg-white/10 rounded-xl p-6">
            <h3 className="font-bold text-lg mb-2">Easy Verification</h3>
            <p className="text-blue-100 text-sm">
              Show your ticket code at the station — agents scan and verify in seconds.
            </p>
          </div>
        </div>
      </main>

      <footer className="container mx-auto px-4 py-8 text-center text-blue-200 text-sm">
        © {new Date().getFullYear()} Salone Transit. All rights reserved.
      </footer>
    </div>
  );
}
