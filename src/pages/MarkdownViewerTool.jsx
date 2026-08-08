import { useEffect, useMemo, useState } from 'react'
import { Clipboard, Eye, FileText, RotateCcw, Trash2, Upload } from 'lucide-react'
import Editor from '@monaco-editor/react'
import '../App.css'

const DRAFT_KEY = 'markdown-viewer-draft'

const SAMPLE_MARKDOWN = `# Markdown Viewer

Preview catatan markdown langsung di browser.

## Checklist

- Upload file .md atau .txt
- Edit isi markdown
- Copy markdown atau plain text preview

> Cocok buat cek README, changelog, catatan meeting, dan draft artikel.

| Fitur | Status |
| --- | --- |
| Heading | OK |
| Table | OK |
| Code block | OK |

\`\`\`js
const message = 'Hello markdown'
console.log(message)
\`\`\``

const loadDraft = () => {
  try {
    return localStorage.getItem(DRAFT_KEY) || null
  } catch {
    return null
  }
}

const decodeTextFile = async (fileValue) => {
  const buffer = await fileValue.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  const hasUtf16LeBom = bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe
  const hasUtf16BeBom = bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff
  const encoding = hasUtf16LeBom ? 'utf-16le' : hasUtf16BeBom ? 'utf-16be' : 'utf-8'
  return new TextDecoder(encoding).decode(bytes).replace(/^\uFEFF/, '').split('\0').join('')
}

const stripInlineMarkdown = (value = '') =>
  value
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '$1')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/~~([^~]+)~~/g, '$1')
    .trim()

const isTableSeparator = (line) => {
  const normalized = line.trim().replace(/^\|/, '').replace(/\|$/, '')
  return normalized.includes('-') && normalized.split('|').every((part) => /^:?-{3,}:?$/.test(part.trim()))
}

const parseTableCells = (line) =>
  line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim())

const isSpecialLine = (line) => {
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

const parseBlocks = (markdownText) => {
  const lines = markdownText.replace(/\r\n/g, '\n').split('\n')
  const blocks = []
  let index = 0
  let inCodeBlock = false
  let codeLanguage = ''
  let codeLines = []

  while (index < lines.length) {
    const line = lines[index]
    const trimmed = line.trim()

    if (trimmed.startsWith('```')) {
      if (inCodeBlock) {
        blocks.push({ type: 'code', language: codeLanguage, content: codeLines.join('\n') })
        inCodeBlock = false
        codeLanguage = ''
        codeLines = []
      } else {
        inCodeBlock = true
        codeLanguage = trimmed.replace(/^```/, '').trim()
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
      blocks.push({ type: 'heading', level: headingMatch[1].length, text: headingMatch[2] })
      index += 1
      continue
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      blocks.push({ type: 'hr' })
      index += 1
      continue
    }

    const nextLine = lines[index + 1]?.trim() ?? ''
    if (trimmed.includes('|') && isTableSeparator(nextLine)) {
      const headers = parseTableCells(trimmed)
      const rows = []
      index += 2
      while (index < lines.length && lines[index].trim().includes('|')) {
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
      blocks.push({ type: 'quote', text: quoteLines.join('\n') })
      continue
    }

    if (/^[-*+]\s+/.test(trimmed)) {
      const items = []
      while (index < lines.length && /^[-*+]\s+/.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^[-*+]\s+/, ''))
        index += 1
      }
      blocks.push({ type: 'unordered-list', items })
      continue
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      const items = []
      while (index < lines.length && /^\d+\.\s+/.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^\d+\.\s+/, ''))
        index += 1
      }
      blocks.push({ type: 'ordered-list', items })
      continue
    }

    const paragraphLines = []
    while (index < lines.length && !isSpecialLine(lines[index])) {
      paragraphLines.push(lines[index].trim())
      index += 1
    }
    blocks.push({ type: 'paragraph', text: paragraphLines.join(' ') })
  }

  if (inCodeBlock && codeLines.length > 0) {
    blocks.push({ type: 'code', language: codeLanguage, content: codeLines.join('\n') })
  }

  return blocks
}

const renderInline = (value = '') => {
  const nodes = []
  const pattern = /(!\[([^\]]*)\]\(([^)]+)\)|\[([^\]]+)\]\(([^)]+)\)|`([^`]+)`|\*\*([^*]+)\*\*|__([^_]+)__|\*([^*]+)\*|_([^_]+)_|~~([^~]+)~~)/g
  let lastIndex = 0
  let match

  while ((match = pattern.exec(value)) !== null) {
    if (match.index > lastIndex) nodes.push(value.slice(lastIndex, match.index))

    if (match[2] !== undefined) {
      nodes.push(<span key={`img-${match.index}`} className="md-inline-image-text">{match[2] || match[3]}</span>)
    } else if (match[4] !== undefined) {
      nodes.push(
        <a key={`a-${match.index}`} href={match[5]} target="_blank" rel="noreferrer">
          {match[4]}
        </a>,
      )
    } else if (match[6] !== undefined) {
      nodes.push(<code key={`code-${match.index}`}>{match[6]}</code>)
    } else if (match[7] !== undefined || match[8] !== undefined) {
      nodes.push(<strong key={`strong-${match.index}`}>{match[7] ?? match[8]}</strong>)
    } else if (match[9] !== undefined || match[10] !== undefined) {
      nodes.push(<em key={`em-${match.index}`}>{match[9] ?? match[10]}</em>)
    } else if (match[11] !== undefined) {
      nodes.push(<del key={`del-${match.index}`}>{match[11]}</del>)
    }

    lastIndex = pattern.lastIndex
  }

  if (lastIndex < value.length) nodes.push(value.slice(lastIndex))
  return nodes
}

const blocksToPlainText = (blocks) =>
  blocks
    .map((block) => {
      if (block.type === 'heading') return stripInlineMarkdown(block.text)
      if (block.type === 'paragraph' || block.type === 'quote') return stripInlineMarkdown(block.text)
      if (block.type === 'code') return block.content
      if (block.type === 'unordered-list' || block.type === 'ordered-list') {
        return block.items.map((item) => stripInlineMarkdown(item)).join('\n')
      }
      if (block.type === 'table') {
        return [block.headers, ...block.rows].map((row) => row.map(stripInlineMarkdown).join('\t')).join('\n')
      }
      return ''
    })
    .filter(Boolean)
    .join('\n\n')

const renderBlocks = (blocks) =>
  blocks.map((block, index) => {
    if (block.type === 'spacer') return <div key={`sp-${index}`} className="md-spacer" />
    if (block.type === 'heading') {
      const HeadingTag = `h${Math.min(block.level, 6)}`
      return <HeadingTag key={`h-${index}`}>{renderInline(block.text)}</HeadingTag>
    }
    if (block.type === 'paragraph') return <p key={`p-${index}`}>{renderInline(block.text)}</p>
    if (block.type === 'hr') return <hr key={`hr-${index}`} />
    if (block.type === 'quote') return <blockquote key={`q-${index}`}>{renderInline(block.text)}</blockquote>
    if (block.type === 'code') {
      return (
        <pre key={`c-${index}`}>
          {block.language ? <span className="md-code-language">{block.language}</span> : null}
          <code>{block.content}</code>
        </pre>
      )
    }
    if (block.type === 'table') {
      return (
        <table key={`tb-${index}`}>
          <thead>
            <tr>
              {block.headers.map((header, headerIndex) => (
                <th key={`th-${index}-${headerIndex}`}>{renderInline(header)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row, rowIndex) => (
              <tr key={`tr-${index}-${rowIndex}`}>
                {row.map((cell, cellIndex) => (
                  <td key={`td-${index}-${rowIndex}-${cellIndex}`}>{renderInline(cell)}</td>
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
            <li key={`ul-${index}-${itemIndex}`}>{renderInline(item)}</li>
          ))}
        </ul>
      )
    }
    if (block.type === 'ordered-list') {
      return (
        <ol key={`ol-${index}`}>
          {block.items.map((item, itemIndex) => (
            <li key={`ol-${index}-${itemIndex}`}>{renderInline(item)}</li>
          ))}
        </ol>
      )
    }
    return null
  })

function MarkdownViewerTool() {
  const [markdownText, setMarkdownText] = useState(loadDraft() ?? SAMPLE_MARKDOWN)
  const [fileName, setFileName] = useState('Belum ada file')
  const [activeTab, setActiveTab] = useState('editor')
  const [status, setStatus] = useState('Siap preview markdown.')
  const blocks = useMemo(() => parseBlocks(markdownText), [markdownText])
  const stats = useMemo(() => {
    const words = markdownText.trim() ? markdownText.trim().split(/\s+/).length : 0
    const headings = blocks.filter((block) => block.type === 'heading').length
    return { words, headings, lines: markdownText ? markdownText.split('\n').length : 0 }
  }, [blocks, markdownText])

  useEffect(() => {
    const timeout = setTimeout(() => {
      localStorage.setItem(DRAFT_KEY, markdownText)
    }, 250)
    return () => clearTimeout(timeout)
  }, [markdownText])

  const onUploadMarkdown = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const content = await decodeTextFile(file)
      setMarkdownText(content)
      setFileName(file.name)
      setStatus(`${file.name} berhasil dimuat.`)
      setActiveTab('preview')
    } catch {
      setStatus('Gagal membaca file markdown.')
    } finally {
      event.target.value = ''
    }
  }

  const copyMarkdown = async () => {
    await navigator.clipboard.writeText(markdownText)
    setStatus('Markdown berhasil disalin.')
  }

  const copyPlainText = async () => {
    await navigator.clipboard.writeText(blocksToPlainText(blocks))
    setStatus('Plain text preview berhasil disalin.')
  }

  const clearAll = () => {
    setMarkdownText('')
    setFileName('Belum ada file')
    localStorage.removeItem(DRAFT_KEY)
    setStatus('Editor dikosongkan.')
  }

  const resetSample = () => {
    setMarkdownText(SAMPLE_MARKDOWN)
    setFileName('Sample markdown')
    setStatus('Sample markdown dimuat ulang.')
  }

  return (
    <main className="page md-page markdown-viewer-page">
      <section className="hero markdown-viewer-hero" style={{ '--theme-color': '#2563eb' }}>
        <div className="hero-left">
          <div className="hero-icon" aria-hidden="true">
            <Eye className="icon-md" />
          </div>
          <div>
            <h1>Markdown Viewer</h1>
            <p>Lihat, edit, dan cek struktur markdown dengan live preview.</p>
          </div>
        </div>
        <div className="shortcut-box">
          <span>FILE</span>
          <code>{fileName}</code>
        </div>
      </section>

      <section className="card md-toolbar-card markdown-viewer-toolbar">
        <div className="md-toolbar-grid">
          <label className="upload-box md-upload-box">
            <input type="file" accept=".md,.markdown,.txt,text/markdown,text/plain" onChange={onUploadMarkdown} />
            <span>
              <Upload className="icon-xs" /> Upload markdown atau text
            </span>
          </label>

          <div className="markdown-viewer-stats">
            <span>{stats.lines} lines</span>
            <span>{stats.words} words</span>
            <span>{stats.headings} headings</span>
          </div>

          <div className="md-toolbar-actions">
            <button type="button" className="outline icon-btn" onClick={copyMarkdown}>
              <Clipboard className="icon-sm" /> Copy Markdown
            </button>
            <button type="button" className="outline icon-btn" onClick={copyPlainText}>
              <FileText className="icon-sm" /> Copy Text
            </button>
            <button type="button" className="outline icon-btn" onClick={resetSample}>
              <RotateCcw className="icon-sm" /> Sample
            </button>
            <button type="button" className="outline icon-btn" onClick={clearAll}>
              <Trash2 className="icon-sm" /> Clear
            </button>
          </div>
        </div>
        <p className="markdown-viewer-status">{status}</p>
      </section>

      <section className="card md-tab-card">
        <div className="md-tabs md-mobile-tabs">
          <button
            type="button"
            className={`md-tab ${activeTab === 'editor' ? 'active' : ''}`}
            onClick={() => setActiveTab('editor')}
          >
            Markdown
          </button>
          <button
            type="button"
            className={`md-tab ${activeTab === 'preview' ? 'active' : ''}`}
            onClick={() => setActiveTab('preview')}
          >
            Preview
          </button>
        </div>

        <div className="md-split">
          <article className={`md-pane ${activeTab === 'editor' ? 'active' : ''}`}>
            <h3>Markdown</h3>
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
              }}
              loading={
                <textarea
                  className="md-editor"
                  placeholder="Paste markdown di sini..."
                  value={markdownText}
                  onChange={(event) => setMarkdownText(event.target.value)}
                  spellCheck={false}
                />
              }
            />
          </article>

          <article className={`md-pane ${activeTab === 'preview' ? 'active' : ''}`}>
            <h3>Preview</h3>
            <div className="md-preview-wrap">
              <div className="md-preview markdown-viewer-preview">
                {markdownText.trim() ? renderBlocks(blocks) : <p>Belum ada markdown.</p>}
              </div>
            </div>
          </article>
        </div>
      </section>
    </main>
  )
}

export default MarkdownViewerTool
