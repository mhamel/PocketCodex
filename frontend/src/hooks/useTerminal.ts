import { useEffect, useMemo, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import '@xterm/xterm/css/xterm.css'

export function useTerminal() {
  const terminalRef = useRef<Terminal | null>(null)
  const fitAddon = useMemo(() => new FitAddon(), [])

  useEffect(() => {
    const term = new Terminal({
      convertEol: true,
      cursorBlink: true,
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
    })

    term.loadAddon(fitAddon)
    term.loadAddon(new WebLinksAddon())

    terminalRef.current = term

    return () => {
      try {
        term.dispose()
      } catch {
        // ignore
      }
      terminalRef.current = null
    }
  }, [fitAddon])

  return { terminalRef, fitAddon }
}
