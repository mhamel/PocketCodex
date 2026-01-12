import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ChatHistoryItem, ChatHistoryListResponse } from '../types/chatHistory'
import { clearHistory, createHistorySnapshot, deleteHistoryItem, fetchHistory, renameHistoryItem } from '../services/chatHistory'

export function useChatHistory(projectPath: string | null) {
  const [data, setData] = useState<ChatHistoryListResponse>({ global: [], project: [] })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetchHistory(projectPath)
      setData(res)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load history')
    } finally {
      setLoading(false)
    }
  }, [projectPath])

  useEffect(() => {
    refresh()
  }, [refresh])

  const items = useMemo(() => {
    return [...data.project, ...data.global]
  }, [data.global, data.project])

  const byId = useMemo(() => {
    const map = new Map<string, ChatHistoryItem>()
    for (const it of items) map.set(it.id, it)
    return map
  }, [items])

  const saveSnapshot = useCallback(
    async (title?: string) => {
      setError(null)
      const scope = projectPath && projectPath.trim() ? 'project' : 'global'
      try {
        await createHistorySnapshot({
          scope,
          title: title ?? null,
          project_path: scope === 'project' ? projectPath : null
        })
      } finally {
        await refresh()
      }
    },
    [projectPath, refresh]
  )

  const rename = useCallback(
    async (id: string, title: string) => {
      setError(null)
      const it = byId.get(id)
      if (!it) return
      const scope = it.project_path ? 'project' : 'global'
      try {
        await renameHistoryItem({ id, scope, title, project_path: it.project_path ?? null })
      } finally {
        await refresh()
      }
    },
    [byId, refresh]
  )

  const remove = useCallback(
    async (id: string) => {
      setError(null)
      const it = byId.get(id)
      if (!it) return
      const scope = it.project_path ? 'project' : 'global'
      try {
        await deleteHistoryItem({ id, scope, project_path: it.project_path ?? null })
      } finally {
        await refresh()
      }
    },
    [byId, refresh]
  )

  const clearAll = useCallback(async () => {
    setError(null)
    try {
      await clearHistory({ scope: 'all', project_path: projectPath ?? null })
    } finally {
      await refresh()
    }
  }, [projectPath, refresh])

  return { items, byId, loading, error, refresh, saveSnapshot, rename, remove, clearAll }
}
