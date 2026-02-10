import type { LucideProps } from "lucide-react";

/**
 * Custom Telegram Icon Component
 * Using official Telegram SVG path designed to fit the Lucide icon set.
 */
export function TelegramIcon({ size = 24, ...props }: LucideProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      {/* Simplified Telegram Paper Plane Path 
        Optimized for high-contrast 'wemake' style
      */}
      <path 
        d="M21.174 3.512L2.2 11.55c-1.12.45-1.11 1.08-.2 1.36l4.87 1.52l1.35 4.14c.16.45.08.63.56.63c.37 0 .53-.17.74-.38l1.78-1.73l3.7 2.73c.68.38 1.17.18 1.34-.63l2.43-11.44c.25-1-.38-1.46-1.04-1.2l.01.01z" 
        fill="currentColor"
        stroke="none"
      />
    </svg>
  );
}