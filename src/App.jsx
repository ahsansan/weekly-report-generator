import { useEffect, useMemo, useState } from 'react'
import { jsPDF } from 'jspdf'
import {
  CalendarDays,
  CheckCheck,
  ClipboardList,
  Eye,
  FileText,
  Palette,
  Plus,
  Save,
  Tag,
  Trash2,
  Upload,
  UserRound,
  X,
} from 'lucide-react'
import './App.css'

const QUICK_TEMPLATES = [
  'Daily Standup',
  'Code Review',
  'Testing & QA',
  'Dokumentasi',
  'Rapat Tim',
  'Bug Fixing',
]

const DEFAULT_TAGS = ['Backend', 'Frontend', 'Testing', 'DevOps', 'Design', 'Meeting', 'Dokumentasi']

const THEMES = [
  { key: 'blue', label: 'Biru', color: '#57B5E0' },
  { key: 'green', label: 'Hijau', color: '#09a56d' },
  { key: 'purple', label: 'Ungu', color: '#7c3aed' },
  { key: 'slate', label: 'Abu-abu', color: '#42526d' },
  { key: 'red', label: 'Merah', color: '#e11d48' },
  { key: 'custom', label: 'Kustom', color: '#5668ff' },
]
const CUSTOM_SWATCHES = ['#57B5E0', '#09a56d', '#7c3aed', '#42526d', '#e11d48', '#ff8a00', '#00a3a3', '#121a2b']

const DRAFT_KEY = 'weekly-report-generator-draft'

const createEmptyItem = (id) => ({
  id,
  title: '',
  description: '',
  tags: [],
  attachments: [],
})

const normalizeDraftItems = (draftItems) => {
  if (!Array.isArray(draftItems) || draftItems.length === 0) return [createEmptyItem(1)]

  return draftItems.map((item, index) => ({
    id: item?.id ?? Date.now() + index,
    title: item?.title ?? '',
    description: item?.description ?? '',
    tags: Array.isArray(item?.tags) ? item.tags : [],
    attachments: Array.isArray(item?.attachments)
      ? item.attachments
          .map((attachment, attachmentIndex) => {
            if (typeof attachment === 'string') {
              return {
                id: `${Date.now()}-${index}-${attachmentIndex}`,
                name: attachment,
                src: '',
              }
            }
            return {
              id: attachment?.id ?? `${Date.now()}-${index}-${attachmentIndex}`,
              name: attachment?.name ?? 'lampiran',
              src: attachment?.src ?? '',
            }
          })
          .filter(Boolean)
      : [],
  }))
}

const loadDraft = () => {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

const fileToDataUrl = (fileValue) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('Gagal membaca file'))
    reader.readAsDataURL(fileValue)
  })

const hexToRgb = (hexValue) => {
  const normalized = hexValue.replace('#', '')
  const fullHex =
    normalized.length === 3
      ? normalized
          .split('')
          .map((char) => `${char}${char}`)
          .join('')
      : normalized

  const intValue = Number.parseInt(fullHex, 16)
  return {
    r: (intValue >> 16) & 255,
    g: (intValue >> 8) & 255,
    b: intValue & 255,
  }
}

const formatDateShort = (value) => {
  if (!value) return '-'
  const dateValue = new Date(`${value}T00:00:00`)
  if (Number.isNaN(dateValue.getTime())) return value
  return dateValue.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}

const formatDateLong = (value) => {
  if (!value) return '-'
  const dateValue = new Date(`${value}T00:00:00`)
  if (Number.isNaN(dateValue.getTime())) return value
  return dateValue.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
}

const getImageFormatFromDataUrl = (src = '') => {
  if (src.startsWith('data:image/png')) return 'PNG'
  if (src.startsWith('data:image/webp')) return 'WEBP'
  return 'JPEG'
}

function App() {
  const draft = loadDraft()
  const [employeeName, setEmployeeName] = useState(draft?.employeeName ?? '')
  const [employeeNipp, setEmployeeNipp] = useState(draft?.employeeNipp ?? '')
  const [startDate, setStartDate] = useState(draft?.startDate ?? '')
  const [endDate, setEndDate] = useState(draft?.endDate ?? '')
  const [items, setItems] = useState(normalizeDraftItems(draft?.items))
  const [templates, setTemplates] = useState(draft?.templates?.length ? draft.templates : QUICK_TEMPLATES)
  const [theme, setTheme] = useState(draft?.theme ?? 'blue')
  const [customThemeColor, setCustomThemeColor] = useState(draft?.customThemeColor ?? '#5668ff')
  const [lastSavedAt, setLastSavedAt] = useState(draft?.lastSavedAt ?? null)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [previewPdfUrl, setPreviewPdfUrl] = useState('')
  const [activeItemId, setActiveItemId] = useState(
    draft?.items?.length ? draft.items[draft.items.length - 1].id : 1,
  )

  const activeTheme = useMemo(() => {
    const baseTheme = THEMES.find((item) => item.key === theme) ?? THEMES[0]
    if (baseTheme.key !== 'custom') return baseTheme
    return { ...baseTheme, color: customThemeColor }
  }, [theme, customThemeColor])

  const saveDraft = () => {
    const payload = {
      employeeName,
      employeeNipp,
      startDate,
      endDate,
      items,
      templates,
      theme,
      customThemeColor,
      lastSavedAt: new Date().toISOString(),
    }
    localStorage.setItem(DRAFT_KEY, JSON.stringify(payload))
    setLastSavedAt(payload.lastSavedAt)
  }

  const clearDraft = () => {
    localStorage.removeItem(DRAFT_KEY)
    setEmployeeName('')
    setEmployeeNipp('')
    setStartDate('')
    setEndDate('')
    setItems([createEmptyItem(1)])
    setTemplates(QUICK_TEMPLATES)
    setTheme('blue')
    setCustomThemeColor('#5668ff')
    setLastSavedAt(null)
    setActiveItemId(1)
  }

  const buildPdfDocument = () => {
    const pdf = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' })
    pdf.setFont('helvetica', 'normal')
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    const marginX = 42
    const contentWidth = pageWidth - marginX * 2
    const themeRgb = hexToRgb(activeTheme.color)
    const reportPeriodShort = `${formatDateShort(startDate)} - ${formatDateShort(endDate)}`
    const reportPeriodLong = `${formatDateLong(startDate)} - ${formatDateLong(endDate)}`
    const reportName = employeeName.trim() || '-'
    const printableItems = items.filter((item) => item.title.trim() || item.description.trim() || item.tags.length > 0)
    let y = 32

    const ensurePage = (requiredHeight = 0) => {
      if (y + requiredHeight <= pageHeight - 56) return
      pdf.addPage()
      pdf.setFillColor(247, 250, 255)
      pdf.rect(0, 0, pageWidth, pageHeight, 'F')
      y = 32
    }

    pdf.setFillColor(247, 250, 255)
    pdf.rect(0, 0, pageWidth, pageHeight, 'F')

    const headerTop = 28
    const headerHeight = 76
    pdf.setFillColor(themeRgb.r, themeRgb.g, themeRgb.b)
    pdf.roundedRect(marginX, headerTop, contentWidth, headerHeight, 12, 12, 'F')
    pdf.setFillColor(255, 255, 255)
    pdf.roundedRect(marginX + contentWidth - 220, headerTop + 11, 190, 30, 10, 10, 'F')

    pdf.setTextColor(255, 255, 255)
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(22)
    pdf.text('WEEKLY REPORT', marginX + 14, headerTop + 30)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(11.5)
    pdf.text('LAPORAN KERJA MINGGUAN', marginX + 14, headerTop + 50)
    pdf.setTextColor(66, 92, 146)
    pdf.setFontSize(11)
    pdf.text(reportPeriodShort, marginX + contentWidth - 125, headerTop + 30, { align: 'center' })

    const infoTableY = headerTop + headerHeight + 18
    const labelColWidth = 90
    const valueColWidth = contentWidth - labelColWidth
    const rowHeight = 24
    const infoRows = [
      ['NAMA', reportName],
      ['NIPP', employeeNipp || '-'],
      ['PERIODE', reportPeriodLong],
    ]

    pdf.setDrawColor(210, 223, 242)
    pdf.setLineWidth(1)
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(11)
    infoRows.forEach((row, index) => {
      const rowY = infoTableY + index * rowHeight
      pdf.setFillColor(index % 2 === 0 ? 255 : 250, index % 2 === 0 ? 255 : 251, index % 2 === 0 ? 255 : 255)
      pdf.rect(marginX, rowY, contentWidth, rowHeight, 'FD')
      pdf.line(marginX + labelColWidth, rowY, marginX + labelColWidth, rowY + rowHeight)
      pdf.setTextColor(36, 56, 86)
      pdf.text(row[0], marginX + 8, rowY + 16)
      pdf.setTextColor(25, 42, 72)
      pdf.text(`: ${row[1]}`, marginX + labelColWidth + 8, rowY + 16)
    })

    y = infoTableY + infoRows.length * rowHeight + 26

    pdf.setTextColor(themeRgb.r, themeRgb.g, themeRgb.b)
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(12.5)
    pdf.text('RINGKASAN PEKERJAAN', marginX, y)
    y += 16

    if (printableItems.length === 0) {
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(11)
      pdf.setTextColor(96, 109, 133)
      pdf.text('Belum ada item pekerjaan.', marginX, y + 8)
    }

    printableItems.forEach((item, index) => {
      const title = item.title.trim() || 'Tanpa judul'
      const description = item.description.trim() || '-'
      const primaryTag = item.tags.length > 0 ? item.tags[0] : ''
      const attachments = item.attachments.filter((attachment) => attachment?.src)
      const itemInnerX = marginX + 56
      const itemInnerWidth = contentWidth - 68
      const descLines = pdf.splitTextToSize(description, itemInnerWidth)
      const imageWidth = itemInnerWidth
      const imageBlocks = attachments
        .map((attachment, attachmentIndex) => {
          try {
            const props = pdf.getImageProperties(attachment.src)
            const imageFormat = getImageFormatFromDataUrl(attachment.src)
            const ratio = props?.width ? props.height / props.width : 0.62
            const renderedWidth = imageWidth
            const renderedHeight = Math.max(90, renderedWidth * ratio)
            return { attachment, attachmentIndex, imageFormat, renderedWidth, renderedHeight }
          } catch {
            return null
          }
        })
        .filter(Boolean)
      const imagesHeight =
        imageBlocks.length > 0
          ? imageBlocks.reduce((total, block) => total + block.renderedHeight + 24 + 8, 0)
          : 0
      const titleBlockHeight = primaryTag ? 62 : 46
      const boxHeight = Math.max(132, titleBlockHeight + descLines.length * 14 + imagesHeight + 20)

      ensurePage(boxHeight + 10)
      pdf.setDrawColor(215, 226, 241)
      pdf.setFillColor(255, 255, 255)
      pdf.roundedRect(marginX, y, contentWidth, boxHeight, 8, 8, 'FD')

      pdf.setFillColor(221, 234, 255)
      pdf.circle(marginX + 20, y + 26, 11, 'F')
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(10)
      pdf.setTextColor(themeRgb.r, themeRgb.g, themeRgb.b)
      pdf.text(String(index + 1), marginX + 20, y + 29, { align: 'center' })

      let textY = y + 24
      if (primaryTag) {
        const tagText = primaryTag.toUpperCase()
        const tagWidth = Math.min(120, pdf.getTextWidth(tagText) + 18)
        pdf.setFillColor(40, 186, 102)
        pdf.roundedRect(itemInnerX, y + 12, tagWidth, 17, 5, 5, 'F')
        pdf.setTextColor(255, 255, 255)
        pdf.setFont('helvetica', 'bold')
        pdf.setFontSize(8.5)
        pdf.text(tagText, itemInnerX + tagWidth / 2, y + 23, { align: 'center' })
        textY = y + 48
      }

      pdf.setTextColor(25, 42, 72)
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(13)
      pdf.text(title, itemInnerX, textY)

      const descY = textY + 22
      pdf.setTextColor(34, 48, 74)
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(10)
      pdf.text(descLines, itemInnerX, descY)

      if (imageBlocks.length > 0) {
        let imageY = descY + descLines.length * 14 + 10
        imageBlocks.forEach((block) => {
          const imageX = itemInnerX
          try {
            pdf.addImage(
              block.attachment.src,
              block.imageFormat,
              imageX,
              imageY,
              block.renderedWidth,
              block.renderedHeight,
              undefined,
              'FAST',
            )
          } catch {
            // Continue even if image fails to render.
          }

          pdf.setFillColor(241, 245, 251)
          pdf.rect(imageX, imageY + block.renderedHeight, imageWidth, 20, 'F')
          pdf.setTextColor(87, 103, 132)
          pdf.setFont('helvetica', 'normal')
          pdf.setFontSize(9)
          pdf.text(`Bukti ${index + 1}.${block.attachmentIndex + 1}`, imageX + imageWidth / 2, imageY + block.renderedHeight + 13, {
            align: 'center',
          })

          imageY += block.renderedHeight + 28
        })
      }

      y += boxHeight + 10
    })

    const totalPages = pdf.getNumberOfPages()
    for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
      pdf.setPage(pageNumber)
      const footerText = `Weekly Report - ${reportName} - ${reportPeriodShort}  Halaman ${pageNumber} dari ${totalPages}`
      pdf.setTextColor(120, 132, 154)
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(9)
      pdf.text(footerText, marginX, pageHeight - 24)
    }

    return pdf
  }

  const openPreview = () => {
    try {
      if (previewPdfUrl) URL.revokeObjectURL(previewPdfUrl)
      const pdf = buildPdfDocument()
      const blob = pdf.output('blob')
      const url = URL.createObjectURL(blob)
      setPreviewPdfUrl(url)
      setIsPreviewOpen(true)
    } catch {
      alert('Gagal membuat preview PDF.')
    }
  }

  const closePreview = () => {
    setIsPreviewOpen(false)
    if (previewPdfUrl) {
      URL.revokeObjectURL(previewPdfUrl)
      setPreviewPdfUrl('')
    }
  }

  const downloadPdf = () => {
    try {
      const pdf = buildPdfDocument()
      const namePart = employeeName.trim() ? employeeName.trim().replace(/\s+/g, '-').toLowerCase() : 'karyawan'
      const startPart = startDate || 'start'
      const endPart = endDate || 'end'
      pdf.save(`weekly-report_${namePart}_${startPart}_${endPart}.pdf`)
    } catch {
      alert('Gagal generate PDF.')
    }
  }

  const appendAttachments = async (itemId, fileList) => {
    const files = Array.from(fileList ?? [])
    if (files.length === 0) return

    const createdAttachments = await Promise.all(
      files.map(async (fileValue, index) => ({
        id: `${Date.now()}-${index}-${Math.random().toString(16).slice(2)}`,
        name: fileValue.name || `lampiran-${index + 1}.png`,
        src: await fileToDataUrl(fileValue),
      })),
    )

    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, attachments: [...item.attachments, ...createdAttachments] } : item,
      ),
    )
  }

  useEffect(() => {
    const timeout = setTimeout(saveDraft, 300)
    return () => clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeName, employeeNipp, startDate, endDate, items, templates, theme, customThemeColor])

  useEffect(() => {
    const onKeyDown = (event) => {
      if (!event.ctrlKey) return
      if (event.key.toLowerCase() === 's') {
        event.preventDefault()
        saveDraft()
      }
      if (event.key === 'Enter') {
        event.preventDefault()
        downloadPdf()
      }
      if (event.key === 'Escape') {
        closePreview()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    employeeName,
    employeeNipp,
    startDate,
    endDate,
    items,
    templates,
    theme,
    customThemeColor,
    activeTheme,
    previewPdfUrl,
  ])

  useEffect(
    () => () => {
      if (previewPdfUrl) URL.revokeObjectURL(previewPdfUrl)
    },
    [previewPdfUrl],
  )

  useEffect(() => {
    const onPaste = (event) => {
      const clipboardItems = Array.from(event.clipboardData?.items ?? [])
      const imageFiles = clipboardItems
        .filter((clipboardItem) => clipboardItem.type.startsWith('image/'))
        .map((clipboardItem) => clipboardItem.getAsFile())
        .filter(Boolean)

      if (imageFiles.length === 0) return

      event.preventDefault()
      const targetId = activeItemId ?? items[0]?.id
      if (!targetId) return

      appendAttachments(targetId, imageFiles)
    }

    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [activeItemId, items])

  const addItem = (title = '') => {
    const newId = Date.now()
    setItems((prev) => [...prev, { ...createEmptyItem(newId), title }])
    setActiveItemId(newId)
  }

  const updateItem = (id, patch) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)))
  }

  const removeItem = (id) => {
    setItems((prev) => {
      if (prev.length === 1) return prev
      const nextItems = prev.filter((item) => item.id !== id)
      if (activeItemId === id) {
        setActiveItemId(nextItems[nextItems.length - 1]?.id ?? nextItems[0]?.id ?? null)
      }
      return nextItems
    })
  }

  const removeAttachment = (itemId, attachmentId) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? {
              ...item,
              attachments: item.attachments.filter((attachment) => attachment.id !== attachmentId),
            }
          : item,
      ),
    )
  }

  const toggleTag = (id, tagValue) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item
        const exists = item.tags.includes(tagValue)
        return {
          ...item,
          tags: exists ? item.tags.filter((tag) => tag !== tagValue) : [...item.tags, tagValue],
        }
      }),
    )
  }

  const addTemplate = () => {
    const name = prompt('Nama template baru:')
    if (!name) return
    setTemplates((prev) => (prev.includes(name) ? prev : [...prev, name]))
  }

  const formatSavedTime = () => {
    if (!lastSavedAt) return 'Belum ada draft'
    return new Date(lastSavedAt).toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const copySummary = async () => {
    const summary = items
      .map((item, index) => `${index + 1}. ${item.title || 'Tanpa judul'}\n${item.description || '-'}`)
      .join('\n\n')

    await navigator.clipboard.writeText(summary || 'Belum ada ringkasan pekerjaan.')
    alert('Ringkasan berhasil disalin.')
  }

  return (
    <>
      <main className="page">
        <section className="hero" style={{ '--theme-color': activeTheme.color }}>
          <div className="hero-left">
            <div className="hero-icon" aria-hidden="true">
              <FileText className="icon-md" />
            </div>
            <div>
              <h1>Weekly Report Generator</h1>
              <p>Buat laporan kerja mingguan yang profesional &amp; generate PDF.</p>
            </div>
          </div>
          <div className="shortcut-box">
            <span>SHORTCUT</span>
            <code>Ctrl+Enter -&gt; Download PDF</code>
            <code>Ctrl+S -&gt; Save Draft</code>
          </div>
        </section>

        <section className="draft-row">
          <p>
            <Save className="icon-sm" /> Draft tersimpan - {formatSavedTime()}
          </p>
          <button onClick={clearDraft} className="ghost-btn icon-btn" type="button">
            <Trash2 className="icon-sm" />
            Hapus Draft
          </button>
        </section>

        <section className="card">
          <header className="card-head">
            <div className="badge" aria-hidden="true">
              <UserRound className="icon-md" />
            </div>
            <h2>Informasi Laporan</h2>
          </header>

          <div className="field-grid">
            <label className="field full">
              <span>NAMA KARYAWAN</span>
              <input
                placeholder="Masukkan nama lengkap..."
                value={employeeName}
                onChange={(event) => setEmployeeName(event.target.value)}
              />
            </label>

            <label className="field full">
              <span>NIPP KARYAWAN</span>
              <input
                placeholder="Masukkan NIPP..."
                value={employeeNipp}
                onChange={(event) => setEmployeeNipp(event.target.value)}
              />
            </label>

            <label className="field">
              <span>
                <CalendarDays className="icon-xs" /> MULAI
              </span>
              <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
            </label>

            <label className="field">
              <span>
                <CalendarDays className="icon-xs" /> SELESAI
              </span>
              <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
            </label>
          </div>
        </section>

        <section className="card">
          <header className="card-head">
            <div className="badge" aria-hidden="true">
              <CheckCheck className="icon-md" />
            </div>
            <div>
              <h2>Ringkasan Pekerjaan</h2>
              <p className="sub">Tambahkan bukti gambar di setiap item</p>
            </div>
          </header>

          <div className="template-row">
            <p>
              <Tag className="icon-xs" /> Template Cepat
            </p>
            <div className="chips">
              {templates.map((template) => (
                <button key={template} type="button" className="chip" onClick={() => addItem(template)}>
                  {template}
                </button>
              ))}
              <button type="button" className="chip chip-dashed" onClick={addTemplate}>
                <Plus className="icon-xs" /> Tambah Template
              </button>
            </div>
          </div>

          <div className="items-wrap">
            {items.map((item, index) => (
              <article className="task-item" key={item.id}>
                <div className="task-head">
                  <span className="item-no">{index + 1}</span>
                  <input
                    className="task-title"
                    placeholder="Judul task..."
                    value={item.title}
                    onChange={(event) => updateItem(item.id, { title: event.target.value })}
                    onFocus={() => setActiveItemId(item.id)}
                  />
                  <button type="button" className="ghost-btn danger icon-btn" onClick={() => removeItem(item.id)}>
                    <Trash2 className="icon-xs" />
                    Hapus
                  </button>
                </div>

                <textarea
                  className="task-desc"
                  placeholder="Deskripsikan pekerjaan..."
                  maxLength={500}
                  value={item.description}
                  onChange={(event) => updateItem(item.id, { description: event.target.value })}
                  onFocus={() => setActiveItemId(item.id)}
                />
                <small className="counter">{item.description.length}/500</small>

                <div className="chips">
                  {DEFAULT_TAGS.map((tagValue) => {
                    const selected = item.tags.includes(tagValue)
                    return (
                      <button
                        key={tagValue}
                        type="button"
                        className={`tag ${selected ? 'active' : ''}`}
                        onClick={() => toggleTag(item.id, tagValue)}
                      >
                        {tagValue}
                      </button>
                    )
                  })}
                </div>

                <label className="upload-box">
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={async (event) => {
                      await appendAttachments(item.id, event.target.files)
                      event.target.value = ''
                    }}
                  />
                  <span>
                    <Upload className="icon-xs" /> Pilih file - klik di sini atau Ctrl+V untuk paste screenshot
                    {item.attachments.length > 0 ? ` (${item.attachments.length} file)` : ''}
                  </span>
                </label>

                {item.attachments.length > 0 && (
                  <div className="attachment-grid">
                    {item.attachments.map((attachment) => (
                      <figure className="attachment-card" key={attachment.id}>
                        <button
                          type="button"
                          className="attachment-remove"
                          onClick={() => removeAttachment(item.id, attachment.id)}
                          aria-label={`Hapus ${attachment.name}`}
                        >
                          <Trash2 className="icon-xs" />
                        </button>
                        {attachment.src ? (
                          <img src={attachment.src} alt={attachment.name} />
                        ) : (
                          <div className="attachment-empty">No preview</div>
                        )}
                        <figcaption>{attachment.name}</figcaption>
                      </figure>
                    ))}
                  </div>
                )}
              </article>
            ))}

            <button className="add-item icon-btn" onClick={() => addItem('')} type="button">
              <Plus className="icon-sm" /> Tambah Item Pekerjaan
            </button>
          </div>
        </section>

        <section className="card action-card">
          <header className="theme-head">
            <h3>
              <Palette className="icon-xs" /> TEMA PDF
            </h3>
            <span>{activeTheme.label}</span>
          </header>

          <div className="theme-grid">
            {THEMES.map((item) => (
              <button
                key={item.key}
                type="button"
                className={`theme-dot ${theme === item.key ? 'selected' : ''}`}
                onClick={() => setTheme(item.key)}
              >
                <i style={{ backgroundColor: item.color }}></i>
                {item.label}
              </button>
            ))}
          </div>
          {theme === 'custom' && (
            <div className="custom-palette">
              <p>Pilih warna custom:</p>
              <div className="custom-palette-row">
                {CUSTOM_SWATCHES.map((swatch) => (
                  <button
                    key={swatch}
                    type="button"
                    className={`swatch ${customThemeColor === swatch ? 'active' : ''}`}
                    style={{ backgroundColor: swatch }}
                    onClick={() => setCustomThemeColor(swatch)}
                    aria-label={`Pilih warna ${swatch}`}
                  ></button>
                ))}
                <label className="swatch-picker" title="Pilih warna lain">
                  <input
                    type="color"
                    value={customThemeColor}
                    onChange={(event) => setCustomThemeColor(event.target.value)}
                  />
                </label>
              </div>
            </div>
          )}

          <div className="actions">
            <button type="button" className="outline icon-btn" onClick={openPreview}>
              <Eye className="icon-sm" /> Preview PDF
            </button>
            <button type="button" className="primary icon-btn" onClick={downloadPdf}>
              <FileText className="icon-sm" /> Download PDF
            </button>
          </div>

          <button type="button" className="copy-btn icon-btn" onClick={copySummary}>
            <ClipboardList className="icon-sm" /> Salin Ringkasan Teks
          </button>

          <p className="footer-note">Weekly Report Generator - Data tersimpan lokal di browser Anda</p>
        </section>
      </main>

      {isPreviewOpen && (
        <div className="preview-modal" role="dialog" aria-modal="true">
          <div className="preview-backdrop" onClick={closePreview}></div>
          <section className="preview-panel">
            <header className="preview-head">
              <h3>Preview PDF</h3>
              <button type="button" className="ghost-btn icon-btn" onClick={closePreview}>
                <X className="icon-xs" /> Tutup
              </button>
            </header>

            <div className="preview-pdf-wrap">
              {previewPdfUrl ? (
                <iframe title="PDF Preview" src={previewPdfUrl} className="preview-pdf-frame" />
              ) : (
                <div className="preview-empty">Preview belum tersedia.</div>
              )}
            </div>
          </section>
        </div>
      )}
    </>
  )
}

export default App
