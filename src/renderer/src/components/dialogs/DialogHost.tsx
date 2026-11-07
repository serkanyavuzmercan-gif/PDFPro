import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DialogButton, Modal } from './Modal'
import { PrintDialog } from './PrintDialog'
import { SignatureDialog } from './SignatureDialog'
import {
  closeDialog,
  parsePageGroups,
  parsePageRanges,
  useDialogStore,
  type DialogSpec
} from './dialogStore'

function ConfirmDialog({ spec }: { spec: Extract<DialogSpec, { type: 'confirm' }> }): JSX.Element {
  const { t } = useTranslation()
  return (
    <Modal
      title={t(spec.titleKey)}
      onCancel={() => closeDialog(false)}
      footer={
        <>
          <DialogButton onClick={() => closeDialog(false)}>{t('common.cancel')}</DialogButton>
          <DialogButton variant={spec.danger ? 'danger' : 'primary'} autoFocus onClick={() => closeDialog(true)}>
            {t(spec.confirmKey)}
          </DialogButton>
        </>
      }
    >
      <p>{t(spec.messageKey, spec.params)}</p>
    </Modal>
  )
}

function UnsavedDialog({ spec }: { spec: Extract<DialogSpec, { type: 'unsaved' }> }): JSX.Element {
  const { t } = useTranslation()
  return (
    <Modal
      title={t('dialogs.unsaved.title')}
      onCancel={() => closeDialog('cancel')}
      footer={
        <>
          <DialogButton onClick={() => closeDialog('cancel')}>{t('common.cancel')}</DialogButton>
          <DialogButton variant="danger" onClick={() => closeDialog('discard')}>
            {t('dialogs.unsaved.discard')}
          </DialogButton>
          <DialogButton variant="primary" autoFocus onClick={() => closeDialog('save')}>
            {t('tools.save')}
          </DialogButton>
        </>
      }
    >
      <p>{t('dialogs.unsaved.message', { name: spec.name })}</p>
    </Modal>
  )
}

function PageRangeDialog({ spec }: { spec: Extract<DialogSpec, { type: 'pageRange' }> }): JSX.Element {
  const { t } = useTranslation()
  const [value, setValue] = useState(spec.initial)
  const pages = parsePageRanges(value, spec.pageCount)
  const submit = (): void => {
    if (pages && pages.length > 0) closeDialog(pages)
  }

  return (
    <Modal
      title={t(spec.titleKey)}
      onCancel={() => closeDialog(null)}
      footer={
        <>
          <DialogButton onClick={() => closeDialog(null)}>{t('common.cancel')}</DialogButton>
          <DialogButton variant="primary" disabled={!pages || pages.length === 0} onClick={submit}>
            {t(spec.confirmKey)}
          </DialogButton>
        </>
      }
    >
      <label className="flex flex-col gap-1.5">
        <span>{t('dialogs.pageRange.label', { count: spec.pageCount })}</span>
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          className="rounded border border-chrome-border px-2 py-1.5 outline-none focus:border-brand"
          placeholder="1-3, 5"
        />
        <span className={pages ? 'text-ink-muted' : 'text-brand'}>
          {pages ? t('dialogs.pageRange.selected', { count: pages.length }) : t('dialogs.pageRange.invalid')}
        </span>
      </label>
    </Modal>
  )
}

function SplitDialog({ spec }: { spec: Extract<DialogSpec, { type: 'split' }> }): JSX.Element {
  const { t } = useTranslation()
  const [mode, setMode] = useState<'every' | 'ranges'>('every')
  const [every, setEvery] = useState('1')
  const [ranges, setRanges] = useState('')

  const groups = ((): number[][] | null => {
    if (mode === 'ranges') return parsePageGroups(ranges, spec.pageCount)
    const n = Number.parseInt(every, 10)
    if (!Number.isFinite(n) || n < 1) return null
    const result: number[][] = []
    for (let start = 0; start < spec.pageCount; start += n) {
      result.push(Array.from({ length: Math.min(n, spec.pageCount - start) }, (_, i) => start + i))
    }
    return result
  })()

  return (
    <Modal
      title={t('dialogs.split.title')}
      onCancel={() => closeDialog(null)}
      footer={
        <>
          <DialogButton onClick={() => closeDialog(null)}>{t('common.cancel')}</DialogButton>
          <DialogButton variant="primary" disabled={!groups || groups.length === 0} onClick={() => closeDialog(groups)}>
            {t('dialogs.split.confirm')}
          </DialogButton>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <label className="flex items-center gap-2">
          <input type="radio" checked={mode === 'every'} onChange={() => setMode('every')} className="accent-brand" />
          <span>{t('dialogs.split.every')}</span>
          <input
            type="number"
            min={1}
            max={spec.pageCount}
            value={every}
            disabled={mode !== 'every'}
            onChange={(e) => setEvery(e.target.value)}
            className="w-16 rounded border border-chrome-border px-2 py-1 outline-none focus:border-brand disabled:bg-chrome"
          />
          <span>{t('dialogs.split.pages')}</span>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="flex items-center gap-2">
            <input type="radio" checked={mode === 'ranges'} onChange={() => setMode('ranges')} className="accent-brand" />
            {t('dialogs.split.ranges')}
          </span>
          <input
            value={ranges}
            disabled={mode !== 'ranges'}
            onChange={(e) => setRanges(e.target.value)}
            placeholder="1-3, 4-6, 7-"
            className="rounded border border-chrome-border px-2 py-1.5 outline-none focus:border-brand disabled:bg-chrome"
          />
        </label>
        <span className={groups ? 'text-ink-muted' : 'text-brand'}>
          {groups
            ? t('dialogs.split.result', { count: groups.length, pageCount: spec.pageCount })
            : t('dialogs.pageRange.invalid')}
        </span>
      </div>
    </Modal>
  )
}

export function DialogHost(): JSX.Element | null {
  const current = useDialogStore((s) => s.current)
  if (!current) return null
  const { spec } = current
  // Keyed so every opened dialog starts with fresh state.
  const key = current.id
  switch (spec.type) {
    case 'confirm':
      return <ConfirmDialog key={key} spec={spec} />
    case 'unsaved':
      return <UnsavedDialog key={key} spec={spec} />
    case 'pageRange':
      return <PageRangeDialog key={key} spec={spec} />
    case 'split':
      return <SplitDialog key={key} spec={spec} />
    case 'signature':
      return <SignatureDialog key={key} />
    case 'print':
      return <PrintDialog key={key} spec={spec} />
  }
}
