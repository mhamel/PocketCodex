import styles from '../../App.module.css'

type Props = {
  canRestart: boolean
  onRestart: () => void
}

export default function ControlPanel({ canRestart, onRestart }: Props) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
      <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={onRestart} disabled={!canRestart}>
        Restart
      </button>
    </div>
  )
}
