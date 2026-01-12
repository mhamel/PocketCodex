import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Terminal as XTermTerminal } from '@xterm/xterm'
import './Mobile.css'
import './App.css'
import type { WSMessage } from './types/messages'
import { useWebSocket } from './hooks/useWebSocket'
import TerminalView from './components/Terminal/Terminal'
import PresetManager from './components/PresetManager/PresetManager'
import { apiGet, apiPost } from './services/api'
import { usePresets } from './hooks/usePresets'
import { useChatHistory } from './hooks/useChatHistory'
import type { PresetScope } from './types/preset'
import type { WorkspaceListResponse, WorkspaceNode } from './types/workspace'
import type { ChatHistoryItem } from './types/chatHistory'

type ProcessStatus = 'running' | 'stopped' | 'error'

type MobileTab = 'terminal' | 'projects' | 'history'

type PresetRow = { id: string; scope: PresetScope; name: string; description?: string | null; category?: string }

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

function parseTabFromPath(pathname: string): MobileTab {
  const p = pathname.toLowerCase()
  if (p.startsWith('/mobile/projects')) return 'projects'
  if (p.startsWith('/mobile/history')) return 'history'
  return 'terminal'
}

function setMobilePath(tab: MobileTab): void {
  const next = tab === 'terminal' ? '/mobile/' : `/mobile/${tab}`
  if (window.location.pathname === next) return
  window.history.pushState({}, '', next)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

export default function MobileApp() {
  const termRef = useRef<XTermTerminal | null>(null)
  const composerRef = useRef<HTMLTextAreaElement | null>(null)
  const composerWrapRef = useRef<HTMLDivElement | null>(null)

  const focusComposer = useCallback(() => {
    try {
      composerRef.current?.focus()
    } catch {
    }
  }, [])

  const [tab, setTab] = useState<MobileTab>(() => parseTabFromPath(window.location.pathname))
  const [menuOpen, setMenuOpen] = useState(false)
  const [quickActionsOpen, setQuickActionsOpen] = useState(false)
  const [managerOpen, setManagerOpen] = useState(false)

  const [composerValue, setComposerValue] = useState('')
  const [composerOffset, setComposerOffset] = useState(0)

  const [processStatus, setProcessStatus] = useState<ProcessStatus>('stopped')
  const [pid, setPid] = useState<number | null>(null)
  const [terminalError, setTerminalError] = useState<string | null>(null)

  const [projectPath, setProjectPath] = useState<string>('')
  const [cwd, setCwd] = useState<string>('')

  const chatHistory = useChatHistory(projectPath.trim() ? projectPath.trim() : null)

  const {
    data: presets,
    loading: presetsLoading,
    error: presetsError,
    createPreset,
    updatePreset,
    deletePreset,
    executePreset
  } = usePresets(projectPath.trim() ? projectPath.trim() : null)

  useEffect(() => {
    const onPop = () => setTab(parseTabFromPath(window.location.pathname))
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const onWsMessage = useCallback(
    (msg: WSMessage) => {
      if (msg.type === 'output') {
        termRef.current?.write(msg.payload.data)
      }
      if (msg.type === 'status') {
        setProcessStatus(msg.payload.status)
        setPid(msg.payload.pid ?? null)
      }
    },
    []
  )

  const { state: wsState, send } = useWebSocket(onWsMessage)

  const onData = useCallback(
    (data: string) => {
      send({ type: 'input', payload: { data } })
    },
    [send]
  )

  const canSendComposer = useMemo(() => {
    return tab === 'terminal' && wsState === 'connected' && processStatus === 'running'
  }, [processStatus, tab, wsState])

  const sendComposer = useCallback(() => {
    if (!canSendComposer) return

    const raw = composerValue
    if (!raw.trim()) return

    const normalized = raw.replace(/\r?\n/g, '\r\n')
    const payload = normalized.endsWith('\r\n') ? normalized : `${normalized}\r\n`
    onData(payload)
    setComposerValue('')

    window.setTimeout(() => {
      try {
        composerRef.current?.focus()
      } catch {
      }
    }, 0)
  }, [canSendComposer, composerValue, onData])

  useEffect(() => {
    const el = composerRef.current
    if (!el) return
    el.style.height = '0px'
    const next = Math.min(el.scrollHeight, 140)
    el.style.height = `${next}px`
  }, [composerValue])

  useEffect(() => {
    if (tab !== 'terminal') {
      setComposerOffset(0)
      return
    }

    const el = composerWrapRef.current
    if (!el) return

    const update = () => {
      try {
        const rect = el.getBoundingClientRect()
        const styles = window.getComputedStyle(el)
        const pb = Number.parseFloat(styles.paddingBottom || '0')
        const next = Math.max(0, Math.ceil(rect.height - pb))
        setComposerOffset(next)
      } catch {
      }
    }

    update()

    const ro = new ResizeObserver(() => update())
    ro.observe(el)
    window.addEventListener('resize', update)

    return () => {
      ro.disconnect()
      window.removeEventListener('resize', update)
    }
  }, [tab])

  const onResize = useCallback(
    (cols: number, rows: number) => {
      send({ type: 'resize', payload: { cols, rows } })
    },
    [send]
  )

  const onTerminalReady = useCallback((term: XTermTerminal) => {
    termRef.current = term
  }, [])

  const [workspaces, setWorkspaces] = useState<WorkspaceNode[]>([])
  const [workspacesLoading, setWorkspacesLoading] = useState(false)
  const [workspacesError, setWorkspacesError] = useState<string | null>(null)

  const refreshWorkspaces = useCallback(async () => {
    setWorkspacesLoading(true)
    setWorkspacesError(null)
    try {
      const res = await apiGet<WorkspaceListResponse>('/api/workspaces')
      setWorkspaces(res.items)
    } catch (e) {
      setWorkspacesError(e instanceof Error ? e.message : String(e))
    } finally {
      setWorkspacesLoading(false)
    }
  }, [])

  useEffect(() => {
    void refreshWorkspaces()
  }, [refreshWorkspaces])

  const onSelectProject = useCallback(
    (path: string) => {
      setProjectPath(path)
      setCwd(path)

      if (processStatus === 'running') {
        const data = buildCdInput(path)
        if (data) send({ type: 'input', payload: { data } })
      }

      setMobilePath('terminal')
      window.setTimeout(() => focusComposer(), 0)
    },
    [focusComposer, processStatus, send]
  )

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
    } catch {
    }

    try {
      await apiPost('/api/terminal/restart', body)
      try {
        termRef.current?.clear()
      } catch {
      }

      setMobilePath('terminal')
      window.setTimeout(() => focusComposer(), 0)
    } catch (e) {
      setTerminalError(getErrorMessage(e))
      setProcessStatus('error')
    }
  }, [cwd, focusComposer, saveCurrentHistorySnapshot])

  const quickActions = useMemo<PresetRow[]>(() => {
    const rows: PresetRow[] = []
    for (const p of presets.global) rows.push({ id: p.id, scope: 'global', name: p.name, description: p.description, category: p.category })
    for (const p of presets.project) rows.push({ id: p.id, scope: 'project', name: p.name, description: p.description, category: p.category })
    return rows
  }, [presets.global, presets.project])

  const [qaQuery, setQaQuery] = useState('')
  const filteredQuickActions = useMemo(() => {
    const q = qaQuery.trim().toLowerCase()
    if (!q) return quickActions
    return quickActions.filter((x) => {
      const hay = `${x.name}\n${x.description ?? ''}\n${x.category ?? ''}\n${x.scope}`.toLowerCase()
      return hay.includes(q)
    })
  }, [qaQuery, quickActions])

  const [historyQuery, setHistoryQuery] = useState('')
  const [historySelectedId, setHistorySelectedId] = useState<string | null>(null)

  useEffect(() => {
    if (tab !== 'history') return
    if (!historySelectedId && chatHistory.items.length > 0) setHistorySelectedId(chatHistory.items[0].id)
  }, [chatHistory.items, historySelectedId, tab])

  const filteredHistory = useMemo(() => {
    const q = historyQuery.trim().toLowerCase()
    if (!q) return chatHistory.items
    return chatHistory.items.filter((x: ChatHistoryItem) => {
      const hay = `${x.title}\n${x.project_path ?? ''}\n${x.transcript}`.toLowerCase()
      return hay.includes(q)
    })
  }, [chatHistory.items, historyQuery])

  const selectedHistory = useMemo(() => {
    if (!historySelectedId) return null
    return chatHistory.items.find((x) => x.id === historySelectedId) || null
  }, [chatHistory.items, historySelectedId])

  return (
    <div className="mobileApp" style={{ ['--mobile-composer-offset' as any]: `${composerOffset}px` }}>
      <div className="mobileTopbar">
        <div className="mobileBrand">WebCodeAI</div>

        <button
          type="button"
          className="mobileSearchBtn"
          onClick={() => {
            setQuickActionsOpen(true)
            setMenuOpen(false)
          }}
        >
          <span>Quick actions</span>
          <span className="mobileSheetItemSecondary">Search</span>
        </button>

        <button
          type="button"
          className="btn"
          onClick={() => {
            setMenuOpen(true)
            setQuickActionsOpen(false)
          }}
        >
          Menu
        </button>
      </div>

      {terminalError ? (
        <div style={{ padding: '0 12px' }}>
          <div className="small">Terminal error: {terminalError}</div>
        </div>
      ) : null}

      {presetsError ? (
        <div style={{ padding: '0 12px' }}>
          <div className="small">Presets error: {presetsError}</div>
        </div>
      ) : null}

      <div className="mobileContent">
        <div className="terminalWrap mobileCard mobileTerminalWrap" id="mobile-terminal-host">
          <TerminalView onData={onData} onResize={onResize} onTerminalReady={onTerminalReady} />
        </div>

        {tab === 'projects' ? (
          <div className="mobileOverlayPage mobileCard" role="dialog" aria-modal="true" aria-label="Projects">
            <div className="mobileOverlayHeader">
              <div style={{ fontWeight: 600 }}>Projects</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn" type="button" onClick={() => void refreshWorkspaces()} disabled={workspacesLoading}>
                  Refresh
                </button>
                <button className="btn" type="button" onClick={() => setMobilePath('terminal')}>
                  Close
                </button>
              </div>
            </div>

            <div className="mobileOverlayBody">
              {workspacesLoading ? <div className="small">Loading...</div> : null}
              {workspacesError ? <div className="small">Error: {workspacesError}</div> : null}

              <div className="mobileList">
                {workspaces.map((w) => {
                  const isSelected = projectPath ? w.path.toLowerCase() === projectPath.toLowerCase() : false
                  return (
                    <button
                      key={w.path}
                      type="button"
                      className="mobileListRow"
                      onClick={() => onSelectProject(w.path)}
                      style={{ background: isSelected ? 'var(--bg-active)' : '#000000' }}
                      title={w.path}
                    >
                      <div className="mobileListRowTitle">{w.name}</div>
                      <div className="mobileListRowMeta">{w.path}</div>
                    </button>
                  )
                })}
              </div>

              <div className="small" style={{ marginTop: 10 }}>
                Selected: {projectPath || '-'}
              </div>
            </div>
          </div>
        ) : null}

        {tab === 'history' ? (
          <div className="mobileOverlayPage mobileCard" role="dialog" aria-modal="true" aria-label="History">
            <div className="mobileOverlayHeader">
              <div style={{ fontWeight: 600 }}>History</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn" type="button" onClick={() => void saveCurrentHistorySnapshot()}>
                  Save
                </button>
                <button className="btn" type="button" onClick={() => setMobilePath('terminal')}>
                  Close
                </button>
              </div>
            </div>

            <div className="mobileOverlayBody" style={{ display: 'grid', gap: 10 }}>
              <input className="input" placeholder="Search..." value={historyQuery} onChange={(e) => setHistoryQuery(e.target.value)} />

              <div className="mobileList">
                {filteredHistory.length === 0 ? <div className="small">No history</div> : null}
                {filteredHistory.map((it) => {
                  const active = historySelectedId === it.id
                  const subtitle = it.project_path ? it.project_path : 'No project'
                  return (
                    <button
                      key={it.id}
                      type="button"
                      className="mobileListRow"
                      onClick={() => setHistorySelectedId(it.id)}
                      style={{ background: active ? 'var(--bg-active)' : '#000000' }}
                      title={subtitle}
                    >
                      <div className="mobileListRowTitle">{it.title}</div>
                      <div className="mobileListRowMeta">{subtitle}</div>
                      <div className="mobileListRowMeta">{formatDate(it.created_at)}</div>
                    </button>
                  )
                })}
              </div>

              {selectedHistory ? (
                <div className="mobileCard" style={{ padding: 12, display: 'grid', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{selectedHistory.title}</div>
                      <div className="small">{selectedHistory.project_path ? selectedHistory.project_path : 'No project'}</div>
                    </div>

                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        className="btn"
                        type="button"
                        onClick={() => {
                          const nextTitle = window.prompt('Rename', selectedHistory.title)
                          if (!nextTitle) return
                          chatHistory.rename(selectedHistory.id, nextTitle)
                        }}
                      >
                        Rename
                      </button>
                      <button
                        className="btn"
                        type="button"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(selectedHistory.transcript)
                          } catch {
                            window.prompt('Copy transcript', selectedHistory.transcript)
                          }
                        }}
                      >
                        Copy
                      </button>
                    </div>
                  </div>

                  <pre className="mobileTranscript">{selectedHistory.transcript}</pre>

                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      className="btn"
                      type="button"
                      onClick={() => {
                        const ok = window.confirm('Delete this history item?')
                        if (!ok) return
                        chatHistory.remove(selectedHistory.id)
                        setHistorySelectedId(null)
                      }}
                    >
                      Delete
                    </button>
                    <button
                      className="btn"
                      type="button"
                      onClick={() => {
                        const ok = window.confirm('Clear all history items?')
                        if (!ok) return
                        chatHistory.clearAll()
                        setHistorySelectedId(null)
                      }}
                    >
                      Clear all
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      {tab === 'terminal' ? (
        <div className="mobileComposer" ref={composerWrapRef} role="group" aria-label="Command input">
          <div className="mobileComposerRow">
            <textarea
              ref={composerRef}
              className="mobileComposerInput"
              placeholder="Type a command..."
              value={composerValue}
              onChange={(e) => setComposerValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== 'Enter') return
                if (e.shiftKey) return
                if (!canSendComposer) return
                e.preventDefault()
                sendComposer()
              }}
              rows={1}
            />

            <button className="mobileComposerSend" type="button" onClick={sendComposer} disabled={!canSendComposer || !composerValue.trim()}>
              Send
            </button>
          </div>
        </div>
      ) : null}

      {quickActionsOpen ? (
        <div className="mobileSheetOverlay" onMouseDown={() => setQuickActionsOpen(false)} role="dialog" aria-modal="true" aria-label="Quick actions">
          <div className="mobileSheet" onMouseDown={(e) => e.stopPropagation()}>
            <div className="mobileSheetHeader">
              <div className="mobileSheetTitle">Quick actions</div>
              <button className="btn" type="button" onClick={() => setQuickActionsOpen(false)}>
                Close
              </button>
            </div>

            <div className="mobileList">
              <input className="input" placeholder="Search actions..." value={qaQuery} onChange={(e) => setQaQuery(e.target.value)} />

              <button
                type="button"
                className="mobileSheetItem"
                onClick={() => {
                  setQuickActionsOpen(false)
                  setManagerOpen(true)
                }}
                disabled={presetsLoading}
              >
                Manage presets
              </button>

              {filteredQuickActions.map((a) => (
                <button
                  key={`${a.scope}:${a.id}`}
                  type="button"
                  className="mobileSheetItem"
                  onClick={async () => {
                    await executePreset(a.id, a.scope)
                    setQuickActionsOpen(false)
                    window.setTimeout(() => focusComposer(), 0)
                  }}
                  disabled={wsState !== 'connected' || processStatus !== 'running' || presetsLoading}
                >
                  <div style={{ fontWeight: 600 }}>{a.name}</div>
                  <div className="mobileSheetItemSecondary">{a.scope}</div>
                </button>
              ))}

              {filteredQuickActions.length === 0 ? <div className="small">No actions</div> : null}
            </div>
          </div>
        </div>
      ) : null}

      {menuOpen ? (
        <div className="mobileSheetOverlay" onMouseDown={() => setMenuOpen(false)} role="dialog" aria-modal="true" aria-label="Menu">
          <div className="mobileSheet" onMouseDown={(e) => e.stopPropagation()}>
            <div className="mobileSheetHeader">
              <div className="mobileSheetTitle">Menu</div>
              <button className="btn" type="button" onClick={() => setMenuOpen(false)}>
                Close
              </button>
            </div>

            <div className="mobileList">
              <div className="small">WebSocket: {wsState}</div>
              <div className="small">Process: {processStatus}{pid ? ` (PID ${pid})` : ''}</div>
              <div className="small">Project: {projectPath || '-'}</div>

              <button
                type="button"
                className="mobileSheetItem"
                onClick={async () => {
                  setMenuOpen(false)
                  await restart()
                }}
                disabled={wsState !== 'connected'}
              >
                Restart
              </button>

              <button
                type="button"
                className="mobileSheetItem"
                onClick={async () => {
                  setMenuOpen(false)
                  await saveCurrentHistorySnapshot()
                }}
              >
                Save current to history
              </button>

              <button
                type="button"
                className="mobileSheetItem"
                onClick={() => {
                  setMenuOpen(false)
                  setMobilePath('history')
                }}
              >
                History
              </button>

              <button
                type="button"
                className="mobileSheetItem"
                onClick={() => {
                  setMenuOpen(false)
                  setMobilePath('projects')
                }}
              >
                Projects
              </button>

              <button
                type="button"
                className="mobileSheetItem"
                onClick={() => {
                  setMenuOpen(false)
                  setManagerOpen(true)
                }}
              >
                Actions
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <PresetManager
        open={managerOpen}
        onClose={() => {
          setManagerOpen(false)
          window.setTimeout(() => focusComposer(), 0)
        }}
        data={presets}
        onCreate={createPreset}
        onUpdate={updatePreset}
        onDelete={deletePreset}
      />
    </div>
  )
}
