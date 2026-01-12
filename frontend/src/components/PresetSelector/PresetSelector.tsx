import { useMemo, useState } from 'react'
import type { ChangeEvent } from 'react'
import type { Preset, PresetScope, PresetsResponse } from '../../types/preset'
import styles from '../../App.module.css'

type Option = { preset: Preset; scope: PresetScope }

type Props = {
  data: PresetsResponse
  disabled?: boolean
  onExecute: (id: string, scope: PresetScope) => void
  onArrowUp?: () => void
  onArrowDown?: () => void
  arrowsDisabled?: boolean
}

export default function PresetSelector({ data, disabled, onExecute, onArrowUp, onArrowDown, arrowsDisabled }: Props) {
  const options = useMemo<Option[]>(() => {
    const all: Option[] = []
    for (const p of data.global) all.push({ preset: p, scope: 'global' })
    for (const p of data.project) all.push({ preset: p, scope: 'project' })
    return all
  }, [data.global, data.project])

  const [selected, setSelected] = useState<string>('')

  const selectedOption = useMemo(() => {
    return options.find((o: Option) => `${o.scope}:${o.preset.id}` === selected) || null
  }, [options, selected])

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      <select
        className={styles.input}
        value={selected}
        disabled={disabled}
        onChange={(e: ChangeEvent<HTMLSelectElement>) => setSelected(e.target.value)}
        style={{ minWidth: 240, width: 'min(320px, 70vw)', maxWidth: '100%' }}
      >
        <option value="">Quick actions...</option>
        <optgroup label="Global">
          {data.global.map((p) => (
            <option key={p.id} value={`global:${p.id}`}>
              {p.name}
            </option>
          ))}
        </optgroup>
        <optgroup label="Project">
          {data.project.map((p) => (
            <option key={p.id} value={`project:${p.id}`}>
              {p.name}
            </option>
          ))}
        </optgroup>
      </select>

      <button
        className={`${styles.btn} ${styles.btnPrimary}`}
        disabled={disabled || !selectedOption}
        onClick={() => {
          if (!selectedOption) return
          onExecute(selectedOption.preset.id, selectedOption.scope)
        }}
      >
        Send
      </button>

      <button className={styles.btn} onClick={onArrowUp} disabled={disabled || arrowsDisabled || !onArrowUp}>
        Up
      </button>

      <button className={styles.btn} onClick={onArrowDown} disabled={disabled || arrowsDisabled || !onArrowDown}>
        Down
      </button>
    </div>
  )
}
