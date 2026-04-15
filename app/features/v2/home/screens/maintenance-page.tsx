/**
 * /maintenance
 *
 * Shown to all non-admin users when maintenance_mode = true.
 * Accessible directly — no redirect loop.
 */
export default function MaintenancePage() {
  return (
    <div className="min-h-screen bg-[#fdf8f0] flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm text-center">

        {/* Leni image */}
        <div className="mb-6">
          <img
            src="/images/leni/leni-maintenance.jpg"
            alt="Leni"
            className="h-150 w-auto object-contain mx-auto"
          />
        </div>

        {/* Icon + title */}
        <div className="mb-3 text-4xl">🔧</div>
        <h1 className="font-display text-2xl font-black text-[#1a2744] mb-3">
          점검 중입니다
        </h1>

        {/* Message */}
        <p className="text-sm leading-relaxed text-[#6b7a99] mb-6">
          서비스 품질 향상을 위해 잠시 점검 중이에요.
          <br />
          빠른 시간 내에 돌아올게요! 🌱
        </p>

        {/* Nudge branding */}
        <div className="border-t border-[#e8ecf5] pt-5">
          <p className="text-xs text-[#c3c9d5]">Nudge · nudge.neowithai.com</p>
        </div>
      </div>
    </div>
  );
}
