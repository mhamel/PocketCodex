import { apiDelete, apiGet, apiPost, apiPut } from './api'
import type { ChatHistoryItem, ChatHistoryListResponse, HistoryScope } from '../types/chatHistory'

export async function fetchHistory(projectPath: string | null): Promise<ChatHistoryListResponse> {
  const qp = projectPath ? `?project_path=${encodeURIComponent(projectPath)}` : ''
  return await apiGet<ChatHistoryListResponse>(`/api/history${qp}`)
}

export async function createHistorySnapshot(input: {
  scope: Exclude<HistoryScope, 'all'>
  title?: string | null
  project_path?: string | null
}): Promise<ChatHistoryItem> {
  const res = await apiPost<{ success: true; item: ChatHistoryItem }>(`/api/history/snapshot`, input)
  return res.item
}

export async function renameHistoryItem(input: {
  id: string
  scope: Exclude<HistoryScope, 'all'>
  title: string
  project_path?: string | null
}): Promise<ChatHistoryItem> {
  const qp = new URLSearchParams({ scope: input.scope })
  if (input.scope === 'project' && input.project_path) qp.set('project_path', input.project_path)
  const res = await apiPut<{ success: true; item: ChatHistoryItem }>(`/api/history/${encodeURIComponent(input.id)}?${qp.toString()}`, {
    title: input.title
  })
  return res.item
}

export async function deleteHistoryItem(input: {
  id: string
  scope: Exclude<HistoryScope, 'all'>
  project_path?: string | null
}): Promise<void> {
  const qp = new URLSearchParams({ scope: input.scope })
  if (input.scope === 'project' && input.project_path) qp.set('project_path', input.project_path)
  await apiDelete(`/api/history/${encodeURIComponent(input.id)}?${qp.toString()}`)
}

export async function clearHistory(input: { scope: HistoryScope; project_path?: string | null }): Promise<void> {
  const qp = new URLSearchParams({ scope: input.scope })
  if (input.project_path) qp.set('project_path', input.project_path)
  await apiDelete(`/api/history?${qp.toString()}`)
}
