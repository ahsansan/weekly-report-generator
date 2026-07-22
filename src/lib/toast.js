const TOAST_EVENT = 'app-toast'

export const getToastVariant = (message = '', fallback = 'info') => {
  const text = String(message).toLowerCase()

  if (
    text.includes('gagal') ||
    text.includes('error') ||
    text.includes('invalid') ||
    text.includes('tidak valid') ||
    text.includes('masih kosong')
  ) {
    return 'error'
  }

  if (
    text.includes('berhasil') ||
    text.includes('selesai') ||
    text.includes('siap') ||
    text.includes('valid') ||
    text.includes('disalin') ||
    text.includes('dibuat') ||
    text.includes('diunduh')
  ) {
    return 'success'
  }

  return fallback
}

export const toast = ({ title, message, variant, duration } = {}) => {
  if (typeof window === 'undefined') return

  const detail = {
    title,
    message: message || title || '',
    variant: variant || getToastVariant(message || title || ''),
    duration,
  }

  window.dispatchEvent(new CustomEvent(TOAST_EVENT, { detail }))
}

export const toastStatus = (status, fallbackVariant = 'info') => {
  if (!status) return

  if (typeof status === 'string') {
    toast({ message: status, variant: getToastVariant(status, fallbackVariant) })
    return
  }

  if (typeof status === 'object' && status.message) {
    toast({
      message: status.message,
      variant: status.type && status.type !== 'idle' ? status.type : getToastVariant(status.message, fallbackVariant),
    })
  }
}

export const subscribeToToasts = (listener) => {
  if (typeof window === 'undefined') return () => {}

  const onToast = (event) => listener(event.detail)
  window.addEventListener(TOAST_EVENT, onToast)
  return () => window.removeEventListener(TOAST_EVENT, onToast)
}
