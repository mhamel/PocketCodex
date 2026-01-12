import { useCallback, useEffect, useRef, useState } from 'react'
import { apiGet } from '../../services/api'
import type { WorkspaceListResponse, WorkspaceNode } from '../../types/workspace'

type Props = {
  selectedPath: string | null
  onSelect: (path: string) => void
}

export default function ProjectTree({ selectedPath, onSelect }: Props) {
  const [roots, setRoots] = useState<WorkspaceNode[]>([])
  const [rootsLoading, setRootsLoading] = useState(false)
  const [rootsError, setRootsError] = useState<string | null>(null)

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

  const nodesToRender = roots

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
        {nodesToRender.map((n) => {
          const isSelected = selectedPath ? n.path.toLowerCase() === selectedPath.toLowerCase() : false
          return (
            <div key={n.path}>
              <div className={`treeRow${isSelected ? ' treeRowSelected' : ''}`} style={{ paddingLeft: 8 }}>
                <button className="treeName" type="button" onClick={() => onSelect(n.path)} title={n.path}>
                  {n.name}
                </button>
              </div>
            </div>
          )
        })}
      </div>

      <div className="sidebarFooter small">Selected: {selectedPath || '-'}</div>
    </div>
  )
}
