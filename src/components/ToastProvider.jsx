import { CheckCircle2, Info, X, XCircle } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { getToastVariant, subscribeToToasts, toast } from '../lib/toast'

const DEFAULT_DURATION = 3600

const ICONS = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
}

const STATUS_SELECTORS = [
  '.m4a-status',
  '.csv-json-status',
  '.json-tool-status',
  '.ig-dm-status-text',
].join(',')

const shouldSkipStatusToast = (message) => {
  const text = String(message).trim().toLowerCase()
  if (!text) return true

  return (
    text.startsWith('pilih ') ||
    text.startsWith('upload ') ||
    text.startsWith('siap ') ||
    text === 'siap memproses json.' ||
    text === 'siap convert csv ke json.' ||
    text.includes('preview akan berubah real-time')
  )
}

function ToastProvider() {
  const [toasts, setToasts] = useState([])
  const timersRef = useRef(new Map())

  const dismissToast = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
    const timer = timersRef.current.get(id)
    if (timer) window.clearTimeout(timer)
    timersRef.current.delete(id)
  }, [])

  useEffect(() => {
    const timers = timersRef.current
    const unsubscribe = subscribeToToasts((nextToast) => {
      const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`
      const duration = nextToast.duration ?? DEFAULT_DURATION
      const toast = {
        id,
        title: nextToast.title,
        message: nextToast.message || nextToast.title || '',
        variant: nextToast.variant || 'info',
      }

      setToasts((current) => [toast, ...current].slice(0, 4))

      if (duration > 0) {
        const timer = window.setTimeout(() => dismissToast(id), duration)
        timers.set(id, timer)
      }
    })

    return () => {
      unsubscribe()
      timers.forEach((timer) => window.clearTimeout(timer))
      timers.clear()
    }
  }, [dismissToast])

  useEffect(() => {
    const originalAlert = window.alert
    window.alert = (message) => {
      toast({ message: String(message ?? ''), variant: getToastVariant(message, 'info') })
    }

    return () => {
      window.alert = originalAlert
    }
  }, [])

  useEffect(() => {
    const lastMessages = new WeakMap()

    const notifyStatusElement = (element, skipFirst = false) => {
      const message = element.textContent?.replace(/\s+/g, ' ').trim() || ''
      const previous = lastMessages.get(element)
      lastMessages.set(element, message)

      if (skipFirst || message === previous || shouldSkipStatusToast(message)) return

      const forcedVariant = element.classList.contains('error')
        ? 'error'
        : element.classList.contains('success')
          ? 'success'
          : undefined

      toast({
        message,
        variant: forcedVariant || getToastVariant(message, 'info'),
      })
    }

    document.querySelectorAll(STATUS_SELECTORS).forEach((element) => notifyStatusElement(element, true))

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'characterData') {
          const parent = mutation.target.parentElement?.closest(STATUS_SELECTORS)
          if (parent) notifyStatusElement(parent)
          return
        }

        if (mutation.type === 'childList') {
          const target = mutation.target instanceof Element ? mutation.target.closest(STATUS_SELECTORS) : null
          if (target) notifyStatusElement(target)

          mutation.addedNodes.forEach((node) => {
            if (!(node instanceof Element)) return
            if (node.matches(STATUS_SELECTORS)) notifyStatusElement(node)
            node.querySelectorAll(STATUS_SELECTORS).forEach((element) => notifyStatusElement(element))
          })
        }
      })
    })

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    })

    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const onDocumentClick = (event) => {
      const downloadLink = event.target instanceof Element ? event.target.closest('a[download]') : null
      if (!downloadLink || downloadLink.getAttribute('aria-disabled') === 'true') return

      const fileName = downloadLink.getAttribute('download')
      toast({
        message: fileName ? `Download dimulai: ${fileName}` : 'Download dimulai.',
        variant: 'success',
      })
    }

    document.addEventListener('click', onDocumentClick)
    return () => document.removeEventListener('click', onDocumentClick)
  }, [])

  if (toasts.length === 0) return null

  return (
    <div className="toast-stack" aria-live="polite" aria-atomic="true">
      {toasts.map((toast) => {
        const Icon = ICONS[toast.variant] || Info
        return (
          <article key={toast.id} className={`toast-item ${toast.variant}`}>
            <Icon className="toast-icon" aria-hidden="true" />
            <div className="toast-copy">
              {toast.title ? <strong>{toast.title}</strong> : null}
              <span>{toast.message}</span>
            </div>
            <button type="button" className="toast-close" aria-label="Tutup notifikasi" onClick={() => dismissToast(toast.id)}>
              <X />
            </button>
          </article>
        )
      })}
    </div>
  )
}

export default ToastProvider
