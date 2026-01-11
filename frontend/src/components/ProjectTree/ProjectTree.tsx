import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { apiGet } from '../../services/api'
import type { WorkspaceListResponse, WorkspaceNode } from '../../types/workspace'

type Props = {
  selectedPath: string | null
  onSelect: (path: string) => void
}

type ChildrenState = {
  items: WorkspaceNode[]
  loaded: boolean
  loading: boolean
  error: string | null
}

function buildEmptyChildrenState(): ChildrenState {
  return { items: [], loaded: false, loading: false, error: null }
}

export default function ProjectTree({ selectedPath, onSelect }: Props) {
  const [roots, setRoots] = useState<WorkspaceNode[]>([])
  const [rootsLoading, setRootsLoading] = useState(false)
  const [rootsError, setRootsError] = useState<string | null>(null)

  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())
  const [childrenByPath, setChildrenByPath] = useState<Record<string, ChildrenState>>({})

  const fetchRoots = useCallback(async () => {
    setRootsLoading(true)
    setRootsError(null)
    try {
      const res = await apiGet<WorkspaceListResponse>('/api/workspaces')
      setRoots(res.items)
    } catch (e) {
      setRootsError(e instanceof Error ? e.message : String(e))
    } finally {
      setRootsLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchRoots()
  }, [fetchRoots])

  const ensureChildrenLoaded = useCallback(async (path: string) => {
    setChildrenByPath((prev) => {
      const cur = prev[path] ?? buildEmptyChildrenState()
      if (cur.loaded || cur.loading) return prev
      return { ...prev, [path]: { ...cur, loading: true, error: null } }
    })

    try {
      const res = await apiGet<WorkspaceListResponse>(`/api/workspaces/children?path=${encodeURIComponent(path)}`)
      setChildrenByPath((prev) => ({
        ...prev,
        [path]: { items: res.items, loaded: true, loading: false, error: null }
      }))
    } catch (e) {
      setChildrenByPath((prev) => ({
        ...prev,
        [path]: { items: [], loaded: false, loading: false, error: e instanceof Error ? e.message : String(e) }
      }))
    }
  }, [])

  const toggle = useCallback(
    (node: WorkspaceNode) => {
      setExpanded((prev) => {
        const next = new Set(prev)
        if (next.has(node.path)) {
          next.delete(node.path)
        } else {
          next.add(node.path)
        }
        return next
      })

      if (node.has_children) {
        void ensureChildrenLoaded(node.path)
      }
    },
    [ensureChildrenLoaded]
  )

  const nodesToRender = useMemo(() => {
    return roots
  }, [roots])

  const initialAutoExpandRef = useRef(false)
  useEffect(() => {
    if (initialAutoExpandRef.current) return
    if (roots.length === 0) return

    initialAutoExpandRef.current = true

    if (roots.length === 1 && roots[0].has_children) {
      setExpanded((prev) => {
        const next = new Set(prev)
        next.add(roots[0].path)
        return next
      })
      void ensureChildrenLoaded(roots[0].path)
    }
  }, [ensureChildrenLoaded, roots])

  const initialAutoSelectRef = useRef(false)
  useEffect(() => {
    if (initialAutoSelectRef.current) return
    if (selectedPath && selectedPath.trim()) {
      initialAutoSelectRef.current = true
      return
    }
    if (roots.length === 0) return

    initialAutoSelectRef.current = true
    onSelect(roots[0].path)
  }, [onSelect, roots, selectedPath])

  const renderNode = useCallback(
    (node: WorkspaceNode, level: number) => {
      const isExpanded = expanded.has(node.path)
      const children = childrenByPath[node.path] ?? buildEmptyChildrenState()
      const isSelected = selectedPath ? node.path.toLowerCase() === selectedPath.toLowerCase() : false

      return (
        <div key={node.path}>
          <div
            className={`treeRow${isSelected ? ' treeRowSelected' : ''}`}
            style={{ paddingLeft: 8 + level * 14 }}
          >
            <button
              className="treeToggle"
              onClick={() => toggle(node)}
              disabled={!node.has_children}
              aria-label={node.has_children ? (isExpanded ? 'Collapse' : 'Expand') : 'No children'}
              type="button"
            >
              {node.has_children ? (isExpanded ? '-' : '+') : ''}
            </button>

            <button className="treeName" type="button" onClick={() => onSelect(node.path)} title={node.path}>
              {node.name}
            </button>
          </div>

          {isExpanded ? (
            <div>
              {children.loading ? <div className="treeMeta" style={{ paddingLeft: 8 + (level + 1) * 14 }}>Loading...</div> : null}
              {children.error ? (
                <div className="treeMeta" style={{ paddingLeft: 8 + (level + 1) * 14 }}>Error: {children.error}</div>
              ) : null}
              {children.items.map((c) => renderNode(c, level + 1))}
            </div>
          ) : null}
        </div>
      )
    },
    [childrenByPath, expanded, onSelect, selectedPath, toggle]
  )

  return (
    <div className="sidebar card">
      <div className="sidebarHeader">
        <div>Projects</div>
        <button className="btn" type="button" onClick={fetchRoots} disabled={rootsLoading}>
          Refresh
        </button>
      </div>

      <div className="sidebarBody">
        {rootsLoading ? <div className="small">Loading...</div> : null}
        {rootsError ? <div className="small">Error: {rootsError}</div> : null}
        {!rootsLoading && !rootsError && nodesToRender.length === 0 ? <div className="small">No workspaces configured</div> : null}
        {nodesToRender.map((n) => renderNode(n, 0))}
      </div>

      <div className="sidebarFooter small">Selected: {selectedPath || '-'}</div>
    </div>
  )
}
