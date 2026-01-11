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
      fontFamily: 'JetBrains Mono, Fira Code, monospace',
      fontSize: 13,
      theme: {
        background: '#000000',
        foreground: '#f8fafc'
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
