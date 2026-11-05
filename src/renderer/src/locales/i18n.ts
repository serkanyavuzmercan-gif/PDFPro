import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import type { AppLanguage } from '../../../shared/ipc'
import en from './en.json'
import tr from './tr.json'

const STORAGE_KEY = 'pdfpro.language'

function initialLanguage(): AppLanguage {
  const saved = localStorage.getItem(STORAGE_KEY)
  return saved === 'en' || saved === 'tr' ? saved : 'tr'
}

void i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, tr: { translation: tr } },
  lng: initialLanguage(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false }
})

document.documentElement.lang = i18n.language

export function setLanguage(lang: AppLanguage): void {
  localStorage.setItem(STORAGE_KEY, lang)
  document.documentElement.lang = lang
  void i18n.changeLanguage(lang)
}

export default i18n
