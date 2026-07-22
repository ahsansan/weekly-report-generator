import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Camera,
  ChevronLeft,
  CirclePlus,
  Clipboard,
  Download,
  Image as ImageIcon,
  ImagePlus,
  Mic,
  MessageCircle,
  Phone,
  Plus,
  RefreshCcw,
  SmilePlus,
  Sticker,
  Trash2,
  User,
  Video,
} from 'lucide-react'
import '../App.css'

const DEFAULT_MESSAGES = [
  {
    id: 1,
    sender: 'contact',
    date: '22 JUL 10:13',
    text: 'Would I rather be feared or loved? Easy. Both. I want people to be afraid of how much they love me.',
  },
  { id: 2, sender: 'you', date: '', text: "That's... not how it works Michael 😂" },
  {
    id: 3,
    sender: 'contact',
    date: '',
    text: "You miss 100% of the shots you don't take. - Wayne Gretzky - Michael Scott",
  },
]

const makeMessage = (id, sender = 'you') => ({ id, sender, date: '', text: '' })

const getInstagramMessagePreview = (message) => {
  const text = message.text.trim() || '(empty message)'
  return text.length > 64 ? `${text.slice(0, 61)}...` : text
}

const wrapCanvasText = (context, text, maxWidth) => {
  const words = String(text || '').split(/\s+/).filter(Boolean)
  const lines = []
  let line = ''

  words.forEach((word) => {
    const testLine = line ? `${line} ${word}` : word
    if (context.measureText(testLine).width <= maxWidth) {
      line = testLine
      return
    }
    if (line) lines.push(line)
    if (context.measureText(word).width <= maxWidth) {
      line = word
      return
    }

    let chunk = ''
    Array.from(word).forEach((letter) => {
      const testChunk = `${chunk}${letter}`
      if (context.measureText(testChunk).width <= maxWidth) {
        chunk = testChunk
      } else {
        if (chunk) lines.push(chunk)
        chunk = letter
      }
    })
    line = chunk
  })

  if (line) lines.push(line)
  return lines.length > 0 ? lines : ['']
}

const loadImage = (source) =>
  new Promise((resolve, reject) => {
    if (!source) {
      resolve(null)
      return
    }
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Gagal membaca avatar.'))
    image.src = source
  })

const drawRoundRect = (context, x, y, width, height, radius) => {
  const r = Math.min(radius, width / 2, height / 2)
  context.beginPath()
  context.moveTo(x + r, y)
  context.arcTo(x + width, y, x + width, y + height, r)
  context.arcTo(x + width, y + height, x, y + height, r)
  context.arcTo(x, y + height, x, y, r)
  context.arcTo(x, y, x + width, y, r)
  context.closePath()
}

const drawChevronLeft = (context, x, y, size, color) => {
  context.strokeStyle = color
  context.lineWidth = 2.4
  context.lineCap = 'round'
  context.lineJoin = 'round'
  context.beginPath()
  context.moveTo(x + size * 0.62, y + size * 0.2)
  context.lineTo(x + size * 0.32, y + size * 0.5)
  context.lineTo(x + size * 0.62, y + size * 0.8)
  context.stroke()
}

const drawPhoneIcon = (context, x, y, size, color) => {
  context.strokeStyle = color
  context.lineWidth = 2
  context.lineCap = 'round'
  context.beginPath()
  context.moveTo(x + size * 0.28, y + size * 0.2)
  context.quadraticCurveTo(x + size * 0.14, y + size * 0.35, x + size * 0.27, y + size * 0.55)
  context.quadraticCurveTo(x + size * 0.44, y + size * 0.82, x + size * 0.72, y + size * 0.72)
  context.stroke()
}

const drawInfoIcon = (context, x, y, size, color) => {
  context.strokeStyle = color
  context.fillStyle = color
  context.lineWidth = 1.8
  context.beginPath()
  context.arc(x + size / 2, y + size / 2, size * 0.38, 0, Math.PI * 2)
  context.stroke()
  context.beginPath()
  context.arc(x + size / 2, y + size * 0.34, 1.5, 0, Math.PI * 2)
  context.fill()
  context.fillRect(x + size / 2 - 1, y + size * 0.45, 2, size * 0.22)
}

const drawCameraIcon = (context, x, y, size) => {
  context.fillStyle = '#3797f0'
  context.beginPath()
  context.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2)
  context.fill()
  context.strokeStyle = '#ffffff'
  context.lineWidth = 1.8
  drawRoundRect(context, x + size * 0.26, y + size * 0.32, size * 0.48, size * 0.36, 3)
  context.stroke()
  context.beginPath()
  context.arc(x + size / 2, y + size / 2, size * 0.11, 0, Math.PI * 2)
  context.stroke()
}

const drawAvatar = (context, x, y, size, image, theme) => {
  context.save()
  context.beginPath()
  context.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2)
  context.clip()

  if (image) {
    context.drawImage(image, x, y, size, size)
  } else {
    const gradient = context.createLinearGradient(x, y, x + size, y + size)
    gradient.addColorStop(0, '#f58529')
    gradient.addColorStop(0.5, '#dd2a7b')
    gradient.addColorStop(1, '#515bd4')
    context.fillStyle = gradient
    context.fillRect(x, y, size, size)
    context.fillStyle = '#ffffff'
    context.font = '700 18px Segoe UI, Arial'
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.fillText('IG', x + size / 2, y + size / 2)
  }

  context.restore()
  context.strokeStyle = theme === 'dark' ? '#262626' : '#ffffff'
  context.lineWidth = 2
  context.beginPath()
  context.arc(x + size / 2, y + size / 2, size / 2 - 1, 0, Math.PI * 2)
  context.stroke()
}

const drawInstagramDmCanvas = async ({ theme, statusTime, contactName, username, placeholder, avatarUrl, messages }) => {
  const width = 390
  const height = 844
  const scale = 3
  const canvas = document.createElement('canvas')
  canvas.width = width * scale
  canvas.height = height * scale
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas tidak tersedia di browser ini.')

  context.scale(scale, scale)
  const isDark = theme === 'dark'
  const colors = {
    app: isDark ? '#000000' : '#ffffff',
    text: isDark ? '#f5f5f5' : '#111111',
    muted: isDark ? '#a8a8a8' : '#737373',
    border: isDark ? '#262626' : '#dbdbdb',
    incoming: isDark ? '#262626' : '#efefef',
    incomingText: isDark ? '#f5f5f5' : '#111111',
    outgoing: '#9b2fff',
    outgoingText: '#ffffff',
    input: isDark ? '#121212' : '#ffffff',
  }
  const avatarImage = await loadImage(avatarUrl)

  context.fillStyle = colors.app
  context.fillRect(0, 0, width, height)

  context.fillStyle = colors.text
  context.font = '700 15px Segoe UI, Arial'
  context.textAlign = 'left'
  context.fillText(statusTime || '9:41', 27, 28)
  context.textAlign = 'right'
  context.font = '700 12px Segoe UI, Arial'
  context.fillText('5G 100%', width - 22, 28)

  context.strokeStyle = isDark ? '#171717' : '#e5e5e5'
  context.lineWidth = 1
  context.beginPath()
  context.moveTo(0, 104)
  context.lineTo(width, 104)
  context.stroke()

  drawChevronLeft(context, 16, 61, 31, colors.text)
  drawAvatar(context, 48, 57, 36, avatarImage, theme)
  context.fillStyle = colors.text
  context.font = '700 17px Segoe UI, Arial'
  context.textAlign = 'left'
  context.fillText(contactName || 'Contact Name', 98, 72)
  context.fillStyle = colors.muted
  context.font = '400 13px Segoe UI, Arial'
  context.fillText(username || 'username', 98, 89)
  drawInfoIcon(context, width - 142, 61, 28, '#c7c7ce')
  drawPhoneIcon(context, width - 86, 60, 28, colors.text)
  drawRoundRect(context, width - 42, 63, 27, 19, 5)
  context.strokeStyle = colors.text
  context.lineWidth = 2.2
  context.stroke()

  let y = 127
  messages.forEach((message) => {
    if (message.date) {
      context.fillStyle = colors.muted
      context.font = '700 11px Segoe UI, Arial'
      context.textAlign = 'center'
      context.fillText(message.date.toUpperCase(), width / 2, y)
      y += 27
    }

    const isYou = message.sender === 'you'
    const maxBubbleWidth = 268
    context.font = '400 15.5px Segoe UI, Arial'
    const lines = wrapCanvasText(context, message.text || ' ', maxBubbleWidth - 34)
    const bubbleHeight = Math.max(44, lines.length * 22 + 22)
    const textWidth = Math.min(
      maxBubbleWidth,
      Math.max(48, ...lines.map((line) => context.measureText(line).width)) + 34,
    )
    const bubbleX = isYou ? width - textWidth - 16 : 54

    if (!isYou) drawAvatar(context, 17, y + 4, 29, avatarImage, theme)

    context.fillStyle = isYou ? colors.outgoing : colors.incoming
    drawRoundRect(context, bubbleX, y, textWidth, bubbleHeight, 22)
    context.fill()

    context.fillStyle = isYou ? colors.outgoingText : colors.incomingText
    context.textAlign = 'left'
    context.textBaseline = 'top'
    lines.forEach((line, index) => {
      context.fillText(line, bubbleX + 17, y + 12 + index * 22)
    })
    y += bubbleHeight + 11
  })

  context.textBaseline = 'alphabetic'
  context.fillStyle = isDark ? '#181818' : '#efefef'
  drawRoundRect(context, 10, height - 54, width - 20, 44, 22)
  context.fill()

  drawCameraIcon(context, 15, height - 50, 36)
  context.fillStyle = colors.muted
  context.font = '400 16px Segoe UI, Arial'
  context.textAlign = 'left'
  context.fillText(placeholder || 'Message...', 62, height - 27)
  context.strokeStyle = colors.text
  context.lineWidth = 2.2
  context.beginPath()
  context.arc(width - 42, height - 31, 11, 0, Math.PI * 2)
  context.moveTo(width - 42, height - 39)
  context.lineTo(width - 42, height - 23)
  context.moveTo(width - 50, height - 31)
  context.lineTo(width - 34, height - 31)
  context.stroke()

  return canvas
}

function InstagramDmGeneratorTool() {
  const [theme, setTheme] = useState('light')
  const [statusTime, setStatusTime] = useState('9:41')
  const [contactName, setContactName] = useState('Michael Scott')
  const [username, setUsername] = useState('theoffice')
  const [placeholder, setPlaceholder] = useState('Message...')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [messages, setMessages] = useState(DEFAULT_MESSAGES)
  const [openMessageIds, setOpenMessageIds] = useState([1])
  const [status, setStatus] = useState('Edit konten di kanan, preview akan berubah real-time.')
  const previewRef = useRef(null)
  const nextMessageId = useRef(4)

  useEffect(() => {
    return () => {
      if (avatarUrl) URL.revokeObjectURL(avatarUrl)
    }
  }, [avatarUrl])

  const nonEmptyMessages = useMemo(() => messages.filter((message) => message.text.trim() || message.date.trim()), [messages])

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

  const resetSample = () => {
    setTheme('light')
    setStatusTime('9:41')
    setContactName('Michael Scott')
    setUsername('theoffice')
    setPlaceholder('Message...')
    setMessages(DEFAULT_MESSAGES)
    setOpenMessageIds([1])
    setStatus('Sample dikembalikan.')
    nextMessageId.current = 4
  }

  const onSelectAvatar = (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (!/image\/(png|jpeg|webp|gif)/i.test(file.type)) {
      setStatus('Avatar harus berupa PNG, JPG, WEBP, atau GIF.')
      event.target.value = ''
      return
    }

    if (avatarUrl) URL.revokeObjectURL(avatarUrl)
    setAvatarUrl(URL.createObjectURL(file))
    setStatus('Avatar diperbarui.')
    event.target.value = ''
  }

  const buildCanvas = async () => {
    if (previewRef.current) {
      const { default: html2canvas } = await import('html2canvas')
      return html2canvas(previewRef.current, {
        backgroundColor: theme === 'dark' ? '#000000' : '#ffffff',
        scale: 3,
        useCORS: true,
        logging: false,
      })
    }

    return drawInstagramDmCanvas({
      theme,
      statusTime,
      contactName,
      username,
      placeholder,
      avatarUrl,
      messages: nonEmptyMessages.length > 0 ? nonEmptyMessages : messages,
    })
  }

  const downloadImage = async () => {
    try {
      setStatus('Membuat gambar...')
      const canvas = await buildCanvas()
      const link = document.createElement('a')
      link.href = canvas.toDataURL('image/jpeg', 0.97)
      link.download = 'instagram-dm-generator.jpg'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      setStatus('JPG berhasil dibuat.')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Gagal export gambar.')
    }
  }

  const copyImage = async () => {
    try {
      if (!navigator.clipboard || !window.ClipboardItem) {
        setStatus('Browser ini belum mendukung copy image ke clipboard.')
        return
      }
      setStatus('Menyalin gambar...')
      const canvas = await buildCanvas()
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
      if (!blob) throw new Error('Gagal membuat gambar.')
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
      setStatus('Gambar berhasil disalin ke clipboard.')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Gagal copy gambar.')
    }
  }

  return (
    <main className="page ig-dm-page">
      <section className="hero ig-dm-hero" style={{ '--theme-color': '#e34882' }}>
        <div className="hero-left">
          <div className="hero-icon" aria-hidden="true">
            <MessageCircle className="icon-md" />
          </div>
          <div>
            <h1>Instagram DM Generator</h1>
            <p>Buat mockup percakapan DM Instagram dan export sebagai PNG.</p>
          </div>
        </div>
        <div className="shortcut-box">
          <span>OUTPUT</span>
          <code>Light/Dark</code>
          <code>{messages.length} messages</code>
        </div>
      </section>

      <section className="ig-dm-workspace">
        <article className={`ig-dm-preview-card ${theme}`}>
          <div ref={previewRef} className="ig-dm-phone">
            <div className="ig-dm-status">
              <strong>{statusTime || '9:41'}</strong>
              <span className="ig-dm-status-icons" aria-hidden="true">
                <i className="ig-dm-cellular">
                  <b />
                  <b />
                  <b />
                  <b />
                </i>
                <i className="ig-dm-wifi" />
                <i className="ig-dm-battery" />
              </span>
            </div>
            <header className="ig-dm-chat-head">
              <button type="button" aria-label="Back">
                <ChevronLeft />
              </button>
              <div className="ig-dm-avatar">
                {avatarUrl ? <img src={avatarUrl} alt="" /> : <User aria-hidden="true" />}
              </div>
              <div>
                <strong>{contactName || 'Contact Name'}</strong>
                <span>{username || 'username'}</span>
              </div>
              <div className="ig-dm-head-actions" aria-hidden="true">
                <SmilePlus className="icon-sm ig-dm-muted-action" />
                <Phone className="icon-sm" />
                <Video className="icon-sm" />
              </div>
            </header>

            <div className="ig-dm-thread">
              {(nonEmptyMessages.length > 0 ? nonEmptyMessages : messages).map((message) => (
                <div key={message.id} className="ig-dm-row-wrap">
                  {message.date ? <div className="ig-dm-date">{message.date}</div> : null}
                  <div className={`ig-dm-message-row ${message.sender}`}>
                    {message.sender === 'contact' ? (
                      <div className="ig-dm-mini-avatar">
                        {avatarUrl ? <img src={avatarUrl} alt="" /> : <User aria-hidden="true" />}
                      </div>
                    ) : null}
                    <p>{message.text || ' '}</p>
                  </div>
                </div>
              ))}
            </div>

            <footer className="ig-dm-inputbar">
              <span className="ig-dm-camera">
                <Camera className="icon-sm" />
              </span>
              <span>{placeholder || 'Message...'}</span>
              <Mic className="icon-sm ig-dm-input-icon" />
              <ImageIcon className="icon-sm ig-dm-input-icon" />
              <Sticker className="icon-sm ig-dm-input-icon" />
              <CirclePlus className="icon-sm ig-dm-input-icon" />
            </footer>
          </div>
        </article>

        <article className="card ig-dm-editor-card">
          <div className="ig-dm-editor-head">
            <div>
              <h2>Settings</h2>
              <p>Konten dibuat lokal di browser, termasuk avatar dan export gambar.</p>
            </div>
            <div className="ig-dm-actions">
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

          <div className="ig-dm-editor-body">
            <div className="ig-dm-theme-tabs" role="tablist" aria-label="Theme">
              <button type="button" className={theme === 'light' ? 'active' : ''} onClick={() => setTheme('light')}>
                Light
              </button>
              <button type="button" className={theme === 'dark' ? 'active' : ''} onClick={() => setTheme('dark')}>
                Dark
              </button>
            </div>

            <div className="ig-dm-fields">
              <label className="field">
                <span>Status Bar Time</span>
                <input value={statusTime} onChange={(event) => setStatusTime(event.target.value)} placeholder="9:41" />
              </label>
              <label className="field">
                <span>Contact Name</span>
                <input value={contactName} onChange={(event) => setContactName(event.target.value)} />
              </label>
              <label className="field">
                <span>Username</span>
                <input value={username} onChange={(event) => setUsername(event.target.value)} />
              </label>
              <label className="field">
                <span>Input Placeholder</span>
                <input value={placeholder} onChange={(event) => setPlaceholder(event.target.value)} />
              </label>
            </div>

            <label className="upload-box ig-dm-avatar-upload">
              <input type="file" accept=".png,.jpg,.jpeg,.webp,.gif,image/png,image/jpeg,image/webp,image/gif" onChange={onSelectAvatar} />
              <span>
                <ImagePlus className="icon-xs" /> Upload Contact Avatar
              </span>
            </label>

            <div className="ig-dm-message-editor-head">
              <h2>Messages</h2>
              <button type="button" className="outline icon-btn" onClick={addMessage}>
                <Plus className="icon-sm" /> Add Message
              </button>
            </div>

            <div className="ig-dm-message-list">
              {messages.map((message, index) => (
                <article key={message.id} className={`ig-dm-message-editor ${openMessageIds.includes(message.id) ? 'expanded' : ''}`}>
                  <div className="ig-dm-message-top">
                    <button type="button" className="ig-dm-message-toggle" onClick={() => toggleMessageEditor(message.id)}>
                      <strong>Message {index + 1}</strong>
                      <span>
                        {message.sender === 'you' ? 'You' : contactName || 'Contact'} - {getInstagramMessagePreview(message)}
                      </span>
                    </button>
                    <button type="button" className="ghost-btn icon-btn" onClick={() => removeMessage(message.id)} aria-label={`Remove message ${index + 1}`}>
                      <Trash2 className="icon-sm" />
                    </button>
                  </div>
                  {openMessageIds.includes(message.id) ? (
                    <div className="ig-dm-message-panel">
                      <div className="ig-dm-message-fields">
                        <label className="field">
                          <span>Sender</span>
                          <select value={message.sender} onChange={(event) => updateMessage(message.id, 'sender', event.target.value)}>
                            <option value="contact">{contactName || 'Contact'}</option>
                            <option value="you">You</option>
                          </select>
                        </label>
                        <label className="field">
                          <span>Date</span>
                          <input
                            value={message.date}
                            onChange={(event) => updateMessage(message.id, 'date', event.target.value)}
                            placeholder="22 JUL 10:13"
                          />
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

            <p className="ig-dm-status-text">{status}</p>
            <p className="ig-dm-policy">
              Gunakan sebagai mockup atau konten hiburan. Jangan presentasikan hasil generator sebagai percakapan asli.
            </p>
          </div>
        </article>
      </section>
    </main>
  )
}

export default InstagramDmGeneratorTool
