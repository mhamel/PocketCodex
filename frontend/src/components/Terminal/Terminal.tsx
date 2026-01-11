import { useEffect, useRef } from 'react'
import type { Terminal as XTermTerminal } from '@xterm/xterm'
import { useTerminal } from '../../hooks/useTerminal'
import './Terminal.css'

type Props = {
  onData: (data: string) => void
  onResize: (cols: number, rows: number) => void
  onTerminalReady?: (term: XTermTerminal) => void
}

export default function TerminalView({ onData, onResize, onTerminalReady }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const { terminalRef, fitAddon } = useTerminal()

  useEffect(() => {
    const container = containerRef.current
    const term = terminalRef.current
    if (!container || !term) return

    term.open(container)
    term.focus()

    if (onTerminalReady) onTerminalReady(term)

    fitAddon.fit()
    onResize(term.cols, term.rows)

    const sub = term.onData((d: string) => onData(d))

    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit()
      onResize(term.cols, term.rows)
    })
    resizeObserver.observe(container)

    return () => {
      sub.dispose()
      resizeObserver.disconnect()
    }
  }, [fitAddon, onData, onResize, onTerminalReady, terminalRef])

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
}
