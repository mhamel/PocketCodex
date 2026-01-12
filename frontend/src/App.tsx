import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Terminal as XTermTerminal } from '@xterm/xterm'
import './App.css'
import type { WSMessage } from './types/messages'
import { useWebSocket } from './hooks/useWebSocket'
import TerminalView from './components/Terminal/Terminal'
import ControlPanel from './components/ControlPanel/ControlPanel'
import PresetSelector from './components/PresetSelector/PresetSelector'
import PresetManager from './components/PresetManager/PresetManager'
import ProjectTree from './components/ProjectTree/ProjectTree'
import ChatHistoryDrawer from './components/ChatHistory/ChatHistoryDrawer'
import { apiPost } from './services/api'
import { usePresets } from './hooks/usePresets'
import { useChatHistory } from './hooks/useChatHistory'
import type { PresetScope } from './types/preset'

type ProcessStatus = 'running' | 'stopped' | 'error'

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  return String(err)
}

function buildCdInput(path: string): string {
  const trimmed = path.trim()
  if (!trimmed) return ''

  const drive = /^[a-zA-Z]:/.exec(trimmed)?.[0]
  const safe = trimmed.split('"').join('\\"')

  let out = ''
  if (drive) out += `${drive}\r\n`
  out += `cd "${safe}"\r\n`
  return out
}

export default function App() {
  const termRef = useRef<XTermTerminal | null>(null)

  const [processStatus, setProcessStatus] = useState<ProcessStatus>('stopped')
  const [pid, setPid] = useState<number | null>(null)
  const [terminalError, setTerminalError] = useState<string | null>(null)
  const [projectPath, setProjectPath] = useState<string>('')
  const [cwd, setCwd] = useState<string>('')
  const [managerOpen, setManagerOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)

  const chatHistory = useChatHistory(projectPath.trim() ? projectPath.trim() : null)

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

  const onSelectProject = useCallback(
    (path: string) => {
      setProjectPath(path)
      setCwd(path)

      if (processStatus === 'running') {
        const data = buildCdInput(path)
        if (data) send({ type: 'input', payload: { data } })
      }
    },
    [processStatus, send]
  )

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
      if (e.ctrlKey && (e.key === 'h' || e.key === 'H')) {
        e.preventDefault()
        setHistoryOpen(true)
        return
      }

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

  const saveCurrentHistorySnapshot = useCallback(async () => {
    const project = projectPath.trim() ? projectPath.trim() : null
    const leaf = project ? project.replace(/\\+$/g, '').split(/\\|\//).filter(Boolean).slice(-1)[0] : null
    const title = leaf ? `Session (${leaf})` : 'Session'

    try {
      await chatHistory.saveSnapshot(title)
    } catch (e) {
      const msg = getErrorMessage(e)
      if (!msg.toLowerCase().includes('no terminal history')) {
        setTerminalError(msg)
      }
    }
  }, [chatHistory, projectPath])

  const restart = useCallback(async () => {
    const body: { cwd?: string } = {}
    if (cwd.trim()) body.cwd = cwd.trim()
    setTerminalError(null)
    try {
      await saveCurrentHistorySnapshot()
      await apiPost('/api/terminal/restart', body)
      try {
        termRef.current?.clear()
      } catch {
      }
    } catch (e) {
      setTerminalError(getErrorMessage(e))
      setProcessStatus('error')
    }
  }, [cwd, saveCurrentHistorySnapshot])

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

  const onArrowUp = useCallback(() => {
    send({ type: 'special_key', payload: { key: 'ArrowUp', modifiers: [] } })
  }, [send])

  const onArrowDown = useCallback(() => {
    send({ type: 'special_key', payload: { key: 'ArrowDown', modifiers: [] } })
  }, [send])

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
          onArrowUp={onArrowUp}
          onArrowDown={onArrowDown}
          arrowsDisabled={wsState !== 'connected' || processStatus !== 'running'}
        />

        <div className="topbar-spacer" />

        <button className="btn" type="button" onClick={() => setHistoryOpen(true)}>
          History
        </button>

        <div className="small" style={{ maxWidth: 520, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          Project: {projectPath || '-'}
        </div>
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

      <div className="main">
        <ProjectTree selectedPath={projectPath.trim() ? projectPath.trim() : null} onSelect={onSelectProject} />

        <div className="content">
          <div className="terminalWrap" id="terminal-host">
            <TerminalView onData={onData} onResize={onResize} onTerminalReady={onTerminalReady} />
          </div>

          <div className="card footer">
            <ControlPanel
              canRestart={wsState === 'connected'}
              onRestart={restart}
            />

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
      </div>

      <PresetManager
        open={managerOpen}
        onClose={() => setManagerOpen(false)}
        data={presets}
        onCreate={createPreset}
        onUpdate={updatePreset}
        onDelete={deletePreset}
      />

      <ChatHistoryDrawer
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        items={chatHistory.items}
        onSaveCurrent={() => void saveCurrentHistorySnapshot()}
        onRename={(id: string, title: string) => void chatHistory.rename(id, title)}
        onDelete={(id: string) => void chatHistory.remove(id)}
        onClearAll={() => {
          const ok = window.confirm('Clear all history items?')
          if (!ok) return
          void chatHistory.clearAll()
        }}
      />
    </div>
  )
}
