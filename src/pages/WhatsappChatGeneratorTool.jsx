import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Camera,
  CheckCheck,
  ChevronLeft,
  Clipboard,
  Download,
  ImagePlus,
  MessageCircle,
  Mic,
  MoreHorizontal,
  Phone,
  Plus,
  RefreshCcw,
  Trash2,
  User,
  Video,
} from 'lucide-react'
import { toast } from '../lib/toast'
import '../App.css'

const DEFAULT_MESSAGES = [
  { id: 1, sender: 'you', time: '21:19', text: 'oh lu matiin wkwkwk' },
  { id: 2, sender: 'contact', time: '21:19', text: 'mau dimatiin dulu' },
  { id: 3, sender: 'you', time: '21:20', text: 'reset dulu ya bang' },
  { id: 4, sender: 'you', time: '21:20', text: 'wkwk' },
  { id: 5, sender: 'contact', time: '21:20', text: 'diliat dari CTRnya malah makin jelek' },
  {
    id: 6,
    sender: 'you',
    time: '21:28',
    quoteSender: 'Zul',
    quoteText: 'diliat dari CTRnya malah makin jelek',
    text: 'emang harus jeda dulu sih bang wkwk',
  },
]

const makeMessage = (id, sender = 'you') => ({ id, sender, time: '', quoteSender: '', quoteText: '', text: '' })

const getMessageQuoteSender = (message, contactName) => (message.sender === 'you' ? 'You' : contactName || 'Contact')

const getMessagePreview = (message) => {
  const text = message.text.trim() || '(empty message)'
  return text.length > 64 ? `${text.slice(0, 61)}...` : text
}

function WhatsappChatGeneratorTool() {
  const [theme, setTheme] = useState('dark')
  const [statusTime, setStatusTime] = useState('11:24')
  const [backCount, setBackCount] = useState('7')
  const [contactName, setContactName] = useState('Zul')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [messages, setMessages] = useState(DEFAULT_MESSAGES)
  const [openMessageIds, setOpenMessageIds] = useState([6])
  const [status, setStatus] = useState('Edit chat di kanan, preview WhatsApp akan berubah real-time.')
  const previewRef = useRef(null)
  const nextMessageId = useRef(14)

  useEffect(() => {
    return () => {
      if (avatarUrl) URL.revokeObjectURL(avatarUrl)
    }
  }, [avatarUrl])

  const visibleMessages = useMemo(() => messages.filter((message) => message.text.trim() || message.time.trim()), [messages])

  const updateMessage = (id, key, value) => {
    setMessages((current) => current.map((message) => (message.id === id ? { ...message, [key]: value } : message)))
  }

  const addMessage = () => {
    const lastSender = messages[messages.length - 1]?.sender
    const nextSender = lastSender === 'you' ? 'contact' : 'you'
    const nextId = nextMessageId.current
    setMessages((current) => [...current, makeMessage(nextId, nextSender)])
    setOpenMessageIds((current) => [...new Set([...current, nextId])])
    nextMessageId.current += 1
  }

  const removeMessage = (id) => {
    setMessages((current) => (current.length > 1 ? current.filter((message) => message.id !== id) : current))
    setOpenMessageIds((current) => current.filter((messageId) => messageId !== id))
  }

  const toggleMessageEditor = (id) => {
    setOpenMessageIds((current) => (current.includes(id) ? current.filter((messageId) => messageId !== id) : [...current, id]))
  }

  const updateReplyReference = (messageId, referenceId) => {
    setMessages((current) => {
      const reference = current.find((message) => message.id === Number(referenceId))

      return current.map((message) => {
        if (message.id !== messageId) return message
        if (!reference) return { ...message, quoteSender: '', quoteText: '' }

        return {
          ...message,
          quoteSender: getMessageQuoteSender(reference, contactName),
          quoteText: reference.text,
        }
      })
    })
  }

  const resetSample = () => {
    setTheme('dark')
    setStatusTime('11:24')
    setBackCount('7')
    setContactName('Zul')
    setMessages(DEFAULT_MESSAGES)
    setOpenMessageIds([6])
    setStatus('Sample WhatsApp dikembalikan.')
    toast({ message: 'Sample WhatsApp dikembalikan.', variant: 'info' })
    nextMessageId.current = 14
  }

  const onSelectAvatar = (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!/image\/(png|jpeg|webp|gif)/i.test(file.type)) {
      setStatus('Avatar harus berupa PNG, JPG, WEBP, atau GIF.')
      toast({ message: 'Avatar harus berupa PNG, JPG, WEBP, atau GIF.', variant: 'error' })
      event.target.value = ''
      return
    }

    if (avatarUrl) URL.revokeObjectURL(avatarUrl)
    setAvatarUrl(URL.createObjectURL(file))
    setStatus('Avatar diperbarui.')
    toast({ message: 'Avatar diperbarui.', variant: 'success' })
    event.target.value = ''
  }

  const buildCanvas = async () => {
    if (!previewRef.current) throw new Error('Preview belum tersedia.')
    const { default: html2canvas } = await import('html2canvas')
    return html2canvas(previewRef.current, {
      backgroundColor: theme === 'dark' ? '#0b141a' : '#efe7dd',
      scale: 3,
      useCORS: true,
      logging: false,
    })
  }

  const downloadImage = async () => {
    try {
      setStatus('Membuat gambar WhatsApp...')
      const canvas = await buildCanvas()
      const link = document.createElement('a')
      link.href = canvas.toDataURL('image/jpeg', 0.96)
      link.download = 'whatsapp-chat-generator.jpg'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      setStatus('JPG WhatsApp berhasil dibuat.')
      toast({ message: 'JPG WhatsApp berhasil dibuat.', variant: 'success' })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal export gambar WhatsApp.'
      setStatus(message)
      toast({ message, variant: 'error' })
    }
  }

  const copyImage = async () => {
    try {
      if (!navigator.clipboard || !window.ClipboardItem) {
        setStatus('Browser ini belum mendukung copy image ke clipboard.')
        toast({ message: 'Browser ini belum mendukung copy image ke clipboard.', variant: 'error' })
        return
      }

      setStatus('Menyalin gambar WhatsApp...')
      const canvas = await buildCanvas()
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
      if (!blob) throw new Error('Gagal membuat gambar.')
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
      setStatus('Gambar WhatsApp berhasil disalin ke clipboard.')
      toast({ message: 'Gambar WhatsApp berhasil disalin ke clipboard.', variant: 'success' })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal copy gambar WhatsApp.'
      setStatus(message)
      toast({ message, variant: 'error' })
    }
  }

  return (
    <main className="page wa-chat-page">
      <section className="hero wa-chat-hero" style={{ '--theme-color': '#25d366' }}>
        <div className="hero-left">
          <div className="hero-icon" aria-hidden="true">
            <MessageCircle className="icon-md" />
          </div>
          <div>
            <h1>WhatsApp Chat Generator</h1>
            <p>Buat mockup chat WhatsApp dan export sebagai JPG atau copy ke clipboard.</p>
          </div>
        </div>
        <div className="shortcut-box">
          <span>OUTPUT</span>
          <code>Light/Dark</code>
          <code>{messages.length} messages</code>
        </div>
      </section>

      <section className="wa-chat-workspace">
        <article className={`wa-chat-preview-card ${theme}`}>
          <div ref={previewRef} className="wa-chat-phone">
            <div className="wa-chat-status">
              <strong>{statusTime || '9:41'}</strong>
              <span className="wa-chat-status-icons" aria-hidden="true">
                <i className="wa-chat-cellular">
                  <b />
                  <b />
                  <b />
                  <b />
                </i>
                <i className="wa-chat-wifi" />
                <i className="wa-chat-battery" />
              </span>
            </div>

            <header className="wa-chat-head">
              <button type="button" className="wa-chat-back" aria-label="Back">
                <ChevronLeft />
                <span>{backCount || '7'}</span>
              </button>
              <div className="wa-chat-avatar">
                {avatarUrl ? <img src={avatarUrl} alt="" /> : <User aria-hidden="true" />}
              </div>
              <div className="wa-chat-contact">
                <strong>{contactName || 'Contact Name'}</strong>
              </div>
              <div className="wa-chat-head-actions" aria-hidden="true">
                <Video className="icon-sm" />
                <Phone className="icon-sm" />
              </div>
            </header>

            <div className="wa-chat-thread">
              {(visibleMessages.length > 0 ? visibleMessages : messages).map((message) => (
                <div key={message.id} className={`wa-chat-message ${message.sender}`}>
                  <p>
                    {message.quoteText ? (
                      <span className="wa-chat-quote">
                        <strong>{message.quoteSender || contactName || 'Contact'}</strong>
                        <span>{message.quoteText}</span>
                      </span>
                    ) : null}
                    <span className="wa-chat-message-text">{message.text || ' '}</span>
                    <span className="wa-chat-meta">
                      {message.time || ' '}
                      {message.sender === 'you' ? <CheckCheck aria-hidden="true" /> : null}
                    </span>
                  </p>
                </div>
              ))}
            </div>

            <footer className="wa-chat-inputbar">
              <button type="button" className="wa-chat-plus" aria-label="Add attachment">
                <Plus className="icon-sm" />
              </button>
              <div className="wa-chat-input-pill">
                <span>Message</span>
                <MoreHorizontal className="icon-sm" aria-hidden="true" />
              </div>
              <button type="button" className="wa-chat-camera-btn" aria-label="Camera">
                <Camera className="icon-sm" />
              </button>
              <button type="button" className="wa-chat-mic-btn" aria-label="Voice message">
                <Mic className="icon-sm" />
              </button>
            </footer>
          </div>
        </article>

        <article className="card wa-chat-editor-card">
          <div className="wa-chat-editor-head">
            <div>
              <h2>Settings</h2>
              <p>Konten dibuat lokal di browser, termasuk avatar dan export gambar.</p>
            </div>
            <div className="wa-chat-actions">
              <button type="button" className="outline icon-btn" onClick={resetSample}>
                <RefreshCcw className="icon-sm" /> Reset
              </button>
              <button type="button" className="outline icon-btn" onClick={copyImage}>
                <Clipboard className="icon-sm" /> Copy
              </button>
              <button type="button" className="primary icon-btn" onClick={downloadImage}>
                <Download className="icon-sm" /> Download JPG
              </button>
            </div>
          </div>

          <div className="wa-chat-editor-body">
            <div className="wa-chat-theme-tabs" role="tablist" aria-label="Theme">
              <button type="button" className={theme === 'light' ? 'active' : ''} onClick={() => setTheme('light')}>
                Light
              </button>
              <button type="button" className={theme === 'dark' ? 'active' : ''} onClick={() => setTheme('dark')}>
                Dark
              </button>
            </div>

            <div className="wa-chat-fields">
              <label className="field">
                <span>Status Bar Time</span>
                <input value={statusTime} onChange={(event) => setStatusTime(event.target.value)} placeholder="9:41" />
              </label>
              <label className="field">
                <span>Back Count</span>
                <input value={backCount} onChange={(event) => setBackCount(event.target.value)} placeholder="7" />
              </label>
              <label className="field">
                <span>Contact Name</span>
                <input value={contactName} onChange={(event) => setContactName(event.target.value)} placeholder="Zul" />
              </label>
            </div>

            <label className="upload-box wa-chat-avatar-upload">
              <input type="file" accept=".png,.jpg,.jpeg,.webp,.gif,image/png,image/jpeg,image/webp,image/gif" onChange={onSelectAvatar} />
              <span>
                <ImagePlus className="icon-xs" /> Upload Contact Avatar
              </span>
            </label>

            <div className="wa-chat-message-editor-head">
              <h2>Messages</h2>
              <button type="button" className="outline icon-btn" onClick={addMessage}>
                <Plus className="icon-sm" /> Add Message
              </button>
            </div>

            <div className="wa-chat-message-list">
              {messages.map((message, index) => (
                <article key={message.id} className={`wa-chat-message-editor ${openMessageIds.includes(message.id) ? 'expanded' : ''}`}>
                  <div className="wa-chat-message-top">
                    <button type="button" className="wa-chat-message-toggle" onClick={() => toggleMessageEditor(message.id)}>
                      <strong>Message {index + 1}</strong>
                      <span>
                        {message.sender === 'you' ? 'You' : contactName || 'Contact'} - {getMessagePreview(message)}
                      </span>
                    </button>
                    <button type="button" className="ghost-btn icon-btn" onClick={() => removeMessage(message.id)} aria-label={`Remove message ${index + 1}`}>
                      <Trash2 className="icon-sm" />
                    </button>
                  </div>
                  {openMessageIds.includes(message.id) ? (
                    <div className="wa-chat-message-panel">
                      <div className="wa-chat-message-fields">
                        <label className="field">
                          <span>Sender</span>
                          <select value={message.sender} onChange={(event) => updateMessage(message.id, 'sender', event.target.value)}>
                            <option value="contact">{contactName || 'Contact'}</option>
                            <option value="you">You</option>
                          </select>
                        </label>
                        <label className="field">
                          <span>Time</span>
                          <input value={message.time} onChange={(event) => updateMessage(message.id, 'time', event.target.value)} placeholder="10:30" />
                        </label>
                      </div>
                      <div className="wa-chat-message-fields wa-chat-reply-fields">
                        <label className="field">
                          <span>Reply To</span>
                          <select
                            value=""
                            onChange={(event) => {
                              updateReplyReference(message.id, event.target.value)
                              event.target.value = ''
                            }}
                          >
                            <option value="">Pilih chat sebelumnya</option>
                            {messages.slice(0, index).map((candidate, candidateIndex) => (
                              <option key={candidate.id} value={candidate.id}>
                                {candidateIndex + 1}. {getMessageQuoteSender(candidate, contactName)} - {getMessagePreview(candidate)}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="field">
                          <span>Selected Quote</span>
                          <div className="wa-chat-selected-quote">
                            {message.quoteText ? (
                              <>
                                <strong>{message.quoteSender || 'Quote'}</strong>
                                <span>{message.quoteText}</span>
                                <button type="button" onClick={() => updateMessage(message.id, 'quoteText', '')}>
                                  Clear
                                </button>
                              </>
                            ) : (
                              <span>No reply quote</span>
                            )}
                          </div>
                        </label>
                      </div>
                      <label className="field">
                        <span>Message {message.text.length} / 1000</span>
                        <textarea
                          value={message.text}
                          maxLength={1000}
                          onChange={(event) => updateMessage(message.id, 'text', event.target.value)}
                          rows={3}
                        />
                      </label>
                    </div>
                  ) : null}
                </article>
              ))}
            </div>

            <p className="wa-chat-status-text">{status}</p>
            <p className="wa-chat-policy">
              Gunakan sebagai mockup atau konten hiburan. Jangan presentasikan hasil generator sebagai percakapan asli.
            </p>
          </div>
        </article>
      </section>
    </main>
  )
}

export default WhatsappChatGeneratorTool
