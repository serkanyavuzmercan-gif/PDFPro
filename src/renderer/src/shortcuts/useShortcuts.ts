import { useEffect } from 'react'
import { actions, getAction, runAction, type ActionId } from '../actions/actions'

interface ParsedShortcut {
  id: ActionId
  ctrl: boolean
  shift: boolean
  alt: boolean
  key: string
}

const KEY_ALIASES: Record<string, string> = { '+': '=', add: '=', subtract: '-', _: '-' }

function normalizeKey(key: string): string {
  const lower = key.toLowerCase()
  return KEY_ALIASES[lower] ?? lower
}

const isSymbol = (key: string): boolean => key.length === 1 && !/[a-z0-9]/i.test(key)

const parsed: ParsedShortcut[] = (Object.keys(actions) as ActionId[]).flatMap((id) => {
  const shortcut = getAction(id).shortcut
  if (!shortcut) return []
  const parts = shortcut.split('+')
  // "Ctrl+=" splits into ["Ctrl", "="]; a trailing "+" key would produce an empty part.
  const key = parts.pop() || '+'
  return [
    {
      id,
      ctrl: parts.includes('Ctrl'),
      shift: parts.includes('Shift'),
      alt: parts.includes('Alt'),
      key: normalizeKey(key)
    }
  ]
})

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
}

export function findShortcut(event: KeyboardEvent): ActionId | null {
  const ctrl = event.ctrlKey || event.metaKey
  const key = normalizeKey(event.key)
  const candidates = parsed.filter((s) => s.key === key && s.ctrl === ctrl && s.alt === event.altKey)
  const exact = candidates.find((s) => s.shift === event.shiftKey)
  if (exact) return exact.id
  // Symbols like "=" need Shift on many layouts (e.g. Turkish Q), so be lenient there.
  return isSymbol(key) ? (candidates.find((s) => !s.shift)?.id ?? null) : null
}

export function useShortcuts(): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.repeat && !['pagedown', 'pageup'].includes(event.key.toLowerCase())) return
      const hasModifier = event.ctrlKey || event.metaKey || event.altKey
      if (isTypingTarget(event.target) && !hasModifier) return
      const id = findShortcut(event)
      if (!id) return
      event.preventDefault()
      runAction(id)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}
