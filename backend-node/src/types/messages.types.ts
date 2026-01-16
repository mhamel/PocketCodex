export interface InputPayload {
  data: string;
}

export interface InputMessage {
  type: 'input';
  payload: InputPayload;
}

export interface ResizePayload {
  cols: number;
  rows: number;
}

export interface ResizeMessage {
  type: 'resize';
  payload: ResizePayload;
}

export interface SpecialKeyPayload {
  key: string;
  modifiers: string[];
}

export interface SpecialKeyMessage {
  type: 'special_key';
  payload: SpecialKeyPayload;
}

export interface PingMessage {
  type: 'ping';
  payload: Record<string, never>;
}

export interface OutputPayload {
  data: string;
}

export interface OutputMessage {
  type: 'output';
  payload: OutputPayload;
}

export interface StatusPayload {
  status: 'running' | 'stopped' | 'error';
  message: string | null;
  pid: number | null;
}

export interface StatusMessage {
  type: 'status';
  payload: StatusPayload;
}

export interface ErrorPayload {
  code: string;
  message: string;
}

export interface ErrorMessage {
  type: 'error';
  payload: ErrorPayload;
}

export interface PongMessage {
  type: 'pong';
  payload: Record<string, never>;
}

export type WSMessage =
  | InputMessage
  | ResizeMessage
  | SpecialKeyMessage
  | PingMessage
  | OutputMessage
  | StatusMessage
  | ErrorMessage
  | PongMessage;
