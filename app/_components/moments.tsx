'use client';

// One illustrated moment per station (decorative, nature only, no text): S1 rain falls from the cloud
// after the correct answer; S2 the wilted flower revives; S3 the seed sprouts one stage per step.
// State changes are CSS transitions and the rain is a CSS animation; prefers-reduced-motion shows
// the end state without movement (globals.css).

import type { Step } from '@/app/_lib/flow';

const move = (transform: string, origin: string): React.CSSProperties => ({
  transform,
  transformOrigin: origin,
  transformBox: 'view-box',
  transition: 'transform 1s cubic-bezier(0.34, 1.3, 0.64, 1), opacity 0.6s ease, fill 0.8s ease',
});

const Frame = ({ id, state, children, wide = false }: { id: string; state: string | number; children: React.ReactNode; wide?: boolean }) => (
  <div className={`card overflow-hidden p-2 ${wide ? 'mx-auto w-full max-w-md' : ''}`} aria-hidden="true" data-moment={id} data-moment-state={state}>
    <svg viewBox="0 0 320 200" className="h-40 w-full md:h-44">
      <rect width="320" height="200" rx="22" fill="#EAF6FC" />
      {children}
    </svg>
  </div>
);

const CLOUD = 'M96 70a28 28 0 0 1 52-14a34 34 0 0 1 62 8a24 24 0 0 1 14 46H102a24 24 0 0 1-6-40z';
const DROPS = [112, 132, 152, 172, 192, 212, 122, 162, 202];

function Rain({ active }: { active: boolean }) {
  return (
    <Frame id="S1" state={active ? 'rain' : 'cloud'}>
      <path d="M0 176 Q80 160 160 172 T320 168 V200 H0z" fill="#3BA55C" />
      <ellipse cx="160" cy="182" rx="46" ry="7" fill="#4FA3DD" style={move(active ? 'scale(1)' : 'scale(0)', '160px 182px')} />
      {active && DROPS.map((x, i) => (
        <path key={i} d={`M${x} ${118 + (i % 3) * 6}c3 4 5 7 5 9a5 5 0 0 1-10 0c0-2 2-5 5-9z`} fill="#2F80C9"
          className="anim-fall" style={{ animationDelay: `${(i * 170) % 1400}ms` }} />
      ))}
      <path d={CLOUD} fill={active ? '#D5E6F1' : '#FFFFFF'} stroke="#4FA3DD" strokeWidth="3" style={{ transition: 'fill 0.8s ease' }} />
    </Frame>
  );
}

function Flower({ active }: { active: boolean }) {
  const petals = Array.from({ length: 6 }, (_, i) => i * 60);
  return (
    <Frame id="S2" state={active ? 'revived' : 'wilted'}>
      <path d="M0 178 Q160 166 320 178 V200 H0z" fill="#C97B4A" />
      <g style={move(active ? 'rotate(0deg)' : 'rotate(52deg)', '160px 176px')}>
        <path d="M160 176 V86" stroke="#1F6B3A" strokeWidth="6" strokeLinecap="round" />
        <path d="M160 140 C140 136 128 124 128 112 C144 112 156 124 160 140" fill="#3BA55C" style={move(active ? 'rotate(0deg)' : 'rotate(-35deg)', '160px 140px')} />
        <path d="M160 122 C180 118 192 106 192 94 C176 94 164 106 160 122" fill="#3BA55C" style={move(active ? 'rotate(0deg)' : 'rotate(35deg)', '160px 122px')} />
        <g style={move(active ? 'scale(1)' : 'scale(0.5)', '160px 80px')}>
          {petals.map((a) => (
            <ellipse key={a} cx="160" cy="62" rx="10" ry="18" fill={active ? '#FFC94A' : '#D8CBA6'} transform={`rotate(${a} 160 80)`} style={{ transition: 'fill 0.8s ease' }} />
          ))}
          <circle cx="160" cy="80" r="11" fill="#C97B4A" />
        </g>
      </g>
    </Frame>
  );
}

// 0 seed, 1 root and shoot, 2 first leaves, 3 more leaves, 4 bud.
function Sprout({ stage }: { stage: number }) {
  const show = (n: number, origin: string) => move(stage >= n ? 'scale(1)' : 'scale(0)', origin);
  return (
    <Frame id="S3" state={stage} wide>
      <path d="M0 168 Q160 140 320 168 V200 H0z" fill="#C97B4A" />
      <path d="M160 166 q-6 14 -2 28 M160 166 q8 10 10 22" stroke="#8A5A36" strokeWidth="3" fill="none" style={show(1, '160px 166px')} />
      <ellipse cx="160" cy="160" rx="12" ry="8" fill="#8A5A36" style={{ opacity: stage >= 2 ? 0 : 1, transition: 'opacity 0.6s ease' }} />
      <path d="M160 160 V70" stroke="#1F6B3A" strokeWidth="6" strokeLinecap="round"
        style={move(`scaleY(${[0, 0.2, 0.5, 0.8, 1][Math.min(stage, 4)]})`, '160px 160px')} />
      <path d="M160 132 C140 130 128 118 128 104 C144 106 156 118 160 132" fill="#3BA55C" style={show(2, '160px 132px')} />
      <path d="M160 132 C180 130 192 118 192 104 C176 106 164 118 160 132" fill="#2E8F4C" style={show(2, '160px 132px')} />
      <path d="M160 106 C142 102 134 92 134 80 C148 82 158 92 160 106" fill="#2E8F4C" style={show(3, '160px 106px')} />
      <path d="M160 106 C178 102 186 92 186 80 C172 82 162 92 160 106" fill="#3BA55C" style={show(3, '160px 106px')} />
      <g style={show(4, '160px 72px')}>
        <circle cx="160" cy="66" r="10" fill="#FFC94A" />
        <circle cx="160" cy="66" r="4" fill="#C97B4A" />
      </g>
    </Frame>
  );
}

const SPROUT_STAGE: Record<Step, number> = { frame: 0, observe: 0, connect: 1, ask: 2, narrate: 3, close: 4, done: 4 };

// S1/S2 render inside the observe step; S3 stays mounted across steps so each step grows it.
export function Moment({ stationId, step, solved }: { stationId: string; step: Step; solved: boolean }) {
  if (stationId === 'S1') return <Rain active={solved} />;
  if (stationId === 'S2') return <Flower active={solved} />;
  if (stationId === 'S3') return <Sprout stage={step === 'observe' ? (solved ? 1 : 0) : SPROUT_STAGE[step]} />;
  return null;
}
