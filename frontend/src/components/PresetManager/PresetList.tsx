import type { Preset, PresetScope } from '../../types/preset'
import styles from '../../App.module.css'

type Row = { preset: Preset; scope: PresetScope }

type Props = {
  rows: Row[]
  onUpdate: (id: string, scope: PresetScope, patch: Partial<Preset>) => void
  onDelete: (id: string, scope: PresetScope) => void
}

export default function PresetList({ rows, onUpdate, onDelete }: Props) {
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {rows.length === 0 ? <div className={styles.small}>No presets</div> : null}

      {rows.map(({ preset, scope }) => (
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
  )
}
