import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Check, ChevronLeft, ChevronRight, Download, RefreshCcw, FileSignature,
  ImageIcon, Pen, PlusCircle, RotateCcw, Trash2, Type, Upload, X,
} from 'lucide-react'
import { PDFDocument } from 'pdf-lib'
import * as pdfjsLib from 'pdfjs-dist'
import '../App.css'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).href

const PREVIEW_MAX_W = 640
let _pid = 0
const genId = () => String((_pid += 1))

function PdfSignatureTool() {
  // ── PDF ────────────────────────────────────────────────────────────────────
  const [pdfFile, setPdfFile] = useState(null)
  const [pdfJsDoc, setPdfJsDoc] = useState(null)
  const [totalPages, setTotalPages] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageDataUrl, setPageDataUrl] = useState(null)
  const [pageViewport, setPageViewport] = useState({ width: 0, height: 0 })

  // ── Signature ──────────────────────────────────────────────────────────────
  const [sigMode, setSigMode] = useState('draw')
  const [sigDataUrl, setSigDataUrl] = useState(null)
  const [typedName, setTypedName] = useState('')
  const [penColor, setPenColor] = useState('#1a1a2e')

  // ── Draft overlay (current draggable position) ─────────────────────────────
  const [draftPos, setDraftPos] = useState({ x: 40, y: 40 })
  const [draftSize, setDraftSize] = useState({ w: 220, h: 80 })
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)

  // ── Placements list: [{ id, pageNum, x, y, w, h }] ────────────────────────
  const [placements, setPlacements] = useState([])

  // ── Processing ─────────────────────────────────────────────────────────────
  const [isProcessing, setIsProcessing] = useState(false)
  const [status, setStatus] = useState('')
  const [outputUrl, setOutputUrl] = useState(null)
  const [outputName, setOutputName] = useState('')

  const drawCanvasRef = useRef(null)
  const isDrawingRef = useRef(false)
  const lastPtRef = useRef(null)
  const previewRef = useRef(null)
  const dragOffsetRef = useRef({ x: 0, y: 0 })
  const resizeStartRef = useRef({ x: 0, y: 0, w: 0, h: 0 })

  // ── Load PDF ───────────────────────────────────────────────────────────────
  const loadPdf = useCallback(async (file) => {
    try {
      setStatus('Memuat PDF...')
      setSigDataUrl(null)
      setPlacements([])
      setOutputUrl(null)
      const doc = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise
      setPdfJsDoc(doc)
      setTotalPages(doc.numPages)
      setCurrentPage(1)
      setStatus('')
    } catch (e) {
      setStatus('Gagal memuat PDF: ' + e.message)
    }
  }, [])

  const onSelectFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPdfFile(file)
    loadPdf(file)
    e.target.value = ''
  }

  const resetPdf = () => {
    if (outputUrl) URL.revokeObjectURL(outputUrl)
    setPdfFile(null); setPdfJsDoc(null); setTotalPages(0); setCurrentPage(1)
    setPageDataUrl(null); setSigDataUrl(null); setPlacements([])
    setOutputUrl(null); setOutputName(''); setStatus('')
  }

  // ── Render page ────────────────────────────────────────────────────────────
  const renderPage = useCallback(async (doc, pageNum) => {
    try {
      const page = await doc.getPage(pageNum)
      const scale = PREVIEW_MAX_W / page.getViewport({ scale: 1 }).width
      const viewport = page.getViewport({ scale })
      const canvas = document.createElement('canvas')
      canvas.width = viewport.width
      canvas.height = viewport.height
      await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise
      setPageDataUrl(canvas.toDataURL())
      setPageViewport({ width: viewport.width, height: viewport.height })
    } catch (e) {
      setStatus('Gagal render halaman: ' + e.message)
    }
  }, [])

  useEffect(() => {
    if (pdfJsDoc) renderPage(pdfJsDoc, currentPage)
  }, [pdfJsDoc, currentPage, renderPage])

  // ── Draw canvas ────────────────────────────────────────────────────────────
  const getCanvasPos = (e, canvas) => {
    const rect = canvas.getBoundingClientRect()
    const src = e.touches ? e.touches[0] : e
    return {
      x: (src.clientX - rect.left) * (canvas.width / rect.width),
      y: (src.clientY - rect.top) * (canvas.height / rect.height),
    }
  }

  const startDraw = (e) => {
    const c = drawCanvasRef.current; if (!c) return
    isDrawingRef.current = true; lastPtRef.current = getCanvasPos(e, c)
  }
  const draw = (e) => {
    if (!isDrawingRef.current) return
    const c = drawCanvasRef.current; const ctx = c.getContext('2d')
    const pt = getCanvasPos(e, c)
    ctx.beginPath(); ctx.strokeStyle = penColor; ctx.lineWidth = 2.5
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'
    ctx.moveTo(lastPtRef.current.x, lastPtRef.current.y); ctx.lineTo(pt.x, pt.y); ctx.stroke()
    lastPtRef.current = pt
  }
  const endDraw = () => { isDrawingRef.current = false; lastPtRef.current = null }
  const clearDrawCanvas = () => {
    const c = drawCanvasRef.current; if (!c) return
    c.getContext('2d').clearRect(0, 0, c.width, c.height)
  }
  const applyDrawSignature = () => {
    const c = drawCanvasRef.current; if (!c) return
    setSigDataUrl(c.toDataURL('image/png'))
  }

  // ── Typed signature ────────────────────────────────────────────────────────
  const applyTypedSignature = () => {
    if (!typedName.trim()) return
    const c = document.createElement('canvas'); c.width = 500; c.height = 130
    const ctx = c.getContext('2d')
    ctx.font = `italic 58px 'Segoe Script','Dancing Script',Georgia,cursive`
    ctx.fillStyle = penColor; ctx.textBaseline = 'middle'; ctx.textAlign = 'center'
    ctx.fillText(typedName, 250, 65)
    setSigDataUrl(c.toDataURL('image/png'))
  }

  // ── Upload signature ───────────────────────────────────────────────────────
  const onUploadSig = (e) => {
    const file = e.target.files?.[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => setSigDataUrl(ev.target.result)
    reader.readAsDataURL(file); e.target.value = ''
  }

  // ── Drag / resize draft overlay ────────────────────────────────────────────
  const onSigPointerDown = (e) => {
    e.preventDefault(); e.stopPropagation()
    const src = e.touches ? e.touches[0] : e
    dragOffsetRef.current = { x: src.clientX - draftPos.x, y: src.clientY - draftPos.y }
    setIsDragging(true)
  }
  const onResizePointerDown = (e) => {
    e.preventDefault(); e.stopPropagation()
    const src = e.touches ? e.touches[0] : e
    resizeStartRef.current = { x: src.clientX, y: src.clientY, w: draftSize.w, h: draftSize.h }
    setIsResizing(true)
  }

  useEffect(() => {
    const onMove = (e) => {
      const src = e.touches ? e.touches[0] : e
      if (isDragging) {
        const rect = previewRef.current?.getBoundingClientRect(); if (!rect) return
        setDraftPos({
          x: Math.max(0, Math.min(src.clientX - dragOffsetRef.current.x, rect.width - draftSize.w)),
          y: Math.max(0, Math.min(src.clientY - dragOffsetRef.current.y, rect.height - draftSize.h)),
        })
      } else if (isResizing) {
        setDraftSize({
          w: Math.max(60, resizeStartRef.current.w + src.clientX - resizeStartRef.current.x),
          h: Math.max(30, resizeStartRef.current.h + src.clientY - resizeStartRef.current.y),
        })
      }
    }
    const onUp = () => { setIsDragging(false); setIsResizing(false) }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    window.addEventListener('touchmove', onMove, { passive: false })
    window.addEventListener('touchend', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp)
      window.removeEventListener('touchmove', onMove); window.removeEventListener('touchend', onUp)
    }
  }, [isDragging, isResizing, draftSize.w, draftSize.h])

  // ── Placements ─────────────────────────────────────────────────────────────
  const addPlacement = () => {
    const exists = placements.find((p) => p.pageNum === currentPage)
    if (exists) {
      setPlacements((prev) => prev.map((p) =>
        p.pageNum === currentPage
          ? { ...p, x: draftPos.x, y: draftPos.y, w: draftSize.w, h: draftSize.h }
          : p
      ))
      setStatus(`Posisi di halaman ${currentPage} diperbarui.`)
    } else {
      setPlacements((prev) => [
        ...prev,
        { id: genId(), pageNum: currentPage, x: draftPos.x, y: draftPos.y, w: draftSize.w, h: draftSize.h },
      ])
      setStatus(`Tanda tangan ditambahkan ke halaman ${currentPage}.`)
    }
  }
  const removePlacement = (id) => setPlacements((prev) => prev.filter((p) => p.id !== id))

  const currentPagePlaced = placements.some((p) => p.pageNum === currentPage)

  // ── Export PDF ─────────────────────────────────────────────────────────────
  const exportPdf = async () => {
    if (!pdfFile || !sigDataUrl || placements.length === 0) return
    try {
      setIsProcessing(true); setStatus('Memproses PDF...')
      if (outputUrl) URL.revokeObjectURL(outputUrl)

      const pdfDoc = await PDFDocument.load(await pdfFile.arrayBuffer())
      const pages = pdfDoc.getPages()
      const previewEl = previewRef.current
      const previewW = previewEl ? previewEl.offsetWidth : pageViewport.width
      const previewH = previewEl ? previewEl.offsetHeight : pageViewport.height

      // Convert sig to PNG bytes once
      let imgBytes
      if (sigDataUrl.startsWith('data:image/png')) {
        imgBytes = Uint8Array.from(atob(sigDataUrl.split(',')[1]), (c) => c.charCodeAt(0))
      } else {
        const img = new Image()
        await new Promise((res) => { img.onload = res; img.src = sigDataUrl })
        const cvs = document.createElement('canvas')
        cvs.width = img.naturalWidth; cvs.height = img.naturalHeight
        cvs.getContext('2d').drawImage(img, 0, 0)
        imgBytes = Uint8Array.from(atob(cvs.toDataURL('image/png').split(',')[1]), (c) => c.charCodeAt(0))
      }

      const pngImage = await pdfDoc.embedPng(imgBytes)

      for (const pl of placements) {
        const page = pages[pl.pageNum - 1]; if (!page) continue
        const { width: pdfW, height: pdfH } = page.getSize()
        page.drawImage(pngImage, {
          x: pl.x * (pdfW / previewW),
          y: pdfH - (pl.y + pl.h) * (pdfH / previewH),
          width: pl.w * (pdfW / previewW),
          height: pl.h * (pdfH / previewH),
        })
      }

      const blob = new Blob([await pdfDoc.save()], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const name = pdfFile.name.replace(/\.pdf$/i, '') + '-signed.pdf'
      setOutputUrl(url); setOutputName(name)
      setStatus(`✓ PDF berhasil ditandatangani di ${placements.length} halaman!`)
    } catch (e) {
      setStatus('Gagal export: ' + e.message)
    } finally {
      setIsProcessing(false)
    }
  }

  const hasSig = !!sigDataUrl
  const hasPdf = !!pdfJsDoc
  const PEN_COLORS = ['#1a1a2e', '#1e3a8a', '#7c3aed', '#065f46', '#92400e', '#b91c1c']

  return (
    <main className="page pdf-sign-page">
      {/* Hero */}
      <section className="hero" style={{ '--theme-color': '#57B5E0' }}>
        <div className="hero-left">
          <div className="hero-icon" aria-hidden="true"><FileSignature className="icon-md" /></div>
          <div>
            <h1>PDF Signature</h1>
            <p>Tambahkan tanda tangan ke PDF langsung di browser, tanpa upload ke server.</p>
          </div>
        </div>
        <div className="shortcut-box">
          <span>FITUR</span>
          <code>Multi-page sign</code>
          <code>Output .pdf</code>
        </div>
      </section>

      <section className="card pdf-sign-card">

        {/* ── Step 1: Upload PDF ─────────────────────────────────────────────── */}
        <div className="pdf-sign-step">
          <div className="pdf-sign-step-label">
            <span className="pdf-sign-step-num">1</span>
            Upload PDF
          </div>
          <div className="pdf-sign-upload-row">
            <label className="upload-box pdf-sign-upload-box">
              <input type="file" accept="application/pdf,.pdf" onChange={onSelectFile} />
              <Upload className="icon-xs" />
              {pdfFile ? pdfFile.name : 'Pilih file PDF'}
            </label>
            {pdfFile && (
              <button type="button" className="pdf-sign-delete-btn" onClick={resetPdf} title="Hapus file PDF">
                <X className="icon-xs" />
              </button>
            )}
          </div>
        </div>

        {hasPdf && (
          <>
            {/* ── Step 2: Create Signature ───────────────────────────────────── */}
            <div className="pdf-sign-step">
              <div className="pdf-sign-step-label">
                <span className="pdf-sign-step-num">2</span>
                Buat Tanda Tangan
              </div>

              <div className="pdf-sign-color-row">
                <span className="pdf-sign-color-label">Warna:</span>
                {PEN_COLORS.map((c) => (
                  <button key={c} type="button"
                    className={`pdf-sign-color-dot${penColor === c ? ' active' : ''}`}
                    style={{ background: c }} onClick={() => setPenColor(c)} />
                ))}
              </div>

              <div className="pdf-sign-tabs">
                {[
                  { id: 'draw', icon: <Pen className="icon-xs" />, label: 'Gambar' },
                  { id: 'type', icon: <Type className="icon-xs" />, label: 'Ketik' },
                  { id: 'upload', icon: <ImageIcon className="icon-xs" />, label: 'Upload Gambar' },
                ].map((tab) => (
                  <button key={tab.id} type="button"
                    className={`pdf-sign-tab${sigMode === tab.id ? ' active' : ''}`}
                    onClick={() => setSigMode(tab.id)}>
                    {tab.icon} {tab.label}
                  </button>
                ))}
              </div>

              {sigMode === 'draw' && (
                <div className="pdf-sign-draw-wrap">
                  <canvas ref={drawCanvasRef} width={560} height={180} className="pdf-sign-draw-canvas"
                    onMouseDown={startDraw} onMouseMove={draw} onMouseUp={endDraw} onMouseLeave={endDraw}
                    onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={endDraw} />
                  <p className="pdf-sign-draw-hint">Gambar tanda tangan di area di atas</p>
                  <div className="pdf-sign-draw-actions">
                    <button type="button" className="ghost-btn icon-btn" onClick={clearDrawCanvas}>
                      <RotateCcw className="icon-xs" /> Reset
                    </button>
                    <button type="button" className="primary icon-btn" onClick={applyDrawSignature}>
                      <Check className="icon-xs" /> Gunakan Tanda Tangan
                    </button>
                  </div>
                </div>
              )}

              {sigMode === 'type' && (
                <div className="pdf-sign-type-wrap">
                  <input type="text" className="pdf-sign-type-input" placeholder="Masukkan nama Anda..."
                    value={typedName} onChange={(e) => setTypedName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && applyTypedSignature()} />
                  {typedName.trim() && (
                    <div className="pdf-sign-type-preview" style={{ color: penColor }}>{typedName}</div>
                  )}
                  <button type="button" className="primary icon-btn" onClick={applyTypedSignature} disabled={!typedName.trim()}>
                    <Check className="icon-xs" /> Gunakan Tanda Tangan
                  </button>
                </div>
              )}

              {sigMode === 'upload' && (
                <label className="upload-box pdf-sign-upload-sig-box">
                  <input type="file" accept="image/*" onChange={onUploadSig} />
                  <ImageIcon className="icon-xs" />
                  Upload gambar tanda tangan (PNG transparan lebih baik)
                </label>
              )}

              {hasSig && (
                <div className="pdf-sign-sig-preview-wrap">
                  <span className="pdf-sign-sig-preview-label">✓ Tanda tangan siap:</span>
                  <div className="pdf-sign-sig-preview">
                    <img src={sigDataUrl} alt="Signature preview" />
                    <button type="button" className="pdf-sign-sig-remove"
                      onClick={() => { setSigDataUrl(null); setPlacements([]) }}>
                      <X className="icon-xs" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* ── Step 3: Place per page ─────────────────────────────────────── */}
            {hasSig && (
              <div className="pdf-sign-step">
                <div className="pdf-sign-step-label">
                  <span className="pdf-sign-step-num">3</span>
                  Atur Posisi per Halaman
                  <span className="pdf-sign-step-hint">— navigasi, drag &amp; resize, klik "Tambah"</span>
                </div>

                {/* Page navigation */}
                <div className="pdf-sign-page-nav">
                  <button type="button" className="outline icon-btn"
                    disabled={currentPage <= 1} onClick={() => setCurrentPage((p) => p - 1)}>
                    <ChevronLeft className="icon-xs" />
                  </button>
                  <span>Halaman <strong>{currentPage}</strong> / {totalPages}</span>
                  <button type="button" className="outline icon-btn"
                    disabled={currentPage >= totalPages} onClick={() => setCurrentPage((p) => p + 1)}>
                    <ChevronRight className="icon-xs" />
                  </button>

                  {/* Add button inline with page nav */}
                  <button type="button"
                    className={`pdf-sign-add-btn icon-btn${currentPagePlaced ? ' placed' : ''}`}
                    onClick={addPlacement}>
                    <PlusCircle className="icon-xs" />
                    {currentPagePlaced ? `Perbarui Hal. ${currentPage}` : `Tambah ke Hal. ${currentPage}`}
                  </button>
                </div>

                {/* Preview + draggable signature */}
                <div className="pdf-sign-preview-wrap" ref={previewRef}>
                  {pageDataUrl && (
                    <img src={pageDataUrl} alt={`Halaman ${currentPage}`}
                      className="pdf-sign-page-img" draggable={false} />
                  )}
                  <div
                    className={`pdf-sign-overlay${isDragging ? ' dragging' : ''}${currentPagePlaced ? ' placed' : ''}`}
                    style={{ left: draftPos.x, top: draftPos.y, width: draftSize.w, height: draftSize.h }}
                    onMouseDown={onSigPointerDown} onTouchStart={onSigPointerDown}>
                    <img src={sigDataUrl} alt="Signature" className="pdf-sign-overlay-img" draggable={false} />
                    <div className="pdf-sign-resize-handle" onMouseDown={onResizePointerDown} onTouchStart={onResizePointerDown} />
                  </div>
                </div>

                {/* Placements list */}
                {placements.length > 0 && (
                  <div className="pdf-sign-placements">
                    <p className="pdf-sign-placements-title">
                      Halaman yang akan ditandatangani ({placements.length}):
                    </p>
                    <div className="pdf-sign-placements-list">
                      {[...placements].sort((a, b) => a.pageNum - b.pageNum).map((pl) => (
                        <div key={pl.id} className="pdf-sign-placement-item">
                          <span className="pdf-sign-placement-badge">Hal. {pl.pageNum}</span>
                          <span className="pdf-sign-placement-info">
                            pos ({Math.round(pl.x)}, {Math.round(pl.y)}) · {Math.round(pl.w)}×{Math.round(pl.h)}px
                          </span>
                          <button type="button" className="pdf-sign-placement-remove"
                            onClick={() => removePlacement(pl.id)} title="Hapus">
                            <Trash2 className="icon-xs" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Step 4: Export ─────────────────────────────────────────────── */}
            {hasSig && placements.length > 0 && (
              <div className="pdf-sign-step pdf-sign-export-step">
                <div className="pdf-sign-step-label">
                  <span className="pdf-sign-step-num">4</span>
                  Simpan PDF
                </div>
                <div className="pdf-sign-actions">
                  <button type="button" className="primary icon-btn" onClick={exportPdf} disabled={isProcessing}>
                    <RefreshCcw className="icon-sm" />
                    {isProcessing ? 'Memproses...' : `Export & Download (${placements.length} halaman)`}
                  </button>
                  {outputUrl && (
                    <a href={outputUrl} download={outputName} className="outline icon-btn">
                      <Download className="icon-xs" /> {outputName}
                    </a>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {status && <p className="m4a-status">{status}</p>}
      </section>
    </main>
  )
}

export default PdfSignatureTool
