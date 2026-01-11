import styles from '../../App.module.css'

type Props = {
  canStart: boolean
  canStop: boolean
  onStart: () => void
  onStop: () => void
}

export default function ControlPanel({ canStart, canStop, onStart, onStop }: Props) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
      <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={onStart} disabled={!canStart}>
        Start
      </button>
      <button className={`${styles.btn} ${styles.btnDanger}`} onClick={onStop} disabled={!canStop}>
        Stop
      </button>
    </div>
  )
}
