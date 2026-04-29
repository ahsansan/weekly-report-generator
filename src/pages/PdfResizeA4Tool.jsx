import { useEffect, useMemo, useState } from 'react'
import { Download, FileDown, RefreshCcw, Trash2 } from 'lucide-react'
import { PDFDocument, rgb } from 'pdf-lib'
import '../App.css'

const MM_TO_PT = 2.8346456693
const DEFAULT_MARGIN = 24

const PAGE_PRESETS = {
  a4: { label: 'A4 (210 x 297 mm)', width: 210, height: 297 },
  a5: { label: 'A5 (148 x 210 mm)', width: 148, height: 210 },
  letter: { label: 'Letter (216 x 279 mm)', width: 215.9, height: 279.4 },
  legal: { label: 'Legal (216 x 356 mm)', width: 215.9, height: 355.6 },
  b5: { label: 'B5 (176 x 250 mm)', width: 176, height: 250 },
  tabloid: { label: 'Tabloid (279 x 432 mm)', width: 279.4, height: 431.8 },
}
const BG_SWATCHES = ['#ffffff', '#f8fafc', '#fef3c7', '#fee2e2', '#dbeafe', '#dcfce7', '#e9d5ff', '#111827']

const sanitizeBaseName = (fileName = 'document') =>
  fileName
    .replace(/\.pdf$/i, '')
    .replace(/[^a-zA-Z0-9-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase() || 'document'

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
    r: ((intValue >> 16) & 255) / 255,
    g: ((intValue >> 8) & 255) / 255,
    b: (intValue & 255) / 255,
  }
}

function PdfResizeA4Tool() {
  const [pdfFile, setPdfFile] = useState(null)
  const [totalPages, setTotalPages] = useState(0)
  const [isProcessing, setIsProcessing] = useState(false)
  const [status, setStatus] = useState('')
  const [outputUrl, setOutputUrl] = useState(null)
  const [outputName, setOutputName] = useState('')

  const [sizePreset, setSizePreset] = useState('a4')
  const [orientationMode, setOrientationMode] = useState('auto')
  const [backgroundMode, setBackgroundMode] = useState('transparent')
  const [backgroundHex, setBackgroundHex] = useState('#ffffff')
  const [customWidthMm, setCustomWidthMm] = useState('210')
  const [customHeightMm, setCustomHeightMm] = useState('297')

  const effectiveSize = useMemo(() => {
    if (sizePreset !== 'custom') return PAGE_PRESETS[sizePreset]
    const width = Number(customWidthMm)
    const height = Number(customHeightMm)
    return {
      label: `Custom (${customWidthMm} x ${customHeightMm} mm)`,
      width: Number.isFinite(width) ? width : 0,
      height: Number.isFinite(height) ? height : 0,
    }
  }, [sizePreset, customWidthMm, customHeightMm])

  useEffect(() => {
    return () => {
      if (outputUrl) URL.revokeObjectURL(outputUrl)
    }
  }, [outputUrl])

  const clearOutput = () => {
    if (outputUrl) URL.revokeObjectURL(outputUrl)
    setOutputUrl(null)
    setOutputName('')
  }

  const onSelectPdf = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      clearOutput()
      setStatus('Memuat PDF...')
      const inputDoc = await PDFDocument.load(await file.arrayBuffer())
      setPdfFile(file)
      setTotalPages(inputDoc.getPageCount())
      setStatus(`PDF siap: ${file.name} (${inputDoc.getPageCount()} halaman).`)
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Unknown error'
      setPdfFile(null)
      setTotalPages(0)
      setStatus(`Gagal membaca PDF: ${reason}`)
    } finally {
      event.target.value = ''
    }
  }

  const resetFile = () => {
    clearOutput()
    setPdfFile(null)
    setTotalPages(0)
    setStatus('')
  }

  const resizePdf = async () => {
    if (!pdfFile || isProcessing) return

    if (!effectiveSize.width || !effectiveSize.height || effectiveSize.width <= 0 || effectiveSize.height <= 0) {
      setStatus('Ukuran halaman tidak valid. Pastikan lebar/tinggi lebih dari 0 mm.')
      return
    }

    try {
      setIsProcessing(true)
      clearOutput()
      setStatus('Resize PDF sedang diproses...')

      const inputDoc = await PDFDocument.load(await pdfFile.arrayBuffer())
      const outputDoc = await PDFDocument.create()
      const pageIndices = inputDoc.getPageIndices()
      const embeddedPages = await outputDoc.embedPages(pageIndices.map((idx) => inputDoc.getPage(idx)))

      const presetWPt = effectiveSize.width * MM_TO_PT
      const presetHPt = effectiveSize.height * MM_TO_PT

      embeddedPages.forEach((embeddedPage) => {
        const sourceW = embeddedPage.width
        const sourceH = embeddedPage.height
        const sourceLandscape = sourceW > sourceH

        let pageW = presetWPt
        let pageH = presetHPt

        if (orientationMode === 'landscape') {
          pageW = Math.max(presetWPt, presetHPt)
          pageH = Math.min(presetWPt, presetHPt)
        } else if (orientationMode === 'portrait') {
          pageW = Math.min(presetWPt, presetHPt)
          pageH = Math.max(presetWPt, presetHPt)
        } else if (sourceLandscape) {
          pageW = Math.max(presetWPt, presetHPt)
          pageH = Math.min(presetWPt, presetHPt)
        } else {
          pageW = Math.min(presetWPt, presetHPt)
          pageH = Math.max(presetWPt, presetHPt)
        }

        const targetW = pageW - DEFAULT_MARGIN * 2
        const targetH = pageH - DEFAULT_MARGIN * 2
        const scale = Math.min(targetW / sourceW, targetH / sourceH)
        const drawW = sourceW * scale
        const drawH = sourceH * scale
        const x = (pageW - drawW) / 2
        const y = (pageH - drawH) / 2

        const page = outputDoc.addPage([pageW, pageH])

        if (backgroundMode === 'white') {
          page.drawRectangle({ x: 0, y: 0, width: pageW, height: pageH, color: rgb(1, 1, 1) })
        } else if (backgroundMode === 'color') {
          const { r, g, b } = hexToRgb(backgroundHex)
          page.drawRectangle({ x: 0, y: 0, width: pageW, height: pageH, color: rgb(r, g, b) })
        }

        page.drawPage(embeddedPage, { x, y, width: drawW, height: drawH })
      })

      const bytes = await outputDoc.save()
      const blob = new Blob([bytes], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const fileName = `${sanitizeBaseName(pdfFile.name)}-resized.pdf`

      setOutputUrl(url)
      setOutputName(fileName)
      setStatus(`Berhasil resize ${embeddedPages.length} halaman ke ${effectiveSize.label}.`)
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Unknown error'
      setStatus(`Gagal resize PDF: ${reason}`)
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <main className="page pdf-resize-page">
      <section className="hero" style={{ '--theme-color': '#57B5E0' }}>
        <div className="hero-left">
          <div className="hero-icon" aria-hidden="true">
            <RefreshCcw className="icon-md" />
          </div>
          <div>
            <h1>PDF Resize</h1>
            <p>Atur ukuran halaman PDF + background, lalu fit konten otomatis tanpa terpotong.</p>
          </div>
        </div>
        <div className="shortcut-box">
          <span>MODE</span>
          <code>Preset + Custom Size</code>
          <code>Background Selectable</code>
        </div>
      </section>

      <section className="card pdf-resize-card">
        <div className="pdf-resize-grid">
          <label className="upload-box pdf-resize-upload-box">
            <input type="file" accept="application/pdf,.pdf" onChange={onSelectPdf} />
            <span>
              <FileDown className="icon-xs" /> Upload PDF
            </span>
          </label>

          <div className="pdf-resize-file-panel">
            <p className="pdf-resize-file-title">File Aktif</p>
            {pdfFile ? (
              <div className="pdf-resize-file-row">
                <div>
                  <strong>{pdfFile.name}</strong>
                  <p>{totalPages} halaman</p>
                </div>
                <button type="button" className="ghost-btn icon-btn" onClick={resetFile}>
                  <Trash2 className="icon-xs" /> Hapus
                </button>
              </div>
            ) : (
              <p className="pdf-resize-empty">Belum ada file PDF dipilih.</p>
            )}
          </div>

          <div className="field-grid pdf-resize-config-grid">
            <label className="field">
              <span>Ukuran Halaman</span>
              <select value={sizePreset} onChange={(event) => setSizePreset(event.target.value)}>
                <option value="a4">A4</option>
                <option value="a5">A5</option>
                <option value="letter">Letter</option>
                <option value="legal">Legal</option>
                <option value="b5">B5</option>
                <option value="tabloid">Tabloid</option>
                <option value="custom">Custom (mm)</option>
              </select>
            </label>

            <label className="field">
              <span>Orientasi</span>
              <select value={orientationMode} onChange={(event) => setOrientationMode(event.target.value)}>
                <option value="auto">Auto (ikut halaman asli)</option>
                <option value="portrait">Portrait</option>
                <option value="landscape">Landscape</option>
              </select>
            </label>

            {sizePreset === 'custom' ? (
              <>
                <label className="field">
                  <span>Lebar (mm)</span>
                  <input value={customWidthMm} onChange={(event) => setCustomWidthMm(event.target.value)} />
                </label>
                <label className="field">
                  <span>Tinggi (mm)</span>
                  <input value={customHeightMm} onChange={(event) => setCustomHeightMm(event.target.value)} />
                </label>
              </>
            ) : null}

            <div className="field">
              <span>Background</span>
              <div className="pdf-resize-bg-tabs" role="tablist" aria-label="Background mode">
                <button
                  type="button"
                  className={`pdf-resize-bg-tab ${backgroundMode === 'transparent' ? 'active' : ''}`}
                  onClick={() => setBackgroundMode('transparent')}
                >
                  Transparent
                </button>
                <button
                  type="button"
                  className={`pdf-resize-bg-tab ${backgroundMode === 'white' ? 'active' : ''}`}
                  onClick={() => setBackgroundMode('white')}
                >
                  White
                </button>
                <button
                  type="button"
                  className={`pdf-resize-bg-tab ${backgroundMode === 'color' ? 'active' : ''}`}
                  onClick={() => setBackgroundMode('color')}
                >
                  Custom
                </button>
              </div>
            </div>

            {backgroundMode === 'color' ? (
              <div className="field">
                <span>Warna Background</span>
                <div className="pdf-resize-color-row">
                  <label className="pdf-resize-color-input-wrap" title="Pilih warna bebas">
                    <input
                      type="color"
                      value={backgroundHex}
                      onChange={(event) => setBackgroundHex(event.target.value)}
                    />
                  </label>
                  <code className="pdf-resize-color-hex">{backgroundHex.toUpperCase()}</code>
                </div>
                <div className="pdf-resize-swatch-row">
                  {BG_SWATCHES.map((swatch) => (
                    <button
                      key={swatch}
                      type="button"
                      className={`pdf-resize-swatch ${backgroundHex.toLowerCase() === swatch ? 'active' : ''}`}
                      style={{ background: swatch }}
                      onClick={() => setBackgroundHex(swatch)}
                      title={swatch.toUpperCase()}
                    />
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <div className="pdf-resize-actions">
            <button
              type="button"
              className="primary icon-btn"
              onClick={resizePdf}
              disabled={!pdfFile || isProcessing}
            >
              <RefreshCcw className="icon-sm" /> {isProcessing ? 'Memproses...' : 'Resize PDF'}
            </button>
          </div>
        </div>

        {status ? <p className="m4a-status">{status}</p> : null}

        {outputUrl ? (
          <div className="pdf-resize-result">
            <a href={outputUrl} download={outputName} className="primary icon-btn pdf-resize-download-link">
              <Download className="icon-sm" /> Download {outputName}
            </a>
          </div>
        ) : null}
      </section>
    </main>
  )
}

export default PdfResizeA4Tool
