/**
 * Original umroh-theme SVG illustrations — drawn entirely in code.
 * No third-party images or photo assets are used.
 */

/** Kaaba scene: cube, kiswah drape, Hajar Aswad band, crescent moon, stars */
export function KaabaIllustration({ size = 220, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 220 200"
      width={size}
      height={(size * 200) / 220}
      className={className}
      aria-label="Ilustrasi Ka'bah"
      role="img"
      style={{ overflow: 'visible' }}
    >
      {/* Sky gradient */}
      <defs>
        <linearGradient id="sky-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0a1628" />
          <stop offset="100%" stopColor="#1a3a5c" />
        </linearGradient>
        <linearGradient id="kaaba-front" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1a1208" />
          <stop offset="100%" stopColor="#0d0a04" />
        </linearGradient>
        <linearGradient id="kaaba-side" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#0d0a04" />
          <stop offset="100%" stopColor="#241c0a" />
        </linearGradient>
        <linearGradient id="ground-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#c8b98a" />
          <stop offset="100%" stopColor="#a0916a" />
        </linearGradient>
      </defs>

      {/* Background */}
      <rect width="220" height="200" fill="url(#sky-grad)" />

      {/* Stars */}
      {[[18,22],[40,12],[65,8],[95,18],[125,6],[148,20],[170,10],[195,16],[210,28],[30,40],[80,35],[155,38],[190,42]].map(([cx,cy],i) => (
        <circle key={i} cx={cx} cy={cy} r={i % 3 === 0 ? 1.2 : 0.7} fill="#fff" opacity={0.6 + (i % 4) * 0.1} />
      ))}

      {/* Crescent moon */}
      <g transform="translate(172,28)">
        <circle r={14} fill="#f0d080" />
        <circle cx={6} cy={-4} r={12} fill="#1a3a5c" />
        {/* Moon star */}
        <polygon points="22,-2 23.5,2 27.5,2 24.5,4.5 25.5,8.5 22,6 18.5,8.5 19.5,4.5 16.5,2 20.5,2" fill="#f0d080" transform="scale(0.55) translate(-4,4)" />
      </g>

      {/* Ground / marble floor */}
      <ellipse cx="110" cy="185" rx="95" ry="12" fill="url(#ground-grad)" opacity="0.7" />
      <rect x="30" y="178" width="160" height="8" rx="2" fill="#d4c89a" />

      {/* Kaaba body — isometric perspective */}
      {/* Front face */}
      <polygon points="55,155 55,82 140,82 140,155" fill="url(#kaaba-front)" />
      {/* Right face */}
      <polygon points="140,82 165,68 165,142 140,155" fill="url(#kaaba-side)" />
      {/* Top face */}
      <polygon points="55,82 80,68 165,68 140,82" fill="#2a2010" />

      {/* Kiswah gold band (top horizontal stripe on front) */}
      <polygon points="55,98 55,90 140,90 140,98" fill="#c9a227" opacity="0.85" />
      {/* Gold band side */}
      <polygon points="140,90 165,77 165,85 140,98" fill="#b08820" opacity="0.85" />

      {/* Kiswah calligraphy lines on front (simulated) */}
      {[107,116,125,134,143].map((y,i) => (
        <g key={i}>
          <rect x={62} y={y} width={i%2===0?60:50} height={1.5} rx={0.7} fill="#c9a227" opacity={0.5} />
        </g>
      ))}

      {/* Hajar Aswad corner mark (lower-left corner of front face) */}
      <circle cx={57} cy={148} r={4.5} fill="#3a2a18" stroke="#c9a227" strokeWidth="1" />
      <circle cx={57} cy={148} r={2} fill="#1a0f08" />

      {/* Door (front face) */}
      <rect x={86} y={110} width={24} height={36} rx={2} fill="#2a1e0a" />
      <rect x={88} y={112} width={20} height={32} rx={1.5} fill="#1a1208" />
      {/* Door gold frame */}
      <rect x={86} y={110} width={24} height={3} rx={1} fill="#c9a227" opacity="0.9" />
      <rect x={86} y={110} width={3} height={36} rx={1} fill="#c9a227" opacity="0.9" />
      <rect x={107} y={110} width={3} height={36} rx={1} fill="#c9a227" opacity="0.9" />
      {/* Door handle */}
      <circle cx={100} cy={130} r={2} fill="#c9a227" />

      {/* Pilgrims silhouettes (tawaf) */}
      {[
        [50, 172, 0.9],
        [70, 175, 0.85],
        [90, 176, 0.9],
        [115, 176, 0.85],
        [135, 175, 0.88],
        [155, 172, 0.82],
        [170, 170, 0.78],
      ].map(([x, y, op], i) => (
        <g key={i} transform={`translate(${x},${y})`} opacity={op}>
          {/* ihram robe */}
          <ellipse cx={0} cy={-8} rx={4} ry={6} fill="#fff" opacity={0.92} />
          {/* head */}
          <circle cx={0} cy={-16} r={3} fill="#e8d5b0" />
          {/* arms raised in dua (every other) */}
          {i % 2 === 0
            ? <><line x1={-4} y1={-10} x2={-7} y2={-14} stroke="#fff" strokeWidth={1.2} /><line x1={4} y1={-10} x2={7} y2={-14} stroke="#fff" strokeWidth={1.2} /></>
            : <><line x1={-4} y1={-10} x2={-6} y2={-9} stroke="#fff" strokeWidth={1.2} /><line x1={4} y1={-10} x2={6} y2={-9} stroke="#fff" strokeWidth={1.2} /></>
          }
        </g>
      ))}

      {/* Subtle glow under kaaba */}
      <ellipse cx="97" cy="176" rx="50" ry="5" fill="#c9a227" opacity="0.12" />
    </svg>
  );
}

/** Minaret & dome scene — for package hero backgrounds */
export function MinaretIllustration({ size = 280, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 280 160"
      width={size}
      height={(size * 160) / 280}
      className={className}
      aria-label="Ilustrasi Masjid"
      role="img"
    >
      <defs>
        <linearGradient id="dawn-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0d1b2e" />
          <stop offset="50%" stopColor="#1a3a6a" />
          <stop offset="100%" stopColor="#e8834a" />
        </linearGradient>
        <linearGradient id="mosque-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#e8e0cc" />
          <stop offset="100%" stopColor="#c8bfa8" />
        </linearGradient>
        <radialGradient id="glow" cx="50%" cy="100%" r="50%">
          <stop offset="0%" stopColor="#e8834a" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#e8834a" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Sky */}
      <rect width="280" height="160" fill="url(#dawn-sky)" />
      {/* Horizon glow */}
      <rect width="280" height="160" fill="url(#glow)" />

      {/* Stars */}
      {[[20,15],[45,8],[75,20],[100,10],[200,12],[230,7],[255,18],[265,30],[15,35]].map(([cx,cy],i) => (
        <circle key={i} cx={cx} cy={cy} r={0.8} fill="#fff" opacity={0.7} />
      ))}

      {/* Ground */}
      <rect x="0" y="145" width="280" height="15" fill="#c8bfa8" />
      <rect x="0" y="148" width="280" height="12" fill="#b8af98" />

      {/* Left minaret */}
      <g transform="translate(52,0)">
        {/* Shaft */}
        <rect x={-6} y={50} width={12} height={80} fill="url(#mosque-body)" />
        {/* Balcony */}
        <rect x={-9} y={72} width={18} height={4} rx={1} fill="#d4c8a8" />
        {/* Upper shaft */}
        <rect x={-5} y={38} width={10} height={34} fill="#e0d8c0" />
        {/* Conical top */}
        <polygon points="-5,38 5,38 0,18" fill="#b87333" />
        {/* Crescent */}
        <g transform="translate(0,13)">
          <circle r={4} fill="#d4a820" />
          <circle cx={2} cy={-1.5} r={3.2} fill="#0d1b2e" />
          <line x1={0} y1={-7} x2={0} y2={-12} stroke="#d4a820" strokeWidth="1" />
          <polygon points="-1.5,-12 1.5,-12 0,-16" fill="#d4a820" />
        </g>
      </g>

      {/* Right minaret */}
      <g transform="translate(228,0)">
        <rect x={-6} y={50} width={12} height={80} fill="url(#mosque-body)" />
        <rect x={-9} y={72} width={18} height={4} rx={1} fill="#d4c8a8" />
        <rect x={-5} y={38} width={10} height={34} fill="#e0d8c0" />
        <polygon points="-5,38 5,38 0,18" fill="#b87333" />
        <g transform="translate(0,13)">
          <circle r={4} fill="#d4a820" />
          <circle cx={2} cy={-1.5} r={3.2} fill="#0d1b2e" />
          <line x1={0} y1={-7} x2={0} y2={-12} stroke="#d4a820" strokeWidth="1" />
          <polygon points="-1.5,-12 1.5,-12 0,-16" fill="#d4a820" />
        </g>
      </g>

      {/* Mosque body */}
      <rect x={75} y={95} width={130} height={50} fill="url(#mosque-body)" rx={2} />

      {/* Side arched wings */}
      <rect x={60} y={108} width={30} height={37} fill="#dfd8c0" rx={1} />
      <rect x={190} y={108} width={30} height={37} fill="#dfd8c0" rx={1} />

      {/* Arched windows on wings */}
      <path d="M68,140 L68,125 Q73,118 78,125 L78,140 Z" fill="#1a3a6a" opacity="0.6" />
      <path d="M198,140 L198,125 Q203,118 208,125 L208,140 Z" fill="#1a3a6a" opacity="0.6" />

      {/* Main arched entrance */}
      <path d="M118,145 L118,118 Q140,102 162,118 L162,145 Z" fill="#1a3a6a" opacity="0.7" />

      {/* Side arched windows on body */}
      <path d="M80,135 L80,118 Q89,108 98,118 L98,135 Z" fill="#1a3a6a" opacity="0.5" />
      <path d="M182,135 L182,118 Q191,108 200,118 L200,135 Z" fill="#1a3a6a" opacity="0.5" />

      {/* Main central dome */}
      <ellipse cx={140} cy={96} rx={36} ry={8} fill="#d4c8a8" />
      <path d="M104,96 Q104,56 140,52 Q176,56 176,96 Z" fill="#e8e0cc" />
      {/* Dome rib lines */}
      {[-25,-12,0,12,25].map((dx, i) => (
        <path key={i} d={`M${140+dx},96 Q${140 + dx*0.5},${56 + Math.abs(dx)*0.3} 140,52`} stroke="#d4c8a8" strokeWidth="0.8" fill="none" opacity="0.6" />
      ))}
      {/* Dome finial */}
      <line x1={140} y1={52} x2={140} y2={38} stroke="#b87333" strokeWidth="2" />
      <circle cx={140} cy={36} r={3} fill="#d4a820" />
      {/* Crescent on dome */}
      <g transform="translate(140,28)">
        <circle r={5} fill="#d4a820" />
        <circle cx={2.5} cy={-2} r={4} fill="#0d1b2e" />
        <line x1={0} y1={-8} x2={0} y2={-13} stroke="#d4a820" strokeWidth="1.2" />
        <polygon points="-2,-13 2,-13 0,-18" fill="#d4a820" />
      </g>

      {/* Smaller side domes */}
      <path d="M85,108 Q85,90 100,88 Q115,90 115,108 Z" fill="#dfd8c0" />
      <path d="M165,108 Q165,90 180,88 Q195,90 195,108 Z" fill="#dfd8c0" />

      {/* Reflection on marble floor */}
      <rect x={75} y={145} width={130} height={6} fill="#b8af98" opacity="0.3" rx={1} />
    </svg>
  );
}

/** Simple crescent-and-star badge icon */
export function CrescentBadge({ size = 40, className = '' }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} className={className} aria-hidden="true">
      <circle r={18} cx={20} cy={20} fill="#1a3a6a" />
      <circle r={14} cx={20} cy={20} fill="#0d1b2e" />
      <circle r={10} cx={20} cy={20} fill="#d4a820" />
      <circle r={8} cx={23} cy={18} fill="#1a3a6a" />
      <polygon points="32,16 33.5,20.5 38,20.5 34.5,23.2 35.8,27.5 32,25 28.2,27.5 29.5,23.2 26,20.5 30.5,20.5" fill="#d4a820" transform="scale(0.45) translate(28,8)" />
    </svg>
  );
}
