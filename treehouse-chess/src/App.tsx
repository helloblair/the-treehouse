import { useCallback, useEffect, useRef, useState } from 'react'
import { Chess } from 'chess.js'
import { Chessboard } from 'react-chessboard'

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
          sendResult(callId, { success: true, fen: chess.fen() })
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
            const move = chess.move(params.move as string)
            if (!move) {
              sendResult(callId, { success: false, error: 'That move is not legal' })
            } else {
              setFen(chess.fen())
              if (!checkGameEnd(chess)) {
                sendResult(callId, { success: true, fen: chess.fen() })
              }
            }
          } catch {
            sendResult(callId, { success: false, error: 'That move is not legal' })
          }
          break
        }
        case 'get_board_state': {
          sendResult(callId, { fen: chess.fen() })
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
    ({ sourceSquare, targetSquare }: { piece: string; sourceSquare: string; targetSquare: string }): boolean => {
      const chess = gameRef.current
      if (gameOver) return false
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
        handleToolCall(data as ToolCallPayload)
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
    // Notify parent to send a chat message on behalf of the user
    window.parent.postMessage(
      {
        type: 'TREEHOUSE_STATE_UPDATE',
        pluginId: PLUGIN_ID,
        payload: {
          state: {
            fen: chess.fen(),
            lastMove: pendingMove,
            turn: chess.turn(),
            history: chess.history(),
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
      <div style={{ width: 400, height: 400 }}>
        <Chessboard
          options={{
            position: fen,
            onPieceDrop,
            animationDurationInMs: 200,
          }}
        />
      </div>
      {pendingMove && !gameOver && (
        <button
          onClick={confirmMove}
          style={{
            display: 'block',
            margin: '8px auto',
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
      )}
      {gameOver && (
        <p style={{ marginTop: 8, fontWeight: 600, textAlign: 'center' }}>Game Over</p>
      )}
    </div>
  )
}

export default App
