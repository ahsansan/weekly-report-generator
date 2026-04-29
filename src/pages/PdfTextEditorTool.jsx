import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Download, FileText, PlusCircle, Upload } from 'lucide-react'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import * as pdfjsLib from 'pdfjs-dist'
import '../App.css'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).href

const PREVIEW_MAX_W = 760
let textIdCounter = 0
const makeTextId = () => `txt-${++textIdCounter}`
const clamp = (value, min, max) => Math.max(min, Math.min(value, max))

function PdfTextEditorTool() {
  const [pdfFile, setPdfFile] = useState(null)
  const [pdfJsDoc, setPdfJsDoc] = useState(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [pageDataUrl, setPageDataUrl] = useState('')
  const [pageViewport, setPageViewport] = useState({ width: 0, height: 0 })
  const [texts, setTexts] = useState([])
  const [sourceTexts, setSourceTexts] = useState([])
  const [selectedTextId, setSelectedTextId] = useState('')
  const [mode, setMode] = useState('edit')
  const [outputUrl, setOutputUrl] = useState('')
  const [outputName, setOutputName] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [status, setStatus] = useState('')

  const previewRef = useRef(null)

  const selectedText = texts.find((text) => text.id === selectedTextId) || null
  const currentPageTexts = texts.filter((text) => text.pageNum === currentPage)
  const currentSourceTexts = sourceTexts.filter((text) => text.pageNum === currentPage)

  const loadPdf = useCallback(async (file) => {
    try {
      setStatus('Memuat PDF...')
      setOutputUrl('')
      setOutputName('')
      const doc = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise
      setPdfJsDoc(doc)
      setCurrentPage(1)
      setTotalPages(doc.numPages)
      setTexts([])
      setSelectedTextId('')
      setStatus('')
    } catch (error) {
      setStatus(`Gagal memuat PDF: ${error.message}`)
    }
  }, [])

  const renderPage = useCallback(async (doc, pageNum) => {
    try {
      const page = await doc.getPage(pageNum)
      const originalViewport = page.getViewport({ scale: 1 })
      const scale = PREVIEW_MAX_W / originalViewport.width
      const viewport = page.getViewport({ scale })
      const canvas = document.createElement('canvas')
      canvas.width = viewport.width
      canvas.height = viewport.height
      await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise
      setPageDataUrl(canvas.toDataURL('image/png'))
      setPageViewport({ width: viewport.width, height: viewport.height })

      const textContent = await page.getTextContent()
      const items = textContent.items
        .filter((item) => item?.str?.trim())
        .map((item) => {
          const [a, b, c, d, e, f] = item.transform
          const fontHeight = Math.hypot(c, d) || Math.abs(d) || 12
          const width = Math.max(8, item.width * scale)
          const height = Math.max(10, fontHeight * scale)
          const x = e * scale
          const yTop = viewport.height - (f * scale) - height
          return {
            id: makeTextId(),
            pageNum,
            original: item.str,
            content: item.str,
            x: clamp(x, 0, Math.max(0, viewport.width - width)),
            y: clamp(yTop, 0, Math.max(0, viewport.height - height)),
            w: width,
            h: height,
            fontSize: Math.round(height * 0.9),
            color: '#111111',
            kind: 'replace',
          }
        })
      setSourceTexts((prev) => [...prev.filter((entry) => entry.pageNum !== pageNum), ...items])
    } catch (error) {
      setStatus(`Gagal render halaman: ${error.message}`)
    }
  }, [])

  useEffect(() => {
    if (pdfJsDoc) {
      renderPage(pdfJsDoc, currentPage)
    }
  }, [pdfJsDoc, currentPage, renderPage])

  useEffect(() => {
    return () => {
      if (outputUrl) {
        URL.revokeObjectURL(outputUrl)
      }
    }
  }, [outputUrl])

  const onSelectPdf = (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    setPdfFile(file)
    loadPdf(file)
    event.target.value = ''
  }

  const onPreviewClick = (event) => {
    if (mode !== 'add') return
    if (!previewRef.current || !pdfJsDoc) return
    const rect = previewRef.current.getBoundingClientRect()
    const x = Math.max(0, Math.min(event.clientX - rect.left, rect.width))
    const y = Math.max(0, Math.min(event.clientY - rect.top, rect.height))
    const id = makeTextId()
    const newText = {
      id,
      pageNum: currentPage,
      content: 'Teks baru',
      x,
      y,
      fontSize: 16,
      color: '#111111',
      w: 120,
      h: 22,
      kind: 'add',
    }
    setTexts((prev) => [...prev, newText])
    setSelectedTextId(id)
  }

  const updateSelectedText = (key, value) => {
    if (!selectedTextId) return
    setTexts((prev) =>
      prev.map((text) => (text.id === selectedTextId ? { ...text, [key]: value } : text))
    )
  }

  const removeSelectedText = () => {
    if (!selectedTextId) return
    setTexts((prev) => prev.filter((text) => text.id !== selectedTextId))
    setSelectedTextId('')
  }

  const exportPdf = async () => {
    if (!pdfFile || texts.length === 0 || !previewRef.current) return
    try {
      setIsProcessing(true)
      setStatus('Menulis teks ke PDF...')
      if (outputUrl) URL.revokeObjectURL(outputUrl)

      const pdfDoc = await PDFDocument.load(await pdfFile.arrayBuffer())
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
      const pages = pdfDoc.getPages()
      const previewWidth = previewRef.current.offsetWidth || pageViewport.width
      const previewHeight = previewRef.current.offsetHeight || pageViewport.height

      for (const text of texts) {
        const page = pages[text.pageNum - 1]
        if (!page || !text.content.trim()) continue
        const { width: pdfW, height: pdfH } = page.getSize()
        const x = text.x * (pdfW / previewWidth)
        const yTop = text.y * (pdfH / previewHeight)
        const y = pdfH - yTop - text.fontSize
        const boxW = (text.w || 0) * (pdfW / previewWidth)
        const boxH = (text.h || text.fontSize) * (pdfH / previewHeight)
        const hex = text.color.replace('#', '')
        const r = parseInt(hex.slice(0, 2), 16) / 255
        const g = parseInt(hex.slice(2, 4), 16) / 255
        const b = parseInt(hex.slice(4, 6), 16) / 255
        if (text.kind === 'replace') {
          page.drawRectangle({
            x,
            y: pdfH - yTop - boxH,
            width: boxW,
            height: boxH,
            color: rgb(1, 1, 1),
          })
        }
        page.drawText(text.content, {
          x,
          y,
          size: text.fontSize,
          font,
          color: rgb(r, g, b),
        })
      }

      const outBytes = await pdfDoc.save()
      const outBlob = new Blob([outBytes], { type: 'application/pdf' })
      const url = URL.createObjectURL(outBlob)
      const fileName = `${pdfFile.name.replace(/\.pdf$/i, '')}-text-edited.pdf`
      setOutputUrl(url)
      setOutputName(fileName)
      const replaced = texts.filter((entry) => entry.kind === 'replace').length
      const added = texts.filter((entry) => entry.kind === 'add').length
      setStatus(`Selesai. ${replaced} teks direplace, ${added} teks ditambah.`)
    } catch (error) {
      setStatus(`Gagal export PDF: ${error.message}`)
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <main className="page pdf-text-editor-page">
      <section className="hero" style={{ '--theme-color': '#57B5E0' }}>
        <div className="hero-left">
          <div className="hero-icon" aria-hidden="true"><FileText className="icon-md" /></div>
          <div>
            <h1>PDF Text Editor</h1>
            <p>Klik area preview untuk tambah teks, edit konten, lalu export PDF baru.</p>
          </div>
        </div>
        <div className="shortcut-box">
          <span>FITUR</span>
          <code>Add text</code>
          <code>Edit text</code>
        </div>
      </section>

      <section className="card pdf-text-editor-card">
        <div className="pdf-text-editor-step">
          <div className="pdf-text-editor-step-label">
            <span className="pdf-text-editor-step-num">1</span>
            Upload PDF
          </div>
          <label className="upload-box pdf-text-editor-upload-box">
            <input type="file" accept="application/pdf,.pdf" onChange={onSelectPdf} />
            <Upload className="icon-xs" />
            {pdfFile ? pdfFile.name : 'Pilih file PDF'}
          </label>
        </div>

        {pdfJsDoc && (
          <>
            <div className="pdf-text-editor-step">
              <div className="pdf-text-editor-step-label">
                <span className="pdf-text-editor-step-num">2</span>
                Tambah/Edit Teks
              </div>
              <div className="pdf-text-editor-mode">
                <button
                  type="button"
                  className={`outline icon-btn${mode === 'edit' ? ' active' : ''}`}
                  onClick={() => setMode('edit')}
                >
                  Edit teks existing
                </button>
                <button
                  type="button"
                  className={`outline icon-btn${mode === 'add' ? ' active' : ''}`}
                  onClick={() => setMode('add')}
                >
                  Tambah teks baru
                </button>
              </div>
              <div className="pdf-text-editor-nav">
                <button
                  type="button"
                  className="outline icon-btn"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((value) => value - 1)}
                >
                  <ChevronLeft className="icon-xs" />
                </button>
                <span>Halaman <strong>{currentPage}</strong> / {totalPages}</span>
                <button
                  type="button"
                  className="outline icon-btn"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((value) => value + 1)}
                >
                  <ChevronRight className="icon-xs" />
                </button>
              </div>

              <div className="pdf-text-editor-layout">
                <div className="pdf-text-editor-preview-wrap" ref={previewRef} onClick={onPreviewClick}>
                  {pageDataUrl && <img src={pageDataUrl} alt={`Preview halaman ${currentPage}`} className="pdf-text-editor-preview" />}
                  {mode === 'edit' && currentSourceTexts.map((text) => (
                    <button
                      key={text.id}
                      type="button"
                      className="pdf-text-editor-source"
                      style={{ left: text.x, top: text.y, width: text.w, height: text.h }}
                      onClick={(event) => {
                        event.stopPropagation()
                        const existing = texts.find((entry) => entry.id === text.id)
                        if (existing) {
                          setSelectedTextId(existing.id)
                          return
                        }
                        setTexts((prev) => [...prev, { ...text }])
                        setSelectedTextId(text.id)
                      }}
                      title={text.original}
                    />
                  ))}
                  {currentPageTexts.map((text) => (
                    <button
                      key={text.id}
                      type="button"
                      className={`pdf-text-editor-overlay${text.id === selectedTextId ? ' active' : ''}`}
                      style={{ left: text.x, top: text.y, width: text.w, minHeight: text.h, fontSize: `${text.fontSize}px`, color: text.color }}
                      onClick={(event) => {
                        event.stopPropagation()
                        setSelectedTextId(text.id)
                      }}
                    >
                      {text.content || '(kosong)'}
                    </button>
                  ))}
                </div>

                <div className="pdf-text-editor-panel">
                  <div className="pdf-text-editor-panel-head">
                    <PlusCircle className="icon-xs" />
                    {mode === 'edit' ? 'Klik kotak kuning untuk edit teks asli PDF' : 'Klik preview untuk tambah teks'}
                  </div>
                  <p className="pdf-text-editor-counter">Total teks: {texts.length}</p>
                  {selectedText ? (
                    <div className="pdf-text-editor-fields">
                      <label>
                        Konten
                        <textarea
                          value={selectedText.content}
                          onChange={(event) => updateSelectedText('content', event.target.value)}
                          rows={4}
                        />
                      </label>
                      <label>
                        Ukuran font
                        <input
                          type="number"
                          min={8}
                          max={120}
                          value={selectedText.fontSize}
                          onChange={(event) => updateSelectedText('fontSize', Number(event.target.value) || 16)}
                        />
                      </label>
                      <label>
                        Warna
                        <input
                          type="color"
                          value={selectedText.color}
                          onChange={(event) => updateSelectedText('color', event.target.value)}
                        />
                      </label>
                      <button type="button" className="ghost-btn" onClick={removeSelectedText}>Hapus teks terpilih</button>
                    </div>
                  ) : (
                    <p className="pdf-text-editor-help">Pilih teks di preview untuk mengedit konten, ukuran, dan warna.</p>
                  )}
                </div>
              </div>
            </div>

            <div className="pdf-text-editor-step">
              <div className="pdf-text-editor-step-label">
                <span className="pdf-text-editor-step-num">3</span>
                Export PDF
              </div>
              <div className="pdf-text-editor-actions">
                <button
                  type="button"
                  className="primary icon-btn"
                  disabled={isProcessing || texts.length === 0}
                  onClick={exportPdf}
                >
                  {isProcessing ? 'Memproses...' : 'Generate PDF Baru'}
                </button>
                {outputUrl && (
                  <a href={outputUrl} download={outputName} className="outline icon-btn">
                    <Download className="icon-xs" />
                    {outputName}
                  </a>
                )}
              </div>
            </div>
          </>
        )}

        {status && <p className="m4a-status">{status}</p>}
      </section>
    </main>
  )
}

export default PdfTextEditorTool
