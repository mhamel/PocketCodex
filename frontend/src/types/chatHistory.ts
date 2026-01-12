export type ChatHistoryItem = {
  id: string
  title: string
  project_path?: string | null
  created_at: string
  updated_at: string
  transcript: string
}

export type HistoryScope = 'global' | 'project' | 'all'

export type ChatHistoryListResponse = {
  global: ChatHistoryItem[]
  project: ChatHistoryItem[]
}
