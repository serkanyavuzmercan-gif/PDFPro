import { create } from 'zustand'

export interface SignatureResult {
  bytes: Uint8Array
  src: string
  width: number
  height: number
}

export type DialogSpec =
  | {
      type: 'confirm'
      titleKey: string
      messageKey: string
      params?: Record<string, string>
      confirmKey: string
      danger?: boolean
    }
  | { type: 'unsaved'; name: string }
  | { type: 'pageRange'; titleKey: string; confirmKey: string; initial: string; pageCount: number }
  | { type: 'split'; pageCount: number }
  | { type: 'signature' }

export type DialogResult<S extends DialogSpec> = S extends { type: 'confirm' }
  ? boolean
  : S extends { type: 'unsaved' }
    ? 'save' | 'discard' | 'cancel'
    : S extends { type: 'pageRange' }
      ? number[] | null
      : S extends { type: 'split' }
        ? number[][] | null
        : SignatureResult | null

interface DialogState {
  current: { id: number; spec: DialogSpec; resolve: (value: unknown) => void } | null
}

export const useDialogStore = create<DialogState>(() => ({ current: null }))

let nextId = 1
const cancelValue = (spec: DialogSpec): unknown =>
  spec.type === 'confirm' ? false : spec.type === 'unsaved' ? 'cancel' : null

export function openDialog<S extends DialogSpec>(spec: S): Promise<DialogResult<S>> {
  const previous = useDialogStore.getState().current
  if (previous) closeDialog(cancelValue(previous.spec))
  return new Promise((resolve) => {
    useDialogStore.setState({
      current: { id: nextId++, spec, resolve: resolve as (value: unknown) => void }
    })
  })
}

export function closeDialog(value: unknown): void {
  const current = useDialogStore.getState().current
  useDialogStore.setState({ current: null })
  current?.resolve(value)
}

export const isDialogOpen = (): boolean => useDialogStore.getState().current !== null

/**
 * Parses "1-3, 5, 8-" into sorted unique 0-based page indices.
 * Returns null when any part is invalid or out of range.
 */
export function parsePageRanges(input: string, pageCount: number): number[] | null {
  const groups = parsePageGroups(input, pageCount)
  if (!groups) return null
  return [...new Set(groups.flat())].sort((a, b) => a - b)
}

/** Parses comma-separated ranges, keeping each range as its own group (used for splitting). */
export function parsePageGroups(input: string, pageCount: number): number[][] | null {
  const parts = input
    .split(/[,;]/)
    .map((p) => p.trim())
    .filter(Boolean)
  if (parts.length === 0) return null
  const groups: number[][] = []
  for (const part of parts) {
    const match = /^(\d+)?\s*(-)?\s*(\d+)?$/.exec(part)
    if (!match || (!match[1] && !match[3])) return null
    const from = match[1] ? Number(match[1]) : 1
    const to = match[2] ? (match[3] ? Number(match[3]) : pageCount) : from
    if (from < 1 || to > pageCount || from > to) return null
    groups.push(Array.from({ length: to - from + 1 }, (_, i) => from - 1 + i))
  }
  return groups
}

/** Formats 1-based pages as a compact range string, e.g. [1,2,3,5] -> "1-3, 5". */
export function formatPageRanges(pages: number[]): string {
  const sorted = [...new Set(pages)].sort((a, b) => a - b)
  const parts: string[] = []
  let start = sorted[0]
  let prev = sorted[0]
  for (const page of [...sorted.slice(1), Number.NaN]) {
    if (page === prev + 1) {
      prev = page
      continue
    }
    if (start !== undefined) parts.push(start === prev ? `${start}` : `${start}-${prev}`)
    start = page
    prev = page
  }
  return parts.join(', ')
}
