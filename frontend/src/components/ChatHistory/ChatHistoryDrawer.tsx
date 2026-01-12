import { useEffect, useMemo, useState } from 'react'
import styles from '../../App.module.css'
import type { ChatHistoryItem } from '../../types/chatHistory'

type Props = {
  open: boolean
  onClose: () => void
  items: ChatHistoryItem[]
  onSaveCurrent: () => void
  onRename: (id: string, title: string) => void
  onDelete: (id: string) => void
  onClearAll: () => void
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

export default function ChatHistoryDrawer({ open, onClose, items, onSaveCurrent, onRename, onDelete, onClearAll }: Props) {
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose, open])

  useEffect(() => {
    if (!open) return
    if (!selectedId && items.length > 0) setSelectedId(items[0].id)
  }, [items, open, selectedId])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return items
    return items.filter((x) => {
      const hay = `${x.title}\n${x.project_path ?? ''}\n${x.transcript}`.toLowerCase()
      return hay.includes(q)
    })
  }, [items, query])

  const selected = useMemo(() => {
    if (!selectedId) return null
    return items.find((x) => x.id === selectedId) || null
  }, [items, selectedId])

  if (!open) return null

  return (
    <div
      className="drawerOverlay"
      onMouseDown={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Chat history"
    >
      <div className="drawerPanel" onMouseDown={(e) => e.stopPropagation()}>
        <div className="drawerHeader">
          <div style={{ fontWeight: 600 }}>History</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={onSaveCurrent}>
              Save current
            </button>
            <button className={styles.btn} onClick={onClose}>
              Close
            </button>
          </div>
        </div>

        <div className="drawerBody">
          <div className="drawerLeft">
            <input
              className={styles.input}
              placeholder="Search..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />

            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button className={styles.btn} onClick={onClearAll} disabled={items.length === 0}>
                Clear all
              </button>
            </div>

            <div className="drawerList">
              {filtered.length === 0 ? <div className={styles.small}>No history</div> : null}

              {filtered.map((it) => {
                const active = selectedId === it.id
                const subtitle = it.project_path ? it.project_path : 'No project'
                return (
                  <button
                    key={it.id}
                    type="button"
                    className={`drawerItem${active ? ' drawerItemActive' : ''}`}
                    onClick={() => setSelectedId(it.id)}
                    title={subtitle}
                  >
                    <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.title}</div>
                    <div className={styles.small} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {subtitle}
                    </div>
                    <div className={styles.small}>{formatDate(it.created_at)}</div>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="drawerRight">
            {!selected ? (
              <div className={styles.small}>Select a history item</div>
            ) : (
              <>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{selected.title}</div>
                    <div className={styles.small}>{selected.project_path ? selected.project_path : 'No project'}</div>
                  </div>

                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <button
                      className={styles.btn}
                      onClick={() => {
                        const nextTitle = window.prompt('Rename', selected.title)
                        if (!nextTitle) return
                        onRename(selected.id, nextTitle)
                      }}
                    >
                      Rename
                    </button>
                    <button
                      className={styles.btn}
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(selected.transcript)
                        } catch {
                          window.prompt('Copy transcript', selected.transcript)
                        }
                      }}
                    >
                      Copy
                    </button>
                    <button
                      className={`${styles.btn} ${styles.btnDanger}`}
                      onClick={() => {
                        const ok = window.confirm('Delete this history item?')
                        if (!ok) return
                        onDelete(selected.id)
                        setSelectedId(null)
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>

                <div className="drawerTranscript">
                  <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{selected.transcript}</pre>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
