import { useEffect, useMemo, useRef, useState } from 'react'
import { jsPDF } from 'jspdf'
import { ClipboardList, FileText, Trash2, Upload } from 'lucide-react'
import Editor from '@monaco-editor/react'
import '../App.css'

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


function MarkdownToPdfTool() {
  const draft = loadMarkdownDraft()
  const [markdownText, setMarkdownText] = useState(draft?.markdownText ?? '# Contoh Dokumen\n\nTulis markdown di sini.')
  const [fileName, setFileName] = useState(draft?.fileName ?? 'markdown-document')
  const [isExporting, setIsExporting] = useState(false)
  const [mobileTab, setMobileTab] = useState('editor')
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
        <div className="md-tabs md-mobile-tabs">
          <button
            type="button"
            className={`md-tab ${mobileTab === 'editor' ? 'active' : ''}`}
            onClick={() => setMobileTab('editor')}
          >
            Markdown Input
          </button>
          <button
            type="button"
            className={`md-tab ${mobileTab === 'preview' ? 'active' : ''}`}
            onClick={() => setMobileTab('preview')}
          >
            Live Preview
          </button>
        </div>

        <div className="md-split">
          <article className={`md-pane ${mobileTab === 'editor' ? 'active' : ''}`}>
            <h3>Markdown Input</h3>
            <Editor
              className="md-editor-monaco"
              defaultLanguage="markdown"
              language="markdown"
              value={markdownText}
              onChange={(value) => setMarkdownText(value ?? '')}
              theme="vs-dark"
              height="100%"
              options={{
                fontSize: 14,
                minimap: { enabled: false },
                lineNumbers: 'on',
                renderLineHighlight: 'all',
                roundedSelection: false,
                scrollBeyondLastLine: false,
                wordWrap: 'on',
                tabSize: 2,
                insertSpaces: true,
                automaticLayout: true,
                guides: {
                  indentation: true,
                  bracketPairs: true,
                },
                bracketPairColorization: {
                  enabled: true,
                },
              }}
              loading={
                <textarea
                  className="md-editor"
                  placeholder="Ketik markdown di sini..."
                  value={markdownText}
                  onChange={(event) => setMarkdownText(event.target.value)}
                />
              }
            />
          </article>

          <article className={`md-pane ${mobileTab === 'preview' ? 'active' : ''}`}>
            <h3>Live Preview</h3>
            <div className="md-preview-wrap">
              <div className="md-preview">{markdownText.trim() ? markdownBlocksToReact(blocks) : <p>Belum ada markdown.</p>}</div>
            </div>
          </article>
        </div>
      </section>

      <div className="md-export-root" aria-hidden="true">
        <article className="md-export-doc" ref={exportRef}>
          {markdownText.trim() ? markdownBlocksToReact(blocks) : <p>Belum ada markdown.</p>}
        </article>
      </div>
    </main>
  )
}


export default MarkdownToPdfTool
