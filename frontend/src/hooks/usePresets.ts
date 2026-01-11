import { useCallback, useEffect, useState } from 'react'
import type { Preset, PresetScope, PresetsResponse } from '../types/preset'
import { apiDelete, apiGet, apiPost, apiPut } from '../services/api'

export function usePresets(projectPath: string | null) {
  const [data, setData] = useState<PresetsResponse>({ global: [], project: [] })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const qp = projectPath ? `?project_path=${encodeURIComponent(projectPath)}` : ''
      const res = await apiGet<PresetsResponse>(`/api/presets${qp}`)
      setData(res)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load presets')
    } finally {
      setLoading(false)
    }
  }, [projectPath])

  useEffect(() => {
    refresh()
  }, [refresh])

  const createPreset = useCallback(
    async (preset: {
      name: string
      description?: string | null
      command: string
      category?: string
      shortcut?: string | null
      scope: PresetScope
    }) => {
      setError(null)
      try {
        const body = {
          ...preset,
          project_path: preset.scope === 'project' ? projectPath : null
        }
        await apiPost('/api/presets', body)
        await refresh()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to create preset')
      }
    },
    [projectPath, refresh]
  )

  const updatePreset = useCallback(
    async (id: string, scope: PresetScope, patch: Partial<Preset>) => {
      setError(null)
      try {
        const qp = new URLSearchParams({ scope })
        if (scope === 'project' && projectPath) qp.set('project_path', projectPath)
        await apiPut(`/api/presets/${encodeURIComponent(id)}?${qp.toString()}`, {
          name: patch.name,
          description: patch.description,
          command: patch.command,
          category: patch.category,
          shortcut: patch.shortcut
        })
        await refresh()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to update preset')
      }
    },
    [projectPath, refresh]
  )

  const deletePreset = useCallback(
    async (id: string, scope: PresetScope) => {
      setError(null)
      try {
        const qp = new URLSearchParams({ scope })
        if (scope === 'project' && projectPath) qp.set('project_path', projectPath)
        await apiDelete(`/api/presets/${encodeURIComponent(id)}?${qp.toString()}`)
        await refresh()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to delete preset')
      }
    },
    [projectPath, refresh]
  )

  const executePreset = useCallback(
    async (id: string, scope: PresetScope) => {
      setError(null)
      try {
        const qp = new URLSearchParams({ scope })
        if (scope === 'project' && projectPath) qp.set('project_path', projectPath)
        await apiPost(`/api/presets/${encodeURIComponent(id)}/execute?${qp.toString()}`, { variables: {} })
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to execute preset')
      }
    },
    [projectPath]
  )

  return {
    data,
    loading,
    error,
    refresh,
    createPreset,
    updatePreset,
    deletePreset,
    executePreset
  }
}
