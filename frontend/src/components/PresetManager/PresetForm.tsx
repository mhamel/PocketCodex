import { useState } from 'react'
import type { ChangeEvent } from 'react'
import type { PresetScope } from '../../types/preset'
import styles from '../../App.module.css'

type Props = {
  onCreate: (payload: {
    name: string
    description?: string | null
    command: string
    category?: string
    shortcut?: string | null
    scope: PresetScope
  }) => void
}

export default function PresetForm({ onCreate }: Props) {
  const [scope, setScope] = useState<PresetScope>('global')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [command, setCommand] = useState('')
  const [category, setCategory] = useState('general')
  const [shortcut, setShortcut] = useState('')

  return (
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
  )
}
