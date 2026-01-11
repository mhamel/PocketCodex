export type WSInputMessage = {
  type: 'input'
  payload: { data: string }
}

export type WSResizeMessage = {
  type: 'resize'
  payload: { cols: number; rows: number }
}

export type WSSpecialKeyMessage = {
  type: 'special_key'
  payload: { key: string; modifiers: string[] }
}

export type WSPingMessage = {
  type: 'ping'
  payload: Record<string, never>
}

export type WSOutputMessage = {
  type: 'output'
  payload: { data: string }
}

export type WSStatusMessage = {
  type: 'status'
  payload: { status: 'running' | 'stopped' | 'error'; message?: string | null; pid?: number | null }
}

export type WSErrorMessage = {
  type: 'error'
  payload: { code: string; message: string }
}

export type WSPongMessage = {
  type: 'pong'
  payload: Record<string, never>
}

export type WSMessage =
  | WSInputMessage
  | WSResizeMessage
  | WSSpecialKeyMessage
  | WSPingMessage
  | WSOutputMessage
  | WSStatusMessage
  | WSErrorMessage
  | WSPongMessage
