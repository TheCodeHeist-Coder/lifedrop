import type { ReactNode } from "react";

const DROP_PATH = "M16 2.5c-1 1.6-10 11.4-10 18a10 10 0 0 0 20 0c0-6.6-9-16.4-10-18Z";

export function Drop({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <path fill="var(--blood)" d={DROP_PATH} />
    </svg>
  );
}

// Waiting donors around the centre. The two with `yes` set turn green in turn, as
// if they had just replied.
const DONORS = [
  { x: 168, y: 196 },
  { x: 352, y: 170, yes: 1 },
  { x: 372, y: 318 },
  { x: 214, y: 372 },
  { x: 96, y: 300 },
  { x: 118, y: 122 },
  { x: 300, y: 72 },
  { x: 452, y: 232 },
  { x: 410, y: 420 },
  { x: 268, y: 440, yes: 2 },
];

export function DonorRipple() {
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[540px]">
      <svg viewBox="0 0 520 520" className="absolute inset-0 size-full" aria-hidden="true">
        {[250, 190, 130, 74].map((radius, index) => (
          <circle key={radius} cx="260" cy="260" r={radius} fill="var(--blush)" opacity={0.3 + index * 0.17} />
        ))}
        {[0, 1, 2].map((index) => (
          <circle
            key={index}
            className="ripple"
            style={{ animationDelay: `${index * 3.5}s` }}
            cx="260"
            cy="260"
            r="250"
            fill="none"
            stroke="var(--blood)"
            strokeWidth="1.5"
          />
        ))}
        {DONORS.map((donor) => (
          <g key={`${donor.x}-${donor.y}`}>
            {donor.yes && (
              <line
                className={`donor-link donor-yes-${donor.yes}`}
                x1={donor.x}
                y1={donor.y}
                x2="260"
                y2="260"
                stroke="var(--leaf)"
                strokeWidth="1.5"
                strokeDasharray="3 7"
                strokeLinecap="round"
              />
            )}
            <circle cx={donor.x} cy={donor.y} r="7" fill="var(--rose)" />
            {donor.yes && (
              <circle
                className={`donor-accept donor-yes-${donor.yes}`}
                cx={donor.x}
                cy={donor.y}
                r="9"
                fill="var(--leaf)"
              />
            )}
          </g>
        ))}
        <circle cx="260" cy="260" r="42" fill="white" />
        <path fill="var(--blood)" d={DROP_PATH} transform="translate(233 232) scale(1.7)" />
      </svg>

      <div className="float-slow absolute right-0 top-[5%] w-[58%] max-w-[250px] rounded-2xl bg-white p-3.5 shadow-[0_18px_40px_-20px_rgba(74,20,32,0.35)]">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-leaf">
          <span className="size-2 rounded-full bg-leaf" />
          WhatsApp
        </p>
        <p className="mt-1.5 text-sm leading-snug">
          <strong>B+ blood needed nearby.</strong> Can you come in the next few hours? Reply YES or NO.
        </p>
      </div>

      <div
        className="float-slow absolute bottom-[6%] left-0 flex items-center gap-2.5 rounded-2xl bg-white px-3.5 py-3 shadow-[0_18px_40px_-20px_rgba(74,20,32,0.35)]"
        style={{ animationDelay: "-3s" }}
      >
        <span className="flex size-8 items-center justify-center rounded-full bg-leaf-soft text-leaf">
          <LineIcon path="M5 12.5l4.5 4.5L19 7.5" />
        </span>
        <span className="text-sm font-semibold leading-tight">
          A donor is coming
          <span className="block font-normal text-muted">About 2 km away</span>
        </span>
      </div>
    </div>
  );
}

// Rings are evenly spaced so that every distance can be read. They are not to scale.
const RINGS = [5, 15, 40, 100, 300];

export function DistanceRings() {
  const centerX = 240;
  const centerY = 244;
  const radiusFor = (index: number) => 62 + index * 42;

  return (
    <svg
      viewBox="0 0 480 256"
      className="w-full"
      role="img"
      aria-label="Search rings widening from 5 km to 15, 40, 100 and 300 km"
    >
      {RINGS.map((_, index) => RINGS.length - 1 - index).map((index) => {
        const radius = radiusFor(index);
        return (
          <path
            key={index}
            d={`M${centerX - radius} ${centerY} A${radius} ${radius} 0 0 1 ${centerX + radius} ${centerY} Z`}
            fill="var(--blush)"
            opacity="0.5"
          />
        );
      })}
      {RINGS.map((km, index) => (
        <text
          key={km}
          x={centerX}
          y={centerY - radiusFor(index) + 19}
          textAnchor="middle"
          fontSize="14"
          fontWeight="600"
          fill="var(--muted)"
        >
          {km} km
        </text>
      ))}
      <path fill="var(--blood)" d={DROP_PATH} transform={`translate(${centerX - 15} ${centerY - 34}) scale(0.94)`} />
    </svg>
  );
}

export function LineIcon({ path }: { path: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={path} />
    </svg>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <p className="text-sm font-semibold uppercase tracking-[0.14em] text-blood">{children}</p>;
}
