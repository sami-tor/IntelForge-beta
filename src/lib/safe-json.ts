export function safeJsonParse<T = any>(json: string, defaultValue: T | null = null): T | null {
  if (!json || typeof json !== 'string') {
    return defaultValue
  }

  try {
    const parsed = JSON.parse(json, (key, value) => {
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
        return undefined
      }
      return value
    })

    if (parsed && typeof parsed === 'object') {
      if ('__proto__' in parsed) {
        delete (parsed as any).__proto__
      }
      if ('constructor' in parsed && (parsed as any).constructor?.prototype) {
        delete (parsed as any).constructor
      }
    }

    return parsed as T
  } catch {
    return defaultValue
  }
}

