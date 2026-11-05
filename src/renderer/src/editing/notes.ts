import { useEditStore } from '../store/useEditStore'
import { removeObjects } from './history'

/** Closes a sticky note popup; empty notes are discarded. */
export function closeNote(id: string | null = useEditStore.getState().openNoteId): void {
  if (!id) return
  const note = useEditStore.getState().objects.find((o) => o.id === id)
  useEditStore.getState().setOpenNote(null)
  if (note?.kind === 'note' && note.text.trim() === '') removeObjects([id])
}
