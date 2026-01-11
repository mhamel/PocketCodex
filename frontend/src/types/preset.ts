export type PresetCategory = 'general' | 'debug' | 'testing' | 'refactor' | 'docs' | 'review' | 'custom'
export type PresetScope = 'global' | 'project'

export type Preset = {
  id: string
  name: string
  description?: string | null
  command: string
  category?: PresetCategory
  shortcut?: string | null
  created_at?: string | null
  updated_at?: string | null
}

export type PresetsResponse = {
  global: Preset[]
  project: Preset[]
}
