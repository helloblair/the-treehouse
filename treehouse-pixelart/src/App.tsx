import { useCallback, useEffect, useRef, useState } from 'react'
import './App.css'

const PLUGIN_ID = 'treehouse-pixelart'
const PLATFORM_ORIGIN = import.meta.env.VITE_PLATFORM_ORIGIN || 'http://localhost:1212'
const MAX_HISTORY = 50

const DEFAULT_PALETTE = [
  '#000000', '#ffffff', '#ff0000', '#ff8c00',
  '#ffff00', '#00c853', '#2979ff', '#7c4dff',
  '#ff80ab', '#795548', '#9e9e9e', '#ffcc80',
]

type Tool = 'draw' | 'erase' | 'fill'

type ToolCallPayload = {
  type: 'TREEHOUSE_TOOL_CALL'
  pluginId: string
  payload: {
    callId: string
    toolName: string
    params: Record<string, unknown>
  }
}

function createGrid(size: number): string[] {
  return new Array(size * size).fill('#ffffff')
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

function getBase64(grid: string[], size: number): string | null {
  try {
    const scale = 10
    const canvas = document.createElement('canvas')
    canvas.width = size * scale
    canvas.height = size * scale
    const ctx = canvas.getContext('2d')!
    for (let i = 0; i < grid.length; i++) {
      const x = i % size
      const y = Math.floor(i / size)
      ctx.fillStyle = grid[i]
      ctx.fillRect(x * scale, y * scale, scale, scale)
    }
    return canvas.toDataURL('image/png')
  } catch (err) {
    console.error('[treehouse-pixelart] Canvas capture failed:', err)
    sendError("Couldn't capture the canvas. Try a different browser.", false)
    return null
  }
}

function getMiniBase64(grid: string[], size: number): string | null {
  try {
    const scale = 3
    const canvas = document.createElement('canvas')
    canvas.width = size * scale
    canvas.height = size * scale
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    for (let i = 0; i < grid.length; i++) {
      const x = i % size
      const y = Math.floor(i / size)
      ctx.fillStyle = grid[i]
      ctx.fillRect(x * scale, y * scale, scale, scale)
    }
    return canvas.toDataURL('image/png')
  } catch {
    return null
  }
}

const COLOR_SYMBOLS: Record<string, string> = {
  '#ffffff': '.', '#000000': '#', '#ff0000': 'R', '#ff8c00': 'O',
  '#ffff00': 'Y', '#00c853': 'G', '#2979ff': 'B', '#7c4dff': 'V',
  '#ff80ab': 'P', '#795548': 'W', '#9e9e9e': 'X', '#ffcc80': 'S',
}

function getTextGrid(grid: string[], size: number): string {
  const lines: string[] = []
  for (let y = 0; y < size; y++) {
    let row = ''
    for (let x = 0; x < size; x++) {
      const c = grid[y * size + x].toLowerCase()
      row += COLOR_SYMBOLS[c] ?? c
    }
    lines.push(`${String(y).padStart(2)}|${row}|`)
  }
  return lines.join('\n')
}

function getColorLegend(grid: string[]): string {
  const used = new Set(grid.map((c) => c.toLowerCase()))
  used.delete('#ffffff')
  if (used.size === 0) return 'Canvas is blank (all white).'
  const entries: string[] = []
  for (const c of used) {
    const sym = COLOR_SYMBOLS[c] ?? c
    entries.push(`${sym}=${c}`)
  }
  return 'Legend: .=empty ' + entries.join(' ')
}

function floodFill(grid: string[], size: number, index: number, newColor: string): string[] {
  const oldColor = grid[index]
  if (oldColor === newColor) return grid
  const next = [...grid]
  const queue = [index]
  const visited = new Set<number>()
  while (queue.length > 0) {
    const idx = queue.shift()!
    if (visited.has(idx)) continue
    if (next[idx] !== oldColor) continue
    visited.add(idx)
    next[idx] = newColor
    const x = idx % size
    const y = Math.floor(idx / size)
    if (x > 0) queue.push(idx - 1)
    if (x < size - 1) queue.push(idx + 1)
    if (y > 0) queue.push(idx - size)
    if (y < size - 1) queue.push(idx + size)
  }
  return next
}

function sendStateToParent(grid: string[], size: number, palette: string[]) {
  window.parent.postMessage(
    {
      type: 'TREEHOUSE_STATE_UPDATE',
      pluginId: PLUGIN_ID,
      payload: {
        state: { grid, size, palette },
      },
    },
    PLATFORM_ORIGIN,
  )
}

function App() {
  const [size, setSize] = useState(16)
  const [grid, setGrid] = useState(() => createGrid(16))
  const [color, setColor] = useState('#000000')
  const [tool, setTool] = useState<Tool>('draw')
  const [palette, setPalette] = useState(DEFAULT_PALETTE)
  const [isDrawing, setIsDrawing] = useState(false)

  // Undo/redo history
  const [undoStack, setUndoStack] = useState<string[][]>([])
  const [redoStack, setRedoStack] = useState<string[][]>([])

  const gridRef = useRef(grid)
  const sizeRef = useRef(size)
  const paletteRef = useRef(palette)
  const restoredRef = useRef(false)

  useEffect(() => {
    gridRef.current = grid
    sizeRef.current = size
    paletteRef.current = palette
  }, [grid, size, palette])

  // Push current grid to undo stack before a change
  const pushUndo = useCallback((prevGrid: string[]) => {
    setUndoStack((stack) => {
      const next = [...stack, prevGrid]
      if (next.length > MAX_HISTORY) next.shift()
      return next
    })
    setRedoStack([])
  }, [])

  const undo = useCallback(() => {
    setUndoStack((stack) => {
      if (stack.length === 0) return stack
      const prev = stack[stack.length - 1]
      const newStack = stack.slice(0, -1)
      setRedoStack((redo) => [...redo, gridRef.current])
      setGrid(prev)
      return newStack
    })
  }, [])

  const redo = useCallback(() => {
    setRedoStack((stack) => {
      if (stack.length === 0) return stack
      const next = stack[stack.length - 1]
      const newStack = stack.slice(0, -1)
      setUndoStack((undo) => [...undo, gridRef.current])
      setGrid(next)
      return newStack
    })
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault()
        redo()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [undo, redo])

  // Persist state to parent whenever grid or palette changes (debounced)
  useEffect(() => {
    if (!restoredRef.current) return
    const timer = setTimeout(() => {
      sendStateToParent(grid, size, palette)
    }, 300)
    return () => clearTimeout(timer)
  }, [grid, size, palette])

  const applyTool = useCallback(
    (index: number) => {
      setGrid((prev) => {
        let next: string[]
        if (tool === 'draw') {
          if (prev[index] === color) return prev
          next = [...prev]
          next[index] = color
        } else if (tool === 'erase') {
          if (prev[index] === '#ffffff') return prev
          next = [...prev]
          next[index] = '#ffffff'
        } else if (tool === 'fill') {
          next = floodFill(prev, sizeRef.current, index, color)
          if (next === prev) return prev
        } else {
          return prev
        }
        pushUndo(prev)
        return next
      })
    },
    [tool, color, pushUndo],
  )

  const handleToolCall = useCallback((msg: ToolCallPayload) => {
    const { callId, toolName, params } = msg.payload

    switch (toolName) {
      case 'start_canvas': {
        const newSize = params.size === 32 ? 32 : 16
        const currentGrid = gridRef.current
        const hasDrawing = currentGrid.some((c) => c !== '#ffffff')
        // Preserve existing drawing unless size changes or reset is requested
        if (hasDrawing && sizeRef.current === newSize && !params.reset) {
          sendResult(callId, { success: true, width: newSize, height: newSize, restored: true })
        } else {
          setSize(newSize)
          setGrid(createGrid(newSize))
          setPalette(DEFAULT_PALETTE)
          setColor('#000000')
          setTool('draw')
          setUndoStack([])
          setRedoStack([])
          sendResult(callId, { success: true, width: newSize, height: newSize })
        }
        restoredRef.current = true
        break
      }
      case 'get_canvas_state': {
        const currentGrid = gridRef.current
        const currentSize = sizeRef.current
        const imageBase64 = getBase64(currentGrid, currentSize)
        const textGrid = getTextGrid(currentGrid, currentSize)
        const legend = getColorLegend(currentGrid)
        if (imageBase64 === null) {
          sendResult(callId, { error: "Couldn't capture the canvas image, but here is the text grid.", textGrid, legend, width: currentSize, height: currentSize }, true)
        } else {
          sendResult(callId, { imageBase64, textGrid, legend, width: currentSize, height: currentSize })
        }
        break
      }
      case 'clear_canvas': {
        const currentSize = sizeRef.current
        pushUndo(gridRef.current)
        setGrid(createGrid(currentSize))
        sendResult(callId, { success: true })
        break
      }
      case 'set_palette': {
        let colors: string[]
        try {
          const raw = params.colors
          colors = typeof raw === 'string' ? JSON.parse(raw) : raw as string[]
        } catch {
          sendResult(callId, { error: 'colors must be a JSON array of hex strings' }, true)
          break
        }
        if (!Array.isArray(colors) || colors.length === 0) {
          sendResult(callId, { error: 'colors must be a non-empty array of hex strings' }, true)
          break
        }
        const hexPattern = /^#[0-9a-fA-F]{6}$/
        const invalid = colors.filter((c) => !hexPattern.test(c))
        if (invalid.length > 0) {
          sendResult(callId, { error: `Invalid hex colors: ${invalid.join(', ')}. Expected format: #RRGGBB` }, true)
          break
        }
        setPalette(colors)
        setColor(colors[0])
        sendResult(callId, { success: true, paletteSize: colors.length })
        break
      }
      default:
        sendResult(callId, { error: `Unknown tool: ${toolName}` }, true)
    }
  }, [pushUndo])

  // Listen for postMessage from parent
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (PLATFORM_ORIGIN !== '*' && event.origin !== PLATFORM_ORIGIN) return
      const data = event.data
      if (data?.type === 'TREEHOUSE_TOOL_CALL' && data?.pluginId === PLUGIN_ID) {
        handleToolCall(data as ToolCallPayload)
      }
      // Restore cached state from platform
      if (data?.type === 'TREEHOUSE_RESTORE_STATE' && data?.pluginId === PLUGIN_ID) {
        const s = data.payload?.state
        if (s?.grid && Array.isArray(s.grid)) {
          setGrid(s.grid)
          if (s.size) setSize(s.size)
          if (s.palette && Array.isArray(s.palette)) setPalette(s.palette)
          setUndoStack([])
          setRedoStack([])
        }
        restoredRef.current = true
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
    // If no restore happens within 500ms, mark as restored so persistence starts
    const timer = setTimeout(() => { restoredRef.current = true }, 500)
    return () => clearTimeout(timer)
  }, [])

  const handleDone = useCallback(() => {
    const currentGrid = gridRef.current
    const currentSize = sizeRef.current
    // Cache state first
    sendStateToParent(currentGrid, currentSize, paletteRef.current)
    // Then send a short message — Claude will call get_canvas_state to see the drawing
    setTimeout(() => {
      window.parent.postMessage(
        {
          type: 'TREEHOUSE_STATE_UPDATE',
          pluginId: PLUGIN_ID,
          payload: {
            state: { grid: currentGrid, size: currentSize, palette: paletteRef.current },
            userMessage: "I'm done with my drawing! Please take a look and tell me what you think.",
          },
        },
        PLATFORM_ORIGIN,
      )
    }, 100)
  }, [])

  const handleAskClaude = useCallback(() => {
    const currentGrid = gridRef.current
    const currentSize = sizeRef.current
    const textGrid = getTextGrid(currentGrid, currentSize)
    const legend = getColorLegend(currentGrid)
    window.parent.postMessage(
      {
        type: 'TREEHOUSE_STATE_UPDATE',
        pluginId: PLUGIN_ID,
        payload: {
          state: { grid: currentGrid, size: currentSize, palette: paletteRef.current },
          userMessage: `Here is my pixel art so far. Please describe what you see and give feedback.\n${legend}\n${textGrid}`,
        },
      },
      PLATFORM_ORIGIN,
    )
  }, [])

  // Generate mini thumbnails for history display
  const historyThumbnails = undoStack.slice(-8).flatMap((g, i) => {
    const src = getMiniBase64(g, size)
    if (!src) return []
    return [{ key: undoStack.length - 8 + i, src }]
  })

  const cellSize = size <= 16 ? 20 : 12
  const gridPx = size * cellSize

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
    <div className="pixelart-app">
      <div className="main-layout">
        {/* Grid */}
        <div
          className="grid-container"
          style={{ width: gridPx, height: gridPx }}
          onMouseLeave={() => setIsDrawing(false)}
        >
          {grid.map((cellColor, i) => (
            <div
              key={i}
              className="cell"
              style={{
                width: cellSize,
                height: cellSize,
                backgroundColor: cellColor,
              }}
              onMouseDown={(e) => {
                e.preventDefault()
                setIsDrawing(true)
                applyTool(i)
              }}
              onMouseEnter={() => {
                if (isDrawing && tool !== 'fill') applyTool(i)
              }}
              onMouseUp={() => setIsDrawing(false)}
            />
          ))}
        </div>

        {/* Side panel */}
        <div className="side-panel">
          {/* Active color */}
          <div className="active-color-row">
            <div className="active-swatch" style={{ backgroundColor: color }} />
            <span className="color-hex">{color}</span>
          </div>

          {/* Palette */}
          <div className="palette-grid">
            {palette.map((c) => (
              <div
                key={c}
                className={`palette-swatch${c === color ? ' active' : ''}`}
                style={{ backgroundColor: c }}
                onClick={() => setColor(c)}
              />
            ))}
          </div>

          {/* Tool buttons */}
          <div className="toolbar">
            <button className={tool === 'draw' ? 'active' : ''} onClick={() => setTool('draw')}>
              Draw
            </button>
            <button className={tool === 'erase' ? 'active' : ''} onClick={() => setTool('erase')}>
              Erase
            </button>
            <button className={tool === 'fill' ? 'active' : ''} onClick={() => setTool('fill')}>
              Fill
            </button>
            <button onClick={() => { pushUndo(grid); setGrid(createGrid(size)) }}>Clear</button>
          </div>

          {/* Undo / Redo */}
          <div className="undo-redo">
            <button disabled={undoStack.length === 0} onClick={undo}>Undo</button>
            <button disabled={redoStack.length === 0} onClick={redo}>Redo</button>
          </div>

          {/* Action buttons */}
          <div className="actions">
            <button className="action-btn ask" onClick={handleAskClaude}>
              Ask Claude
            </button>
            <button className="action-btn done" onClick={handleDone}>
              Done
            </button>
          </div>

          {/* History thumbnails */}
          {historyThumbnails.length > 0 && (
            <div className="history-section">
              <span className="history-label">History</span>
              <div className="history-grid">
                {historyThumbnails.map((t) => (
                  <img
                    key={t.key}
                    src={t.src}
                    className="history-thumb"
                    alt={`Step ${t.key + 1}`}
                    onClick={() => {
                      const idx = t.key
                      if (idx < 0 || idx >= undoStack.length) return
                      const target = undoStack[idx]
                      pushUndo(gridRef.current)
                      setGrid(target)
                    }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default App
