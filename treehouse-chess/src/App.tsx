import { useCallback, useEffect, useRef, useState } from 'react'
import { Chess } from 'chess.js'
import { Chessboard } from 'react-chessboard'
import { pokemonPieces } from './pokemonPieces'
import {
  pokeballSquareStyles,
  pokeballBoardStyle,
  pokeballSquareStyle,
  pokeballDarkSquareStyle,
  pokeballLightSquareStyle,
} from './pokemonBoard'

const PLUGIN_ID = 'treehouse-chess'
const PLATFORM_ORIGIN = import.meta.env.VITE_PLATFORM_ORIGIN || '*'

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

function sendStateUpdate(chess: Chess) {
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

function App() {
  const gameRef = useRef(new Chess())
  const [fen, setFen] = useState(gameRef.current.fen())
  const [gameOver, setGameOver] = useState(false)
  const [pendingMove, setPendingMove] = useState<string | null>(null)

  const checkGameEnd = useCallback((chess: Chess) => {
    if (chess.isCheckmate()) {
      const winner = chess.turn() === 'w' ? 'Black' : 'White'
      const moveCount = chess.history().length
      sendCompletion(winner, moveCount, chess)
      setGameOver(true)
      return true
    }
    if (chess.isStalemate() || chess.isDraw()) {
      const moveCount = chess.history().length
      window.parent.postMessage(
        {
          type: 'TREEHOUSE_COMPLETION',
          pluginId: PLUGIN_ID,
          payload: {
            result: {
              summary: `Draw after ${moveCount} moves.`,
              data: {
                winner: 'draw',
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
          setPendingMove(null)
          sendResult(callId, { success: true, fen: chess.fen() })
          sendStateUpdate(chess)
          break
        }
        case 'make_move': {
          if (gameOver) {
            sendResult(callId, { success: false, error: 'Game is already over' })
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
              setFen(chess.fen())
              const gameEnded = checkGameEnd(chess)
              sendResult(callId, {
                success: true,
                fen: chess.fen(),
                movePlayed: move.san,
                turn: 'White',
                moveHistory: chess.history(),
                inCheck: chess.inCheck(),
                gameOver: gameEnded,
              })
              sendStateUpdate(chess)
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

  // react-chessboard v5: onPieceDrop receives { piece, sourceSquare, targetSquare }
  const onPieceDrop = useCallback(
    ({ sourceSquare, targetSquare }: { piece: unknown; sourceSquare: string; targetSquare: string | null }): boolean => {
      const chess = gameRef.current
      if (gameOver || !targetSquare) return false
      if (chess.turn() !== 'w') return false
      try {
        const move = chess.move({
          from: sourceSquare,
          to: targetSquare,
          promotion: 'q',
        })
        if (!move) return false
        setFen(chess.fen())
        setPendingMove(move.san)
        checkGameEnd(chess)
        return true
      } catch {
        return false
      }
    },
    [gameOver, checkGameEnd],
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
          } catch (err) {
            console.warn('[treehouse-chess] Failed to restore game from PGN:', err)
            // Leave the game in its current (fresh) state
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

  const confirmMove = useCallback(() => {
    if (!pendingMove) return
    const chess = gameRef.current
    // Send full state (with pgn for cross-session restore) plus user message
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
          },
          userMessage: `I played ${pendingMove}. Your turn!`,
        },
      },
      PLATFORM_ORIGIN,
    )
    setPendingMove(null)
  }, [pendingMove])

  return (
    <div style={{ width: 400, margin: '0 auto' }}>
      <div style={{ width: 400, height: 400, touchAction: 'none' }}>
        <Chessboard
          options={{
            position: fen,
            onPieceDrop,
            animationDurationInMs: 200,
            pieces: pokemonPieces,
            boardStyle: pokeballBoardStyle,
            squareStyle: pokeballSquareStyle,
            squareStyles: pokeballSquareStyles,
            darkSquareStyle: pokeballDarkSquareStyle,
            lightSquareStyle: pokeballLightSquareStyle,
            allowAutoScroll: false,
          }}
        />
      </div>
      {pendingMove && !gameOver && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 8 }}>
          <button
            onClick={() => {
              gameRef.current.undo()
              setFen(gameRef.current.fen())
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
            Confirm {pendingMove} ✓
          </button>
        </div>
      )}
      {gameOver && (
        <p style={{ marginTop: 8, fontWeight: 600, textAlign: 'center' }}>Game Over</p>
      )}
    </div>
  )
}

export default App
