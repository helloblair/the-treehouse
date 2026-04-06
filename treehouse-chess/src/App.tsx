import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Chess } from 'chess.js'
import { Chessboard } from 'react-chessboard'
import { buildPokemonPieces, type PromotionOverride } from './pokemonPieces'
import {
  pokeballSquareStyles,
  pokeballBoardStyle,
  pokeballSquareStyle,
  pokeballDarkSquareStyle,
  pokeballLightSquareStyle,
} from './pokemonBoard'
import { describeMove } from './describeMove'
import { PROMOTION_POKEMON } from './pokemonLore'
import RetroDialogue from './RetroDialogue'

const PLUGIN_ID = 'treehouse-chess'
const PLATFORM_ORIGIN = (import.meta.env.VITE_PLATFORM_ORIGIN || 'http://localhost:1212').trim()

type ToolCallPayload = {
  type: 'TREEHOUSE_TOOL_CALL'
  pluginId: string
  payload: {
    callId: string
    toolName: string
    params: Record<string, unknown>
  }
}

function sendResult(callId: string, result: unknown, isError = false) {
  window.parent.postMessage(
    {
      type: 'TREEHOUSE_TOOL_RESULT',
      pluginId: PLUGIN_ID,
      payload: { callId, result, isError },
    },
    PLATFORM_ORIGIN,
  )
}

function sendError(message: string, fatal: boolean) {
  window.parent.postMessage(
    {
      type: 'TREEHOUSE_ERROR',
      pluginId: PLUGIN_ID,
      payload: { message, fatal },
    },
    PLATFORM_ORIGIN,
  )
}

/** Extract a human-readable piece name from SAN or UCI-style move string */
function describePiece(moveStr: string): string {
  const san = moveStr.trim()
  const firstChar = san.charAt(0)
  const pieceMap: Record<string, string> = { K: 'King', Q: 'Queen', R: 'Rook', B: 'Bishop', N: 'Knight' }
  if (pieceMap[firstChar]) return pieceMap[firstChar]
  // Lowercase letter = pawn move (e.g. "e4", "exd5") or UCI (e.g. "e2e4")
  return 'Pawn'
}

/** Extract destination square from a move string */
function describeSquares(moveStr: string): { from: string | null; to: string | null } {
  const san = moveStr.trim()
  // UCI format: "e2e4" — 4 or 5 chars, all lowercase/digits
  const uciMatch = san.match(/^([a-h][1-8])([a-h][1-8])/)
  if (uciMatch) return { from: uciMatch[1], to: uciMatch[2] }
  // SAN format: extract last two chars as destination
  const sanMatch = san.match(/([a-h][1-8])[+#=]?[QRBN]?$/)
  return { from: null, to: sanMatch ? sanMatch[1] : null }
}

function serializePromotions(map: Map<string, PromotionOverride>): Record<string, PromotionOverride> {
  const obj: Record<string, PromotionOverride> = {}
  for (const [k, v] of map) obj[k] = v
  return obj
}

function deserializePromotions(obj: Record<string, PromotionOverride> | undefined): Map<string, PromotionOverride> {
  if (!obj) return new Map()
  return new Map(Object.entries(obj))
}

function sendStateUpdate(chess: Chess, promotions?: Map<string, PromotionOverride>) {
  window.parent.postMessage(
    {
      type: 'TREEHOUSE_STATE_UPDATE',
      pluginId: PLUGIN_ID,
      payload: {
        state: {
          pgn: chess.pgn(),
          fen: chess.fen(),
          turn: chess.turn(),
          history: chess.history(),
          gameOver: chess.isGameOver(),
          promotedSquares: promotions ? serializePromotions(promotions) : undefined,
        },
      },
    },
    PLATFORM_ORIGIN,
  )
}

function sendCompletion(winner: string, moveCount: number, chess: Chess) {
  window.parent.postMessage(
    {
      type: 'TREEHOUSE_COMPLETION',
      pluginId: PLUGIN_ID,
      payload: {
        result: {
          summary: `${winner} won in ${moveCount} moves.`,
          data: {
            winner,
            moves: chess.history(),
            pgn: chess.pgn(),
            finalFEN: chess.fen(),
          },
        },
      },
    },
    PLATFORM_ORIGIN,
  )
}

function getGameOverLines(result: string | null): string[] {
  if (!result) return ['The battle is over!']

  if (result.includes('Arceus')) {
    // Player lost (Arceus fell)
    return [
      'TRAINER was defeated!',
      'ARCEUS fainted...',
      'TRAINER whited out!',
      '...Better luck next time, Commander.',
    ]
  }
  if (result.includes('Giratina')) {
    // Player won (Giratina fell)
    return [
      'Enemy GIRATINA fainted!',
      'TRAINER defeated the SHADOW REIGN!',
      'Got ¥4800 for winning!',
      '...Just kidding. But you earned GLORY!',
    ]
  }
  if (result.includes('Stalemate')) {
    return [
      'Neither side can move...',
      'The battle ended in a STALEMATE!',
      'ARCEUS and GIRATINA stare\neach other down eternally.',
    ]
  }
  if (result.includes('repetition')) {
    return [
      'The same position appeared\nthree times...',
      'DRAW by repetition!',
      'Both sides are stuck in\na time loop!',
    ]
  }
  if (result.includes('insufficient')) {
    return [
      'Not enough Pokemon remain\nto finish the fight...',
      'DRAW by insufficient material!',
    ]
  }
  return [
    'The battle is over!',
    result,
  ]
}

function App() {
  const gameRef = useRef(new Chess())
  const [fen, setFen] = useState(gameRef.current.fen())
  const [gameOver, setGameOver] = useState(false)
  const [gameResult, setGameResult] = useState<string | null>(null)
  const [pendingMove, setPendingMove] = useState<{ san: string; narrative: string } | null>(null)
  const pendingMoveRef = useRef(pendingMove)
  pendingMoveRef.current = pendingMove

  // Promotion tracking: maps square → sprite override for promoted pieces
  const [promotedSquares, setPromotedSquares] = useState<Map<string, PromotionOverride>>(new Map())
  const promotedSquaresRef = useRef(promotedSquares)
  promotedSquaresRef.current = promotedSquares

  // Custom promotion dialog state
  const [promoDialog, setPromoDialog] = useState<{ from: string; to: string; color: 'w' | 'b' } | null>(null)

  // Retro dialogue dismissed — shows New Game button after text plays
  const [dialogueDismissed, setDialogueDismissed] = useState(false)

  // Rebuild pieces whenever promotions change
  const pieces = useMemo(() => buildPokemonPieces(promotedSquares), [promotedSquares])

  // Track promoted piece movements: when a promoted piece moves, update its square key
  const updatePromotionTracking = useCallback((from: string, to: string, captured?: string) => {
    setPromotedSquares(prev => {
      const next = new Map(prev)
      // If a promoted piece was captured on the target square, remove it
      if (captured && next.has(to)) {
        next.delete(to)
      }
      // If the moving piece was a promoted piece, move its tracking
      if (next.has(from)) {
        next.set(to, next.get(from)!)
        next.delete(from)
      }
      return next
    })
  }, [])

  const checkGameEnd = useCallback((chess: Chess) => {
    if (chess.isCheckmate()) {
      const winner = chess.turn() === 'w' ? 'Black' : 'White'
      const loser = winner === 'White' ? 'Giratina' : 'Arceus'
      const moveCount = chess.history().length
      setGameResult(`Checkmate! ${loser} has fallen!`)
      sendCompletion(winner, moveCount, chess)
      setGameOver(true)
      return true
    }
    if (chess.isStalemate() || chess.isDraw()) {
      const moveCount = chess.history().length
      let reason = 'Draw'
      if (chess.isStalemate()) reason = 'Stalemate'
      else if (chess.isThreefoldRepetition()) reason = 'Draw by repetition'
      else if (chess.isInsufficientMaterial()) reason = 'Draw — insufficient material'
      setGameResult(reason)
      window.parent.postMessage(
        {
          type: 'TREEHOUSE_COMPLETION',
          pluginId: PLUGIN_ID,
          payload: {
            result: {
              summary: `${reason} after ${moveCount} moves.`,
              data: {
                winner: 'draw',
                reason,
                moves: chess.history(),
                pgn: chess.pgn(),
                finalFEN: chess.fen(),
              },
            },
          },
        },
        PLATFORM_ORIGIN,
      )
      setGameOver(true)
      return true
    }
    return false
  }, [])

  const handleToolCall = useCallback(
    (msg: ToolCallPayload) => {
      const { callId, toolName, params } = msg.payload
      const chess = gameRef.current

      switch (toolName) {
        case 'start_game': {
          chess.reset()
          setFen(chess.fen())
          setGameOver(false)
          setGameResult(null)
          setDialogueDismissed(false)
          setPendingMove(null)
          setPromotedSquares(new Map())
          sendResult(callId, { success: true, fen: chess.fen() })
          sendStateUpdate(chess, new Map())
          break
        }
        case 'make_move': {
          if (gameOver) {
            sendResult(callId, { success: false, error: 'Game is already over' })
            break
          }
          if (pendingMoveRef.current) {
            sendResult(callId, { success: false, error: 'The human has a move pending confirmation. Wait for them to confirm or undo.' })
            break
          }
          if (chess.turn() === 'w') {
            sendResult(callId, { success: false, error: "It is White's turn. Wait for the human to move on the board." })
            break
          }
          try {
            const moveStr = params.move as string
            const move = chess.move(moveStr)
            if (!move) {
              const piece = describePiece(moveStr)
              const { from, to } = describeSquares(moveStr)
              const detail = from && to
                ? `${piece} cannot move from ${from} to ${to}.`
                : to
                  ? `${piece} cannot move to ${to}.`
                  : ''
              sendResult(callId, { success: false, error: `That move is not legal. ${detail}`.trim() })
            } else {
              // Track promotion sprite for AI moves
              if (move.promotion) {
                const promoInfo = PROMOTION_POKEMON[move.color]?.[move.promotion]
                if (promoInfo) {
                  setPromotedSquares(prev => {
                    const next = new Map(prev)
                    next.set(move.to, { slug: promoInfo.slug, scale: promoInfo.scale })
                    return next
                  })
                }
              } else {
                updatePromotionTracking(move.from, move.to, move.captured)
              }
              setFen(chess.fen())
              const gameEnded = checkGameEnd(chess)
              sendResult(callId, {
                success: true,
                fen: chess.fen(),
                movePlayed: move.san,
                narrative: describeMove(move),
                turn: 'White',
                moveHistory: chess.history(),
                inCheck: chess.inCheck(),
                gameOver: gameEnded,
              })
              sendStateUpdate(chess, promotedSquaresRef.current)
            }
          } catch {
            const moveStr = params.move as string
            const piece = describePiece(moveStr)
            const { from, to } = describeSquares(moveStr)
            const detail = from && to
              ? `${piece} cannot move from ${from} to ${to}.`
              : to
                ? `${piece} cannot move to ${to}.`
                : ''
            sendResult(callId, { success: false, error: `That move is not legal. ${detail}`.trim() })
          }
          break
        }
        case 'get_board_state': {
          sendResult(callId, {
            fen: chess.fen(),
            turn: chess.turn() === 'w' ? 'White' : 'Black',
            moveHistory: chess.history(),
            moveCount: chess.history().length,
            inCheck: chess.inCheck(),
          })
          break
        }
        case 'resign': {
          const winner = 'ai'
          const moveCount = chess.history().length
          sendCompletion(winner, moveCount, chess)
          setGameOver(true)
          sendResult(callId, { success: true, resigned: true })
          break
        }
        default:
          sendResult(callId, { error: `Unknown tool: ${toolName}` }, true)
      }
    },
    [gameOver, checkGameEnd],
  )

  // Check if a move is a pawn promotion
  const isPromotionMove = useCallback((from: string, to: string): boolean => {
    const chess = gameRef.current
    const piece = chess.get(from as Parameters<typeof chess.get>[0])
    if (!piece || piece.type !== 'p') return false
    const targetRank = to[1]
    return (piece.color === 'w' && targetRank === '8') || (piece.color === 'b' && targetRank === '1')
  }, [])

  // Execute a move (called directly or after promotion choice)
  const executeMove = useCallback(
    (from: string, to: string, promotion?: string) => {
      const chess = gameRef.current
      try {
        const move = chess.move({ from, to, promotion })
        if (!move) return false
        // Track promotion sprite
        if (move.promotion) {
          const promoInfo = PROMOTION_POKEMON[move.color]?.[move.promotion]
          if (promoInfo) {
            setPromotedSquares(prev => {
              const next = new Map(prev)
              next.set(to, { slug: promoInfo.slug, scale: promoInfo.scale })
              return next
            })
          }
        } else {
          updatePromotionTracking(from, to, move.captured)
        }
        setFen(chess.fen())
        setPendingMove({ san: move.san, narrative: describeMove(move) })
        checkGameEnd(chess)
        return true
      } catch {
        return false
      }
    },
    [checkGameEnd, updatePromotionTracking],
  )

  // react-chessboard v5: onPieceDrop receives { piece, sourceSquare, targetSquare }
  const onPieceDrop = useCallback(
    ({ sourceSquare, targetSquare }: { piece: unknown; sourceSquare: string; targetSquare: string | null }): boolean => {
      if (gameOver || !targetSquare) return false
      if (pendingMoveRef.current) return false
      if (gameRef.current.turn() !== 'w') return false

      // If this is a promotion, show our custom dialog
      if (isPromotionMove(sourceSquare, targetSquare)) {
        setPromoDialog({ from: sourceSquare, to: targetSquare, color: 'w' })
        return false // Don't execute yet — wait for dialog choice
      }

      return executeMove(sourceSquare, targetSquare)
    },
    [gameOver, isPromotionMove, executeMove],
  )

  // Listen for postMessage from parent
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (PLATFORM_ORIGIN !== '*' && event.origin !== PLATFORM_ORIGIN) return
      const data = event.data
      if (data?.type === 'TREEHOUSE_TOOL_CALL' && data?.pluginId === PLUGIN_ID) {
        try {
          handleToolCall(data as ToolCallPayload)
        } catch (err) {
          console.error('[treehouse-chess] Unhandled error in tool call:', err)
          sendError(err instanceof Error ? err.message : String(err), false)
        }
      }
      // Restore state from parent cache or Supabase persistence
      if (data?.type === 'TREEHOUSE_RESTORE_STATE' && data?.pluginId === PLUGIN_ID) {
        const s = data.payload?.state
        if (s?.pgn) {
          try {
            const chess = gameRef.current
            chess.loadPgn(s.pgn)
            setFen(chess.fen())
            setGameOver(chess.isGameOver())
            setPendingMove(null)
            setPromotedSquares(deserializePromotions(s.promotedSquares))
          } catch (err) {
            console.warn('[treehouse-chess] Failed to restore game from PGN:', err)
          }
        }
      }
    }

    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [handleToolCall])

  // Signal ready on mount
  useEffect(() => {
    window.parent.postMessage(
      { type: 'TREEHOUSE_READY', pluginId: PLUGIN_ID },
      PLATFORM_ORIGIN,
    )
  }, [])

  // Prevent visibilitychange from canceling dnd-kit drags inside the iframe.
  // dnd-kit's PointerSensor listens for visibilitychange and cancels active drags,
  // but in an Electron iframe this fires spuriously when the parent window updates.
  useEffect(() => {
    const suppress = (e: Event) => e.stopImmediatePropagation()
    document.addEventListener('visibilitychange', suppress, true)
    return () => document.removeEventListener('visibilitychange', suppress, true)
  }, [])

  const confirmMove = useCallback(() => {
    if (!pendingMove) return
    const chess = gameRef.current
    // Send full state (with pgn for cross-session restore) plus narrative user message
    window.parent.postMessage(
      {
        type: 'TREEHOUSE_STATE_UPDATE',
        pluginId: PLUGIN_ID,
        payload: {
          state: {
            pgn: chess.pgn(),
            fen: chess.fen(),
            turn: chess.turn(),
            history: chess.history(),
            gameOver: chess.isGameOver(),
            promotedSquares: serializePromotions(promotedSquares),
          },
          userMessage: `I played ${pendingMove.san}. ${pendingMove.narrative} Your turn!`,
        },
      },
      PLATFORM_ORIGIN,
    )
    setPendingMove(null)
  }, [pendingMove, promotedSquares])

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
    <div style={{ width: 400, margin: '0 auto' }}>
      <div style={{ width: 400, height: 400, touchAction: 'none', position: 'relative' }}>
        <Chessboard
          options={{
            position: fen,
            onPieceDrop,
            animationDurationInMs: 200,
            pieces,
            boardOrientation: 'white',
            boardStyle: pokeballBoardStyle,
            squareStyle: pokeballSquareStyle,
            squareStyles: pokeballSquareStyles,
            darkSquareStyle: pokeballDarkSquareStyle,
            lightSquareStyle: pokeballLightSquareStyle,
            allowAutoScroll: false,
            allowDragging: !gameOver,
          }}
        />
      </div>
      {pendingMove && !gameOver && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 8 }}>
          <button
            onClick={() => {
              const undone = gameRef.current.undo()
              if (undone) {
                setFen(gameRef.current.fen())
                // If the undone move was a promotion, remove the sprite override
                if (undone.promotion) {
                  setPromotedSquares((prev) => {
                    const next = new Map(prev)
                    next.delete(undone.to)
                    return next
                  })
                }
              }
              setPendingMove(null)
            }}
            style={{
              padding: '6px 20px',
              fontSize: 14,
              fontWeight: 600,
              borderRadius: 8,
              border: 'none',
              background: '#ff4a4a',
              color: '#fff',
              cursor: 'pointer',
            }}
          >
            Undo ✕
          </button>
          <button
            onClick={confirmMove}
            style={{
              padding: '6px 20px',
              fontSize: 14,
              fontWeight: 600,
              borderRadius: 8,
              border: 'none',
              background: '#4a9eff',
              color: '#fff',
              cursor: 'pointer',
            }}
          >
            Confirm {pendingMove.san} ✓
          </button>
        </div>
      )}
      {promoDialog && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: 4,
            marginTop: 8,
            padding: '8px 0',
            background: '#1a1a1a',
            borderRadius: 8,
          }}
        >
          {Object.entries(PROMOTION_POKEMON[promoDialog.color]).map(([piece, info]) => (
            <button
              key={piece}
              onClick={() => {
                executeMove(promoDialog.from, promoDialog.to, piece)
                setPromoDialog(null)
              }}
              style={{
                width: 80,
                height: 80,
                background: '#2a2a2a',
                border: '2px solid #444',
                borderRadius: 8,
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 2,
              }}
              title={info.name}
            >
              <img
                src={`https://raw.githubusercontent.com/msikma/pokesprite/master/pokemon-gen8/regular/${info.slug}.png`}
                alt={info.name}
                style={{ width: 48, height: 40, objectFit: 'contain', imageRendering: 'pixelated' }}
                draggable={false}
              />
              <span style={{ fontSize: 10, color: '#ccc', fontWeight: 600 }}>{info.name}</span>
            </button>
          ))}
          <button
            onClick={() => setPromoDialog(null)}
            style={{
              width: 40,
              height: 80,
              background: '#2a2a2a',
              border: '2px solid #444',
              borderRadius: 8,
              cursor: 'pointer',
              color: '#888',
              fontSize: 18,
            }}
            title="Cancel"
          >
            ✕
          </button>
        </div>
      )}
      {gameOver && !dialogueDismissed && (
        <RetroDialogue
          lines={getGameOverLines(gameResult)}
          onDone={() => setDialogueDismissed(true)}
        />
      )}
      {gameOver && dialogueDismissed && (
        <div style={{ textAlign: 'center', marginTop: 8 }}>
          <button
            onClick={() => {
              gameRef.current.reset()
              setFen(gameRef.current.fen())
              setGameOver(false)
              setGameResult(null)
              setDialogueDismissed(false)
              setPendingMove(null)
              setPromotedSquares(new Map())
              sendStateUpdate(gameRef.current, new Map())
            }}
            style={{
              padding: '8px 24px',
              fontFamily: '"Press Start 2P", "Courier New", monospace',
              fontSize: 11,
              borderRadius: 4,
              border: '3px solid #333',
              background: '#ffffee',
              color: '#222',
              cursor: 'pointer',
              boxShadow: '3px 3px 0 rgba(0,0,0,0.3)',
            }}
          >
            NEW GAME?
          </button>
        </div>
      )}
    </div>
  )
}

export default App
