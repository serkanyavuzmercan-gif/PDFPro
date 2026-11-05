import { useEffect } from 'react'
import { LoaderCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { NoticeBar } from './components/layout/NoticeBar'
import { Ribbon } from './components/layout/Ribbon'
import { Sidebar } from './components/layout/Sidebar'
import { StatusBar } from './components/layout/StatusBar'
import { TitleBar } from './components/layout/TitleBar'
import { EmptyState } from './components/viewer/EmptyState'
import { PdfViewer } from './components/viewer/PdfViewer'
import { openFromPath } from './services/fileService'
import { useShortcuts } from './shortcuts/useShortcuts'
import { useAppStore } from './store/useAppStore'

function useExternalFileOpening(): void {
  useEffect(() => {
    void window.api.getPendingFile().then((path) => {
      if (path) void openFromPath(path)
    })
    return window.api.onOpenExternalFile((path) => void openFromPath(path))
  }, [])
}

export default function App(): JSX.Element {
  const { t } = useTranslation()
  const doc = useAppStore((s) => s.document)
  const loading = useAppStore((s) => s.loading)

  useShortcuts()
  useExternalFileOpening()

  return (
    <div className="flex h-full flex-col">
      <TitleBar />
      <Ribbon />
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <main className="relative min-w-0 flex-1">
          {doc ? <PdfViewer key={doc.pdf.fingerprints[0] ?? doc.name} doc={doc} /> : <EmptyState />}
          {loading && (
            <div className="absolute inset-0 z-40 flex items-center justify-center bg-workspace/70">
              <div className="flex items-center gap-2 rounded-md bg-white px-4 py-3 shadow">
                <LoaderCircle size={18} className="animate-spin text-brand" />
                <span>{t('common.loading')}</span>
              </div>
            </div>
          )}
          <NoticeBar />
        </main>
      </div>
      <StatusBar />
    </div>
  )
}
