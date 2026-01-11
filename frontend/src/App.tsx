import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import type { Terminal as XTermTerminal } from '@xterm/xterm'
import './App.css'
import type { WSMessage } from './types/messages'
import { useWebSocket } from './hooks/useWebSocket'
import TerminalView from './components/Terminal/Terminal'
import ControlPanel from './components/ControlPanel/ControlPanel'
import PresetSelector from './components/PresetSelector/PresetSelector'
import PresetManager from './components/PresetManager/PresetManager'
import { apiPost } from './services/api'
import { usePresets } from './hooks/usePresets'
import type { PresetScope } from './types/preset'

type ProcessStatus = 'running' | 'stopped' | 'error'

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  return String(err)
}

export default function App() {
  const termRef = useRef<XTermTerminal | null>(null)

  const [processStatus, setProcessStatus] = useState<ProcessStatus>('stopped')
  const [pid, setPid] = useState<number | null>(null)
  const [terminalError, setTerminalError] = useState<string | null>(null)
  const [projectPath, setProjectPath] = useState<string>('')
  const [cwd, setCwd] = useState<string>('')
  const [managerOpen, setManagerOpen] = useState(false)

  const { data: presets, loading: presetsLoading, error: presetsError, createPreset, updatePreset, deletePreset, executePreset } = usePresets(
    projectPath.trim() ? projectPath.trim() : null
  )

  const shortcuts = useMemo(() => {
    const map = new Map<string, { id: string; scope: PresetScope }>()
    for (const p of presets.global) {
      if (p.shortcut) map.set(p.shortcut.toLowerCase(), { id: p.id, scope: 'global' })
    }
    for (const p of presets.project) {
      if (p.shortcut) map.set(p.shortcut.toLowerCase(), { id: p.id, scope: 'project' })
    }
    return map
  }, [presets.global, presets.project])

  const onWsMessage = useCallback((msg: WSMessage) => {
    if (msg.type === 'output') {
      termRef.current?.write(msg.payload.data)
    }
    if (msg.type === 'status') {
      setProcessStatus(msg.payload.status)
      setPid(msg.payload.pid ?? null)
    }
  }, [])

  const { state: wsState, send } = useWebSocket(onWsMessage)

  const wsBadge = useMemo(() => {
    if (wsState === 'connected') return { text: 'WebSocket: Connected', kind: 'green' as const }
    if (wsState === 'connecting') return { text: 'WebSocket: Connecting', kind: 'neutral' as const }
    return { text: 'WebSocket: Disconnected', kind: 'red' as const }
  }, [wsState])

  const statusBadge = useMemo(() => {
    if (processStatus === 'running') return { text: `Process: Running${pid ? ` (PID ${pid})` : ''}`, kind: 'green' as const }
    if (processStatus === 'error') return { text: 'Process: Error', kind: 'red' as const }
    return { text: 'Process: Stopped', kind: 'neutral' as const }
  }, [pid, processStatus])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!e.ctrlKey) return

      const digit = e.key
      if (!/^[0-9]$/.test(digit)) return

      const shortcut = `ctrl+${digit}`
      const hit = shortcuts.get(shortcut)
      if (!hit) return

      e.preventDefault()
      executePreset(hit.id, hit.scope)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [executePreset, shortcuts])

  const start = useCallback(async () => {
    const body: { cwd?: string } = {}
    if (cwd.trim()) body.cwd = cwd.trim()
    setTerminalError(null)
    try {
      await apiPost('/api/terminal/start', body)
    } catch (e) {
      setTerminalError(getErrorMessage(e))
      setProcessStatus('error')
    }
  }, [cwd])

  const stop = useCallback(async () => {
    setTerminalError(null)
    try {
      await apiPost('/api/terminal/stop', { force: false })
    } catch (e) {
      setTerminalError(getErrorMessage(e))
      setProcessStatus('error')
    }
  }, [])

  const onData = useCallback(
    (data: string) => {
      send({ type: 'input', payload: { data } })
    },
    [send]
  )

  const onResize = useCallback(
    (cols: number, rows: number) => {
      send({ type: 'resize', payload: { cols, rows } })
    },
    [send]
  )

  const onTerminalReady = useCallback((term: XTermTerminal) => {
    termRef.current = term
  }, [])

  return (
    <div className="app">
      <div className="topbar">
        <div className="topbar-title">WebCodeAI</div>

        <PresetSelector
          data={presets}
          disabled={presetsLoading}
          onExecute={(id: string, scope: PresetScope) => executePreset(id, scope)}
          onManage={() => setManagerOpen(true)}
        />

        <div className="topbar-spacer" />

        <input
          className="input"
          placeholder="Project path (optional, for project presets)"
          value={projectPath}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setProjectPath(e.target.value)}
        />

        <input
          className="input"
          placeholder="cwd (optional)"
          value={cwd}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setCwd(e.target.value)}
        />
      </div>

      {presetsError ? (
        <div style={{ padding: '0 12px' }}>
          <div className="small">Presets error: {presetsError}</div>
        </div>
      ) : null}

      {terminalError ? (
        <div style={{ padding: '0 12px' }}>
          <div className="small">Terminal error: {terminalError}</div>
        </div>
      ) : null}

      <div className="content">
        <div className="terminalWrap" id="terminal-host">
          <TerminalView onData={onData} onResize={onResize} onTerminalReady={onTerminalReady} />
        </div>

        <div className="card footer">
          <ControlPanel canStart={processStatus !== 'running'} canStop={processStatus === 'running'} onStart={start} onStop={stop} />

          <div style={{ display: 'flex', gap: 10 }}>
            <div className={`badge ${wsBadge.kind === 'green' ? 'badgeGreen' : wsBadge.kind === 'red' ? 'badgeRed' : ''}`}>{wsBadge.text}</div>
            <div
              className={`badge ${statusBadge.kind === 'green' ? 'badgeGreen' : statusBadge.kind === 'red' ? 'badgeRed' : ''}`}
            >
              {statusBadge.text}
            </div>
          </div>
        </div>
      </div>

      <PresetManager
        open={managerOpen}
        onClose={() => setManagerOpen(false)}
        data={presets}
        onCreate={createPreset}
        onUpdate={updatePreset}
        onDelete={deletePreset}
      />
    </div>
  )
}
