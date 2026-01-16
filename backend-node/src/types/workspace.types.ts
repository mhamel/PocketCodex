export interface WorkspaceItem {
  name: string;
  path: string;
}

export interface WorkspaceListResponse {
  items: WorkspaceItem[];
}

export interface WorkspaceChildrenResponse {
  items: WorkspaceItem[];
  parent: string;
}
