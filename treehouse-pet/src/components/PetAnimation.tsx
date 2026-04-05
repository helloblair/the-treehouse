import { useEffect, useRef, useState } from 'react'
import type { Pet, Mood } from '../types'

interface PetAnimationProps {
  petType: Pet['pet_type']
  mood: Mood
}

const SHIMMER_STYLE_ID = 'pet-video-shimmer'

function ensureShimmerStyle() {
  if (document.getElementById(SHIMMER_STYLE_ID)) return
  const style = document.createElement('style')
  style.id = SHIMMER_STYLE_ID
  style.textContent = `
    @keyframes pet-shimmer {
      0% { background-position: -300px 0; }
      100% { background-position: 300px 0; }
    }
  `
  document.head.appendChild(style)
}

export default function PetAnimation({ petType, mood }: PetAnimationProps) {
  const [videoError, setVideoError] = useState(false)
  const [videoLoaded, setVideoLoaded] = useState(false)
  const [opacity, setOpacity] = useState(1)
  const prevMoodRef = useRef(mood)

  // Crossfade on mood change
  useEffect(() => {
    if (prevMoodRef.current !== mood) {
      setOpacity(0)
      const timer = setTimeout(() => setOpacity(1), 150)
      prevMoodRef.current = mood
      return () => clearTimeout(timer)
    }
  }, [mood])

  useEffect(() => {
    ensureShimmerStyle()
  }, [])

  if (videoError) {
    const Placeholder = PLACEHOLDERS[petType] ?? DachshundPlaceholder
    return <Placeholder mood={mood} />
  }

  const videoKey = `${petType}_${mood}`

  return (
    <div
      style={{
        width: 300,
        height: 300,
        borderRadius: 24,
        background: MOOD_BG[mood],
        transition: 'background 0.5s',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {!videoLoaded && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.3) 50%, transparent 100%)',
            backgroundSize: '300px 100%',
            animation: 'pet-shimmer 1.5s infinite linear',
          }}
        />
      )}
      <video
        key={videoKey}
        autoPlay
        loop
        muted
        playsInline
        width={300}
        height={300}
        src={`/pets/${petType}_${mood}.webm`}
        onLoadedData={() => setVideoLoaded(true)}
        onError={(e) => {
          const vid = e.currentTarget
          // If WebM failed, try MP4 fallback
          if (vid.src.endsWith('.webm')) {
            vid.src = `/pets/${petType}_${mood}.mp4`
          } else {
            // Both formats failed — use SVG placeholder
            setVideoError(true)
          }
        }}
        style={{
          display: 'block',
          opacity,
          transition: 'opacity 150ms ease',
        }}
      />
      <div style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}>
        <MoodOverlays mood={mood} />
      </div>
    </div>
  )
}

/* ─── Mood-based animation classes (injected once) ─── */

const STYLE_ID = 'pet-animation-styles'

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = `
    @keyframes pet-bounce {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-8px); }
    }
    @keyframes pet-ecstatic {
      0%, 100% { transform: translateY(0) rotate(0deg); }
      25% { transform: translateY(-14px) rotate(-5deg); }
      75% { transform: translateY(-14px) rotate(5deg); }
    }
    @keyframes pet-wiggle {
      0%, 100% { transform: rotate(0deg); }
      25% { transform: rotate(-6deg); }
      75% { transform: rotate(6deg); }
    }
    @keyframes pet-sick {
      0%, 100% { transform: translateX(0); }
      25% { transform: translateX(-3px); }
      75% { transform: translateX(3px); }
    }
    @keyframes pet-sleep {
      0%, 100% { transform: translateY(0) scaleY(1); }
      50% { transform: translateY(2px) scaleY(0.97); }
    }
    @keyframes pet-hungry {
      0%, 100% { transform: scaleX(1); }
      50% { transform: scaleX(1.03); }
    }
    @keyframes pet-tail-wag {
      0%, 100% { transform: rotate(-15deg); }
      50% { transform: rotate(25deg); }
    }
    @keyframes pet-tail-ecstatic {
      0%, 100% { transform: rotate(-25deg); }
      25% { transform: rotate(35deg); }
      50% { transform: rotate(-25deg); }
      75% { transform: rotate(35deg); }
    }
    @keyframes cat-tail-swish {
      0%, 100% { transform: rotate(-10deg); }
      50% { transform: rotate(15deg); }
    }
    @keyframes float-zzz {
      0% { opacity: 0; transform: translate(0, 0) scale(0.5); }
      50% { opacity: 1; transform: translate(8px, -16px) scale(1); }
      100% { opacity: 0; transform: translate(16px, -32px) scale(0.7); }
    }
    @keyframes sparkle {
      0%, 100% { opacity: 0; transform: scale(0); }
      50% { opacity: 1; transform: scale(1); }
    }
    @keyframes blink {
      0%, 90%, 100% { transform: scaleY(1); }
      95% { transform: scaleY(0.1); }
    }
    @keyframes ear-flop {
      0%, 100% { transform: rotate(0deg); }
      50% { transform: rotate(-8deg); }
    }
    @keyframes purr {
      0%, 100% { transform: scaleY(1); }
      50% { transform: scaleY(1.02); }
    }
    @keyframes pet-stinky {
      0%, 100% { transform: translateX(0) rotate(0deg); }
      20% { transform: translateX(-2px) rotate(-2deg); }
      40% { transform: translateX(2px) rotate(2deg); }
      60% { transform: translateX(-1px) rotate(-1deg); }
      80% { transform: translateX(1px) rotate(1deg); }
    }
    @keyframes stink-float {
      0% { opacity: 0; transform: translate(0, 0) scale(0.5); }
      40% { opacity: 0.8; transform: translate(-4px, -14px) scale(1); }
      100% { opacity: 0; transform: translate(-8px, -30px) scale(0.6); }
    }
  `
  document.head.appendChild(style)
}

const MOOD_ANIM: Record<Mood, string> = {
  happy: 'pet-bounce 1s ease-in-out infinite',
  ecstatic: 'pet-ecstatic 0.5s ease-in-out infinite',
  excited: 'pet-wiggle 0.4s ease-in-out infinite',
  sick: 'pet-sick 0.8s ease-in-out infinite',
  sleeping: 'pet-sleep 2.5s ease-in-out infinite',
  hungry: 'pet-hungry 1.5s ease-in-out infinite',
  stinky: 'pet-stinky 1.2s ease-in-out infinite',
}

const MOOD_BG: Record<Mood, string> = {
  happy: '#FFF9E6',
  ecstatic: '#E8F9EE',
  excited: '#E8F0FE',
  sick: '#F0F9E0',
  sleeping: '#F3EEFA',
  hungry: '#FFF0E5',
  stinky: '#F0EDE4',
}

/* ─── Shared mood overlays ─── */

function MoodOverlays({ mood }: { mood: Mood }) {
  return (
    <>
      {mood === 'sleeping' && (
        <>
          <text x="130" y="75" fontSize="14" fontWeight="800" fill="#9B59B6" opacity="0.7"
            style={{ animation: 'float-zzz 2s ease-in-out infinite' }}>z</text>
          <text x="140" y="62" fontSize="11" fontWeight="800" fill="#9B59B6" opacity="0.5"
            style={{ animation: 'float-zzz 2s ease-in-out infinite 0.5s' }}>z</text>
          <text x="148" y="50" fontSize="9" fontWeight="800" fill="#9B59B6" opacity="0.3"
            style={{ animation: 'float-zzz 2s ease-in-out infinite 1s' }}>z</text>
        </>
      )}
      {mood === 'ecstatic' && (
        <>
          <text x="30" y="55" fontSize="16" style={{ animation: 'sparkle 0.8s ease-in-out infinite' }}>✦</text>
          <text x="155" y="60" fontSize="12" style={{ animation: 'sparkle 0.8s ease-in-out infinite 0.3s' }}>✦</text>
          <text x="40" y="140" fontSize="10" style={{ animation: 'sparkle 0.8s ease-in-out infinite 0.6s' }}>✦</text>
        </>
      )}
      {mood === 'stinky' && (
        <>
          {/* Stink clouds */}
          <g style={{ animation: 'stink-float 2s ease-in-out infinite' }}>
            <path d="M55 80 Q52 75 56 72 Q60 69 58 65" stroke="#9B8B5A" strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.5" />
          </g>
          <g style={{ animation: 'stink-float 2s ease-in-out infinite 0.6s' }}>
            <path d="M100 70 Q97 65 101 62 Q105 59 103 55" stroke="#9B8B5A" strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.5" />
          </g>
          <g style={{ animation: 'stink-float 2s ease-in-out infinite 1.2s' }}>
            <path d="M140 78 Q137 73 141 70 Q145 67 143 63" stroke="#9B8B5A" strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.5" />
          </g>
          {/* Flies */}
          <circle cx="65" cy="68" r="2" fill="#555">
            <animateMotion path="M0,0 Q8,-6 0,-12 Q-8,-6 0,0" dur="1.2s" repeatCount="indefinite" />
          </circle>
          <circle cx="135" cy="72" r="1.8" fill="#555">
            <animateMotion path="M0,0 Q-6,-8 0,-14 Q6,-8 0,0" dur="1.5s" repeatCount="indefinite" />
          </circle>
        </>
      )}
    </>
  )
}

function PetWrapper({ mood, children }: { mood: Mood; children: React.ReactNode }) {
  ensureStyles()
  return (
    <div style={{
      width: 300, height: 300,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      borderRadius: 24,
      background: MOOD_BG[mood],
      transition: 'background 0.5s ease',
      overflow: 'hidden',
      position: 'relative',
    }}>
      <svg viewBox="0 0 200 200" width={240} height={240} style={{ animation: MOOD_ANIM[mood] }}>
        <ellipse cx="100" cy="172" rx="42" ry="7" fill="rgba(0,0,0,0.08)" />
        {children}
        <MoodOverlays mood={mood} />
      </svg>
    </div>
  )
}

/* ─── Dachshund SVG ─── */

function DachshundPlaceholder({ mood }: { mood: Mood }) {
  ensureStyles()
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 3000)
    return () => clearInterval(id)
  }, [])

  const tailAnim = mood === 'ecstatic'
    ? 'pet-tail-ecstatic 0.25s ease-in-out infinite'
    : mood === 'sleeping'
      ? 'none'
      : 'pet-tail-wag 0.6s ease-in-out infinite'

  const eyeOpen = mood !== 'sleeping'
  const isSick = mood === 'sick'
  const bodyColor = isSick ? '#C4A265' : '#8B5E34'
  const bellyColor = isSick ? '#DBBF82' : '#D4A06A'

  return (
    <div style={{
      width: 300, height: 300,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      borderRadius: 24,
      background: MOOD_BG[mood],
      transition: 'background 0.5s ease',
      overflow: 'hidden',
      position: 'relative',
    }}>
      <svg
        viewBox="0 0 200 200"
        width={240}
        height={240}
        style={{ animation: MOOD_ANIM[mood] }}
      >
        {/* Shadow */}
        <ellipse cx="100" cy="170" rx="55" ry="8" fill="rgba(0,0,0,0.08)" />

        {/* Tail */}
        <g style={{ transformOrigin: '155px 100px', animation: tailAnim }}>
          <path d="M155 100 Q170 85 168 70" stroke={bodyColor} strokeWidth="5" fill="none" strokeLinecap="round" />
        </g>

        {/* Back legs */}
        <rect x="130" y="138" width="12" height="22" rx="6" fill={bodyColor} />
        <rect x="140" y="138" width="12" height="22" rx="6" fill={bodyColor} />

        {/* Front legs */}
        <rect x="55" y="138" width="12" height="22" rx="6" fill={bodyColor} />
        <rect x="65" y="138" width="12" height="22" rx="6" fill={bodyColor} />

        {/* Body (long boi) */}
        <ellipse cx="100" cy="120" rx="60" ry="28" fill={bodyColor} />

        {/* Belly */}
        <ellipse cx="100" cy="130" rx="48" ry="16" fill={bellyColor} />

        {/* Head */}
        <circle cx="52" cy="100" r="26" fill={bodyColor} />

        {/* Snout */}
        <ellipse cx="34" cy="108" rx="16" ry="11" fill={bellyColor} />
        <ellipse cx="30" cy="104" rx="6" ry="4.5" fill="#3D2B1A" />

        {/* Mouth */}
        {mood === 'happy' || mood === 'ecstatic' || mood === 'excited' ? (
          <path d="M28 112 Q34 118 40 112" stroke="#3D2B1A" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        ) : mood === 'hungry' ? (
          <ellipse cx="34" cy="114" rx="4" ry="3" fill="#3D2B1A" />
        ) : mood === 'sick' ? (
          <path d="M28 114 Q34 110 40 114" stroke="#3D2B1A" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        ) : null}

        {/* Eyes */}
        <g style={{ animation: eyeOpen ? 'blink 4s ease-in-out infinite' : 'none', transformOrigin: '44px 96px' }}>
          {eyeOpen ? (
            <>
              <circle cx="44" cy="96" r="5" fill="white" />
              <circle cx="44" cy="96" r="3" fill="#3D2B1A" />
              <circle cx="45.5" cy="94.5" r="1" fill="white" />
            </>
          ) : (
            <path d="M39 96 Q44 99 49 96" stroke="#3D2B1A" strokeWidth="2" fill="none" strokeLinecap="round" />
          )}
        </g>
        <g style={{ animation: eyeOpen ? 'blink 4s ease-in-out infinite 0.1s' : 'none', transformOrigin: '60px 94px' }}>
          {eyeOpen ? (
            <>
              <circle cx="60" cy="94" r="4.5" fill="white" />
              <circle cx="60" cy="94" r="2.8" fill="#3D2B1A" />
              <circle cx="61.2" cy="92.8" r="1" fill="white" />
            </>
          ) : (
            <path d="M55.5 94 Q60 97 64.5 94" stroke="#3D2B1A" strokeWidth="2" fill="none" strokeLinecap="round" />
          )}
        </g>

        {/* Sick spirals */}
        {isSick && (
          <>
            <circle cx="44" cy="96" r="4" fill="none" stroke="#7DB84D" strokeWidth="1" opacity="0.6" />
            <circle cx="60" cy="94" r="3.5" fill="none" stroke="#7DB84D" strokeWidth="1" opacity="0.6" />
          </>
        )}

        {/* Ears (floppy) */}
        <g style={{ transformOrigin: '38px 82px', animation: mood !== 'sleeping' ? 'ear-flop 2s ease-in-out infinite' : 'none' }}>
          <ellipse cx="36" cy="82" rx="10" ry="16" fill="#6B3F1F" transform="rotate(-20 36 82)" />
        </g>
        <ellipse cx="62" cy="80" rx="9" ry="14" fill="#6B3F1F" transform="rotate(10 62 80)" />

        {/* Blush (happy/ecstatic) */}
        {(mood === 'happy' || mood === 'ecstatic') && (
          <>
            <ellipse cx="36" cy="108" rx="5" ry="3" fill="#FF9999" opacity="0.4" />
            <ellipse cx="56" cy="106" rx="5" ry="3" fill="#FF9999" opacity="0.4" />
          </>
        )}

        {/* Sleeping ZZZs */}
        {mood === 'sleeping' && (
          <>
            <text x="72" y="78" fontSize="14" fontWeight="800" fill="#9B59B6" opacity="0.7"
              style={{ animation: 'float-zzz 2s ease-in-out infinite' }}>z</text>
            <text x="82" y="68" fontSize="11" fontWeight="800" fill="#9B59B6" opacity="0.5"
              style={{ animation: 'float-zzz 2s ease-in-out infinite 0.5s' }}>z</text>
            <text x="90" y="58" fontSize="9" fontWeight="800" fill="#9B59B6" opacity="0.3"
              style={{ animation: 'float-zzz 2s ease-in-out infinite 1s' }}>z</text>
          </>
        )}

        {/* Ecstatic sparkles */}
        {mood === 'ecstatic' && (
          <>
            <text x="25" y="75" fontSize="16" style={{ animation: 'sparkle 0.8s ease-in-out infinite' }}>✦</text>
            <text x="160" y="90" fontSize="12" style={{ animation: 'sparkle 0.8s ease-in-out infinite 0.3s' }}>✦</text>
            <text x="80" y="60" fontSize="10" style={{ animation: 'sparkle 0.8s ease-in-out infinite 0.6s' }}>✦</text>
          </>
        )}

        {/* Hungry drool */}
        {mood === 'hungry' && (
          <ellipse cx="32" cy="120" rx="2" ry="4" fill="#88CCEE" opacity="0.6">
            <animate attributeName="ry" values="3;6;3" dur="1.5s" repeatCount="indefinite" />
          </ellipse>
        )}
      </svg>
    </div>
  )
}

/* ─── Calico Cat SVG ─── */

function CalicoPlaceholder({ mood }: { mood: Mood }) {
  ensureStyles()
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 3000)
    return () => clearInterval(id)
  }, [])

  const eyeOpen = mood !== 'sleeping'
  const isSick = mood === 'sick'
  const baseColor = isSick ? '#D4C4A8' : '#F5E6D0'
  const patchOrange = isSick ? '#C9A060' : '#E8945A'
  const patchDark = isSick ? '#6B6B5A' : '#4A4A4A'

  const tailAnim = mood === 'ecstatic'
    ? 'cat-tail-swish 0.3s ease-in-out infinite'
    : mood === 'sleeping'
      ? 'none'
      : 'cat-tail-swish 1.2s ease-in-out infinite'

  return (
    <div style={{
      width: 300, height: 300,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      borderRadius: 24,
      background: MOOD_BG[mood],
      transition: 'background 0.5s ease',
      overflow: 'hidden',
      position: 'relative',
    }}>
      <svg
        viewBox="0 0 200 200"
        width={240}
        height={240}
        style={{ animation: MOOD_ANIM[mood] }}
      >
        {/* Shadow */}
        <ellipse cx="100" cy="172" rx="42" ry="7" fill="rgba(0,0,0,0.08)" />

        {/* Tail */}
        <g style={{ transformOrigin: '140px 130px', animation: tailAnim }}>
          <path d="M138 130 Q160 110 165 85 Q168 72 158 72" stroke={patchOrange} strokeWidth="7" fill="none" strokeLinecap="round" />
          <path d="M162 78 Q168 72 158 72" stroke={patchDark} strokeWidth="7" fill="none" strokeLinecap="round" />
        </g>

        {/* Back legs */}
        <ellipse cx="125" cy="158" rx="12" ry="14" fill={baseColor} />
        <ellipse cx="125" cy="167" rx="10" ry="5" fill="#F8F0E8" />

        {/* Front legs */}
        <ellipse cx="75" cy="158" rx="11" ry="14" fill={baseColor} />
        <ellipse cx="75" cy="167" rx="9" ry="5" fill="#F8F0E8" />

        {/* Body */}
        <ellipse cx="100" cy="132" rx="42" ry="32" fill={baseColor}
          style={{ animation: mood === 'happy' || mood === 'ecstatic' ? 'purr 0.3s ease-in-out infinite' : 'none', transformOrigin: '100px 132px' }}
        />

        {/* Calico patches on body */}
        <ellipse cx="85" cy="125" rx="14" ry="10" fill={patchOrange} opacity="0.7" />
        <ellipse cx="118" cy="135" rx="12" ry="9" fill={patchDark} opacity="0.5" />
        <ellipse cx="100" cy="145" rx="8" ry="6" fill={patchOrange} opacity="0.5" />

        {/* Chest */}
        <ellipse cx="100" cy="148" rx="22" ry="10" fill="#F8F0E8" />

        {/* Head */}
        <circle cx="100" cy="88" r="30" fill={baseColor} />

        {/* Head patches */}
        <ellipse cx="85" cy="80" rx="12" ry="10" fill={patchOrange} opacity="0.7" />
        <ellipse cx="115" cy="82" rx="10" ry="8" fill={patchDark} opacity="0.5" />

        {/* Ears */}
        <polygon points="76,68 68,42 88,58" fill={baseColor} />
        <polygon points="78,65 72,48 86,60" fill="#FFB5B5" />
        <polygon points="124,68 132,42 112,58" fill={baseColor} />
        <polygon points="122,65 128,48 114,60" fill="#FFB5B5" />

        {/* Ear patches */}
        <polygon points="76,68 68,42 78,55" fill={patchOrange} opacity="0.6" />
        <polygon points="124,68 132,42 122,55" fill={patchDark} opacity="0.4" />

        {/* Eyes */}
        <g style={{ animation: eyeOpen ? 'blink 5s ease-in-out infinite' : 'none', transformOrigin: '88px 88px' }}>
          {eyeOpen ? (
            <>
              <ellipse cx="88" cy="88" rx="6" ry="7" fill="white" />
              <ellipse cx="88" cy="88" rx="3.5" ry="5" fill="#5BA35F" />
              <ellipse cx="88" cy="88" rx="1.8" ry="4" fill="#2A2A2A" />
              <ellipse cx="89.5" cy="86" rx="1.2" ry="1.5" fill="white" />
            </>
          ) : (
            <path d="M82 89 Q88 93 94 89" stroke="#3D2B1A" strokeWidth="2" fill="none" strokeLinecap="round" />
          )}
        </g>
        <g style={{ animation: eyeOpen ? 'blink 5s ease-in-out infinite 0.15s' : 'none', transformOrigin: '112px 88px' }}>
          {eyeOpen ? (
            <>
              <ellipse cx="112" cy="88" rx="6" ry="7" fill="white" />
              <ellipse cx="112" cy="88" rx="3.5" ry="5" fill="#5BA35F" />
              <ellipse cx="112" cy="88" rx="1.8" ry="4" fill="#2A2A2A" />
              <ellipse cx="113.5" cy="86" rx="1.2" ry="1.5" fill="white" />
            </>
          ) : (
            <path d="M106 89 Q112 93 118 89" stroke="#3D2B1A" strokeWidth="2" fill="none" strokeLinecap="round" />
          )}
        </g>

        {/* Sick spirals over eyes */}
        {isSick && (
          <>
            <circle cx="88" cy="88" r="5" fill="none" stroke="#7DB84D" strokeWidth="1" opacity="0.6" />
            <circle cx="112" cy="88" r="5" fill="none" stroke="#7DB84D" strokeWidth="1" opacity="0.6" />
          </>
        )}

        {/* Nose */}
        <path d="M96 97 L100 101 L104 97 Z" fill="#FFB5B5" />

        {/* Whiskers */}
        <g opacity="0.4">
          <line x1="78" y1="98" x2="60" y2="94" stroke="#888" strokeWidth="1" />
          <line x1="78" y1="101" x2="58" y2="102" stroke="#888" strokeWidth="1" />
          <line x1="78" y1="104" x2="60" y2="110" stroke="#888" strokeWidth="1" />
          <line x1="122" y1="98" x2="140" y2="94" stroke="#888" strokeWidth="1" />
          <line x1="122" y1="101" x2="142" y2="102" stroke="#888" strokeWidth="1" />
          <line x1="122" y1="104" x2="140" y2="110" stroke="#888" strokeWidth="1" />
        </g>

        {/* Mouth */}
        {mood === 'happy' || mood === 'ecstatic' || mood === 'excited' ? (
          <>
            <path d="M96 103 Q100 108 104 103" stroke="#3D2B1A" strokeWidth="1.2" fill="none" strokeLinecap="round" />
          </>
        ) : mood === 'hungry' ? (
          <ellipse cx="100" cy="106" rx="3" ry="2.5" fill="#3D2B1A" />
        ) : mood === 'sick' ? (
          <path d="M96 106 Q100 103 104 106" stroke="#3D2B1A" strokeWidth="1.2" fill="none" strokeLinecap="round" />
        ) : null}

        {/* Blush */}
        {(mood === 'happy' || mood === 'ecstatic') && (
          <>
            <ellipse cx="80" cy="100" rx="6" ry="3.5" fill="#FF9999" opacity="0.3" />
            <ellipse cx="120" cy="100" rx="6" ry="3.5" fill="#FF9999" opacity="0.3" />
          </>
        )}

        {/* Sleeping ZZZs */}
        {mood === 'sleeping' && (
          <>
            <text x="130" y="75" fontSize="14" fontWeight="800" fill="#9B59B6" opacity="0.7"
              style={{ animation: 'float-zzz 2s ease-in-out infinite' }}>z</text>
            <text x="140" y="62" fontSize="11" fontWeight="800" fill="#9B59B6" opacity="0.5"
              style={{ animation: 'float-zzz 2s ease-in-out infinite 0.5s' }}>z</text>
            <text x="148" y="50" fontSize="9" fontWeight="800" fill="#9B59B6" opacity="0.3"
              style={{ animation: 'float-zzz 2s ease-in-out infinite 1s' }}>z</text>
          </>
        )}

        {/* Ecstatic sparkles */}
        {mood === 'ecstatic' && (
          <>
            <text x="55" y="60" fontSize="16" style={{ animation: 'sparkle 0.8s ease-in-out infinite' }}>✦</text>
            <text x="140" y="55" fontSize="12" style={{ animation: 'sparkle 0.8s ease-in-out infinite 0.3s' }}>✦</text>
            <text x="45" y="130" fontSize="10" style={{ animation: 'sparkle 0.8s ease-in-out infinite 0.6s' }}>✦</text>
          </>
        )}

        {/* Hungry drool */}
        {mood === 'hungry' && (
          <ellipse cx="100" cy="112" rx="1.5" ry="4" fill="#88CCEE" opacity="0.6">
            <animate attributeName="ry" values="3;6;3" dur="1.5s" repeatCount="indefinite" />
          </ellipse>
        )}
      </svg>
    </div>
  )
}

/* ─── Bunny SVG ─── */

function BunnyPlaceholder({ mood }: { mood: Mood }) {
  const eyeOpen = mood !== 'sleeping'
  const isSick = mood === 'sick'
  const bodyColor = isSick ? '#D4C8B8' : '#F0E4D8'
  const innerEar = isSick ? '#D4A0A0' : '#FFB5C0'
  const bellyColor = '#FAF4F0'

  const earAnim = mood === 'ecstatic'
    ? 'ear-flop 0.3s ease-in-out infinite'
    : mood === 'sleeping' ? 'none' : 'ear-flop 1.5s ease-in-out infinite'

  return (
    <PetWrapper mood={mood}>
      {/* Feet */}
      <ellipse cx="82" cy="164" rx="14" ry="7" fill={bodyColor} />
      <ellipse cx="118" cy="164" rx="14" ry="7" fill={bodyColor} />
      <ellipse cx="82" cy="164" rx="10" ry="5" fill={bellyColor} />
      <ellipse cx="118" cy="164" rx="10" ry="5" fill={bellyColor} />

      {/* Tail (puff) */}
      <circle cx="140" cy="140" r="10" fill="white" />

      {/* Body */}
      <ellipse cx="100" cy="135" rx="38" ry="35" fill={bodyColor} />
      <ellipse cx="100" cy="145" rx="26" ry="20" fill={bellyColor} />

      {/* Head */}
      <circle cx="100" cy="90" r="30" fill={bodyColor} />

      {/* Ears */}
      <g style={{ transformOrigin: '85px 60px', animation: earAnim }}>
        <ellipse cx="82" cy="42" rx="12" ry="30" fill={bodyColor} transform="rotate(-10 82 42)" />
        <ellipse cx="82" cy="42" rx="7" ry="24" fill={innerEar} transform="rotate(-10 82 42)" />
      </g>
      <g style={{ transformOrigin: '115px 60px', animation: earAnim }}>
        <ellipse cx="118" cy="42" rx="12" ry="30" fill={bodyColor} transform="rotate(10 118 42)" />
        <ellipse cx="118" cy="42" rx="7" ry="24" fill={innerEar} transform="rotate(10 118 42)" />
      </g>

      {/* Eyes */}
      <g style={{ animation: eyeOpen ? 'blink 4s ease-in-out infinite' : 'none', transformOrigin: '88px 88px' }}>
        {eyeOpen ? (
          <>
            <circle cx="88" cy="88" r="6" fill="white" />
            <circle cx="88" cy="88" r="4" fill="#8B4557" />
            <circle cx="89.5" cy="86.5" r="1.5" fill="white" />
          </>
        ) : (
          <path d="M82 89 Q88 93 94 89" stroke="#5A3040" strokeWidth="2" fill="none" strokeLinecap="round" />
        )}
      </g>
      <g style={{ animation: eyeOpen ? 'blink 4s ease-in-out infinite 0.1s' : 'none', transformOrigin: '112px 88px' }}>
        {eyeOpen ? (
          <>
            <circle cx="112" cy="88" r="6" fill="white" />
            <circle cx="112" cy="88" r="4" fill="#8B4557" />
            <circle cx="113.5" cy="86.5" r="1.5" fill="white" />
          </>
        ) : (
          <path d="M106 89 Q112 93 118 89" stroke="#5A3040" strokeWidth="2" fill="none" strokeLinecap="round" />
        )}
      </g>

      {isSick && (
        <>
          <circle cx="88" cy="88" r="5" fill="none" stroke="#7DB84D" strokeWidth="1" opacity="0.6" />
          <circle cx="112" cy="88" r="5" fill="none" stroke="#7DB84D" strokeWidth="1" opacity="0.6" />
        </>
      )}

      {/* Nose + mouth */}
      <ellipse cx="100" cy="98" rx="4" ry="3" fill={innerEar} />
      {mood === 'happy' || mood === 'ecstatic' || mood === 'excited' ? (
        <>
          <path d="M96 101 Q100 106 104 101" stroke="#5A3040" strokeWidth="1.2" fill="none" strokeLinecap="round" />
          <line x1="100" y1="101" x2="100" y2="104" stroke="#5A3040" strokeWidth="1" />
        </>
      ) : mood === 'hungry' ? (
        <ellipse cx="100" cy="104" rx="3" ry="2.5" fill="#5A3040" />
      ) : mood === 'sick' ? (
        <path d="M96 104 Q100 101 104 104" stroke="#5A3040" strokeWidth="1.2" fill="none" strokeLinecap="round" />
      ) : null}

      {/* Whiskers */}
      <g opacity="0.3">
        <line x1="82" y1="98" x2="65" y2="95" stroke="#888" strokeWidth="0.8" />
        <line x1="82" y1="101" x2="64" y2="103" stroke="#888" strokeWidth="0.8" />
        <line x1="118" y1="98" x2="135" y2="95" stroke="#888" strokeWidth="0.8" />
        <line x1="118" y1="101" x2="136" y2="103" stroke="#888" strokeWidth="0.8" />
      </g>

      {/* Blush */}
      {(mood === 'happy' || mood === 'ecstatic') && (
        <>
          <ellipse cx="78" cy="98" rx="6" ry="3" fill="#FF9999" opacity="0.3" />
          <ellipse cx="122" cy="98" rx="6" ry="3" fill="#FF9999" opacity="0.3" />
        </>
      )}

      {/* Teeth (buck teeth!) */}
      {eyeOpen && (
        <>
          <rect x="97" y="104" width="3" height="4" rx="1" fill="white" stroke="#ddd" strokeWidth="0.5" />
          <rect x="100" y="104" width="3" height="4" rx="1" fill="white" stroke="#ddd" strokeWidth="0.5" />
        </>
      )}

      {mood === 'hungry' && (
        <ellipse cx="100" cy="112" rx="1.5" ry="4" fill="#88CCEE" opacity="0.6">
          <animate attributeName="ry" values="3;6;3" dur="1.5s" repeatCount="indefinite" />
        </ellipse>
      )}
    </PetWrapper>
  )
}

/* ─── Frog SVG ─── */

function FrogPlaceholder({ mood }: { mood: Mood }) {
  const eyeOpen = mood !== 'sleeping'
  const isSick = mood === 'sick'
  const bodyColor = isSick ? '#8BA870' : '#6BCB77'
  const bellyColor = isSick ? '#C8D8A0' : '#B8E8A0'
  const darkGreen = isSick ? '#5A7848' : '#3D8B48'

  return (
    <PetWrapper mood={mood}>
      {/* Back legs */}
      <ellipse cx="60" cy="160" rx="20" ry="10" fill={bodyColor} transform="rotate(-10 60 160)" />
      <ellipse cx="140" cy="160" rx="20" ry="10" fill={bodyColor} transform="rotate(10 140 160)" />
      {/* Toes */}
      <circle cx="44" cy="162" r="4" fill={darkGreen} />
      <circle cx="52" cy="165" r="4" fill={darkGreen} />
      <circle cx="148" cy="165" r="4" fill={darkGreen} />
      <circle cx="156" cy="162" r="4" fill={darkGreen} />

      {/* Front legs */}
      <ellipse cx="72" cy="155" rx="10" ry="8" fill={bodyColor} />
      <ellipse cx="128" cy="155" rx="10" ry="8" fill={bodyColor} />
      <circle cx="64" cy="158" r="3.5" fill={darkGreen} />
      <circle cx="136" cy="158" r="3.5" fill={darkGreen} />

      {/* Body */}
      <ellipse cx="100" cy="135" rx="40" ry="30" fill={bodyColor} />
      <ellipse cx="100" cy="142" rx="30" ry="18" fill={bellyColor} />

      {/* Spots */}
      <circle cx="80" cy="125" r="6" fill={darkGreen} opacity="0.3" />
      <circle cx="120" cy="120" r="5" fill={darkGreen} opacity="0.3" />
      <circle cx="105" cy="132" r="4" fill={darkGreen} opacity="0.2" />

      {/* Head */}
      <ellipse cx="100" cy="95" rx="35" ry="28" fill={bodyColor} />

      {/* Eye bumps (protruding frog eyes!) */}
      <circle cx="80" cy="75" r="16" fill={bodyColor} />
      <circle cx="120" cy="75" r="16" fill={bodyColor} />

      {/* Eyes */}
      <g style={{ animation: eyeOpen ? 'blink 5s ease-in-out infinite' : 'none', transformOrigin: '80px 75px' }}>
        {eyeOpen ? (
          <>
            <circle cx="80" cy="75" r="11" fill="white" />
            <circle cx="80" cy="75" r="7" fill="#2A2A2A" />
            <circle cx="82" cy="73" r="2.5" fill="white" />
          </>
        ) : (
          <path d="M70 76 Q80 80 90 76" stroke="#2A5A30" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        )}
      </g>
      <g style={{ animation: eyeOpen ? 'blink 5s ease-in-out infinite 0.2s' : 'none', transformOrigin: '120px 75px' }}>
        {eyeOpen ? (
          <>
            <circle cx="120" cy="75" r="11" fill="white" />
            <circle cx="120" cy="75" r="7" fill="#2A2A2A" />
            <circle cx="122" cy="73" r="2.5" fill="white" />
          </>
        ) : (
          <path d="M110 76 Q120 80 130 76" stroke="#2A5A30" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        )}
      </g>

      {isSick && (
        <>
          <circle cx="80" cy="75" r="8" fill="none" stroke="#AAAA44" strokeWidth="1" opacity="0.6" />
          <circle cx="120" cy="75" r="8" fill="none" stroke="#AAAA44" strokeWidth="1" opacity="0.6" />
        </>
      )}

      {/* Mouth */}
      {mood === 'happy' || mood === 'ecstatic' || mood === 'excited' ? (
        <path d="M78 102 Q100 116 122 102" stroke="#2A5A30" strokeWidth="2" fill="none" strokeLinecap="round" />
      ) : mood === 'hungry' ? (
        <ellipse cx="100" cy="106" rx="6" ry="4" fill="#2A5A30" />
      ) : mood === 'sick' ? (
        <path d="M85 108 Q100 100 115 108" stroke="#2A5A30" strokeWidth="2" fill="none" strokeLinecap="round" />
      ) : (
        <path d="M85 105 Q100 112 115 105" stroke="#2A5A30" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      )}

      {/* Blush */}
      {(mood === 'happy' || mood === 'ecstatic') && (
        <>
          <ellipse cx="72" cy="100" rx="7" ry="3.5" fill="#FF9999" opacity="0.25" />
          <ellipse cx="128" cy="100" rx="7" ry="3.5" fill="#FF9999" opacity="0.25" />
        </>
      )}

      {mood === 'hungry' && (
        <ellipse cx="100" cy="114" rx="2" ry="4" fill="#88CCEE" opacity="0.6">
          <animate attributeName="ry" values="3;6;3" dur="1.5s" repeatCount="indefinite" />
        </ellipse>
      )}
    </PetWrapper>
  )
}

/* ─── Hamster SVG ─── */

function HamsterPlaceholder({ mood }: { mood: Mood }) {
  const eyeOpen = mood !== 'sleeping'
  const isSick = mood === 'sick'
  const bodyColor = isSick ? '#D4B888' : '#F0C878'
  const bellyColor = isSick ? '#E8D8B8' : '#FFF4DC'
  const cheekColor = isSick ? '#D8A878' : '#FFAA66'
  const earColor = isSick ? '#B89868' : '#D4A050'

  return (
    <PetWrapper mood={mood}>
      {/* Tiny feet */}
      <ellipse cx="85" cy="163" rx="8" ry="5" fill={bodyColor} />
      <ellipse cx="115" cy="163" rx="8" ry="5" fill={bodyColor} />

      {/* Tiny arms */}
      <ellipse cx="68" cy="140" rx="7" ry="10" fill={bodyColor} transform="rotate(15 68 140)" />
      <ellipse cx="132" cy="140" rx="7" ry="10" fill={bodyColor} transform="rotate(-15 132 140)" />

      {/* Body (round!) */}
      <ellipse cx="100" cy="135" rx="36" ry="34" fill={bodyColor} />
      <ellipse cx="100" cy="145" rx="26" ry="20" fill={bellyColor} />

      {/* Head (also round, hamsters are spheres) */}
      <circle cx="100" cy="92" r="32" fill={bodyColor} />

      {/* Ears */}
      <g style={{ transformOrigin: '75px 68px', animation: mood !== 'sleeping' ? 'ear-flop 2s ease-in-out infinite' : 'none' }}>
        <circle cx="72" cy="65" r="11" fill={earColor} />
        <circle cx="72" cy="65" r="7" fill="#FFB5C0" />
      </g>
      <g style={{ transformOrigin: '125px 68px', animation: mood !== 'sleeping' ? 'ear-flop 2s ease-in-out infinite 0.3s' : 'none' }}>
        <circle cx="128" cy="65" r="11" fill={earColor} />
        <circle cx="128" cy="65" r="7" fill="#FFB5C0" />
      </g>

      {/* CHEEKS (the star feature!) */}
      <ellipse cx="72" cy="102" rx="16" ry="13" fill={cheekColor} opacity="0.6" />
      <ellipse cx="128" cy="102" rx="16" ry="13" fill={cheekColor} opacity="0.6" />

      {/* White face stripe */}
      <ellipse cx="100" cy="90" rx="14" ry="20" fill={bellyColor} opacity="0.5" />

      {/* Eyes */}
      <g style={{ animation: eyeOpen ? 'blink 3.5s ease-in-out infinite' : 'none', transformOrigin: '90px 88px' }}>
        {eyeOpen ? (
          <>
            <circle cx="90" cy="88" r="5" fill="white" />
            <circle cx="90" cy="88" r="3.5" fill="#2A2A2A" />
            <circle cx="91.2" cy="86.8" r="1.3" fill="white" />
          </>
        ) : (
          <path d="M85 89 Q90 92 95 89" stroke="#3D2B1A" strokeWidth="2" fill="none" strokeLinecap="round" />
        )}
      </g>
      <g style={{ animation: eyeOpen ? 'blink 3.5s ease-in-out infinite 0.15s' : 'none', transformOrigin: '110px 88px' }}>
        {eyeOpen ? (
          <>
            <circle cx="110" cy="88" r="5" fill="white" />
            <circle cx="110" cy="88" r="3.5" fill="#2A2A2A" />
            <circle cx="111.2" cy="86.8" r="1.3" fill="white" />
          </>
        ) : (
          <path d="M105 89 Q110 92 115 89" stroke="#3D2B1A" strokeWidth="2" fill="none" strokeLinecap="round" />
        )}
      </g>

      {isSick && (
        <>
          <circle cx="90" cy="88" r="4" fill="none" stroke="#7DB84D" strokeWidth="1" opacity="0.6" />
          <circle cx="110" cy="88" r="4" fill="none" stroke="#7DB84D" strokeWidth="1" opacity="0.6" />
        </>
      )}

      {/* Nose */}
      <ellipse cx="100" cy="96" rx="3.5" ry="2.5" fill="#FFB5B5" />

      {/* Mouth */}
      {mood === 'happy' || mood === 'ecstatic' || mood === 'excited' ? (
        <path d="M96 100 Q100 105 104 100" stroke="#5A3040" strokeWidth="1.2" fill="none" strokeLinecap="round" />
      ) : mood === 'hungry' ? (
        <ellipse cx="100" cy="103" rx="3" ry="2.5" fill="#5A3040" />
      ) : mood === 'sick' ? (
        <path d="M96 104 Q100 101 104 104" stroke="#5A3040" strokeWidth="1.2" fill="none" strokeLinecap="round" />
      ) : null}

      {/* Whiskers */}
      <g opacity="0.3">
        <line x1="82" y1="97" x2="60" y2="94" stroke="#888" strokeWidth="0.8" />
        <line x1="82" y1="100" x2="58" y2="102" stroke="#888" strokeWidth="0.8" />
        <line x1="118" y1="97" x2="140" y2="94" stroke="#888" strokeWidth="0.8" />
        <line x1="118" y1="100" x2="142" y2="102" stroke="#888" strokeWidth="0.8" />
      </g>

      {/* Blush */}
      {(mood === 'happy' || mood === 'ecstatic') && (
        <>
          <ellipse cx="78" cy="100" rx="5" ry="3" fill="#FF9999" opacity="0.4" />
          <ellipse cx="122" cy="100" rx="5" ry="3" fill="#FF9999" opacity="0.4" />
        </>
      )}

      {mood === 'hungry' && (
        <ellipse cx="100" cy="110" rx="1.5" ry="4" fill="#88CCEE" opacity="0.6">
          <animate attributeName="ry" values="3;6;3" dur="1.5s" repeatCount="indefinite" />
        </ellipse>
      )}
    </PetWrapper>
  )
}

/* ─── Lizard SVG ─── */

function LizardPlaceholder({ mood }: { mood: Mood }) {
  const eyeOpen = mood !== 'sleeping'
  const isSick = mood === 'sick'
  const bodyColor = isSick ? '#7A9A70' : '#58B368'
  const bellyColor = isSick ? '#B8CCA0' : '#A8E890'
  const scaleColor = isSick ? '#5A7A50' : '#3D9048'
  const crestColor = isSick ? '#C8A050' : '#FFB830'

  const tailAnim = mood === 'ecstatic'
    ? 'cat-tail-swish 0.3s ease-in-out infinite'
    : mood === 'sleeping' ? 'none' : 'cat-tail-swish 1.5s ease-in-out infinite'

  return (
    <PetWrapper mood={mood}>
      {/* Tail (long curly) */}
      <g style={{ transformOrigin: '145px 140px', animation: tailAnim }}>
        <path d="M140 140 Q160 130 168 115 Q175 100 165 95 Q158 92 155 100" stroke={bodyColor} strokeWidth="8" fill="none" strokeLinecap="round" />
        <path d="M140 140 Q160 130 168 115 Q175 100 165 95 Q158 92 155 100" stroke={scaleColor} strokeWidth="3" fill="none" strokeLinecap="round" strokeDasharray="4 6" opacity="0.4" />
      </g>

      {/* Back legs */}
      <ellipse cx="125" cy="158" rx="12" ry="8" fill={bodyColor} transform="rotate(-10 125 158)" />
      <ellipse cx="130" cy="163" rx="8" ry="4" fill={scaleColor} />

      {/* Front legs */}
      <ellipse cx="72" cy="152" rx="12" ry="8" fill={bodyColor} transform="rotate(10 72 152)" />
      <ellipse cx="66" cy="157" rx="8" ry="4" fill={scaleColor} />

      {/* Toes (splayed lizard toes!) */}
      <circle cx="58" cy="157" r="2" fill={scaleColor} />
      <circle cx="62" cy="160" r="2" fill={scaleColor} />
      <circle cx="66" cy="161" r="2" fill={scaleColor} />
      <circle cx="124" cy="163" r="2" fill={scaleColor} />
      <circle cx="130" cy="166" r="2" fill={scaleColor} />
      <circle cx="136" cy="163" r="2" fill={scaleColor} />

      {/* Body */}
      <ellipse cx="100" cy="135" rx="42" ry="25" fill={bodyColor} />
      <ellipse cx="100" cy="142" rx="30" ry="14" fill={bellyColor} />

      {/* Scale pattern on back */}
      <circle cx="88" cy="128" r="4" fill={scaleColor} opacity="0.3" />
      <circle cx="100" cy="125" r="3.5" fill={scaleColor} opacity="0.3" />
      <circle cx="112" cy="128" r="4" fill={scaleColor} opacity="0.3" />
      <circle cx="94" cy="122" r="3" fill={scaleColor} opacity="0.2" />
      <circle cx="106" cy="122" r="3" fill={scaleColor} opacity="0.2" />

      {/* Head */}
      <ellipse cx="100" cy="92" rx="28" ry="24" fill={bodyColor} />

      {/* Crest / spines */}
      <circle cx="100" cy="68" r="5" fill={crestColor} />
      <circle cx="92" cy="71" r="4" fill={crestColor} opacity="0.8" />
      <circle cx="108" cy="71" r="4" fill={crestColor} opacity="0.8" />

      {/* Eye ridges */}
      <ellipse cx="85" cy="82" rx="12" ry="10" fill={scaleColor} opacity="0.3" />
      <ellipse cx="115" cy="82" rx="12" ry="10" fill={scaleColor} opacity="0.3" />

      {/* Eyes (big lizard eyes with slit pupils) */}
      <g style={{ animation: eyeOpen ? 'blink 6s ease-in-out infinite' : 'none', transformOrigin: '85px 84px' }}>
        {eyeOpen ? (
          <>
            <circle cx="85" cy="84" r="8" fill={crestColor} />
            <circle cx="85" cy="84" r="6" fill="#2A2A2A" />
            <ellipse cx="85" cy="84" rx="2" ry="5.5" fill={crestColor} />
            <circle cx="87" cy="82" r="1.5" fill="white" opacity="0.7" />
          </>
        ) : (
          <path d="M77 85 Q85 88 93 85" stroke="#2A5A30" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        )}
      </g>
      <g style={{ animation: eyeOpen ? 'blink 6s ease-in-out infinite 0.25s' : 'none', transformOrigin: '115px 84px' }}>
        {eyeOpen ? (
          <>
            <circle cx="115" cy="84" r="8" fill={crestColor} />
            <circle cx="115" cy="84" r="6" fill="#2A2A2A" />
            <ellipse cx="115" cy="84" rx="2" ry="5.5" fill={crestColor} />
            <circle cx="117" cy="82" r="1.5" fill="white" opacity="0.7" />
          </>
        ) : (
          <path d="M107 85 Q115 88 123 85" stroke="#2A5A30" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        )}
      </g>

      {isSick && (
        <>
          <circle cx="85" cy="84" r="6" fill="none" stroke="#AAAA44" strokeWidth="1" opacity="0.6" />
          <circle cx="115" cy="84" r="6" fill="none" stroke="#AAAA44" strokeWidth="1" opacity="0.6" />
        </>
      )}

      {/* Mouth */}
      {mood === 'happy' || mood === 'ecstatic' || mood === 'excited' ? (
        <path d="M88 102 Q100 110 112 102" stroke="#2A5A30" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      ) : mood === 'hungry' ? (
        <>
          <ellipse cx="100" cy="105" rx="4" ry="3" fill="#2A5A30" />
          {/* Tongue! */}
          <path d="M100 108 Q102 118 98 120 Q96 120 97 115" stroke="#E85050" strokeWidth="2" fill="#E85050" strokeLinecap="round" />
        </>
      ) : mood === 'sick' ? (
        <path d="M90 106 Q100 102 110 106" stroke="#2A5A30" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      ) : (
        <path d="M90 104 Q100 108 110 104" stroke="#2A5A30" strokeWidth="1.2" fill="none" strokeLinecap="round" />
      )}

      {/* Blush */}
      {(mood === 'happy' || mood === 'ecstatic') && (
        <>
          <ellipse cx="78" cy="98" rx="6" ry="3" fill="#FF9999" opacity="0.2" />
          <ellipse cx="122" cy="98" rx="6" ry="3" fill="#FF9999" opacity="0.2" />
        </>
      )}
    </PetWrapper>
  )
}

/* ─── Placeholder lookup (must be after all definitions) ─── */

const PLACEHOLDERS: Record<Pet['pet_type'], React.FC<{ mood: Mood }>> = {
  dachshund: DachshundPlaceholder,
  calico: CalicoPlaceholder,
  bunny: BunnyPlaceholder,
  frog: FrogPlaceholder,
  hamster: HamsterPlaceholder,
  lizard: LizardPlaceholder,
}
