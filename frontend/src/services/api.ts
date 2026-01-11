async function readErrorText(res: Response): Promise<string> {
  const text = await res.text()
  if (!text) return ''

  try {
    const parsed = JSON.parse(text) as { detail?: unknown }
    if (parsed && typeof parsed === 'object' && 'detail' in parsed) {
      const d = (parsed as { detail?: unknown }).detail
      if (typeof d === 'string') return d
    }
  } catch {
    // ignore
  }

  return text
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(path)
  if (!res.ok) {
    const text = await readErrorText(res)
    throw new Error(text || `GET ${path} failed`)
  }
  return (await res.json()) as T
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body)
  })
  if (!res.ok) {
    const text = await readErrorText(res)
    throw new Error(text || `POST ${path} failed`)
  }
  return (await res.json()) as T
}

export async function apiPut<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body)
  })
  if (!res.ok) {
    const text = await readErrorText(res)
    throw new Error(text || `PUT ${path} failed`)
  }
  return (await res.json()) as T
}

export async function apiDelete<T>(path: string): Promise<T> {
  const res = await fetch(path, { method: 'DELETE' })
  if (!res.ok) {
    const text = await readErrorText(res)
    throw new Error(text || `DELETE ${path} failed`)
  }
  return (await res.json()) as T
}
