import { useEffect, useRef } from 'react'
import type { Terminal as XTermTerminal } from '@xterm/xterm'
import { useTerminal } from '../../hooks/useTerminal'
import './Terminal.css'

type Props = {
  onData: (data: string) => void
  onResize: (cols: number, rows: number) => void
  onTerminalReady?: (term: XTermTerminal) => void
  interactive?: boolean
  onInteract?: () => void
  autoFocus?: boolean
}

export default function TerminalView({ onData, onResize, onTerminalReady, interactive = true, onInteract, autoFocus = true }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const { terminalRef, fitAddon } = useTerminal()

  const focusTerminal = () => {
    try {
      terminalRef.current?.focus()
    } catch {
    }
  }

  useEffect(() => {
    const container = containerRef.current
    const term = terminalRef.current
    if (!container || !term) return

    term.options.disableStdin = !interactive

    term.open(container)
    if (interactive && autoFocus) focusTerminal()

    if (onTerminalReady) onTerminalReady(term)

    fitAddon.fit()
    onResize(term.cols, term.rows)

    const sub = interactive ? term.onData((d: string) => onData(d)) : null

    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit()
      onResize(term.cols, term.rows)
    })
    resizeObserver.observe(container)

    return () => {
      sub?.dispose()
      resizeObserver.disconnect()
    }
  }, [autoFocus, fitAddon, interactive, onData, onResize, onTerminalReady, terminalRef])

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%' }}
      onMouseDown={() => {
        if (interactive) focusTerminal()
        else onInteract?.()
      }}
      onTouchStart={() => {
        if (interactive) focusTerminal()
        else onInteract?.()
      }}
    />
  )
}
