import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { WSMessage } from '../types/messages'

export type WebSocketState = 'disconnected' | 'connecting' | 'connected'

function getWsUrl(): string {
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'

  if (import.meta.env.DEV) {
    return `${protocol}://${window.location.hostname}:8000/ws/terminal`
  }

  return `${protocol}://${window.location.host}/ws/terminal`
}

export function useWebSocket(onMessage: (msg: WSMessage) => void) {
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectRef = useRef<number | null>(null)
  const backoffRef = useRef<number>(1000)

  const [state, setState] = useState<WebSocketState>('disconnected')
  const url = useMemo(() => getWsUrl(), [])

  const connect = useCallback(() => {
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      return
    }

    setState('connecting')

    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onopen = () => {
      backoffRef.current = 1000
      setState('connected')
    }

    ws.onclose = () => {
      setState('disconnected')
      wsRef.current = null

      const delay = backoffRef.current
      backoffRef.current = Math.min(backoffRef.current * 2, 30000)

      if (reconnectRef.current) {
        window.clearTimeout(reconnectRef.current)
      }
      reconnectRef.current = window.setTimeout(() => connect(), delay)
    }

    ws.onerror = () => {
      try {
        ws.close()
      } catch {
        // ignore
      }
    }

    ws.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data) as WSMessage
        onMessage(parsed)
      } catch {
        // ignore
      }
    }
  }, [onMessage, url])

  useEffect(() => {
    connect()
    return () => {
      if (reconnectRef.current) {
        window.clearTimeout(reconnectRef.current)
      }
      if (wsRef.current) {
        try {
          wsRef.current.close()
        } catch {
          // ignore
        }
      }
      wsRef.current = null
    }
  }, [connect])

  const send = useCallback((msg: WSMessage) => {
    const ws = wsRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    ws.send(JSON.stringify(msg))
  }, [])

  return { state, send, connect }
}
