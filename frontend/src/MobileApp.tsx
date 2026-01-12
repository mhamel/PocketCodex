import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import type { Terminal as XTermTerminal } from '@xterm/xterm'
import './Mobile.css'
import './App.css'
import type { WSMessage } from './types/messages'
import { useWebSocket } from './hooks/useWebSocket'
import TerminalView, { type TerminalHandle } from './components/Terminal/Terminal'
import { apiGet, apiPost } from './services/api'
import type { WorkspaceListResponse, WorkspaceNode } from './types/workspace'
import Login from './components/Login/Login'

type ProcessStatus = 'running' | 'stopped' | 'error'

const AUTH_TOKEN_KEY = 'webcodeai_token'

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  return String(err)
}

export default function MobileApp() {
  const [authToken, setAuthToken] = useState<string | null>(() => {
    return localStorage.getItem(AUTH_TOKEN_KEY)
  })

  const handleLoginSuccess = useCallback((token: string) => {
    localStorage.setItem(AUTH_TOKEN_KEY, token)
    setAuthToken(token)
  }, [])

  const handleLogout = useCallback(() => {
    localStorage.removeItem(AUTH_TOKEN_KEY)
    setAuthToken(null)
  }, [])

  if (!authToken) {
    return <Login onLoginSuccess={handleLoginSuccess} />
  }

  return <MainApp onLogout={handleLogout} />
}

function MainApp({ onLogout }: { onLogout: () => void }) {
  const termRef = useRef<XTermTerminal | null>(null)
  const terminalHandleRef = useRef<TerminalHandle | null>(null)
  const restartInFlightRef = useRef(false)

  const [projectPickerOpen, setProjectPickerOpen] = useState(false)

  const [processStatus, setProcessStatus] = useState<ProcessStatus>('stopped')
  const [pid, setPid] = useState<number | null>(null)
  const [terminalError, setTerminalError] = useState<string | null>(null)

  const [projectPath, setProjectPath] = useState<string>('')

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

  const { send } = useWebSocket(onWsMessage)

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

  // Fetch current terminal status on mount to get the current project
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const status = await apiGet<{ status: string; pid?: number; cwd?: string | null }>('/api/terminal/status')
        if (status.cwd) {
          setProjectPath(status.cwd)
        }
        if (status.status === 'running' || status.status === 'stopped') {
          setProcessStatus(status.status)
        }
        if (status.pid) {
          setPid(status.pid)
        }
      } catch {
        // Ignore errors on initial fetch
      }
    }
    void fetchStatus()
  }, [])

  const onSelectProject = useCallback(
    async (path: string) => {
      setProjectPath(path)
      setProjectPickerOpen(false)

      if (restartInFlightRef.current) return
      restartInFlightRef.current = true
      setTerminalError(null)

      try {
        termRef.current?.reset()
      } catch {}

      try {
        const body = { cwd: path }
        const info = await apiPost<{ status?: ProcessStatus; pid?: number | null }>('/api/terminal/restart', body)
        if (info?.status) setProcessStatus(info.status)
        if ('pid' in (info || {})) setPid(info?.pid ?? null)
      } catch (e) {
        setTerminalError(getErrorMessage(e))
        setProcessStatus('error')
      } finally {
        restartInFlightRef.current = false
      }
    },
    []
  )

  const projectName = useMemo(() => {
    if (!projectPath.trim()) return null
    return projectPath.replace(/\\+$/g, '').split(/\\|\//).filter(Boolean).slice(-1)[0] || null
  }, [projectPath])

  const sendArrowUp = useCallback(() => {
    send({ type: 'input', payload: { data: '\x1b[A' } })
  }, [send])

  const sendArrowDown = useCallback(() => {
    send({ type: 'input', payload: { data: '\x1b[B' } })
  }, [send])

  const sendEnter = useCallback(() => {
    send({ type: 'input', payload: { data: '\r' } })
  }, [send])

  const sendEscape = useCallback(() => {
    send({ type: 'input', payload: { data: '\x1b' } })
  }, [send])

  const handleRefresh = useCallback(() => {
    terminalHandleRef.current?.refresh(onData)
  }, [onData])

  const [keyboardOffset, setKeyboardOffset] = useState(0)

  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return

    const updateOffset = () => {
      const offset = window.innerHeight - vv.height
      setKeyboardOffset(offset > 0 ? offset : 0)
    }

    updateOffset()
    vv.addEventListener('resize', updateOffset)
    vv.addEventListener('scroll', updateOffset)

    return () => {
      vv.removeEventListener('resize', updateOffset)
      vv.removeEventListener('scroll', updateOffset)
    }
  }, [])

  const mobileContentStyle: CSSProperties | undefined = keyboardOffset
    ? { paddingBottom: `calc(env(safe-area-inset-bottom) + 72px + ${keyboardOffset}px)` }
    : undefined

  return (
    <div className="mobileApp">
      <div className="mobileTopbar">
        <button
          type="button"
          className="mobileProjectBtn"
          onClick={() => {
            setProjectPickerOpen(true)
            void refreshWorkspaces()
          }}
        >
          {projectName || 'Select project'}
        </button>
        <button
          type="button"
          className="mobileLogoutBtn"
          onClick={onLogout}
          title="Logout"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
        </button>
      </div>

      {terminalError ? (
        <div style={{ padding: '0 12px' }}>
          <div className="small">Terminal error: {terminalError}</div>
        </div>
      ) : null}

      <div className="mobileContent" style={mobileContentStyle}>
        <div className="terminalWrap mobileCard mobileTerminalWrap" id="mobile-terminal-host">
          <TerminalView ref={terminalHandleRef} onData={onData} onResize={onResize} onTerminalReady={onTerminalReady} autoFocus={true} />
        </div>
      </div>

      <div className="mobileNavArrows" style={{ bottom: keyboardOffset }}>
        <button type="button" className="mobileNavArrowBtn" onClick={handleRefresh} aria-label="Refresh">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10"/>
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
          </svg>
        </button>
        <button type="button" className="mobileNavArrowBtn" onClick={sendEscape} aria-label="Escape">
          <span style={{ fontSize: 12, fontWeight: 600 }}>ESC</span>
        </button>
        <button type="button" className="mobileNavArrowBtn" onClick={sendArrowUp} aria-label="Arrow up">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 15l-6-6-6 6"/>
          </svg>
        </button>
        <button type="button" className="mobileNavArrowBtn" onClick={sendArrowDown} aria-label="Arrow down">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 9l6 6 6-6"/>
          </svg>
        </button>
        <button type="button" className="mobileNavArrowBtn" onClick={sendEnter} aria-label="Enter">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 10l-5 5 5 5"/>
            <path d="M20 4v7a4 4 0 0 1-4 4H4"/>
          </svg>
        </button>
      </div>

      {projectPickerOpen ? (
        <div className="mobileSheetOverlay" onMouseDown={() => setProjectPickerOpen(false)} role="dialog" aria-modal="true" aria-label="Select project">
          <div className="mobileSheet" onMouseDown={(e) => e.stopPropagation()}>
            <div className="mobileSheetHeader">
              <div className="mobileSheetTitle">Select project</div>
              <button className="btn" type="button" onClick={() => setProjectPickerOpen(false)}>
                Close
              </button>
            </div>

            <div className="mobileSheetBody">
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
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
