/**
 * [Lite Layout Component]
 * Provides a clean slate for the Lite version.
 * Does not include standard navigation/footer to maintain design consistency.
 */
import { Outlet } from "react-router";

export default function LiteLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-white font-sans text-slate-900">
      {/* LiteHeader and LiteFooter can be added here once created */}
      <main className="flex-grow">
        <Outlet />
      </main>
    </div>
  );
}