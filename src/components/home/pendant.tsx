"use client";

import type { Ref } from "react";

type PendantProps = {
  lampRef: Ref<HTMLDivElement>;
  swingRef: Ref<HTMLDivElement>;
  cordRef: Ref<HTMLButtonElement>;
};

/** The pendant lamp: canopy, cord, brass socket, glass bulb and pull chain. */
export function Pendant({ lampRef, swingRef, cordRef }: PendantProps) {
  return (
    <div className="lamp" ref={lampRef}>
      <svg className="canopy" viewBox="0 0 100 220" aria-hidden="true">
  {/* canopy on the ceiling, with a contact shadow below it */}
  <ellipse cx="50" cy="11" rx="15" ry="2.2" fill="#000" opacity="0.35" filter="url(#soft)"/>
  <path d="M36,10 C36,3 42,0 50,0 C58,0 64,3 64,10 Z" fill="url(#canopyG)"/>
  <path d="M38,9 C39,5 43,2.5 50,2.5" fill="none" stroke="#5A5A5A" strokeWidth="0.6" opacity="0.7"/>
  {/* grommet where the cord leaves the canopy */}
  <rect x="47.2" y="9" width="5.6" height="3.2" rx="1" fill="#0C0C0C"/>

    </svg>
      <div className="swing" ref={swingRef}>
        <svg viewBox="0 0 100 220" aria-hidden="true">
  <defs>
    <linearGradient id="cordG" x1="48" x2="52" y1="0" y2="0" gradientUnits="userSpaceOnUse">
      <stop offset="0" stopColor="#0E0E0E"/><stop offset="0.35" stopColor="#3B3835"/><stop offset="0.55" stopColor="#4A4642"/><stop offset="1" stopColor="#0A0A0A"/>
    </linearGradient>
    <linearGradient id="brassG" x1="41" x2="59" y1="0" y2="0" gradientUnits="userSpaceOnUse">
      <stop offset="0" stopColor="#4F3A1B"/><stop offset="0.18" stopColor="#8F6B33"/><stop offset="0.36" stopColor="#E2C27A"/><stop offset="0.44" stopColor="#F6E3AB"/><stop offset="0.56" stopColor="#C9A45A"/><stop offset="0.78" stopColor="#7E5C2C"/><stop offset="1" stopColor="#3E2C12"/>
    </linearGradient>
    <linearGradient id="brassDark" x1="41" x2="59" y1="0" y2="0" gradientUnits="userSpaceOnUse">
      <stop offset="0" stopColor="#2E2010"/><stop offset="0.4" stopColor="#8A6730"/><stop offset="0.5" stopColor="#A8843F"/><stop offset="1" stopColor="#241908"/>
    </linearGradient>
    <linearGradient id="canopyG" x1="36" x2="64" y1="0" y2="0" gradientUnits="userSpaceOnUse">
      <stop offset="0" stopColor="#141414"/><stop offset="0.4" stopColor="#333"/><stop offset="0.55" stopColor="#3C3C3C"/><stop offset="1" stopColor="#0F0F0F"/>
    </linearGradient>
    <radialGradient id="glassBody" cx="0.38" cy="0.32" r="0.75">
      <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.16"/><stop offset="0.45" stopColor="#FFFFFF" stopOpacity="0.05"/><stop offset="0.85" stopColor="#FFFFFF" stopOpacity="0.02"/><stop offset="1" stopColor="#FFFFFF" stopOpacity="0.09"/>
    </radialGradient>
    <radialGradient id="glassWarm" cx="0.5" cy="0.55" r="0.55">
      <stop offset="0" stopColor="#FFE6B8" stopOpacity="0.75"/><stop offset="0.5" stopColor="#FFD28C" stopOpacity="0.28"/><stop offset="1" stopColor="#FFC96E" stopOpacity="0.04"/>
    </radialGradient>
    <linearGradient id="edgeL" x1="0" x2="1" y1="0" y2="0">
      <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.55"/><stop offset="1" stopColor="#FFFFFF" stopOpacity="0"/>
    </linearGradient>
    <linearGradient id="rimR" x1="0" x2="1" y1="0" y2="0">
      <stop offset="0" stopColor="#000" stopOpacity="0"/><stop offset="1" stopColor="#000" stopOpacity="0.22"/>
    </linearGradient>
    <radialGradient id="halo" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stopColor="#FFD9A0" stopOpacity="0.42"/><stop offset="0.35" stopColor="#FFC978" stopOpacity="0.14"/><stop offset="0.7" stopColor="#FFC070" stopOpacity="0.035"/><stop offset="1" stopColor="#FFC070" stopOpacity="0"/>
    </radialGradient>
    <filter id="bloom" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.6"/></filter>
    <filter id="soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.5"/></filter>
    <clipPath id="bulbClip"><path d="M44,100 L56,100 C56,112 58,118 64,124 C76,134 80,146 80,160 A30,30 0 1 1 20,160 C20,146 24,134 36,124 C42,118 44,112 44,100 Z"/></clipPath>
  </defs>

  {/* halo, under everything */}
  <circle className="halo" cx="50" cy="156" r="78" fill="url(#halo)"/>

  {/* fabric cord: hangs straight, with a hair of a curve */}
  <path d="M50,12 C50.25,28 49.8,44 50,60" fill="none" stroke="#000" strokeWidth="4" opacity="0.35" transform="translate(0.9,0)" filter="url(#soft)"/>
  <path d="M50,12 C50.25,28 49.8,44 50,60" fill="none" stroke="url(#cordG)" strokeWidth="3.2" strokeLinecap="butt"/>
  <path d="M50,12 C50.25,28 49.8,44 50,60" fill="none" stroke="#6A6560" strokeWidth="3.2" strokeDasharray="0.9 1.6" opacity="0.28" transform="translate(-0.4,0)"/>
  <path d="M50,12 C50.25,28 49.8,44 50,60" fill="none" stroke="#000" strokeWidth="3.2" strokeDasharray="0.9 1.6" strokeDashoffset="1.2" opacity="0.22" transform="translate(0.5,0)"/>

  {/* strain relief and socket */}
  <rect x="46.4" y="59" width="7.2" height="6" rx="1.2" fill="url(#brassDark)"/>
  <path d="M42,65 L58,65 L58,70 L42,70 Z" fill="url(#brassG)"/>
  <rect x="41" y="70" width="18" height="26" fill="url(#brassG)"/>
  {/* grooves: each a dark line with a light line beneath */}
  <g strokeWidth="0.7">
    <line x1="41" y1="74" x2="59" y2="74" stroke="#2A1D09" opacity="0.8"/><line x1="41" y1="74.8" x2="59" y2="74.8" stroke="#FFF0C4" opacity="0.35"/>
    <line x1="41" y1="79" x2="59" y2="79" stroke="#2A1D09" opacity="0.8"/><line x1="41" y1="79.8" x2="59" y2="79.8" stroke="#FFF0C4" opacity="0.35"/>
    <line x1="41" y1="84" x2="59" y2="84" stroke="#2A1D09" opacity="0.8"/><line x1="41" y1="84.8" x2="59" y2="84.8" stroke="#FFF0C4" opacity="0.35"/>
    <line x1="41" y1="89" x2="59" y2="89" stroke="#2A1D09" opacity="0.8"/><line x1="41" y1="89.8" x2="59" y2="89.8" stroke="#FFF0C4" opacity="0.35"/>
  </g>
  {/* skirt at the bottom of the socket, slightly wider, darker underside */}
  <path d="M40,96 L60,96 L61,100 L39,100 Z" fill="url(#brassG)"/>
  <path d="M39,100 L61,100 L60,102 L40,102 Z" fill="#1E1508"/>
  <circle cx="62.5" cy="97.5" r="1.6" fill="url(#brassDark)"/>
  <circle cx="62.5" cy="97.5" r="0.6" fill="#1E1508"/>
  {/* ambient occlusion under the skirt onto the glass neck */}
  <path d="M42,102 L58,102 L58,110 L42,110 Z" fill="#000" opacity="0.28" filter="url(#soft)"/>

  {/* contact shadow of the whole bulb against the background, offset to the lower right */}
  <path d="M44,100 L56,100 C56,112 58,118 64,124 C76,134 80,146 80,160 A30,30 0 1 1 20,160 C20,146 24,134 36,124 C42,118 44,112 44,100 Z" fill="#000" opacity="0.22" transform="translate(3,4)" filter="url(#soft)"/>

  {/* the glass */}
  <path className="glassWarm" d="M44,100 L56,100 C56,112 58,118 64,124 C76,134 80,146 80,160 A30,30 0 1 1 20,160 C20,146 24,134 36,124 C42,118 44,112 44,100 Z" fill="url(#glassWarm)"/>
  <path d="M44,100 L56,100 C56,112 58,118 64,124 C76,134 80,146 80,160 A30,30 0 1 1 20,160 C20,146 24,134 36,124 C42,118 44,112 44,100 Z" fill="url(#glassBody)"/>
  {/* inner darker rim on the right (refraction) */}
  <g clipPath="url(#bulbClip)">
    <path d="M62,122 C76,134 80,146 80,160 A30,30 0 0 1 62,188" fill="none" stroke="url(#rimR)" strokeWidth="7" opacity="0.9"/>
    <path d="M38,124 C26,134 21,146 21,160" fill="none" stroke="#000" strokeWidth="3" opacity="0.08"/>
  </g>
  {/* edge highlight, bright on the left, fading right */}
  <path d="M44,101 C44,112 42,118 36,124 C24,134 20,146 20,160 A30,30 0 0 0 36,186" fill="none" stroke="#FFFFFF" strokeWidth="1" opacity="0.55"/>
  <path d="M56,101 C56,112 58,118 64,124 C76,134 80,146 80,160 A30,30 0 0 1 64,186" fill="none" stroke="#FFFFFF" strokeWidth="0.7" opacity="0.18"/>
  {/* studio window reflection, upper left, and a faint secondary one lower right */}
  <path d="M33,134 C31,142 30,150 31,158" fill="none" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round" opacity="0.32"/>
  <path d="M38,127 C37,129 36,131 35.5,133" fill="none" stroke="#FFFFFF" strokeWidth="1.6" strokeLinecap="round" opacity="0.28"/>
  <path d="M66,172 C64,176 61,179 58,181" fill="none" stroke="#FFFFFF" strokeWidth="1.4" strokeLinecap="round" opacity="0.1"/>

  {/* glass stem and filament supports */}
  <path d="M50,102 L50,132" stroke="#FFFFFF" strokeWidth="2.2" opacity="0.14"/>
  <path d="M50,102 L50,132" stroke="#000" strokeWidth="0.5" opacity="0.18"/>
  <path d="M47.5,131 L40,151.5 M52.5,131 L60,151.5" fill="none" stroke="#5A5248" strokeWidth="0.7" strokeLinecap="round"/>
  {/* filament: glow copy beneath, then the fine coil */}
  <path className="filGlow" d="M40.0,151.3 L40.3,152.9 L40.6,151.8 L40.9,153.4 L41.2,152.3 L41.6,153.9 L41.9,152.8 L42.2,154.3 L42.5,153.3 L42.8,154.8 L43.1,153.7 L43.4,155.2 L43.8,154.1 L44.1,155.6 L44.4,154.5 L44.7,156.0 L45.0,154.9 L45.3,156.4 L45.6,155.2 L45.9,156.7 L46.2,155.5 L46.6,156.9 L46.9,155.8 L47.2,157.2 L47.5,156.0 L47.8,157.4 L48.1,156.1 L48.4,157.5 L48.8,156.3 L49.1,157.6 L49.4,156.3 L49.7,157.6 L50.0,156.3 L50.3,157.6 L50.6,156.3 L50.9,157.6 L51.2,156.3 L51.6,157.5 L51.9,156.1 L52.2,157.4 L52.5,156.0 L52.8,157.2 L53.1,155.8 L53.4,156.9 L53.8,155.5 L54.1,156.7 L54.4,155.2 L54.7,156.4 L55.0,154.9 L55.3,156.0 L55.6,154.5 L55.9,155.6 L56.2,154.1 L56.6,155.2 L56.9,153.7 L57.2,154.8 L57.5,153.3 L57.8,154.3 L58.1,152.8 L58.4,153.9 L58.8,152.3 L59.1,153.4 L59.4,151.8 L59.7,152.9 L60.0,151.3" fill="none" stroke="#FFB85A" strokeWidth="1.8" strokeLinejoin="round" filter="url(#bloom)"/>
  <path className="fil" d="M40.0,151.3 L40.3,152.9 L40.6,151.8 L40.9,153.4 L41.2,152.3 L41.6,153.9 L41.9,152.8 L42.2,154.3 L42.5,153.3 L42.8,154.8 L43.1,153.7 L43.4,155.2 L43.8,154.1 L44.1,155.6 L44.4,154.5 L44.7,156.0 L45.0,154.9 L45.3,156.4 L45.6,155.2 L45.9,156.7 L46.2,155.5 L46.6,156.9 L46.9,155.8 L47.2,157.2 L47.5,156.0 L47.8,157.4 L48.1,156.1 L48.4,157.5 L48.8,156.3 L49.1,157.6 L49.4,156.3 L49.7,157.6 L50.0,156.3 L50.3,157.6 L50.6,156.3 L50.9,157.6 L51.2,156.3 L51.6,157.5 L51.9,156.1 L52.2,157.4 L52.5,156.0 L52.8,157.2 L53.1,155.8 L53.4,156.9 L53.8,155.5 L54.1,156.7 L54.4,155.2 L54.7,156.4 L55.0,154.9 L55.3,156.0 L55.6,154.5 L55.9,155.6 L56.2,154.1 L56.6,155.2 L56.9,153.7 L57.2,154.8 L57.5,153.3 L57.8,154.3 L58.1,152.8 L58.4,153.9 L58.8,152.3 L59.1,153.4 L59.4,151.8 L59.7,152.9 L60.0,151.3" fill="none" strokeWidth="0.7" strokeLinejoin="round" strokeLinecap="round"/>
      </svg>
        <button
          className="cord"
          ref={cordRef}
          type="button"
          aria-pressed="false"
          aria-label="Pull the chain to turn the lights on"
        >
          <span className="rope" aria-hidden="true" />
          <span className="knob" aria-hidden="true" />
          <span className="hint" aria-hidden="true">pull</span>
        </button>
      </div>
    </div>
  );
}
