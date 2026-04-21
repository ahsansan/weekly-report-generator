import { useEffect, useMemo, useRef, useState } from 'react'
import { jsPDF } from 'jspdf'
import {
  CalendarDays,
  CheckCheck,
  ClipboardList,
  Eye,
  FileText,
  Menu,
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

const QUICK_TEMPLATES = ['Daily Standup', 'Code Review', 'Testing & QA', 'Dokumentasi', 'Rapat Tim', 'Bug Fixing']

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
const MARKDOWN_DRAFT_KEY = 'markdown-to-pdf-draft'
const PDF_EXPORT_WINDOW_WIDTH = 760
const TOOL_ROUTES = [
  { path: '/', label: 'Weekly Report Tool' },
  { path: '/md-to-pdf', label: 'Markdown to PDF' },
]

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

const loadMarkdownDraft = () => {
  try {
    const raw = localStorage.getItem(MARKDOWN_DRAFT_KEY)
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

const fileToText = (fileValue) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '')
    reader.onerror = () => reject(new Error('Gagal membaca file markdown'))
    reader.readAsText(fileValue)
  })

const decodeMarkdownFile = async (fileValue) => {
  const buffer = await fileValue.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  const hasUtf16LeBom = bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe
  const hasUtf16BeBom = bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff
  const hasUtf8Bom = bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf
  const encodings = hasUtf16LeBom
    ? ['utf-16le', 'utf-8']
    : hasUtf16BeBom
      ? ['utf-16be', 'utf-8']
      : hasUtf8Bom
        ? ['utf-8', 'utf-16le']
        : ['utf-8', 'utf-16le', 'utf-16be']

  const decodedCandidates = encodings
    .map((encoding) => {
      try {
        const value = new TextDecoder(encoding).decode(bytes)
        return { encoding, value }
      } catch {
        return null
      }
    })
    .filter(Boolean)

  if (decodedCandidates.length === 0) {
    return fileToText(fileValue)
  }

  const sorted = decodedCandidates.sort((a, b) => {
    const score = (value) => {
      const nullCount = value.split('\0').length - 1
      const replacementCount = (value.match(/\uFFFD/g) || []).length
      return nullCount * 5 + replacementCount * 3
    }
    return score(a.value) - score(b.value)
  })

  return sorted[0].value
}

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

const toSafeFileName = (value, fallback = 'document') => {
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-')
  const compact = normalized.replace(/-+/g, '-').replace(/^-|-$/g, '')
  return compact || fallback
}

const EMOJI_REGEX = /\p{Extended_Pictographic}/u

const toTwemojiCodepoint = (emojiValue) =>
  Array.from(emojiValue)
    .map((char) => char.codePointAt(0)?.toString(16))
    .filter(Boolean)
    .filter((codepoint) => codepoint !== 'fe0f')
    .join('-')

const splitGraphemes = (value) => {
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    const segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' })
    return Array.from(segmenter.segment(value), (segment) => segment.segment)
  }
  return Array.from(value)
}

const replaceEmojiTextWithImages = (rootNode) => {
  const walker = document.createTreeWalker(rootNode, NodeFilter.SHOW_TEXT)
  const textNodes = []
  let currentNode = walker.nextNode()

  while (currentNode) {
    if (currentNode.nodeValue && EMOJI_REGEX.test(currentNode.nodeValue)) {
      textNodes.push(currentNode)
    }
    currentNode = walker.nextNode()
  }

  textNodes.forEach((textNode) => {
    const textValue = textNode.nodeValue || ''
    const parts = splitGraphemes(textValue)
    const fragment = document.createDocumentFragment()
    let hasEmoji = false

    parts.forEach((part) => {
      if (EMOJI_REGEX.test(part)) {
        hasEmoji = true
        const codepoint = toTwemojiCodepoint(part)
        const img = document.createElement('img')
        img.alt = part
        img.src = `https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/${codepoint}.png`
        img.width = 18
        img.height = 18
        img.setAttribute('data-emoji-fallback', 'true')
        img.style.width = '1em'
        img.style.height = '1em'
        img.style.verticalAlign = '-0.16em'
        img.style.display = 'inline-block'
        fragment.appendChild(img)
      } else {
        fragment.appendChild(document.createTextNode(part))
      }
    })

    if (hasEmoji) {
      textNode.parentNode?.replaceChild(fragment, textNode)
    }
  })
}

const waitForImages = async (rootNode) => {
  const images = Array.from(rootNode.querySelectorAll('img'))
  if (images.length === 0) return
  await Promise.all(
    images.map(
      (img) =>
        new Promise((resolve) => {
          if (img.complete) {
            resolve()
            return
          }
          const done = () => resolve()
          img.addEventListener('load', done, { once: true })
          img.addEventListener('error', done, { once: true })
        }),
    ),
  )
}

const stripInlineMarkdown = (value = '') =>
  value
    .split('\0')
    .join('')
    .replace(/\[!(TIP|NOTE|IMPORTANT|WARNING|CAUTION)\]\s*/gi, '')
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '$1')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .trim()

const isSpecialMarkdownLine = (line) => {
  const trimmed = line.trim()
  if (!trimmed) return true
  if (trimmed.startsWith('```')) return true
  if (/^#{1,6}\s+/.test(trimmed)) return true
  if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) return true
  if (/^>\s?/.test(trimmed)) return true
  if (/^[-*+]\s+/.test(trimmed)) return true
  if (/^\d+\.\s+/.test(trimmed)) return true
  return false
}

const parseTableCells = (line) =>
  line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => stripInlineMarkdown(cell.trim()))

const isMarkdownTableSeparatorLine = (line) => {
  const normalized = line.trim().replace(/^\|/, '').replace(/\|$/, '')
  if (!normalized.includes('-')) return false
  return normalized
    .split('|')
    .every((part) => /^:?-{3,}:?$/.test(part.trim()))
}

const isLikelyMarkdownTableRow = (line) => line.includes('|') && line.trim() !== ''

const parseMarkdownBlocks = (markdownText) => {
  const lines = markdownText.replace(/\r\n/g, '\n').split('\n')
  const blocks = []
  let index = 0
  let inCodeBlock = false
  let codeLines = []

  while (index < lines.length) {
    const line = lines[index]
    const trimmed = line.trim()

    if (trimmed.startsWith('```')) {
      if (inCodeBlock) {
        blocks.push({ type: 'code', content: codeLines.join('\n') })
        codeLines = []
        inCodeBlock = false
      } else {
        inCodeBlock = true
      }
      index += 1
      continue
    }

    if (inCodeBlock) {
      codeLines.push(line)
      index += 1
      continue
    }

    if (!trimmed) {
      blocks.push({ type: 'spacer' })
      index += 1
      continue
    }

    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/)
    if (headingMatch) {
      blocks.push({ type: 'heading', level: headingMatch[1].length, text: stripInlineMarkdown(headingMatch[2]) })
      index += 1
      continue
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      blocks.push({ type: 'hr' })
      index += 1
      continue
    }

    const nextLine = lines[index + 1]?.trim() ?? ''
    if (isLikelyMarkdownTableRow(trimmed) && isMarkdownTableSeparatorLine(nextLine)) {
      const headers = parseTableCells(trimmed)
      const rows = []
      index += 2
      while (index < lines.length && isLikelyMarkdownTableRow(lines[index])) {
        rows.push(parseTableCells(lines[index]))
        index += 1
      }
      blocks.push({ type: 'table', headers, rows })
      continue
    }

    if (/^>\s?/.test(trimmed)) {
      const quoteLines = []
      while (index < lines.length && /^>\s?/.test(lines[index].trim())) {
        quoteLines.push(lines[index].trim().replace(/^>\s?/, ''))
        index += 1
      }
      blocks.push({ type: 'quote', text: stripInlineMarkdown(quoteLines.join('\n')) })
      continue
    }

    if (/^[-*+]\s+/.test(trimmed)) {
      const items = []
      while (index < lines.length && /^[-*+]\s+/.test(lines[index].trim())) {
        items.push(stripInlineMarkdown(lines[index].trim().replace(/^[-*+]\s+/, '')))
        index += 1
      }
      blocks.push({ type: 'unordered-list', items })
      continue
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      const items = []
      while (index < lines.length && /^\d+\.\s+/.test(lines[index].trim())) {
        items.push(stripInlineMarkdown(lines[index].trim().replace(/^\d+\.\s+/, '')))
        index += 1
      }
      blocks.push({ type: 'ordered-list', items })
      continue
    }

    const paragraphLines = []
    while (index < lines.length && !isSpecialMarkdownLine(lines[index])) {
      paragraphLines.push(lines[index].trim())
      index += 1
    }
    blocks.push({ type: 'paragraph', text: stripInlineMarkdown(paragraphLines.join(' ')) })
  }

  if (inCodeBlock && codeLines.length > 0) {
    blocks.push({ type: 'code', content: codeLines.join('\n') })
  }

  return blocks
}

const markdownBlocksToReact = (blocks) =>
  blocks.map((block, index) => {
    if (block.type === 'spacer') return <div key={`sp-${index}`} className="md-spacer" />
    if (block.type === 'heading') {
      const HeadingTag = `h${Math.min(block.level, 6)}`
      return <HeadingTag key={`h-${index}`}>{block.text}</HeadingTag>
    }
    if (block.type === 'paragraph') return <p key={`p-${index}`}>{block.text}</p>
    if (block.type === 'hr') return <hr key={`hr-${index}`} />
    if (block.type === 'quote') return <blockquote key={`q-${index}`}>{block.text}</blockquote>
    if (block.type === 'code') return <pre key={`c-${index}`}>{block.content}</pre>
    if (block.type === 'table') {
      return (
        <table key={`tb-${index}`}>
          <thead>
            <tr>
              {block.headers.map((header, headerIndex) => (
                <th key={`th-${index}-${headerIndex}`}>{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row, rowIndex) => (
              <tr key={`tr-${index}-${rowIndex}`}>
                {row.map((cell, cellIndex) => (
                  <td key={`td-${index}-${rowIndex}-${cellIndex}`}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )
    }
    if (block.type === 'unordered-list') {
      return (
        <ul key={`ul-${index}`}>
          {block.items.map((item, itemIndex) => (
            <li key={`ul-${index}-${itemIndex}`}>{item}</li>
          ))}
        </ul>
      )
    }
    if (block.type === 'ordered-list') {
      return (
        <ol key={`ol-${index}`}>
          {block.items.map((item, itemIndex) => (
            <li key={`ol-${index}-${itemIndex}`}>{item}</li>
          ))}
        </ol>
      )
    }
    return null
  })

const getInitialPath = () => {
  const currentPath = window.location.pathname || '/'
  return TOOL_ROUTES.some((route) => route.path === currentPath) ? currentPath : '/'
}

function WeeklyReportTool() {
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
        imageBlocks.length > 0 ? imageBlocks.reduce((total, block) => total + block.renderedHeight + 24 + 8, 0) : 0
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
  }, [employeeName, employeeNipp, startDate, endDate, items, templates, theme, customThemeColor, activeTheme, previewPdfUrl])

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
    const newId =
      items.reduce((maxId, item) => {
        const numericId = Number(item.id)
        return Number.isFinite(numericId) ? Math.max(maxId, numericId) : maxId
      }, 0) + 1
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
    return new Date(lastSavedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
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
                        {attachment.src ? <img src={attachment.src} alt={attachment.name} /> : <div className="attachment-empty">No preview</div>}
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
              {previewPdfUrl ? <iframe title="PDF Preview" src={previewPdfUrl} className="preview-pdf-frame" /> : <div className="preview-empty">Preview belum tersedia.</div>}
            </div>
          </section>
        </div>
      )}
    </>
  )
}

function MarkdownToPdfTool() {
  const draft = loadMarkdownDraft()
  const [markdownText, setMarkdownText] = useState(draft?.markdownText ?? '# Contoh Dokumen\n\nTulis markdown di sini.')
  const [fileName, setFileName] = useState(draft?.fileName ?? 'markdown-document')
  const [isExporting, setIsExporting] = useState(false)
  const [activeTab, setActiveTab] = useState('editor')
  const blocks = useMemo(() => parseMarkdownBlocks(markdownText), [markdownText])
  const exportRef = useRef(null)

  useEffect(() => {
    const timeout = setTimeout(() => {
      localStorage.setItem(MARKDOWN_DRAFT_KEY, JSON.stringify({ markdownText, fileName }))
    }, 250)
    return () => clearTimeout(timeout)
  }, [markdownText, fileName])

  const onUploadMarkdown = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const content = await decodeMarkdownFile(file)
      setMarkdownText(content.split('\0').join(''))
      setFileName(file.name.replace(/\.(md|markdown|txt)$/i, ''))
    } catch {
      alert('Gagal membaca file markdown.')
    } finally {
      event.target.value = ''
    }
  }

  const clearAll = () => {
    setMarkdownText('')
    setFileName('markdown-document')
    localStorage.removeItem(MARKDOWN_DRAFT_KEY)
  }

  const copyMarkdown = async () => {
    await navigator.clipboard.writeText(markdownText)
    alert('Markdown berhasil disalin.')
  }

  const downloadPdf = async () => {
    if (isExporting) return

    try {
      setIsExporting(true)
      const safeFileName = toSafeFileName(fileName, 'markdown-document')
      const targetElement = exportRef.current
      if (!targetElement) throw new Error('Elemen export tidak ditemukan')
      if (document.fonts?.ready) await document.fonts.ready

      const renderContainer = document.createElement('div')
      renderContainer.className = 'md-export-render-shell'
      const clonedElement = targetElement.cloneNode(true)
      renderContainer.appendChild(clonedElement)
      document.body.appendChild(renderContainer)

      replaceEmojiTextWithImages(clonedElement)
      await waitForImages(clonedElement)

      const pdf = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait', compress: true })
      const { default: html2canvas } = await import('html2canvas')
      const canvas = await html2canvas(clonedElement, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        windowWidth: PDF_EXPORT_WINDOW_WIDTH,
      })

      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      const margin = 24
      const contentWidth = pageWidth - margin * 2
      const contentHeight = pageHeight - margin * 2

      const pxPerPt = canvas.width / contentWidth
      const pageSliceHeightPx = Math.max(1, Math.floor(contentHeight * pxPerPt))
      const domHeight = Math.max(1, Math.ceil(clonedElement.scrollHeight))
      const domToCanvasScale = canvas.height / domHeight
      const minSliceHeightPx = Math.floor(pageSliceHeightPx * 0.6)
      const maxSliceHeightPx = Math.floor(pageSliceHeightPx * 1.25)
      const blockBoundariesPx = Array.from(clonedElement.children)
        .map((element) => {
          const htmlElement = element
          const endPx = (htmlElement.offsetTop + htmlElement.offsetHeight) * domToCanvasScale
          return Math.max(1, Math.floor(endPx))
        })
        .filter((value) => value > 0 && value < canvas.height)

      let offsetY = 0
      let pageIndex = 0
      while (offsetY < canvas.height) {
        const remaining = canvas.height - offsetY
        let sliceHeight = Math.min(pageSliceHeightPx, remaining)
        if (remaining > pageSliceHeightPx) {
          const preferredEnd = offsetY + pageSliceHeightPx
          const candidateBoundaries = blockBoundariesPx.filter(
            (value) => value > offsetY + minSliceHeightPx && value <= offsetY + maxSliceHeightPx,
          )

          if (candidateBoundaries.length > 0) {
            const atOrBeforePreferred = candidateBoundaries.filter((value) => value <= preferredEnd)
            const selectedBoundary =
              atOrBeforePreferred.length > 0
                ? atOrBeforePreferred[atOrBeforePreferred.length - 1]
                : candidateBoundaries[0]
            sliceHeight = Math.max(1, selectedBoundary - offsetY)
          }
        }

        const pageCanvas = document.createElement('canvas')
        pageCanvas.width = canvas.width
        pageCanvas.height = sliceHeight
        const ctx = pageCanvas.getContext('2d')
        if (!ctx) throw new Error('Gagal membuat canvas context')

        ctx.drawImage(canvas, 0, offsetY, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight)
        const imageData = pageCanvas.toDataURL('image/png')
        const renderedHeightPt = sliceHeight / pxPerPt

        if (pageIndex > 0) pdf.addPage()
        pdf.addImage(imageData, 'PNG', margin, margin, contentWidth, renderedHeightPt, undefined, 'FAST')

        offsetY += sliceHeight
        pageIndex += 1
      }

      document.body.removeChild(renderContainer)
      pdf.save(`${safeFileName}.pdf`)
    } catch {
      alert('Gagal convert markdown ke PDF.')
    } finally {
      const oldShell = document.querySelector('.md-export-render-shell')
      if (oldShell?.parentNode) oldShell.parentNode.removeChild(oldShell)
      setIsExporting(false)
    }
  }

  return (
    <main className="page md-page">
      <section className="hero md-hero" style={{ '--theme-color': '#57B5E0' }}>
        <div className="hero-left">
          <div className="hero-icon" aria-hidden="true">
            <FileText className="icon-md" />
          </div>
          <div>
            <h1>Markdown to PDF</h1>
            <p>Konversi markdown ke PDF dengan preview langsung.</p>
          </div>
        </div>
        <div className="shortcut-box">
          <span>FITUR</span>
          <code>Upload .md</code>
          <code>Live Preview + Download PDF</code>
        </div>
      </section>

      <section className="card md-toolbar-card">
        <div className="md-toolbar-grid">
          <label className="field">
            <span>Nama File PDF</span>
            <input
              placeholder="contoh: catatan-mingguan"
              value={fileName}
              onChange={(event) => setFileName(event.target.value)}
            />
          </label>

          <label className="upload-box md-upload-box">
            <input type="file" accept=".md,.markdown,.txt,text/markdown,text/plain" onChange={onUploadMarkdown} />
            <span>
              <Upload className="icon-xs" /> Upload file markdown
            </span>
          </label>

          <div className="md-toolbar-actions">
            <button type="button" className="outline icon-btn" onClick={copyMarkdown}>
              <ClipboardList className="icon-sm" /> Copy Markdown
            </button>
            <button type="button" className="outline icon-btn" onClick={clearAll}>
              <Trash2 className="icon-sm" /> Clear
            </button>
            <button type="button" className="primary icon-btn" onClick={downloadPdf} disabled={isExporting}>
              <FileText className="icon-sm" /> {isExporting ? 'Generating...' : 'Download PDF'}
            </button>
          </div>
        </div>
      </section>

      <section className="card md-tab-card">
        <div className="md-tabs">
          <button
            type="button"
            className={`md-tab ${activeTab === 'editor' ? 'active' : ''}`}
            onClick={() => setActiveTab('editor')}
          >
            Markdown Input
          </button>
          <button
            type="button"
            className={`md-tab ${activeTab === 'preview' ? 'active' : ''}`}
            onClick={() => setActiveTab('preview')}
          >
            <Eye className="icon-sm" /> Live Preview
          </button>
        </div>

        {activeTab === 'editor' ? (
          <article className="md-panel">
            <div className="md-panel-body">
              <textarea
                className="md-editor"
                placeholder="Ketik markdown di sini..."
                value={markdownText}
                onChange={(event) => setMarkdownText(event.target.value)}
              />
            </div>
          </article>
        ) : (
          <article className="md-panel">
            <div className="md-panel-body">
              <div className="md-preview">{markdownText.trim() ? markdownBlocksToReact(blocks) : <p>Belum ada markdown.</p>}</div>
            </div>
          </article>
        )}
      </section>

      <div className="md-export-root" aria-hidden="true">
        <article className="md-export-doc" ref={exportRef}>
          {markdownText.trim() ? markdownBlocksToReact(blocks) : <p>Belum ada markdown.</p>}
        </article>
      </div>
    </main>
  )
}

function App() {
  const [pathname, setPathname] = useState(getInitialPath)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  useEffect(() => {
    document.title = pathname === '/md-to-pdf' ? 'Convert Markdown to PDF' : 'Weekly Report Generator'
  }, [pathname])

  useEffect(() => {
    const onPopState = () => setPathname(getInitialPath())
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth > 840) setIsMobileMenuOpen(false)
    }

    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const navigate = (nextPath) => {
    if (pathname === nextPath) return
    window.history.pushState({}, '', nextPath)
    setPathname(nextPath)
    setIsMobileMenuOpen(false)
  }

  return (
    <>
      <header className="tools-nav-wrap">
        <div className="tools-nav-mobile-head">
          <span className="tools-nav-title">Tools</span>
          <button
            type="button"
            className="mobile-nav-toggle"
            onClick={() => setIsMobileMenuOpen((prev) => !prev)}
            aria-expanded={isMobileMenuOpen}
            aria-controls="tools-nav-list"
            aria-label="Toggle navigation menu"
          >
            {isMobileMenuOpen ? <X className="icon-sm" /> : <Menu className="icon-sm" />}
          </button>
        </div>
        <nav className="tools-nav" aria-label="Tools navigation">
          <div id="tools-nav-list" className={`tools-nav-list ${isMobileMenuOpen ? 'open' : ''}`}>
          {TOOL_ROUTES.map((tool) => (
            <a
              key={tool.path}
              href={tool.path}
              className={`tools-nav-link ${pathname === tool.path ? 'active' : ''}`}
              onClick={(event) => {
                event.preventDefault()
                navigate(tool.path)
              }}
            >
              {tool.label}
            </a>
          ))}
          </div>
        </nav>
      </header>

      {pathname === '/md-to-pdf' ? <MarkdownToPdfTool /> : <WeeklyReportTool />}
    </>
  )
}

export default App
