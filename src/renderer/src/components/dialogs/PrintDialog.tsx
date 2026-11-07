import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DialogButton, Modal } from './Modal'
import { closeDialog, parsePageRanges, type DialogSpec } from './dialogStore'

type PrintSpec = Extract<DialogSpec, { type: 'print' }>

export function PrintDialog({ spec }: { spec: PrintSpec }): JSX.Element {
  const { t } = useTranslation()
  const [deviceName, setDeviceName] = useState(spec.printers[0]?.name ?? '')
  const [copies, setCopies] = useState('1')
  const [scope, setScope] = useState<'all' | 'current' | 'range'>('all')
  const [range, setRange] = useState(String(spec.currentPage))

  const pages = useMemo(() => {
    if (scope === 'current') return [spec.currentPage]
    if (scope === 'all') return spec.previews.map((page) => page.page)
    return (parsePageRanges(range, spec.pageCount) ?? []).map((index) => index + 1)
  }, [scope, range, spec])

  const visible = spec.previews.filter((page) => pages.includes(page.page))
  const copyCount = Math.min(99, Math.max(1, Number.parseInt(copies, 10) || 1))

  const submit = (): void => {
    if (pages.length === 0) return
    closeDialog({
      deviceName: deviceName || undefined,
      copies: copyCount,
      pages
    })
  }

  return (
    <Modal
      title={t('dialogs.print.title')}
      width={860}
      onCancel={() => closeDialog(null)}
      footer={
        <>
          <DialogButton onClick={() => closeDialog(null)}>{t('common.cancel')}</DialogButton>
          <DialogButton variant="primary" disabled={pages.length === 0} onClick={submit}>
            {t('dialogs.print.print')}
          </DialogButton>
        </>
      }
    >
      <div className="flex gap-4">
        <div className="flex w-52 shrink-0 flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="font-medium">{t('dialogs.print.printer')}</span>
            {spec.printers.length > 0 ? (
              <select
                value={deviceName}
                onChange={(e) => setDeviceName(e.target.value)}
                className="rounded border border-chrome-border bg-white px-2 py-1.5 outline-none focus:border-brand"
              >
                {spec.printers.map((printer) => (
                  <option key={printer.name} value={printer.name}>
                    {printer.displayName}
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-ink-muted">{t('dialogs.print.noPrinter')}</span>
            )}
          </label>
          <label className="flex items-center justify-between gap-2">
            <span className="font-medium">{t('dialogs.print.copies')}</span>
            <input
              type="number"
              min={1}
              max={99}
              value={copies}
              onChange={(e) => setCopies(e.target.value)}
              className="w-16 rounded border border-chrome-border px-2 py-1 text-right outline-none focus:border-brand"
            />
          </label>
          <fieldset className="flex flex-col gap-1.5">
            <legend className="mb-1 font-medium">{t('dialogs.print.pages')}</legend>
            {(
              [
                ['all', 'dialogs.print.all'],
                ['current', 'dialogs.print.current'],
                ['range', 'dialogs.print.range']
              ] as const
            ).map(([id, key]) => (
              <label key={id} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="print-scope"
                  checked={scope === id}
                  onChange={() => setScope(id)}
                  className="accent-brand"
                />
                {t(key)}
              </label>
            ))}
            <input
              value={range}
              disabled={scope !== 'range'}
              placeholder="1-3, 5"
              onChange={(e) => setRange(e.target.value)}
              className="rounded border border-chrome-border px-2 py-1.5 outline-none focus:border-brand disabled:bg-chrome"
            />
            <span className={pages.length > 0 ? 'text-ink-muted' : 'text-brand'}>
              {pages.length > 0
                ? t('dialogs.pageRange.selected', { count: pages.length })
                : t('dialogs.pageRange.invalid')}
            </span>
          </fieldset>
        </div>
        <div className="max-h-[62vh] min-h-64 flex-1 overflow-y-auto rounded bg-workspace p-4">
          <div className="flex flex-col items-center gap-4">
            {visible.map((page) => (
              <figure key={page.page} className="w-full max-w-[420px]">
                <img
                  src={page.src}
                  alt=""
                  className="block w-full bg-white shadow-[0_1px_4px_rgba(0,0,0,0.3)]"
                />
                <figcaption className="mt-1 text-center text-[11px] text-ink-muted">{page.page}</figcaption>
              </figure>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  )
}
