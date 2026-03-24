/**
 * v2 Layout
 *
 * A clean, minimal layout for all v2 routes.
 * - Accessible by both logged-in and anonymous users
 * - No auth redirect logic
 * - Includes v2 nav and footer once created
 */
import { Outlet } from "react-router";

export default function V2Layout() {
  return (
    <div className="flex min-h-screen flex-col bg-[#fdf8f0] font-sans text-[#1a2744]">
      {/* V2Nav will be added here */}
      <main className="flex-grow">
        <Outlet />
      </main>
      {/* V2Footer will be added here */}
    </div>
  );
}
