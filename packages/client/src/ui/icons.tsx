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

/** Troop-type marks: round shield (Shieldwall), bearded axe (Berserker), yew bow (Archer). */
export const TroopTypeIcon = ({
  type,
  size = 18,
}: {
  type: 'shieldwall' | 'berserker' | 'archer';
  size?: number;
}) => {
  if (type === 'shieldwall') {
    return svg(
      size,
      <g>
        <circle cx="12" cy="12" r="9" fill="#a83a2c" stroke="#e9e1cf" strokeWidth="1.5" />
        <circle cx="12" cy="12" r="2.6" fill="#c9c4b8" />
      </g>,
    );
  }
  if (type === 'berserker') {
    return svg(
      size,
      <g>
        <rect x="11" y="3" width="2" height="18" rx="1" fill="#9a6a3a" />
        <path d="M13 4c5 0 7 3 7 6-2-1-4-1-7 0z" fill="#c9d0d6" />
      </g>,
    );
  }
  return svg(
    size,
    <g fill="none" strokeLinecap="round">
      <path d="M7 3c8 4 8 14 0 18" stroke="#c48a4a" strokeWidth="2.2" />
      <path d="M7 3v18" stroke="#e9e1cf" strokeWidth="1" />
      <path d="M4 12h15M16 9l3 3-3 3" stroke="#c9d0d6" strokeWidth="1.6" />
    </g>,
  );
};
