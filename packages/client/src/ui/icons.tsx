import type { UnitType } from '@jarlheim/sim';

/** Small inline SVG icons for the HUD (no icon font, no extra download). */
type IconProps = { size?: number };

const svg = (size: number, children: React.ReactNode) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
    {children}
  </svg>
);

export const FoodIcon = ({ size = 18 }: IconProps) =>
  svg(
    size,
    <g fill="#e2b85c">
      <path d="M12 2c1.5 2 1.5 4 0 6-1.5-2-1.5-4 0-6z" />
      <path d="M7 6c2 .5 3.5 2 4 4.5-2.2-.3-3.6-1.8-4-4.5zM17 6c-2 .5-3.5 2-4 4.5 2.2-.3 3.6-1.8 4-4.5z" />
      <path d="M7 11c2 .5 3.5 2 4 4.5-2.2-.3-3.6-1.8-4-4.5zM17 11c-2 .5-3.5 2-4 4.5 2.2-.3 3.6-1.8 4-4.5z" />
      <rect x="11.3" y="8" width="1.4" height="14" rx=".7" />
    </g>,
  );

export const TimberIcon = ({ size = 18 }: IconProps) =>
  svg(
    size,
    <g>
      <rect x="2" y="8" width="18" height="8" rx="4" fill="#8a5a36" />
      <ellipse cx="20" cy="12" rx="2.6" ry="4" fill="#d9b48a" />
      <ellipse cx="20" cy="12" rx="1.2" ry="2" fill="#b98a5e" />
    </g>,
  );

export const IronIcon = ({ size = 18 }: IconProps) =>
  svg(
    size,
    <path d="M3 17l3-7h12l3 7z" fill="#9aa3ad" stroke="#5f6770" strokeWidth="1.2" strokeLinejoin="round" />,
  );

export const SilverIcon = ({ size = 18 }: IconProps) =>
  svg(
    size,
    <g fill="none" stroke="#d7dde3" strokeWidth="1.6" strokeLinecap="round">
      <path d="M12 3v17M5 7h14M8 20h8" />
      <path d="M5 7l-3 6h6zM19 7l-3 6h6z" fill="#d7dde3" fillOpacity=".35" />
    </g>,
  );

export const GoldIcon = ({ size = 18 }: IconProps) =>
  svg(
    size,
    <g fill="none" stroke="#f0c44c" strokeWidth="2.4">
      <ellipse cx="12" cy="12" rx="8" ry="5" />
      <ellipse cx="12" cy="12" rx="4.5" ry="2.4" strokeWidth="1.2" />
    </g>,
  );

export const PowerIcon = ({ size = 18 }: IconProps) =>
  svg(
    size,
    <g fill="#e9e1cf">
      <path d="M4 20L16 8l1.5 1.5L5.5 21.5zM15 4l5 5-2 2-5-5z" />
      <path d="M20 20L8 8 6.5 9.5l12 12zM9 4L4 9l2 2 5-5z" fillOpacity=".7" />
    </g>,
  );

const BY_RESOURCE = {
  food: FoodIcon,
  timber: TimberIcon,
  iron: IronIcon,
  silver: SilverIcon,
  gold: GoldIcon,
} as const;

export const ResourceIcon = ({ res, size = 18 }: { res: keyof typeof BY_RESOURCE; size?: number }) => {
  const Icon = BY_RESOURCE[res];
  return <Icon size={size} />;
};

/** Unit marks: shield, axe, bow, horse, bear paw, ram, ship and wall. */
export const TroopTypeIcon = ({ type, size = 18 }: { type: UnitType; size?: number }) => {
  switch (type) {
    case 'shieldwall':
      return svg(
        size,
        <g>
          <circle cx="12" cy="12" r="9" fill="#a83a2c" stroke="#e9e1cf" strokeWidth="1.5" />
          <circle cx="12" cy="12" r="2.6" fill="#c9c4b8" />
        </g>,
      );
    case 'berserker':
      return svg(
        size,
        <g>
          <rect x="11" y="3" width="2" height="18" rx="1" fill="#9a6a3a" />
          <path d="M13 4c5 0 7 3 7 6-2-1-4-1-7 0z" fill="#c9d0d6" />
        </g>,
      );
    case 'archer':
      return svg(
        size,
        <g fill="none" strokeLinecap="round">
          <path d="M7 3c8 4 8 14 0 18" stroke="#c48a4a" strokeWidth="2.2" />
          <path d="M7 3v18" stroke="#e9e1cf" strokeWidth="1" />
          <path d="M4 12h15M16 9l3 3-3 3" stroke="#c9d0d6" strokeWidth="1.6" />
        </g>,
      );
    case 'cavalry':
      return svg(
        size,
        <path
          d="M6 21l1-7c-2-1-3-4-1-7l4-3 1 2 4-1c3 1 5 4 5 7l-2 1-3-2-2 3 1 7z"
          fill="#a0704a"
          stroke="#e9e1cf"
          strokeWidth="1"
        />,
      );
    case 'bear':
      return svg(
        size,
        <g fill="#6a4a32">
          <ellipse cx="12" cy="15" rx="5.5" ry="4.5" />
          <circle cx="6" cy="9" r="2" />
          <circle cx="10" cy="6.5" r="2" />
          <circle cx="14" cy="6.5" r="2" />
          <circle cx="18" cy="9" r="2" />
        </g>,
      );
    case 'siege':
      return svg(
        size,
        <g>
          <rect x="3" y="9" width="16" height="4" rx="2" fill="#9a6a3a" />
          <rect x="18" y="8" width="3" height="6" rx="1" fill="#8a9098" />
          <circle cx="7" cy="17" r="3" fill="#5a3a1e" stroke="#e9e1cf" />
          <circle cx="15" cy="17" r="3" fill="#5a3a1e" stroke="#e9e1cf" />
        </g>,
      );
    case 'ship':
      return svg(
        size,
        <g>
          <path d="M2 15h20c-2 4-5 5-10 5S4 19 2 15z" fill="#7a5236" />
          <path d="M12 3v12" stroke="#5a3a1e" strokeWidth="1.4" />
          <path d="M12 4l7 8h-7z" fill="#a83a2c" />
          <path d="M2 15l-1-3M22 15l1-3" stroke="#5a3a1e" strokeWidth="1.4" />
        </g>,
      );
    case 'wall':
      return svg(
        size,
        <g fill="#8a6446">
          {[3, 7, 11, 15, 19].map((x) => (
            <path key={x} d={`M${x} 21V8l1.5-3L${x + 3} 8v13z`} />
          ))}
        </g>,
      );
  }
};

// ---- HUD buttons (icons instead of words: owner request) --------------------------

export const BuilderIcon = ({ size = 22 }: IconProps) =>
  svg(
    size,
    <g>
      <rect x="10.8" y="8" width="2.4" height="14" rx="1.2" fill="#9a6a3a" transform="rotate(-35 12 15)" />
      <path d="M5 6l6-3 3 3-6 4z" fill="#c9d0d6" stroke="#5f6770" strokeWidth=".8" />
      <circle cx="18" cy="18" r="3.5" fill="#e3b552" />
    </g>,
  );

export const ArmyIcon = ({ size = 22 }: IconProps) =>
  svg(
    size,
    <g>
      <path d="M4 20L16 8l1.5 1.5L5.5 21.5zM15 4l5 5-2 2-5-5z" fill="#d7dde3" />
      <path d="M20 20L8 8 6.5 9.5l12 12zM9 4L4 9l2 2 5-5z" fill="#e3b552" />
    </g>,
  );

export const SagaIcon = ({ size = 22 }: IconProps) =>
  svg(
    size,
    <g>
      <path d="M6 3h10l3 3v15H6z" fill="#e9dcc0" stroke="#8a6524" strokeWidth="1.2" />
      <path d="M9 8h7M9 11h7M9 14h5" stroke="#8a6524" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="16.5" cy="18" r="2.6" fill="#a8402f" />
    </g>,
  );

export const QuestIcon = ({ size = 22 }: IconProps) =>
  svg(
    size,
    <g>
      <rect x="4" y="3" width="16" height="19" rx="2.5" fill="#e9dcc0" stroke="#8a6524" strokeWidth="1.2" />
      <path d="M7.5 9l2 2 3.5-4M7.5 16l2 2 3.5-4" fill="none" stroke="#5c8a2e" strokeWidth="1.8" />
      <path d="M15 10h3M15 17h3" stroke="#8a6524" strokeWidth="1.4" />
    </g>,
  );

export const HeroIcon = ({ size = 22 }: IconProps) =>
  svg(
    size,
    <g>
      <path d="M5 13a7 7 0 0114 0v2H5z" fill="#c9d0d6" stroke="#5f6770" strokeWidth=".8" />
      <path d="M3 11l3 2M21 11l-3 2" stroke="#e9dcc0" strokeWidth="2" strokeLinecap="round" />
      <path d="M11 13h2v7h-2z" fill="#5f6770" />
      <path d="M7 15c1 5 9 5 10 0" fill="#c48a4a" />
    </g>,
  );

export const BagIcon = ({ size = 22 }: IconProps) =>
  svg(
    size,
    <g>
      <path d="M6 9h12l1.5 12h-15z" fill="#8a5a36" stroke="#5a3a1e" strokeWidth="1" />
      <path d="M9 9V6a3 3 0 016 0v3" fill="none" stroke="#e3b552" strokeWidth="1.6" />
    </g>,
  );

export const GearIcon = ({ size = 22 }: IconProps) =>
  svg(
    size,
    <g fill="#d7dde3">
      <path d="M10.5 2h3l.5 3 2 1 2.6-1.6 2.1 2.1L19 9.1l1 2 3 .4v3l-3 .5-1 2 1.6 2.6-2.1 2.1-2.6-1.6-2 1-.5 3h-3l-.5-3-2-1-2.6 1.6-2.1-2.1L5 16.9l-1-2-3-.4v-3l3-.5 1-2-1.6-2.6 2.1-2.1L8 6l2-1z" />
      <circle cx="12" cy="13" r="3.4" fill="#2a2f3a" />
    </g>,
  );

export const GlobeIcon = ({ size = 30 }: IconProps) =>
  svg(
    size,
    <g>
      <circle cx="12" cy="12" r="10" fill="#2f6f9a" stroke="#e3b552" strokeWidth="1.4" />
      <path
        d="M6 7c2 1 3 0 4 2s-1 3 1 4 2 3 1 5M14 4c0 2 2 2 3 3s3 1 3 3M15 14c1 0 2 1 2 3"
        fill="none"
        stroke="#7fbf6a"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </g>,
  );

export const ChestIcon = ({
  size = 28,
  open = false,
  glow = false,
}: IconProps & { open?: boolean; glow?: boolean }) =>
  svg(
    size,
    <g>
      {glow && <circle cx="12" cy="13" r="11" fill="#f0c44c" fillOpacity=".35" />}
      <rect x="4" y="11" width="16" height="9" rx="1.5" fill="#8a5a36" stroke="#e3b552" strokeWidth="1.2" />
      {open ? (
        <path d="M4 11l2-6h12l2 6z" fill="#5a3a1e" stroke="#e3b552" strokeWidth="1.2" />
      ) : (
        <path d="M4 11a8 5 0 0116 0z" fill="#9a6a3a" stroke="#e3b552" strokeWidth="1.2" />
      )}
      <rect x="10.5" y="10" width="3" height="4" rx=".8" fill="#e3b552" />
    </g>,
  );

/**
 * Profile pictures: Viking faces drawn in SVG (no downloaded art). The first three
 * are free; the others are bought with earned Gold (sim `AVATARS`).
 */
const LOOKS = [
  { bg: '#6d2a22', helm: '#9aa3ad', beard: '#c48a4a', skin: '#e8c4a0' },
  { bg: '#24485e', helm: '#c9a24a', beard: '#7a4a26', skin: '#d9a87e' },
  { bg: '#2f5a32', helm: '#6f7780', beard: '#e0c070', skin: '#f0d0b0' },
  { bg: '#4a2a5e', helm: '#e3b552', beard: '#d9d4c8', skin: '#e8c4a0' },
  { bg: '#5e3a1a', helm: '#c9d0d6', beard: '#a83a2c', skin: '#c99872' },
  { bg: '#1a1f2a', helm: '#f0c44c', beard: '#2a1a10', skin: '#e0b48e' },
] as const;

export const AvatarFace = ({ id, size = 44 }: { id: number; size?: number }) => {
  const l = LOOKS[id % LOOKS.length]!;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="12" fill={l.bg} />
      <circle cx="12" cy="12" r="5.2" fill={l.skin} />
      <path d="M6.4 11a5.6 5.6 0 0111.2 0z" fill={l.helm} />
      <rect x="11.3" y="10.6" width="1.4" height="3.8" fill={l.helm} />
      {id >= 3 && (
        <path d="M6.4 9.5L3.5 6M17.6 9.5L20.5 6" stroke="#e9e1cf" strokeWidth="1.6" strokeLinecap="round" />
      )}
      <path d="M7 14c.5 6 9.5 6 10 0-2 1.2-8 1.2-10 0z" fill={l.beard} />
      <circle cx="10" cy="12.6" r=".7" fill="#1a1a1a" />
      <circle cx="14" cy="12.6" r=".7" fill="#1a1a1a" />
    </svg>
  );
};
