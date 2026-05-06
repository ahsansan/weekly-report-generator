import { useEffect, useMemo, useState } from 'react'
import { Download, FileDown, Minimize2, Trash2 } from 'lucide-react'
import { jsPDF } from 'jspdf'
import * as pdfjsLib from 'pdfjs-dist'
import '../App.css'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()

const QUALITY_PROFILES = {
  high: {
    label: 'High Quality',
    hint: 'Teks dan grafik tetap tajam, kompresi ringan.',
    renderScale: 2,
    jpegQuality: 0.92,
  },
  balanced: {
    label: 'Balanced',
    hint: 'Seimbang antara ukuran file dan kualitas visual.',
    renderScale: 1.5,
    jpegQuality: 0.84,
  },
  strong: {
    label: 'Strong Compression',
    hint: 'Ukuran lebih kecil, kualitas turun sedikit.',
    renderScale: 1.2,
    jpegQuality: 0.75,
  },
}

const formatBytes = (bytes) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const exp = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / 1024 ** exp
  return `${value >= 100 ? value.toFixed(0) : value.toFixed(1)} ${units[exp]}`
}

const sanitizeBaseName = (fileName = 'document') =>
  fileName
    .replace(/\.pdf$/i, '')
    .replace(/[^a-zA-Z0-9-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase() || 'document'

function PdfCompressTool() {
  const [pdfFile, setPdfFile] = useState(null)
  const [totalPages, setTotalPages] = useState(0)
  const [qualityProfile, setQualityProfile] = useState('high')
  const [isProcessing, setIsProcessing] = useState(false)
  const [status, setStatus] = useState('')
  const [outputUrl, setOutputUrl] = useState(null)
  const [outputName, setOutputName] = useState('')
  const [outputSize, setOutputSize] = useState(0)

  const selectedProfile = useMemo(() => QUALITY_PROFILES[qualityProfile], [qualityProfile])

  useEffect(() => {
    return () => {
      if (outputUrl) URL.revokeObjectURL(outputUrl)
    }
  }, [outputUrl])

  const clearOutput = () => {
    if (outputUrl) URL.revokeObjectURL(outputUrl)
    setOutputUrl(null)
    setOutputName('')
    setOutputSize(0)
  }

  const resetFile = () => {
    clearOutput()
    setPdfFile(null)
    setTotalPages(0)
    setStatus('')
  }

  const onSelectPdf = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      clearOutput()
      setStatus('Mengecek file PDF...')
      const loaded = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise
      setPdfFile(file)
      setTotalPages(loaded.numPages)
      setStatus(`PDF siap: ${file.name} (${loaded.numPages} halaman, ${formatBytes(file.size)}).`)
      await loaded.destroy()
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Unknown error'
      setPdfFile(null)
      setTotalPages(0)
      setStatus(`Gagal membaca PDF: ${reason}`)
    } finally {
      event.target.value = ''
    }
  }

  const compressPdf = async () => {
    if (!pdfFile || isProcessing) return

    try {
      setIsProcessing(true)
      clearOutput()
      setStatus('Memproses kompresi PDF...')

      const loaded = await pdfjsLib.getDocument({ data: await pdfFile.arrayBuffer() }).promise
      let outputPdf = null

      for (let pageIndex = 1; pageIndex <= loaded.numPages; pageIndex += 1) {
        setStatus(`Memproses halaman ${pageIndex}/${loaded.numPages}...`)

        const page = await loaded.getPage(pageIndex)
        const baseViewport = page.getViewport({ scale: 1 })
        const maxDimension = Math.max(baseViewport.width, baseViewport.height)
        const safeScale = Math.min(selectedProfile.renderScale, 2400 / maxDimension)
        const renderScale = Math.max(safeScale, 0.8)
        const viewport = page.getViewport({ scale: renderScale })

        const canvas = document.createElement('canvas')
        const context = canvas.getContext('2d', { alpha: false })
        if (!context) throw new Error('Canvas context tidak tersedia di browser ini.')

        canvas.width = Math.max(1, Math.floor(viewport.width))
        canvas.height = Math.max(1, Math.floor(viewport.height))

        await page.render({ canvasContext: context, viewport }).promise

        const pageWidthPt = baseViewport.width
        const pageHeightPt = baseViewport.height
        const orientation = pageWidthPt > pageHeightPt ? 'landscape' : 'portrait'

        if (!outputPdf) {
          outputPdf = new jsPDF({
            orientation,
            unit: 'pt',
            format: [pageWidthPt, pageHeightPt],
            compress: true,
            putOnlyUsedFonts: true,
          })
        } else {
          outputPdf.addPage([pageWidthPt, pageHeightPt], orientation)
        }

        const imageData = canvas.toDataURL('image/jpeg', selectedProfile.jpegQuality)
        outputPdf.addImage(imageData, 'JPEG', 0, 0, pageWidthPt, pageHeightPt, undefined, 'FAST')

        canvas.width = 1
        canvas.height = 1
      }

      if (!outputPdf) throw new Error('Tidak ada halaman yang berhasil diproses.')

      const blob = outputPdf.output('blob')
      const url = URL.createObjectURL(blob)
      const fileName = `${sanitizeBaseName(pdfFile.name)}-compressed-${qualityProfile}.pdf`

      setOutputUrl(url)
      setOutputName(fileName)
      setOutputSize(blob.size)

      const ratio = ((blob.size / pdfFile.size) * 100).toFixed(1)
      setStatus(`Selesai. Ukuran baru ${formatBytes(blob.size)} (${ratio}% dari file asli).`)
      await loaded.destroy()
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Unknown error'
      setStatus(`Gagal kompres PDF: ${reason}`)
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <main className="page pdf-compress-page">
      <section className="hero" style={{ '--theme-color': '#2F80ED' }}>
        <div className="hero-left">
          <div className="hero-icon" aria-hidden="true">
            <Minimize2 className="icon-md" />
          </div>
          <div>
            <h1>PDF Compress</h1>
            <p>Kompres PDF dengan profil kualitas supaya hasil tetap enak dibaca.</p>
          </div>
        </div>
        <div className="shortcut-box">
          <span>MODE</span>
          <code>High / Balanced / Strong</code>
        </div>
      </section>

      <section className="card pdf-compress-card">
        <div className="pdf-compress-grid">
          <label className="upload-box pdf-compress-upload-box">
            <input type="file" accept="application/pdf,.pdf" onChange={onSelectPdf} />
            <span>
              <FileDown className="icon-xs" /> Upload PDF
            </span>
          </label>

          <div className="pdf-compress-file-panel">
            <p className="pdf-compress-file-title">File Aktif</p>
            {pdfFile ? (
              <div className="pdf-compress-file-row">
                <div>
                  <strong>{pdfFile.name}</strong>
                  <p>
                    {totalPages} halaman • {formatBytes(pdfFile.size)}
                  </p>
                </div>
                <button type="button" className="ghost-btn icon-btn" onClick={resetFile}>
                  <Trash2 className="icon-xs" /> Hapus
                </button>
              </div>
            ) : (
              <p className="pdf-compress-empty">Belum ada file PDF dipilih.</p>
            )}
          </div>

          <div className="pdf-compress-profile-tabs" role="tablist" aria-label="Profil kualitas">
            {Object.entries(QUALITY_PROFILES).map(([profileKey, profile]) => (
              <button
                key={profileKey}
                type="button"
                className={`pdf-compress-profile-tab ${qualityProfile === profileKey ? 'active' : ''}`}
                onClick={() => setQualityProfile(profileKey)}
              >
                <strong>{profile.label}</strong>
                <span>{profile.hint}</span>
              </button>
            ))}
          </div>

          <div className="pdf-compress-actions">
            <button
              type="button"
              className="primary icon-btn"
              onClick={compressPdf}
              disabled={!pdfFile || isProcessing}
            >
              <Minimize2 className="icon-sm" /> {isProcessing ? 'Memproses...' : 'Compress PDF'}
            </button>
          </div>
        </div>

        {status ? <p className="m4a-status">{status}</p> : null}

        {outputUrl ? (
          <div className="pdf-compress-result">
            <a href={outputUrl} download={outputName} className="primary icon-btn pdf-compress-download-link">
              <Download className="icon-sm" /> Download {outputName} ({formatBytes(outputSize)})
            </a>
          </div>
        ) : null}

        <p className="pdf-compress-note">
          Catatan: metode ini merender ulang halaman jadi hasil biasanya stabil untuk share/viewing, tapi elemen text di PDF
          output tidak lagi selectable seperti file asli.
        </p>
      </section>
    </main>
  )
}

export default PdfCompressTool
