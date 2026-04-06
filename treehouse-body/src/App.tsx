import { useState, useCallback, useEffect, useRef } from 'react'
import { BODY_SYSTEMS } from './data/systems'
import { initMessaging, sendStateUpdate } from './lib/messaging'
import { getProgress, getSystems, getPartInfo } from './lib/tools'
import type { BodyPart, BodySystemConfig, PlayerStats } from './types'

// ─── Emoji shorthand ────────────────────────────────────────────────
const E = {
  fire: '\u{1F525}',
  check: '\u2705',
  medal: '\u{1F396}\uFE0F',
  bulb: '\u{1F4A1}',
  flask: '\u{1F9EA}',
  party: '\u{1F389}',
  x: '\u2715',
  tick: '\u2713',
  cross: '\u2717',
  search: '\u{1F50D}',
  star: '\u{1F31F}',
  tophat: '\u{1F3A9}',
  brain: '\u{1F9E0}',
  crown: '\u{1F451}',
  trophy: '\u{1F3C6}',
  microscope: '\u{1F52C}',
}

// ─── Badge definitions ──────────────────────────────────────────────
interface Badge {
  id: string
  name: string
  icon: string
  desc: string
  check: (s: PlayerStats) => boolean
}

const SYSTEM_IDS = Object.keys(BODY_SYSTEMS)

const BADGES: Badge[] = [
  {
    id: 'first_click',
    name: 'Curious Explorer',
    icon: E.search,
    desc: 'Clicked your first body part',
    check: (s) => s.totalClicks >= 1,
  },
  {
    id: 'quiz_starter',
    name: 'Quiz Rookie',
    icon: E.star,
    desc: 'Answered your first quiz',
    check: (s) => s.totalQuizzes >= 1,
  },
  {
    id: 'three_streak',
    name: 'Hat Trick',
    icon: E.tophat,
    desc: 'Got 3 correct in a row',
    check: (s) => s.bestStreak >= 3,
  },
  {
    id: 'five_correct',
    name: 'Brain Power',
    icon: E.brain,
    desc: 'Got 5 questions right',
    check: (s) => s.totalCorrect >= 5,
  },
  {
    id: 'skeleton_explorer',
    name: 'Bone Collector',
    icon: BODY_SYSTEMS.skeletal.icon,
    desc: 'Explored all skeletal parts',
    check: (s) =>
      (s.exploredParts.skeletal?.size ?? 0) >=
      BODY_SYSTEMS.skeletal.parts.length,
  },
  {
    id: 'muscle_explorer',
    name: 'Muscle Master',
    icon: BODY_SYSTEMS.muscular.icon,
    desc: 'Explored all muscular parts',
    check: (s) =>
      (s.exploredParts.muscular?.size ?? 0) >=
      BODY_SYSTEMS.muscular.parts.length,
  },
  {
    id: 'circ_explorer',
    name: 'Blood Runner',
    icon: BODY_SYSTEMS.circulatory.icon,
    desc: 'Explored all circulatory parts',
    check: (s) =>
      (s.exploredParts.circulatory?.size ?? 0) >=
      BODY_SYSTEMS.circulatory.parts.length,
  },
  {
    id: 'respiratory_explorer',
    name: 'Deep Breather',
    icon: BODY_SYSTEMS.respiratory.icon,
    desc: 'Explored all respiratory parts',
    check: (s) =>
      (s.exploredParts.respiratory?.size ?? 0) >=
      BODY_SYSTEMS.respiratory.parts.length,
  },
  {
    id: 'digestive_explorer',
    name: 'Gut Guru',
    icon: BODY_SYSTEMS.digestive.icon,
    desc: 'Explored all digestive parts',
    check: (s) =>
      (s.exploredParts.digestive?.size ?? 0) >=
      BODY_SYSTEMS.digestive.parts.length,
  },
  {
    id: 'nervous_explorer',
    name: 'Nerve Navigator',
    icon: BODY_SYSTEMS.nervous.icon,
    desc: 'Explored all nervous system parts',
    check: (s) =>
      (s.exploredParts.nervous?.size ?? 0) >=
      BODY_SYSTEMS.nervous.parts.length,
  },
  {
    id: 'perfect_system',
    name: 'Perfect Score',
    icon: E.crown,
    desc: 'Aced all quizzes in one system',
    check: (s) => s.perfectSystems.size >= 1,
  },
  {
    id: 'full_explorer',
    name: 'Body Expert',
    icon: E.trophy,
    desc: 'Explored every part of all systems',
    check: (s) =>
      SYSTEM_IDS.every(
        (id) =>
          (s.exploredParts[id]?.size ?? 0) >= BODY_SYSTEMS[id].parts.length,
      ),
  },
]

// ─── Helper: build initial empty stats ──────────────────────────────
function makeInitialStats(): PlayerStats {
  const exploredParts: Record<string, Set<string>> = {}
  const quizResults: Record<string, Record<string, boolean>> = {}
  for (const id of SYSTEM_IDS) {
    exploredParts[id] = new Set()
    quizResults[id] = {}
  }
  return {
    totalClicks: 0,
    totalQuizzes: 0,
    totalCorrect: 0,
    currentStreak: 0,
    bestStreak: 0,
    exploredParts,
    quizResults,
    perfectSystems: new Set(),
    xp: 0,
  }
}

// ─── ProgressRing ───────────────────────────────────────────────────
function ProgressRing({
  progress,
  color,
  size = 54,
}: {
  progress: number
  color: string
  size?: number
}) {
  const r = (size - 8) / 2
  const circ = 2 * Math.PI * r
  const offset = circ - (progress / 100) * circ
  return (
    <svg width={size} height={size}>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="#eee"
        strokeWidth="5"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="5"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset 0.6s ease' }}
      />
      <text
        x={size / 2}
        y={size / 2 + 1}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize="13"
        fontWeight="700"
        fill={color}
        fontFamily="Fredoka, sans-serif"
      >
        {Math.round(progress) + '%'}
      </text>
    </svg>
  )
}

// ─── BadgeCard ──────────────────────────────────────────────────────
function BadgeCard({ badge, earned }: { badge: Badge; earned: boolean }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 14px',
        borderRadius: 12,
        background: earned ? '#FFFDF0' : '#f5f5f5',
        border: earned ? '2px solid #FFD700' : '2px solid #e8e8e8',
        opacity: earned ? 1 : 0.5,
        transition: 'all 0.3s',
      }}
    >
      <span style={{ fontSize: 24, filter: earned ? 'none' : 'grayscale(1)' }}>
        {badge.icon}
      </span>
      <div>
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: earned ? '#2D3142' : '#999',
            fontFamily: "'Fredoka', sans-serif",
          }}
        >
          {badge.name}
        </div>
        <div style={{ fontSize: 11, color: earned ? '#666' : '#bbb' }}>
          {badge.desc}
        </div>
      </div>
    </div>
  )
}

// ─── QuizPanel ──────────────────────────────────────────────────────
function QuizPanel({
  part,
  system,
  onAnswer,
  onClose,
}: {
  part: BodyPart
  system: BodySystemConfig
  onAnswer: (correct: boolean) => void
  onClose: () => void
}) {
  const [selected, setSelected] = useState<string | null>(null)
  const [answered, setAnswered] = useState(false)

  const handleSelect = (opt: string) => {
    if (answered) return
    setSelected(opt)
    setAnswered(true)
    setTimeout(() => onAnswer(opt === part.answer), 1400)
  }

  return (
    <div
      style={{
        background: 'white',
        borderRadius: 16,
        padding: '20px 24px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
        border: '2px solid ' + system.accent,
        animation: 'slideUp 0.3s ease-out',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 12,
        }}
      >
        <span
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: system.darkAccent,
            fontFamily: "'Fredoka', sans-serif",
            letterSpacing: 1,
            textTransform: 'uppercase',
          }}
        >
          Quiz Time!
        </span>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            fontSize: 18,
            cursor: 'pointer',
            color: '#aaa',
          }}
        >
          {E.x}
        </button>
      </div>
      <p
        style={{
          fontSize: 16,
          fontWeight: 600,
          color: '#2D3142',
          marginBottom: 16,
          lineHeight: 1.5,
          fontFamily: "'Fredoka', sans-serif",
        }}
      >
        {part.quiz}
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {part.options.map((opt) => {
          const isCorrect = opt === part.answer
          const isSelected = selected === opt
          let bg = '#f7f7f7'
          let border = '#e0e0e0'
          let color = '#2D3142'
          if (answered && isSelected && isCorrect) {
            bg = '#D4EDDA'
            border = '#28A745'
            color = '#155724'
          }
          if (answered && isSelected && !isCorrect) {
            bg = '#F8D7DA'
            border = '#DC3545'
            color = '#721C24'
          }
          if (answered && !isSelected && isCorrect) {
            bg = '#D4EDDA'
            border = '#28A745'
            color = '#155724'
          }
          return (
            <button
              key={opt}
              onClick={() => handleSelect(opt)}
              style={{
                padding: '12px 14px',
                borderRadius: 10,
                border: '2px solid ' + border,
                background: bg,
                color,
                fontSize: 14,
                fontWeight: 600,
                cursor: answered ? 'default' : 'pointer',
                transition: 'all 0.2s',
                fontFamily: "'Fredoka', sans-serif",
              }}
            >
              {opt}
              {answered && isCorrect ? ' ' + E.tick : ''}
              {answered && isSelected && !isCorrect ? ' ' + E.cross : ''}
            </button>
          )
        })}
      </div>
      {answered && (
        <p
          style={{
            marginTop: 14,
            fontSize: 14,
            color: selected === part.answer ? '#28A745' : '#DC3545',
            fontWeight: 600,
            textAlign: 'center',
            fontFamily: "'Fredoka', sans-serif",
            animation: 'fadeIn 0.3s ease',
          }}
        >
          {selected === part.answer
            ? E.party + ' Correct! Great job!'
            : 'Not quite! The answer is: ' + part.answer}
        </p>
      )}
    </div>
  )
}

// ─── BodyDiagram (SVG) ──────────────────────────────────────────────
function BodyDiagram({
  system,
  onPartClick,
  exploredParts,
  activePartId,
}: {
  system: BodySystemConfig
  onPartClick: (part: BodyPart) => void
  exploredParts: Set<string>
  activePartId: string | null
}) {
  const vw = 700
  const vh = 600
  const imgX = 150
  const imgW = 400

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: 560,
        margin: '0 auto',
      }}
    >
      <svg
        viewBox={`0 0 ${vw} ${vh}`}
        style={{ width: '100%', display: 'block' }}
      >
        {/* White glow filter for ellipses */}
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {system.imageSrc ? (
          <image
            href={system.imageSrc}
            x={imgX}
            y={0}
            width={imgW}
            height={vh}
            preserveAspectRatio="xMidYMid meet"
          />
        ) : (
          <g>
            <rect
              x={imgX}
              y={0}
              width={imgW}
              height={vh}
              rx={12}
              fill={system.color}
            />
            <text
              x={imgX + imgW / 2}
              y={vh / 2}
              textAnchor="middle"
              fontSize="48"
              fill={system.darkAccent}
              opacity="0.3"
            >
              {system.icon}
            </text>
            <text
              x={imgX + imgW / 2}
              y={vh / 2 + 40}
              textAnchor="middle"
              fontSize="14"
              fill={system.darkAccent}
              fontFamily="Fredoka, sans-serif"
              fontWeight="600"
            >
              Image coming soon!
            </text>
          </g>
        )}

        {system.parts.map((part) => {
          const explored = exploredParts.has(part.id)
          const active = activePartId === part.id

          // Ellipse center and radii
          const cx = imgX + ((part.xPct + part.wPct / 2) / 100) * imgW
          const cy = ((part.yPct + part.hPct / 2) / 100) * vh
          const rx = (part.wPct / 100) * imgW / 2 + 4
          const ry = (part.hPct / 100) * vh / 2 + 4

          // Label positioning
          const labelY = (part.labelY / 100) * vh + 10
          const pillW = part.name.length * 10 + 24
          let pillX: number
          let textX: number

          if (part.side === 'left') {
            pillX = 8
            textX = pillX + pillW / 2
          } else {
            pillX = vw - pillW - 8
            textX = pillX + pillW / 2
          }

          // Leader line from pill edge to ellipse edge
          const lineStartX = part.side === 'left' ? pillX + pillW : pillX
          const lineStartY = labelY

          const dx = lineStartX - cx
          const dy = lineStartY - cy
          const angle = Math.atan2(dy, dx)
          const edgeX = cx + rx * Math.cos(angle)
          const edgeY = cy + ry * Math.sin(angle)

          // Per-system dynamic colors
          const lineColor = active
            ? system.darkAccent
            : explored
              ? system.accent
              : '#8B7070'
          const textColor = active
            ? system.darkAccent
            : explored
              ? system.darkAccent
              : '#5C4444'
          const circleColor = active
            ? system.darkAccent
            : system.circleAccent
          const fillColor = active
            ? system.accent + '55'
            : explored
              ? system.accent + '20'
              : 'transparent'

          return (
            <g
              key={part.id}
              onClick={() => onPartClick(part)}
              style={{ cursor: 'pointer' }}
            >
              {/* Leader line */}
              <line
                x1={lineStartX}
                y1={lineStartY}
                x2={edgeX}
                y2={edgeY}
                stroke={lineColor}
                strokeWidth={active ? 2 : 1.2}
                strokeDasharray={explored || active ? 'none' : '4 3'}
              />
              {/* White glow behind ellipse */}
              <ellipse
                cx={cx}
                cy={cy}
                rx={rx + 1}
                ry={ry + 1}
                fill="none"
                stroke="white"
                strokeWidth={4}
                strokeDasharray={
                  active ? 'none' : explored ? '5 3' : '4 3'
                }
                opacity={0.7}
              />
              {/* Ellipse around the body part */}
              <ellipse
                cx={cx}
                cy={cy}
                rx={rx}
                ry={ry}
                fill={fillColor}
                stroke={circleColor}
                strokeWidth={active ? 3 : 2.2}
                strokeDasharray={
                  active ? 'none' : explored ? '5 3' : '4 3'
                }
              />
              {/* Label pill background */}
              <rect
                x={pillX}
                y={labelY - 14}
                width={pillW}
                height={28}
                rx={8}
                fill={
                  active
                    ? system.color
                    : explored
                      ? system.color
                      : '#F5F5F5'
                }
                stroke={
                  active
                    ? system.darkAccent
                    : explored
                      ? system.accent
                      : '#8B7070'
                }
                strokeWidth={active ? 1.5 : 1}
              />
              {/* Label text */}
              <text
                x={textX}
                y={labelY + 5}
                textAnchor="middle"
                fontSize="14"
                fontWeight="700"
                fontFamily="Fredoka, sans-serif"
                fill={textColor}
              >
                {part.name}
                {explored ? ' \u2713' : ''}
              </text>
              {/* Invisible hotspot for easier clicking */}
              <rect
                x={imgX + (part.xPct / 100) * imgW - 4}
                y={(part.yPct / 100) * vh - 4}
                width={(part.wPct / 100) * imgW + 8}
                height={(part.hPct / 100) * vh + 8}
                fill="transparent"
                style={{ cursor: 'pointer' }}
              />
            </g>
          )
        })}
      </svg>
    </div>
  )
}

// ─── Main App ───────────────────────────────────────────────────────
export default function App() {
  const [activeSystem, setActiveSystem] = useState('muscular')
  const [activePart, setActivePart] = useState<BodyPart | null>(null)
  const [showQuiz, setShowQuiz] = useState(false)
  const [view, setView] = useState<'explore' | 'badges'>('explore')
  const [stats, setStats] = useState<PlayerStats>(makeInitialStats)
  const [newBadge, setNewBadge] = useState<Badge | null>(null)
  const [showFunFact, setShowFunFact] = useState(false)

  const statsRef = useRef(stats)
  statsRef.current = stats
  const activeSystemRef = useRef(activeSystem)
  activeSystemRef.current = activeSystem

  const earnedBadges = BADGES.filter((b) => b.check(stats))

  const checkNewBadges = useCallback(
    (newStats: PlayerStats) => {
      const oldEarned = BADGES.filter((b) => b.check(stats)).map((b) => b.id)
      const nowEarned = BADGES.filter((b) => b.check(newStats)).map(
        (b) => b.id,
      )
      const fresh = nowEarned.find((id) => !oldEarned.includes(id))
      if (fresh) {
        setNewBadge(BADGES.find((b) => b.id === fresh) ?? null)
        setTimeout(() => setNewBadge(null), 3000)
      }
    },
    [stats],
  )

  // Apply a quiz result and return updated stats.
  // Also marks the part as explored in the same atomic update,
  // so both the UI path and the tool-call path persist consistently.
  const applyQuizResult = useCallback(
    (systemId: string, partId: string, correct: boolean): PlayerStats => {
      const prev = statsRef.current

      // Merge explored-parts update into the same stats object
      const newExplored = new Set(prev.exploredParts[systemId])
      newExplored.add(partId)

      const newQuizResults = { ...prev.quizResults }
      newQuizResults[systemId] = { ...prev.quizResults[systemId], [partId]: correct }

      const newStats: PlayerStats = {
        ...prev,
        totalQuizzes: prev.totalQuizzes + 1,
        totalCorrect: correct ? prev.totalCorrect + 1 : prev.totalCorrect,
        currentStreak: correct ? prev.currentStreak + 1 : 0,
        bestStreak: correct
          ? Math.max(prev.bestStreak, prev.currentStreak + 1)
          : prev.bestStreak,
        xp: prev.xp + (correct ? 20 : 5),
        quizResults: newQuizResults,
        exploredParts: { ...prev.exploredParts, [systemId]: newExplored },
        perfectSystems: new Set(prev.perfectSystems),
      }

      const sysData = BODY_SYSTEMS[systemId]
      const sysResults = newStats.quizResults[systemId]
      const quizzable = sysData.parts.filter((p) => p.quiz)
      if (quizzable.every((p) => sysResults[p.id] === true)) {
        ;(newStats.perfectSystems as Set<string>).add(systemId)
      }

      checkNewBadges(newStats)
      setStats(newStats)
      sendStateUpdate(newStats)
      return newStats
    },
    [checkNewBadges],
  )

  // Tool handler with access to state setters
  const handleToolCall = useCallback(
    (toolName: string, params: Record<string, unknown>): unknown => {
      switch (toolName) {
        case 'get_progress':
          return getProgress(statsRef.current)

        case 'get_systems':
          return getSystems()

        case 'get_part_info': {
          const sysId = (params.system_id as string) || activeSystemRef.current
          const partId = params.part_id as string
          if (!partId) return { error: 'part_id is required' }
          return getPartInfo(sysId, partId)
        }

        case 'record_quiz_answer': {
          const sysId = (params.system_id as string) || activeSystemRef.current
          const partId = params.part_id as string
          const correct = params.correct as boolean
          if (!partId) return { error: 'part_id is required' }
          if (typeof correct !== 'boolean') return { error: 'correct (boolean) is required' }

          // Validate systemId and partId before proceeding
          const sys = BODY_SYSTEMS[sysId]
          if (!sys) return { error: `Unknown system_id: ${sysId}. Valid: ${SYSTEM_IDS.join(', ')}` }
          const part = sys.parts.find((p) => p.id === partId)
          if (!part) return { error: `Unknown part_id: ${partId} in system ${sysId}` }

          // applyQuizResult handles explored-parts + quiz + XP + persistence atomically
          const updated = applyQuizResult(sysId, partId, correct)
          return {
            recorded: true,
            correct,
            xp: updated.xp,
            currentStreak: updated.currentStreak,
            bestStreak: updated.bestStreak,
            partName: part.name,
            systemName: sys.name,
          }
        }

        case 'start_quiz':
          return {
            message:
              'Click on any body part in the diagram, then I\'ll quiz you about it!',
          }

        default:
          return { error: `Unknown tool: ${toolName}` }
      }
    },
    [applyQuizResult],
  )

  // Init messaging on mount; pass restore handler for cross-session persistence
  useEffect(() => {
    const cleanup = initMessaging(handleToolCall, (restored) => {
      setStats(restored)
    })
    return cleanup
  }, [handleToolCall])

  // Debounce chat messages so rapid clicks don't spam the AI mid-generation
  const chatTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const pendingMsgRef = useRef<{ stats: PlayerStats; msg: string } | null>(null)

  const flushChatMessage = useCallback(() => {
    const pending = pendingMsgRef.current
    if (pending) {
      pendingMsgRef.current = null
      sendStateUpdate(pending.stats, pending.msg)
    }
  }, [])

  const handlePartClick = (part: BodyPart) => {
    setActivePart(part)
    setShowQuiz(false)
    const newExplored = new Set(stats.exploredParts[activeSystem])
    const isFirstVisit = !newExplored.has(part.id)
    newExplored.add(part.id)
    const newExploredParts = { ...stats.exploredParts }
    newExploredParts[activeSystem] = newExplored
    const newStats: PlayerStats = {
      ...stats,
      totalClicks: stats.totalClicks + 1,
      exploredParts: newExploredParts,
      xp: stats.xp + 5,
    }
    checkNewBadges(newStats)
    setStats(newStats)

    // Always persist state immediately (no chat message)
    sendStateUpdate(newStats)

    // Debounce the chat message: cancel any pending one and queue this one.
    // Only the last click within 600ms actually sends to chat.
    const sysName = BODY_SYSTEMS[activeSystem].name
    const msg = isFirstVisit
      ? `I just clicked on the ${part.name} in the ${sysName}! Tell me about it and quiz me.`
      : `I'm looking at the ${part.name} in the ${sysName} again. Quiz me on it!`
    pendingMsgRef.current = { stats: newStats, msg }
    clearTimeout(chatTimerRef.current)
    chatTimerRef.current = setTimeout(flushChatMessage, 600)
  }

  const handleQuizAnswer = (correct: boolean) => {
    if (!activePart) return
    applyQuizResult(activeSystem, activePart.id, correct)
    setTimeout(() => {
      setShowQuiz(false)
      setActivePart(null)
    }, 1800)
  }

  const sysData = BODY_SYSTEMS[activeSystem]
  const exploredCount = stats.exploredParts[activeSystem]?.size ?? 0
  const totalParts = sysData.parts.length
  const sysProgress = (exploredCount / totalParts) * 100
  const quizzedCorrect = Object.values(
    stats.quizResults[activeSystem] ?? {},
  ).filter(Boolean).length

  // Standalone detection: redirect to main app if not in an iframe
  if (window.parent === window) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        background: '#0f172a',
        color: '#e2e8f0',
        textAlign: 'center',
        padding: 24,
      }}>
        <div>
          <h2 style={{ fontSize: 20, marginBottom: 12, color: '#f8fafc' }}>This app runs inside The Treehouse</h2>
          <p style={{ fontSize: 14, opacity: 0.7, marginBottom: 16 }}>
            It's designed to be embedded in the chat experience, not visited directly.
          </p>
          <a
            href="https://thetreehouse.vercel.app"
            style={{
              display: 'inline-block',
              padding: '10px 24px',
              background: '#3b82f6',
              color: '#fff',
              borderRadius: 8,
              textDecoration: 'none',
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            Go to The Treehouse
          </a>
        </div>
      </div>
    )
  }

  return (
    <div
      style={{
        fontFamily: "'Fredoka', sans-serif",
        minHeight: '100vh',
        background:
          'linear-gradient(160deg, #FFF8F0 0%, #FFF0F0 50%, #F0F4FF 100%)',
        padding: '0 0 40px 0',
      }}
    >
      {/* ─── Header ─────────────────────────────────────────── */}
      <div
        style={{
          background: 'linear-gradient(135deg, #FF7B7B 0%, #FFB347 100%)',
          padding: '28px 24px 20px',
          borderRadius: '0 0 28px 28px',
          boxShadow: '0 4px 20px rgba(255,123,123,0.2)',
          marginBottom: 20,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <h1
              style={{
                fontSize: 26,
                fontWeight: 700,
                color: 'white',
                letterSpacing: -0.5,
              }}
            >
              {'Anatomy Adventure ' + E.microscope}
            </h1>
            <p
              style={{
                fontSize: 13,
                color: 'rgba(255,255,255,0.85)',
                marginTop: 4,
              }}
            >
              Tap body parts to learn about them!
            </p>
          </div>
          <div
            style={{
              textAlign: 'center',
              background: 'rgba(255,255,255,0.2)',
              borderRadius: 14,
              padding: '8px 16px',
            }}
          >
            <div style={{ fontSize: 22, fontWeight: 700, color: 'white' }}>
              {stats.xp}
            </div>
            <div
              style={{
                fontSize: 10,
                color: 'rgba(255,255,255,0.8)',
                fontWeight: 600,
              }}
            >
              XP
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 14, flexWrap: 'wrap' }}>
          <div
            style={{
              background: 'rgba(255,255,255,0.2)',
              borderRadius: 10,
              padding: '6px 12px',
              fontSize: 12,
              color: 'white',
              fontWeight: 600,
            }}
          >
            {E.fire + ' Streak: ' + stats.currentStreak}
          </div>
          <div
            style={{
              background: 'rgba(255,255,255,0.2)',
              borderRadius: 10,
              padding: '6px 12px',
              fontSize: 12,
              color: 'white',
              fontWeight: 600,
            }}
          >
            {E.check +
              ' ' +
              stats.totalCorrect +
              '/' +
              stats.totalQuizzes +
              ' correct'}
          </div>
          <div
            style={{
              background: 'rgba(255,255,255,0.2)',
              borderRadius: 10,
              padding: '6px 12px',
              fontSize: 12,
              color: 'white',
              fontWeight: 600,
            }}
          >
            {E.medal + ' ' + earnedBadges.length + '/' + BADGES.length}
          </div>
        </div>
      </div>

      {/* ─── Content ────────────────────────────────────────── */}
      <div style={{ maxWidth: 580, margin: '0 auto', padding: '0 16px' }}>
        {/* View tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <button
            onClick={() => setView('explore')}
            style={{
              flex: 1,
              padding: '10px 0',
              borderRadius: 12,
              border: 'none',
              background: view === 'explore' ? '#2D3142' : '#f0f0f0',
              color: view === 'explore' ? 'white' : '#999',
              fontWeight: 700,
              fontSize: 14,
              cursor: 'pointer',
              fontFamily: "'Fredoka', sans-serif",
            }}
          >
            {E.microscope + ' Explore'}
          </button>
          <button
            onClick={() => setView('badges')}
            style={{
              flex: 1,
              padding: '10px 0',
              borderRadius: 12,
              border: 'none',
              background: view === 'badges' ? '#2D3142' : '#f0f0f0',
              color: view === 'badges' ? 'white' : '#999',
              fontWeight: 700,
              fontSize: 14,
              cursor: 'pointer',
              fontFamily: "'Fredoka', sans-serif",
            }}
          >
            {E.medal + ' Badges'}
          </button>
        </div>

        {view === 'badges' ? (
          <div style={{ animation: 'slideUp 0.3s ease' }}>
            <h2
              style={{
                fontSize: 20,
                fontWeight: 700,
                color: '#2D3142',
                marginBottom: 14,
              }}
            >
              Your Badges
            </h2>
            <div style={{ display: 'grid', gap: 10 }}>
              {BADGES.map((b) => (
                <BadgeCard
                  key={b.id}
                  badge={b}
                  earned={earnedBadges.some((eb) => eb.id === b.id)}
                />
              ))}
            </div>
          </div>
        ) : (
          <div>
            {/* System selector */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 10,
                marginBottom: 18,
              }}
            >
              {Object.entries(BODY_SYSTEMS).map(([key, sys]) => (
                <button
                  key={key}
                  onClick={() => {
                    setActiveSystem(key)
                    setActivePart(null)
                    setShowQuiz(false)
                    setShowFunFact(false)
                  }}
                  style={{
                    padding: '14px 10px',
                    borderRadius: 14,
                    border:
                      activeSystem === key
                        ? '2px solid ' + sys.darkAccent
                        : '2px solid #e8e8e8',
                    background: activeSystem === key ? sys.color : 'white',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    boxShadow:
                      activeSystem === key
                        ? '0 4px 12px ' + sys.accent + '44'
                        : 'none',
                  }}
                >
                  <div style={{ fontSize: 24 }}>{sys.icon}</div>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color:
                        activeSystem === key ? sys.darkAccent : '#999',
                      marginTop: 4,
                      fontFamily: "'Fredoka', sans-serif",
                    }}
                  >
                    {sys.name.replace(' System', '')}
                  </div>
                </button>
              ))}
            </div>

            {/* Progress bar */}
            <div
              style={{
                display: 'flex',
                gap: 16,
                alignItems: 'center',
                marginBottom: 16,
                background: 'white',
                borderRadius: 16,
                padding: '16px 18px',
                boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
              }}
            >
              <ProgressRing
                progress={sysProgress}
                color={sysData.darkAccent}
              />
              <div style={{ flex: 1 }}>
                <div
                  style={{ fontSize: 14, fontWeight: 700, color: '#2D3142' }}
                >
                  {sysData.name}
                </div>
                <div style={{ fontSize: 12, color: '#777', marginTop: 2 }}>
                  {exploredCount + '/' + totalParts + ' parts explored'}
                </div>
                <div style={{ fontSize: 12, color: '#777' }}>
                  {quizzedCorrect + '/' + totalParts + ' quizzes passed'}
                </div>
              </div>
              <button
                onClick={() => setShowFunFact(!showFunFact)}
                style={{
                  background: sysData.color,
                  border: '1px solid ' + sysData.accent,
                  borderRadius: 10,
                  padding: '6px 10px',
                  fontSize: 11,
                  fontWeight: 600,
                  color: sysData.darkAccent,
                  cursor: 'pointer',
                  fontFamily: "'Fredoka', sans-serif",
                }}
              >
                {E.bulb + ' Fun Fact'}
              </button>
            </div>

            {/* Fun fact */}
            {showFunFact && (
              <div
                style={{
                  background: '#FFFDE7',
                  borderRadius: 14,
                  padding: '14px 18px',
                  marginBottom: 16,
                  border: '1px solid #FFE082',
                  animation: 'slideUp 0.3s ease',
                  fontSize: 13,
                  color: '#5D4037',
                  lineHeight: 1.6,
                }}
              >
                {E.bulb + ' '}
                <strong>Fun Fact:</strong>
                {' ' + sysData.funFact}
              </div>
            )}

            {/* Description */}
            <p
              style={{
                fontSize: 13,
                color: '#666',
                lineHeight: 1.6,
                marginBottom: 16,
                textAlign: 'center',
              }}
            >
              {sysData.description}
            </p>

            {/* SVG Diagram */}
            <div
              style={{
                background: '#F0ECEA',
                borderRadius: 20,
                padding: '20px 16px',
                boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
                marginBottom: 18,
                border: '1px solid ' + sysData.accent + '33',
              }}
            >
              <BodyDiagram
                system={sysData}
                onPartClick={handlePartClick}
                exploredParts={stats.exploredParts[activeSystem] ?? new Set()}
                activePartId={activePart?.id ?? null}
              />
            </div>

            {/* Info panel */}
            {activePart && !showQuiz && (
              <div style={{ animation: 'slideUp 0.3s ease', marginBottom: 16 }}>
                <div
                  style={{
                    background: 'white',
                    borderRadius: 16,
                    padding: '20px 24px',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
                    border: '2px solid ' + sysData.accent,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                    }}
                  >
                    <div>
                      <h3
                        style={{
                          fontSize: 20,
                          fontWeight: 700,
                          color: sysData.darkAccent,
                        }}
                      >
                        {activePart.name}
                      </h3>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: '#999',
                          textTransform: 'uppercase',
                          letterSpacing: 1,
                        }}
                      >
                        {sysData.name}
                      </span>
                    </div>
                    <button
                      onClick={() => setActivePart(null)}
                      style={{
                        background: 'none',
                        border: 'none',
                        fontSize: 18,
                        cursor: 'pointer',
                        color: '#aaa',
                      }}
                    >
                      {E.x}
                    </button>
                  </div>
                  <p
                    style={{
                      fontSize: 14,
                      color: '#444',
                      lineHeight: 1.7,
                      margin: '14px 0 18px',
                    }}
                  >
                    {activePart.info}
                  </p>
                  {activePart.quiz && (
                    <button
                      onClick={() => setShowQuiz(true)}
                      style={{
                        width: '100%',
                        padding: '12px 0',
                        borderRadius: 12,
                        border: 'none',
                        background: `linear-gradient(135deg, ${sysData.accent}, ${sysData.darkAccent})`,
                        color: 'white',
                        fontWeight: 700,
                        fontSize: 15,
                        cursor: 'pointer',
                        fontFamily: "'Fredoka', sans-serif",
                        boxShadow: '0 4px 12px ' + sysData.accent + '66',
                      }}
                    >
                      {E.flask + ' Take the Quiz!'}
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Quiz panel */}
            {activePart && showQuiz && (
              <div style={{ marginBottom: 16 }}>
                <QuizPanel
                  key={activePart.id}
                  part={activePart}
                  system={sysData}
                  onAnswer={handleQuizAnswer}
                  onClose={() => {
                    setShowQuiz(false)
                    setActivePart(null)
                  }}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─── Badge toast ────────────────────────────────────── */}
      {newBadge && (
        <div
          style={{
            position: 'fixed',
            bottom: 30,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'linear-gradient(135deg, #FFD700, #FFA500)',
            color: 'white',
            padding: '14px 28px',
            borderRadius: 16,
            boxShadow: '0 8px 32px rgba(255,165,0,0.4)',
            animation: 'popIn 0.4s ease, badgePulse 1.5s ease infinite',
            fontSize: 15,
            fontWeight: 700,
            fontFamily: "'Fredoka', sans-serif",
            zIndex: 1000,
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 28 }}>{newBadge.icon}</div>
          <div>{'Badge Earned: ' + newBadge.name + '!'}</div>
        </div>
      )}
    </div>
  )
}
