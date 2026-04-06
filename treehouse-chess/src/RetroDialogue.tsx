import { useEffect, useState } from 'react'

const CHAR_DELAY = 35 // ms per character — classic Pokemon text speed

type Props = {
  lines: string[]
  onDone?: () => void
}

/**
 * Gen 1 Pokemon-style dialogue box with typewriter text effect.
 * White box, thick dark border, pixel-style rendering.
 * Each line types out character by character. Press/click to advance.
 */
export default function RetroDialogue({ lines, onDone }: Props) {
  const [lineIndex, setLineIndex] = useState(0)
  const [charIndex, setCharIndex] = useState(0)
  const [done, setDone] = useState(false)

  const currentLine = lines[lineIndex] ?? ''
  const displayedText = currentLine.slice(0, charIndex)
  const isLineComplete = charIndex >= currentLine.length
  const isLastLine = lineIndex >= lines.length - 1

  // Typewriter effect
  useEffect(() => {
    if (isLineComplete) return
    const timer = setTimeout(() => setCharIndex(c => c + 1), CHAR_DELAY)
    return () => clearTimeout(timer)
  }, [charIndex, isLineComplete])

  const advance = () => {
    if (!isLineComplete) {
      // Skip to end of current line
      setCharIndex(currentLine.length)
    } else if (!isLastLine) {
      // Next line
      setLineIndex(i => i + 1)
      setCharIndex(0)
    } else {
      // All done
      setDone(true)
      onDone?.()
    }
  }

  if (done) return null

  return (
    <div
      onClick={advance}
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 10,
        cursor: 'pointer',
      }}
    >
      <div
        style={{
          margin: '0 8px 8px',
          background: '#ffffee',
          border: '4px solid #333',
          borderRadius: 4,
          boxShadow: '6px 6px 0 rgba(0,0,0,0.3), inset 2px 2px 0 rgba(255,255,255,0.5)',
          padding: '12px 16px',
          minHeight: 60,
          display: 'flex',
          alignItems: 'flex-start',
          position: 'relative',
        }}
      >
        <span
          style={{
            fontFamily: '"Press Start 2P", "Courier New", monospace',
            fontSize: 11,
            lineHeight: 1.8,
            color: '#222',
            letterSpacing: 0.5,
            imageRendering: 'pixelated',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {displayedText}
        </span>
        {/* Blinking triangle indicator */}
        {isLineComplete && (
          <span
            style={{
              position: 'absolute',
              bottom: 8,
              right: 12,
              fontSize: 12,
              color: '#333',
              animation: 'retro-blink 0.6s step-end infinite',
            }}
          >
            ▼
          </span>
        )}
      </div>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');
        @keyframes retro-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
    </div>
  )
}
