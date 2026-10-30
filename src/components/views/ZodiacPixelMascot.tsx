import React, { useEffect, useState, useMemo } from 'react';

export type ZodiacKey =
  | 'ty_mouse'
  | 'suu_ox'
  | 'dan_tiger'
  | 'mao_cat'
  | 'thin_dragon'
  | 'ty_snake'
  | 'ngo_horse'
  | 'mui_goat'
  | 'than_monkey'
  | 'dau_rooster'
  | 'tuat_dog'
  | 'hoi_pig';

export type MascotMood = 'happy' | 'growl' | 'sleep' | 'sing' | 'cheer';

export interface ZodiacAnimalInfo {
  key: ZodiacKey;
  branchName: string; // e.g., "Mão (Con Mèo)"
  shortName: string;  // e.g., "Mèo Pixel"
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  cheekColor: string;
  earStyle: 'cat' | 'mouse' | 'ox' | 'tiger' | 'dragon' | 'snake' | 'horse' | 'goat' | 'monkey' | 'rooster' | 'dog' | 'pig';
  growlText: string;
}

export const ZODIAC_ANIMALS: Record<ZodiacKey, ZodiacAnimalInfo> = {
  ty_mouse: {
    key: 'ty_mouse',
    branchName: 'Tuổi Tý (Chuột)',
    shortName: 'Chuột Tý Pixel',
    primaryColor: '#94A3B8',
    secondaryColor: '#E2E8F0',
    accentColor: '#F472B6',
    cheekColor: '#FB7185',
    earStyle: 'mouse',
    growlText: 'Chít chít~ Gr gr!',
  },
  suu_ox: {
    key: 'suu_ox',
    branchName: 'Tuổi Sửu (Trâu)',
    shortName: 'Trâu Sửu Pixel',
    primaryColor: '#64748B',
    secondaryColor: '#CBD5E1',
    accentColor: '#FDE047',
    cheekColor: '#F87171',
    earStyle: 'ox',
    growlText: 'Ụm bò~ Gr gr!',
  },
  dan_tiger: {
    key: 'dan_tiger',
    branchName: 'Tuổi Dần (Hổ)',
    shortName: 'Hổ Dần Pixel',
    primaryColor: '#F97316',
    secondaryColor: '#FEF3C7',
    accentColor: '#1E293B',
    cheekColor: '#FB7185',
    earStyle: 'tiger',
    growlText: 'Grào~ Gr gr!',
  },
  mao_cat: {
    key: 'mao_cat',
    branchName: 'Tuổi Mão (Mèo)',
    shortName: 'Mèo Mão Pixel',
    primaryColor: '#FDBA74',
    secondaryColor: '#FFF7ED',
    accentColor: '#FB7185',
    cheekColor: '#F43F5E',
    earStyle: 'cat',
    growlText: 'Meow~ Gr gr!',
  },
  thin_dragon: {
    key: 'thin_dragon',
    branchName: 'Tuổi Thìn (Rồng)',
    shortName: 'Rồng Thìn Pixel',
    primaryColor: '#10B981',
    secondaryColor: '#D1FAE5',
    accentColor: '#FACC15',
    cheekColor: '#F97316',
    earStyle: 'dragon',
    growlText: 'Gr gr~ Khè lửa!',
  },
  ty_snake: {
    key: 'ty_snake',
    branchName: 'Tuổi Tỵ (Rắn)',
    shortName: 'Rắn Tỵ Pixel',
    primaryColor: '#22C55E',
    secondaryColor: '#DCFCE7',
    accentColor: '#EF4444',
    cheekColor: '#FB7185',
    earStyle: 'snake',
    growlText: 'Xì xì~ Gr gr!',
  },
  ngo_horse: {
    key: 'ngo_horse',
    branchName: 'Tuổi Ngọ (Ngựa)',
    shortName: 'Ngựa Ngọ Pixel',
    primaryColor: '#B45309',
    secondaryColor: '#FEF3C7',
    accentColor: '#78350F',
    cheekColor: '#FB7185',
    earStyle: 'horse',
    growlText: 'Hí hí~ Gr gr!',
  },
  mui_goat: {
    key: 'mui_goat',
    branchName: 'Tuổi Mùi (Dê)',
    shortName: 'Dê Mùi Pixel',
    primaryColor: '#F1F5F9',
    secondaryColor: '#FFFFFF',
    accentColor: '#D97706',
    cheekColor: '#FDA4AF',
    earStyle: 'goat',
    growlText: 'Be be~ Gr gr!',
  },
  than_monkey: {
    key: 'than_monkey',
    branchName: 'Tuổi Thân (Khỉ)',
    shortName: 'Khỉ Thân Pixel',
    primaryColor: '#92400E',
    secondaryColor: '#FDE68A',
    accentColor: '#F59E0B',
    cheekColor: '#FB7185',
    earStyle: 'monkey',
    growlText: 'Khẹc khẹc~ Gr gr!',
  },
  dau_rooster: {
    key: 'dau_rooster',
    branchName: 'Tuổi Dậu (Gà)',
    shortName: 'Gà Dậu Pixel',
    primaryColor: '#FACC15',
    secondaryColor: '#FEF9C3',
    accentColor: '#EF4444',
    cheekColor: '#FB7185',
    earStyle: 'rooster',
    growlText: 'Ò ó o~ Gr gr!',
  },
  tuat_dog: {
    key: 'tuat_dog',
    branchName: 'Tuổi Tuất (Chó)',
    shortName: 'Cún Tuất Pixel',
    primaryColor: '#D97706',
    secondaryColor: '#FEF3C7',
    accentColor: '#451A03',
    cheekColor: '#FB7185',
    earStyle: 'dog',
    growlText: 'Gâu gâu~ Gr gr!',
  },
  hoi_pig: {
    key: 'hoi_pig',
    branchName: 'Tuổi Hợi (Heo)',
    shortName: 'Heo Hợi Pixel',
    primaryColor: '#F9A8D4',
    secondaryColor: '#FCE7F3',
    accentColor: '#EC4899',
    cheekColor: '#F43F5E',
    earStyle: 'pig',
    growlText: 'Ủn ỉn~ Gr gr!',
  },
};

const ZODIAC_CYCLE: ZodiacKey[] = [
  'than_monkey',  // year % 12 === 0 (e.g. 2004)
  'dau_rooster',  // year % 12 === 1 (e.g. 2005)
  'tuat_dog',     // year % 12 === 2 (e.g. 2006)
  'hoi_pig',      // year % 12 === 3 (e.g. 2007)
  'ty_mouse',     // year % 12 === 4 (e.g. 2008)
  'suu_ox',       // year % 12 === 5 (e.g. 2009)
  'dan_tiger',    // year % 12 === 6 (e.g. 2010)
  'mao_cat',      // year % 12 === 7 (e.g. 1999, 2011)
  'thin_dragon',  // year % 12 === 8 (e.g. 2000, 2012)
  'ty_snake',     // year % 12 === 9 (e.g. 2001)
  'ngo_horse',    // year % 12 === 10 (e.g. 2002)
  'mui_goat',     // year % 12 === 11 (e.g. 2003)
];

/**
 * Computes Vietnamese 12-Zodiac animal from birthDate string (YYYY-MM-DD or DD/MM/YYYY).
 * Defaults to 'mao_cat' (Con Mèo) if birthDate is empty or invalid.
 */
export function getZodiacFromBirthDate(birthDate?: string): ZodiacAnimalInfo {
  if (!birthDate || !birthDate.trim()) {
    return ZODIAC_ANIMALS.mao_cat;
  }
  const match = birthDate.match(/\b(19\d{2}|20\d{2})\b/);
  if (!match) {
    return ZODIAC_ANIMALS.mao_cat;
  }
  const year = parseInt(match[1], 10);
  if (isNaN(year) || year < 1900 || year > 2100) {
    return ZODIAC_ANIMALS.mao_cat;
  }
  const idx = ((year % 12) + 12) % 12;
  const key = ZODIAC_CYCLE[idx] || 'mao_cat';
  return ZODIAC_ANIMALS[key];
}

interface ZodiacPixelMascotProps {
  birthDate?: string;
  targetOverall?: number;
  onOpenProfile?: () => void;
}

const MOOD_LIST: MascotMood[] = ['happy', 'growl', 'sleep', 'sing', 'cheer'];

export const ZodiacPixelMascot: React.FC<ZodiacPixelMascotProps> = ({
  birthDate,
  targetOverall = 6.5,
  onOpenProfile,
}) => {
  const zodiac = useMemo(() => getZodiacFromBirthDate(birthDate), [birthDate]);
  const [mood, setMood] = useState<MascotMood>('happy');
  const [blink, setBlink] = useState(false);
  const [stepFrame, setStepFrame] = useState(0);

  // Automatically switch to a random mood/action every 4.2 seconds
  useEffect(() => {
    const moodInterval = setInterval(() => {
      setMood((prev) => {
        const candidates = MOOD_LIST.filter((m) => m !== prev);
        return candidates[Math.floor(Math.random() * candidates.length)] || 'happy';
      });
    }, 4200);
    return () => clearInterval(moodInterval);
  }, []);

  // Natural blinking & pixel limb animation frame every 750ms
  useEffect(() => {
    const frameTimer = setInterval(() => {
      setStepFrame((f) => (f + 1) % 4);
      setBlink(Math.random() < 0.25);
    }, 750);
    return () => clearInterval(frameTimer);
  }, []);

  const cycleMoodManually = () => {
    const idx = MOOD_LIST.indexOf(mood);
    setMood(MOOD_LIST[(idx + 1) % MOOD_LIST.length]);
  };

  const bubbleInfo = useMemo(() => {
    switch (mood) {
      case 'growl':
        return { text: zodiac.growlText, badge: '🔥', tone: 'bg-amber-400 text-slate-950' };
      case 'sleep':
        return { text: 'Zzz... Zzz...', badge: '💤', tone: 'bg-indigo-200 text-indigo-950' };
      case 'sing':
        return { text: 'Lalala ♪ ♫', badge: '🎵', tone: 'bg-pink-200 text-pink-950' };
      case 'cheer':
        return {
          text: `Quyết đạt ${Number(targetOverall).toFixed(1)}/10!`,
          badge: '✨',
          tone: 'bg-lime-300 text-slate-950',
        };
      case 'happy':
      default:
        return {
          text: birthDate ? `${zodiac.shortName} chào bạn!` : 'Meow~ Bấm để đùa!',
          badge: '💚',
          tone: 'bg-white text-slate-900',
        };
    }
  }, [mood, zodiac, targetOverall, birthDate]);

  // Posture class based on mood & stepFrame
  const postureClass =
    mood === 'sleep'
      ? 'translate-y-1 rotate-3 scale-y-95'
      : mood === 'sing'
      ? stepFrame % 2 === 0
        ? '-translate-y-1 -rotate-3'
        : 'translate-y-0 rotate-3'
      : mood === 'growl'
      ? stepFrame % 2 === 0
        ? 'scale-105 -translate-y-0.5'
        : 'scale-100'
      : stepFrame % 2 === 0
      ? '-translate-y-0.5'
      : 'translate-y-0';

  return (
    <div className="relative flex flex-col items-center select-none">
      {/* Floating Pixel Speech Bubble */}
      <div
        onClick={cycleMoodManually}
        className={`mb-1.5 relative inline-flex items-center gap-1 rounded-xl px-2.5 py-1 text-[11px] font-black shadow-md border-2 border-slate-900/80 transition-all duration-300 cursor-pointer ${bubbleInfo.tone}`}
        title="Bấm vào linh vật để đổi hành động!"
      >
        <span>{bubbleInfo.badge}</span>
        <span className="tracking-tight whitespace-nowrap">{bubbleInfo.text}</span>
        <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 h-2.5 w-2.5 rotate-45 border-r-2 border-b-2 border-slate-900/80 bg-inherit" />
      </div>

      {/* Interactive Voxel / Fine-Pixel 24x24 Grid SVG */}
      <button
        type="button"
        onClick={cycleMoodManually}
        className="group relative flex flex-col items-center justify-center rounded-2xl bg-black/20 hover:bg-black/30 border border-white/20 p-2 transition-all cursor-pointer shadow-inner"
        title={`${zodiac.branchName} — Bấm để tương tác với thú cưng Pixel`}
      >
        {/* Floating Particle Effects */}
        {mood === 'sleep' && (
          <span className="absolute top-1 right-1.5 text-[10px] font-black text-sky-200 animate-bounce">
            Zzz
          </span>
        )}
        {mood === 'sing' && (
          <span className="absolute top-1 left-1.5 text-xs font-black text-pink-200 animate-pulse">
            ♪
          </span>
        )}
        {mood === 'growl' && (
          <span className="absolute top-1 right-1.5 text-xs font-black text-amber-300 animate-ping">
            !
          </span>
        )}

        <div className={`transition-transform duration-300 ${postureClass}`}>
          <svg
            viewBox="0 0 24 24"
            className="h-20 w-20 sm:h-22 sm:w-22 drop-shadow-[0_4px_0_rgba(0,0,0,0.35)]"
            shapeRendering="crispEdges"
          >
            {/* Shadow under feet */}
            <rect x="5" y="22" width="14" height="1.5" fill="rgba(0,0,0,0.3)" />

            {/* Tail (wagging based on stepFrame) */}
            <rect
              x={stepFrame % 2 === 0 ? '19' : '18'}
              y={stepFrame % 2 === 0 ? '14' : '15'}
              width="2"
              height="4"
              fill={zodiac.primaryColor}
            />
            <rect
              x={stepFrame % 2 === 0 ? '20' : '19'}
              y={stepFrame % 2 === 0 ? '12' : '13'}
              width="2"
              height="2"
              fill={zodiac.accentColor}
            />

            {/* Ears / Horns / Comb based on Zodiac Animal */}
            {zodiac.earStyle === 'cat' || zodiac.earStyle === 'tiger' ? (
              <>
                {/* Left pointy ear */}
                <rect x="4" y="3" width="4" height="4" fill={zodiac.primaryColor} />
                <rect x="5" y="2" width="2" height="1" fill={zodiac.primaryColor} />
                <rect x="5" y="4" width="2" height="2" fill={zodiac.accentColor} />
                {/* Right pointy ear */}
                <rect x="16" y="3" width="4" height="4" fill={zodiac.primaryColor} />
                <rect x="17" y="2" width="2" height="1" fill={zodiac.primaryColor} />
                <rect x="17" y="4" width="2" height="2" fill={zodiac.accentColor} />
              </>
            ) : zodiac.earStyle === 'mouse' ? (
              <>
                <rect x="3" y="2" width="5" height="5" fill={zodiac.primaryColor} />
                <rect x="4" y="3" width="3" height="3" fill={zodiac.accentColor} />
                <rect x="16" y="2" width="5" height="5" fill={zodiac.primaryColor} />
                <rect x="17" y="3" width="3" height="3" fill={zodiac.accentColor} />
              </>
            ) : zodiac.earStyle === 'ox' || zodiac.earStyle === 'goat' ? (
              <>
                {/* Horns */}
                <rect x="4" y="2" width="2" height="4" fill={zodiac.accentColor} />
                <rect x="3" y="1" width="2" height="2" fill={zodiac.accentColor} />
                <rect x="18" y="2" width="2" height="4" fill={zodiac.accentColor} />
                <rect x="19" y="1" width="2" height="2" fill={zodiac.accentColor} />
                {/* Side ears */}
                <rect x="3" y="6" width="2" height="2" fill={zodiac.primaryColor} />
                <rect x="19" y="6" width="2" height="2" fill={zodiac.primaryColor} />
              </>
            ) : zodiac.earStyle === 'dragon' ? (
              <>
                {/* Golden antlers */}
                <rect x="5" y="1" width="2" height="5" fill={zodiac.accentColor} />
                <rect x="3" y="2" width="2" height="2" fill={zodiac.accentColor} />
                <rect x="17" y="1" width="2" height="5" fill={zodiac.accentColor} />
                <rect x="19" y="2" width="2" height="2" fill={zodiac.accentColor} />
              </>
            ) : zodiac.earStyle === 'rooster' ? (
              <>
                {/* Red comb on top of head */}
                <rect x="9" y="2" width="6" height="4" fill={zodiac.accentColor} />
                <rect x="10" y="1" width="2" height="1" fill={zodiac.accentColor} />
                <rect x="13" y="1" width="2" height="1" fill={zodiac.accentColor} />
              </>
            ) : zodiac.earStyle === 'dog' || zodiac.earStyle === 'pig' ? (
              <>
                {/* Floppy voxel ears */}
                <rect x="3" y="5" width="3" height="5" fill={zodiac.accentColor} />
                <rect x="18" y="5" width="3" height="5" fill={zodiac.accentColor} />
              </>
            ) : (
              <>
                {/* Monkey / Horse / Snake head detail */}
                <rect x="3" y="7" width="3" height="4" fill={zodiac.primaryColor} />
                <rect x="18" y="7" width="3" height="4" fill={zodiac.primaryColor} />
                <rect x="10" y="3" width="4" height="3" fill={zodiac.accentColor} />
              </>
            )}

            {/* Main Voxel Head Block */}
            <rect x="5" y="5" width="14" height="10" fill={zodiac.primaryColor} />
            {/* Top head highlight */}
            <rect x="6" y="5" width="12" height="1" fill={zodiac.secondaryColor} opacity="0.45" />

            {/* Tiger forehead stripes */}
            {zodiac.earStyle === 'tiger' && (
              <>
                <rect x="11" y="5" width="2" height="3" fill={zodiac.accentColor} />
                <rect x="9" y="6" width="6" height="1" fill={zodiac.accentColor} />
              </>
            )}

            {/* Inner Face / Muzzle Patch */}
            <rect x="7" y="9" width="10" height="5" fill={zodiac.secondaryColor} />

            {/* Eyes (Change with mood & blink) */}
            {mood === 'sleep' || blink ? (
              <>
                {/* Closed sleeping/blinking pixel eyes */}
                <rect x="7" y="9" width="3" height="1" fill="#0F172A" />
                <rect x="14" y="9" width="3" height="1" fill="#0F172A" />
              </>
            ) : mood === 'growl' ? (
              <>
                {/* Determined fierce pixel eyes */}
                <rect x="7" y="8" width="3" height="2" fill="#0F172A" />
                <rect x="7" y="7" width="2" height="1" fill="#0F172A" />
                <rect x="14" y="8" width="3" height="2" fill="#0F172A" />
                <rect x="15" y="7" width="2" height="1" fill="#0F172A" />
                <rect x="8" y="8" width="1" height="1" fill="#FFFFFF" />
                <rect x="15" y="8" width="1" height="1" fill="#FFFFFF" />
              </>
            ) : mood === 'cheer' || mood === 'sing' ? (
              <>
                {/* Happy curved '^' eyes */}
                <rect x="7" y="8" width="1" height="1" fill="#0F172A" />
                <rect x="8" y="7" width="1" height="1" fill="#0F172A" />
                <rect x="9" y="8" width="1" height="1" fill="#0F172A" />
                <rect x="14" y="8" width="1" height="1" fill="#0F172A" />
                <rect x="15" y="7" width="1" height="1" fill="#0F172A" />
                <rect x="16" y="8" width="1" height="1" fill="#0F172A" />
              </>
            ) : (
              <>
                {/* Standard cute sparkling voxel eyes */}
                <rect x="7" y="8" width="2" height="2" fill="#0F172A" />
                <rect x="7" y="8" width="1" height="1" fill="#FFFFFF" />
                <rect x="15" y="8" width="2" height="2" fill="#0F172A" />
                <rect x="15" y="8" width="1" height="1" fill="#FFFFFF" />
              </>
            )}

            {/* Rosy Pixel Cheeks */}
            <rect x="6" y="10" width="2" height="1" fill={zodiac.cheekColor} />
            <rect x="16" y="10" width="2" height="1" fill={zodiac.cheekColor} />

            {/* Cat Whiskers if Cat */}
            {zodiac.earStyle === 'cat' && (
              <>
                <rect x="4" y="10" width="2" height="1" fill="#475569" />
                <rect x="4" y="12" width="2" height="1" fill="#475569" />
                <rect x="18" y="10" width="2" height="1" fill="#475569" />
                <rect x="18" y="12" width="2" height="1" fill="#475569" />
              </>
            )}

            {/* Nose & Mouth */}
            <rect x="11" y="10" width="2" height="1" fill={zodiac.accentColor} />
            {mood === 'sing' ? (
              /* Singing open 'O' mouth */
              <rect x="11" y="11.5" width="2" height="2" fill="#BE123C" />
            ) : mood === 'growl' ? (
              /* Little fang mouth */
              <>
                <rect x="10" y="12" width="4" height="1" fill="#0F172A" />
                <rect x="10" y="12" width="1" height="1" fill="#FFFFFF" />
                <rect x="13" y="12" width="1" height="1" fill="#FFFFFF" />
              </>
            ) : mood === 'sleep' ? (
              <rect x="11" y="12" width="2" height="1" fill="#64748B" />
            ) : (
              /* Cute smile */
              <>
                <rect x="10" y="12" width="1" height="1" fill="#0F172A" />
                <rect x="11" y="12.5" width="2" height="1" fill="#0F172A" />
                <rect x="13" y="12" width="1" height="1" fill="#0F172A" />
              </>
            )}

            {/* Voxel Body */}
            <rect x="6" y="15" width="12" height="5" fill={zodiac.primaryColor} />
            <rect x="8" y="15" width="8" height="4" fill={zodiac.secondaryColor} />

            {/* Arms / Paws */}
            <rect
              x="4"
              y={mood === 'cheer' || mood === 'sing' ? '13' : '15'}
              width="2"
              height="3"
              fill={zodiac.primaryColor}
            />
            <rect
              x="18"
              y={mood === 'cheer' || mood === 'growl' ? '13' : '15'}
              width="2"
              height="3"
              fill={zodiac.primaryColor}
            />

            {/* Feet */}
            <rect
              x="7"
              y={stepFrame % 2 === 0 ? '20' : '19.5'}
              width="3"
              height="2"
              fill={zodiac.accentColor}
            />
            <rect
              x="14"
              y={stepFrame % 2 === 1 ? '20' : '19.5'}
              width="3"
              height="2"
              fill={zodiac.accentColor}
            />
          </svg>
        </div>

        {/* Zodiac Label Pill */}
        <span className="mt-1 inline-flex items-center gap-1 rounded-md bg-black/35 px-2 py-0.5 text-[10px] font-extrabold text-lime-100">
          <span>{zodiac.branchName}</span>
        </span>
      </button>

      {!birthDate && onOpenProfile && (
        <button
          type="button"
          onClick={onOpenProfile}
          className="mt-1 text-[10px] font-bold text-lime-100/90 hover:text-white underline underline-offset-2 cursor-pointer"
        >
          Nhập ngày sinh để đổi 12 con giáp
        </button>
      )}
    </div>
  );
};
