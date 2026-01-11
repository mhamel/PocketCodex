export type WorkspaceNode = {
  path: string
  name: string
  has_children: boolean
}

export type WorkspaceListResponse = {
  items: WorkspaceNode[]
}
