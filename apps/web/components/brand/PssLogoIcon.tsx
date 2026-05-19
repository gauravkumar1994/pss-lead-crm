/** Inline PSS mark — always renders (no /public fetch, no 404 PNG bug) */
export function PssLogoIcon({ size = 56 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="28 22 144 156"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="PSS"
      className="pss-logo-svg"
    >
      <defs>
        <linearGradient id="pssGradInline" x1="50%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%" stopColor="#B8E986" />
          <stop offset="45%" stopColor="#7CB342" />
          <stop offset="100%" stopColor="#33691E" />
        </linearGradient>
      </defs>
      <path
        fill="url(#pssGradInline)"
        d="M100 24c-30 0-54 20-60 48-3 13-1 26 4 36-6 10-9 22-7 34 3 22 24 40 48 42 7 1 14 0 20-4 9 6 20 10 31 8 27-3 48-24 51-50 2-12-1-24-8-34 5-11 7-23 4-36C154 44 130 24 100 24zm-38 50c3-15 17-26 34-26s31 11 34 26c-9-3-18-5-28-5s-19 2-28 5zm56 82c-15 3-30-3-38-15 12 8 27 9 38 4 11 5 26 4 38-4-9 12-23 19-38 15z"
      />
      <g fill="none" stroke="#DCEDC8" strokeWidth="2.2" strokeLinecap="round" opacity="0.9">
        <path d="M58 78h18v12H58zm68 0h18v12h-18zM74 102h52M64 128h72M84 152h32" />
        <circle cx="67" cy="84" r="2.8" fill="#F1F8E9" />
        <circle cx="133" cy="84" r="2.8" fill="#F1F8E9" />
        <circle cx="100" cy="102" r="2.8" fill="#F1F8E9" />
      </g>
      <text
        x="100"
        y="122"
        textAnchor="middle"
        fontFamily="Arial Black, Segoe UI, sans-serif"
        fontSize="44"
        fontWeight="900"
        fill="#1B5E20"
      >
        PSS
      </text>
    </svg>
  );
}
