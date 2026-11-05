import { join, normalize, relative, isAbsolute } from 'node:path'
import { pathToFileURL } from 'node:url'
import { net, protocol } from 'electron'

export const APP_SCHEME = 'pdfpro'
export const APP_ORIGIN = `${APP_SCHEME}://app`

/** Must run before app "ready". */
export function registerAppScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: APP_SCHEME,
      privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true }
    }
  ])
}

/**
 * Serves the built renderer from a privileged scheme rather than file://, so
 * pdf.js workers, wasm and font/cmap requests behave as same-origin.
 */
export function handleAppScheme(): void {
  const root = join(__dirname, '../renderer')

  protocol.handle(APP_SCHEME, (request) => {
    const { pathname } = new URL(request.url)
    const target = normalize(join(root, decodeURIComponent(pathname)))
    const rel = relative(root, target)
    if (rel.startsWith('..') || isAbsolute(rel)) {
      return new Response('Forbidden', { status: 403 })
    }
    return net.fetch(pathToFileURL(target).toString())
  })
}
