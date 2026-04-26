import { useMemo, useRef, useState } from 'react'
import { jsPDF } from 'jspdf'
import { Code2, Download, Eye, FileText, RefreshCcw, Upload } from 'lucide-react'
import Editor from '@monaco-editor/react'
import '../App.css'

const PDF_EXPORT_WINDOW_WIDTH = 760

const DEFAULT_HTML = `<!doctype html>
<html lang="id">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Preview HTML</title>
    <style>
      body {
        font-family: system-ui, sans-serif;
        margin: 24px;
        background: #f8fbff;
        color: #20324d;
      }

      .card {
        max-width: 560px;
        padding: 18px;
        border-radius: 14px;
        border: 1px solid #dbe6f5;
        background: #ffffff;
      }

      h1 {
        margin: 0 0 10px;
      }
    </style>
  </head>
  <body>
    <article class="card">
      <h1>Hello HTML Editor</h1>
      <p>Silakan edit kode di panel kiri, hasilnya langsung muncul di preview kanan.</p>
    </article>
  </body>
</html>
`

const toSafeFileName = (value, fallback) => {
  const cleaned = (value || fallback || 'html-document')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-_]/g, '')
    .replace(/-+/g, '-')
    .replace(/^[-_]+|[-_]+$/g, '')

  return cleaned || fallback || 'html-document'
}

const waitForFrameReady = (frameEl) =>
  new Promise((resolve, reject) => {
    let settled = false

    const finish = () => {
      if (settled) return
      settled = true
      resolve()
    }

    const fail = () => {
      if (settled) return
      settled = true
      reject(new Error('Gagal memuat HTML ke iframe.'))
    }

    frameEl.addEventListener('load', finish, { once: true })
    frameEl.addEventListener('error', fail, { once: true })

    window.setTimeout(() => {
      const frameDoc = frameEl.contentDocument
      if (!settled && frameDoc?.readyState === 'complete') finish()
    }, 600)

    window.setTimeout(() => {
      if (!settled) fail()
    }, 8000)
  })

const waitForImages = async (docNode) => {
  const images = Array.from(docNode.images || [])
  await Promise.all(
    images.map(
      (image) =>
        new Promise((resolve) => {
          if (image.complete) {
            resolve()
            return
          }
          image.addEventListener('load', resolve, { once: true })
          image.addEventListener('error', resolve, { once: true })
        }),
    ),
  )
}

function HtmlEditorTool() {
  const [htmlCode, setHtmlCode] = useState(DEFAULT_HTML)
  const [fileName, setFileName] = useState('html-editor')
  const [activeTab, setActiveTab] = useState('editor')
  const [isExporting, setIsExporting] = useState(false)
  const fileInputRef = useRef(null)
  const previewDoc = useMemo(() => htmlCode, [htmlCode])

  const resetDefault = () => {
    setHtmlCode(DEFAULT_HTML)
    setFileName('html-editor')
  }

  const saveAsHtml = () => {
    const blob = new Blob([htmlCode], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${fileName || 'html-editor'}.html`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const exportToPdf = async () => {
    if (isExporting) return

    let renderFrame = null
    try {
      setIsExporting(true)
      if (document.fonts?.ready) await document.fonts.ready

      renderFrame = document.createElement('iframe')
      renderFrame.className = 'html-export-render-frame'
      renderFrame.sandbox = 'allow-same-origin'
      renderFrame.style.position = 'fixed'
      renderFrame.style.left = '-13000px'
      renderFrame.style.top = '0'
      renderFrame.style.width = `${PDF_EXPORT_WINDOW_WIDTH}px`
      renderFrame.style.height = '1000px'
      renderFrame.style.opacity = '0'
      renderFrame.style.pointerEvents = 'none'
      document.body.appendChild(renderFrame)
      renderFrame.srcdoc = htmlCode

      await waitForFrameReady(renderFrame)

      const frameDoc = renderFrame.contentDocument
      if (!frameDoc?.body) throw new Error('Dokumen HTML tidak valid.')

      if (frameDoc.fonts?.ready) await frameDoc.fonts.ready
      await waitForImages(frameDoc)

      const renderHeight = Math.max(
        frameDoc.body.scrollHeight,
        frameDoc.documentElement.scrollHeight,
        frameDoc.body.offsetHeight,
        1120,
      )
      renderFrame.style.height = `${renderHeight}px`

      const { default: html2canvas } = await import('html2canvas')
      const canvas = await html2canvas(frameDoc.body, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        windowWidth: PDF_EXPORT_WINDOW_WIDTH,
      })

      const pdf = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait', compress: true })
      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      const margin = 24
      const contentWidth = pageWidth - margin * 2
      const contentHeight = pageHeight - margin * 2

      const pxPerPt = canvas.width / contentWidth
      const pageSliceHeightPx = Math.max(1, Math.floor(contentHeight * pxPerPt))

      let offsetY = 0
      let pageIndex = 0
      while (offsetY < canvas.height) {
        const remaining = canvas.height - offsetY
        const sliceHeight = Math.min(pageSliceHeightPx, remaining)

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

      const safeFileName = toSafeFileName(fileName, 'html-document')
      pdf.save(`${safeFileName}.pdf`)
    } catch {
      alert('Gagal convert HTML ke PDF.')
    } finally {
      if (renderFrame?.parentNode) {
        renderFrame.parentNode.removeChild(renderFrame)
      }
      setIsExporting(false)
    }
  }

  const openUploadPicker = () => {
    fileInputRef.current?.click()
  }

  const onUploadHtml = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const content = await file.text()
      setHtmlCode(content)
      setFileName(file.name.replace(/\.(html?|txt)$/i, '') || 'html-editor')
    } catch {
      alert('Gagal membaca file HTML.')
    } finally {
      event.target.value = ''
    }
  }

  return (
    <main className="page html-editor-page">
      <section className="hero html-editor-hero" style={{ '--theme-color': '#57B5E0' }}>
        <div className="hero-left">
          <div className="hero-icon" aria-hidden="true">
            <Code2 className="icon-md" />
          </div>
          <div>
            <h1>HTML Editor</h1>
            <p>Tulis HTML dan lihat preview secara langsung.</p>
          </div>
        </div>
        <div className="shortcut-box">
          <span>FITUR</span>
          <code>Live Preview</code>
          <code>Reset Template</code>
          <code>Export PDF</code>
        </div>
      </section>

      <section className="card html-editor-card">
        <label className="field">
          <span>Nama File</span>
          <input
            placeholder="contoh: invoice-sederhana"
            value={fileName}
            onChange={(event) => setFileName(event.target.value)}
          />
        </label>

        <div className="html-editor-actions">
          <input
            ref={fileInputRef}
            type="file"
            accept=".html,.htm,.txt,text/html,text/plain"
            onChange={onUploadHtml}
            hidden
          />
          <button type="button" className="outline icon-btn" onClick={openUploadPicker}>
            <Upload className="icon-sm" /> Upload HTML
          </button>
          <button type="button" className="outline icon-btn" onClick={saveAsHtml}>
            <Download className="icon-sm" /> Save as HTML
          </button>
          <button type="button" className="primary icon-btn" onClick={exportToPdf} disabled={isExporting}>
            <FileText className="icon-sm" /> {isExporting ? 'Generating PDF...' : 'Export PDF'}
          </button>
          <button type="button" className="outline icon-btn" onClick={resetDefault}>
            <RefreshCcw className="icon-sm" /> Reset
          </button>
        </div>

        <div className="md-tabs html-editor-tabs-mobile">
          <button
            type="button"
            className={`md-tab ${activeTab === 'editor' ? 'active' : ''}`}
            onClick={() => setActiveTab('editor')}
          >
            <Code2 className="icon-sm" /> HTML
          </button>
          <button
            type="button"
            className={`md-tab ${activeTab === 'preview' ? 'active' : ''}`}
            onClick={() => setActiveTab('preview')}
          >
            <Eye className="icon-sm" /> Preview
          </button>
        </div>

        <div className="html-editor-split">
          <article className={`html-editor-pane ${activeTab === 'editor' ? 'active' : ''}`}>
            <h2>HTML Code</h2>
            <Editor
              className="html-editor-monaco"
              defaultLanguage="html"
              language="html"
              value={htmlCode}
              onChange={(value) => setHtmlCode(value ?? '')}
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
                  className="html-editor-textarea"
                  value={htmlCode}
                  onChange={(event) => setHtmlCode(event.target.value)}
                  spellCheck={false}
                />
              }
            />
          </article>

          <article className={`html-editor-pane ${activeTab === 'preview' ? 'active' : ''}`}>
            <h2>Live Preview</h2>
            <div className="html-editor-preview-wrap">
              <iframe
                className="html-editor-preview"
                srcDoc={previewDoc}
                title="HTML live preview"
                sandbox="allow-scripts"
              />
            </div>
          </article>
        </div>
      </section>
    </main>
  )
}

export default HtmlEditorTool
