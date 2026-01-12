import { useEffect, useRef, useMemo, useImperativeHandle, forwardRef } from 'react'
import { XTerm } from '@pablo-lion/xterm-react'
import type { Terminal as XTermTerminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import './Terminal.css'

type Props = {
  onData: (data: string) => void
  onResize: (cols: number, rows: number) => void
  onTerminalReady?: (term: XTermTerminal) => void
  interactive?: boolean
  onInteract?: () => void
  autoFocus?: boolean
}

export type TerminalHandle = {
  refresh: (sendToPty: (data: string) => void) => void
}

const terminalOptions = {
  convertEol: true,
  cursorBlink: true,
  disableStdin: false,
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", "Courier New", monospace',
  fontSize: 13,
  theme: {
    background: '#000000',
    foreground: '#00ff00',
    cursor: '#00ff00',
    cursorAccent: '#000000',
    selectionBackground: 'rgba(0, 255, 0, 0.25)',
    black: '#000000',
    red: '#00ff00',
    green: '#00ff00',
    yellow: '#00ff00',
    blue: '#00ff00',
    magenta: '#00ff00',
    cyan: '#00ff00',
    white: '#00ff00',
    brightBlack: '#004400',
    brightRed: '#00ff00',
    brightGreen: '#00ff00',
    brightYellow: '#00ff00',
    brightBlue: '#00ff00',
    brightMagenta: '#00ff00',
    brightCyan: '#00ff00',
    brightWhite: '#00ff00'
  }
}

const TerminalView = forwardRef<TerminalHandle, Props>(function TerminalView(
  { onData, onResize, onTerminalReady, interactive = true, onInteract, autoFocus = true },
  ref
) {
  const xtermRef = useRef<InstanceType<typeof XTerm> | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const fitAddon = useMemo(() => new FitAddon(), [])
  const webLinksAddon = useMemo(() => new WebLinksAddon(), [])
  const addons = useMemo(() => [fitAddon, webLinksAddon], [fitAddon, webLinksAddon])

  const options = useMemo(() => ({
    ...terminalOptions,
    disableStdin: !interactive
  }), [interactive])

  const getTerminal = () => xtermRef.current?.terminal ?? null

  const focusTerminal = () => {
    try {
      getTerminal()?.focus()
    } catch {
    }
  }

  useImperativeHandle(ref, () => ({
    refresh: (sendToPty) => {
      const term = getTerminal()
      if (term) {
        term.clear()
        fitAddon.fit()
        onResize(term.cols, term.rows)
      }
      // Envoie Ctrl+L au PTY pour redessiner
      sendToPty('\x0c')
    }
  }), [fitAddon, onResize])

  const handleData = (data: string) => {
    if (interactive) {
      onData(data)
    }
  }

  const handleResize = ({ cols, rows }: { cols: number; rows: number }) => {
    onResize(cols, rows)
  }

  useEffect(() => {
    const term = getTerminal()
    if (!term) return

    if (onTerminalReady) onTerminalReady(term)

    if (interactive && autoFocus) focusTerminal()

    fitAddon.fit()
    onResize(term.cols, term.rows)
  }, [autoFocus, fitAddon, interactive, onResize, onTerminalReady])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit()
      const term = getTerminal()
      if (term) {
        onResize(term.cols, term.rows)
      }
    })
    resizeObserver.observe(container)

    return () => {
      resizeObserver.disconnect()
    }
  }, [fitAddon, onResize])

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
    >
      <XTerm
        ref={xtermRef}
        options={options}
        addons={addons}
        onData={handleData}
        onResize={handleResize}
      />
    </div>
  )
})

export default TerminalView
