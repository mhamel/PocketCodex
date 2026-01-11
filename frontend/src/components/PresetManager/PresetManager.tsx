import { useMemo, useState } from 'react'
import type { ChangeEvent, MouseEvent } from 'react'
import type { Preset, PresetScope, PresetsResponse } from '../../types/preset'
import styles from '../../App.module.css'

type Props = {
  open: boolean
  onClose: () => void
  data: PresetsResponse
  onCreate: (payload: {
    name: string
    description?: string | null
    command: string
    category?: string
    shortcut?: string | null
    scope: PresetScope
  }) => void
  onUpdate: (id: string, scope: PresetScope, patch: Partial<Preset>) => void
  onDelete: (id: string, scope: PresetScope) => void
}

type Row = { preset: Preset; scope: PresetScope }

export default function PresetManager({ open, onClose, data, onCreate, onUpdate, onDelete }: Props) {
  const rows = useMemo<Row[]>(() => {
    const out: Row[] = []
    for (const p of data.global) out.push({ preset: p, scope: 'global' })
    for (const p of data.project) out.push({ preset: p, scope: 'project' })
    return out
  }, [data.global, data.project])

  const [scope, setScope] = useState<PresetScope>('global')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [command, setCommand] = useState('')
  const [category, setCategory] = useState('general')
  const [shortcut, setShortcut] = useState('')

  if (!open) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.9)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16
      }}
      onMouseDown={onClose}
    >
      <div
        className={styles.card}
        style={{ width: 'min(1000px, 95vw)', maxHeight: '85vh', overflow: 'auto', padding: 16 }}
        onMouseDown={(e: MouseEvent<HTMLDivElement>) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ fontWeight: 600 }}>Preset Manager</div>
          <button className={styles.btn} onClick={onClose}>
            Close
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
          <div>
            <div className={styles.small} style={{ marginBottom: 6 }}>
              Create preset
            </div>

            <div style={{ display: 'grid', gap: 10 }}>
              <select
                className={styles.input}
                value={scope}
                onChange={(e: ChangeEvent<HTMLSelectElement>) => setScope(e.target.value as PresetScope)}
              >
                <option value="global">Global</option>
                <option value="project">Project</option>
              </select>
              <input
                className={styles.input}
                value={name}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
                placeholder="Name"
              />
              <input
                className={styles.input}
                value={description}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setDescription(e.target.value)}
                placeholder="Description (optional)"
              />
              <input
                className={styles.input}
                value={category}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setCategory(e.target.value)}
                placeholder="Category (general/debug/testing/refactor/docs/review/custom)"
              />
              <input
                className={styles.input}
                value={shortcut}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setShortcut(e.target.value)}
                placeholder="Shortcut (optional, e.g. Ctrl+1)"
              />
              <textarea
                className={styles.input}
                value={command}
                onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setCommand(e.target.value)}
                placeholder="Command"
                rows={6}
                style={{ resize: 'vertical' }}
              />

              <button
                className={`${styles.btn} ${styles.btnPrimary}`}
                onClick={() => {
                  if (!name.trim() || !command.trim()) return
                  onCreate({
                    scope,
                    name: name.trim(),
                    description: description.trim() || null,
                    command,
                    category,
                    shortcut: shortcut.trim() || null
                  })
                  setName('')
                  setDescription('')
                  setCommand('')
                  setShortcut('')
                }}
              >
                Create
              </button>
            </div>
          </div>

          <div>
            <div className={styles.small} style={{ marginBottom: 6 }}>
              Existing presets
            </div>

            <div style={{ display: 'grid', gap: 10 }}>
              {rows.length === 0 ? <div className={styles.small}>No presets</div> : null}

              {rows.map(({ preset, scope }: Row) => (
                <div
                  key={`${scope}:${preset.id}`}
                  style={{
                    border: `1px solid var(--border-subtle)`,
                    borderRadius: 0,
                    padding: 12,
                    background: '#000000'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{preset.name}</div>
                      <div className={styles.small}>{scope}</div>
                      {preset.description ? <div className={styles.small}>{preset.description}</div> : null}
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <button
                        className={styles.btn}
                        onClick={() => {
                          const newName = window.prompt('New name', preset.name)
                          if (!newName) return
                          onUpdate(preset.id, scope, { name: newName })
                        }}
                      >
                        Rename
                      </button>
                      <button className={`${styles.btn} ${styles.btnDanger}`} onClick={() => onDelete(preset.id, scope)}>
                        Delete
                      </button>
                    </div>
                  </div>

                  <div className={styles.small} style={{ marginTop: 8 }}>
                    {preset.shortcut ? `Shortcut: ${preset.shortcut}` : 'No shortcut'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
