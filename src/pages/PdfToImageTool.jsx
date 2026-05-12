import { useEffect, useMemo, useRef, useState } from 'react'
import { Download, FileImage, FileUp, Trash2 } from 'lucide-react'
import JSZip from 'jszip'
import { PDFiumLibrary } from '@hyzyla/pdfium'
import pdfiumWasmUrl from '@hyzyla/pdfium/pdfium.wasm?url'
import '../App.css'

const QUALITY_OPTIONS = {
  ultra: { label: 'Ultra HQ', scale: 3.2, hint: 'Paling tajam, proses lebih lama.' },
  high: { label: 'High', scale: 2.4, hint: 'Kualitas tinggi untuk mayoritas dokumen.' },
  standard: { label: 'Standard', scale: 1.8, hint: 'Lebih cepat, detail masih bagus.' },
}
const MAX_RENDER_PIXELS = 16_000_000
const MIN_SAFE_SCALE = 1.1

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

const getSafeScale = (targetScale, originalWidth, originalHeight) => {
  const basePixels = Math.max(1, originalWidth * originalHeight)
  const maxScaleByPixels = Math.sqrt(MAX_RENDER_PIXELS / basePixels)
  return Math.max(MIN_SAFE_SCALE, Math.min(targetScale, maxScaleByPixels))
}

const isOutOfMemoryError = (error) => {
  const message = error instanceof Error ? error.message : String(error)
  return /out of bounds|memory|wasm|abort/i.test(message)
}

function PdfToImageTool() {
  const pdfiumLibraryRef = useRef(null)
  const [pdfFile, setPdfFile] = useState(null)
  const [totalPages, setTotalPages] = useState(0)
  const [qualityKey, setQualityKey] = useState('high')
  const [imageType, setImageType] = useState('png')
  const [isProcessing, setIsProcessing] = useState(false)
  const [status, setStatus] = useState('Upload PDF lalu convert ke gambar HQ.')
  const [resultImages, setResultImages] = useState([])

  const selectedQuality = useMemo(() => QUALITY_OPTIONS[qualityKey], [qualityKey])
  const sourceBaseName = useMemo(() => sanitizeBaseName(pdfFile?.name || 'document'), [pdfFile?.name])

  useEffect(() => {
    return () => {
      resultImages.forEach((item) => URL.revokeObjectURL(item.url))
      if (pdfiumLibraryRef.current) {
        pdfiumLibraryRef.current.destroy()
        pdfiumLibraryRef.current = null
      }
    }
  }, [resultImages])

  const clearResults = () => {
    resultImages.forEach((item) => URL.revokeObjectURL(item.url))
    setResultImages([])
  }

  const getPdfiumLibrary = async () => {
    if (pdfiumLibraryRef.current) return pdfiumLibraryRef.current
    const library = await PDFiumLibrary.init({ wasmUrl: pdfiumWasmUrl })
    pdfiumLibraryRef.current = library
    return library
  }

  const rgbaToImageBytes = async (rgbaBuffer, width, height, format = 'png') => {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d', { alpha: true })
    if (!context) throw new Error('Canvas context tidak tersedia di browser ini.')

    const imageData = new ImageData(new Uint8ClampedArray(rgbaBuffer), width, height)
    context.putImageData(imageData, 0, 0)

    const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png'
    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (nextBlob) => {
          if (!nextBlob) {
            reject(new Error('Gagal membuat blob gambar.'))
            return
          }
          resolve(nextBlob)
        },
        mimeType,
        format === 'jpeg' ? 0.96 : undefined
      )
    })

    canvas.width = 1
    canvas.height = 1
    return new Uint8Array(await blob.arrayBuffer())
  }

  const resetFile = () => {
    clearResults()
    setPdfFile(null)
    setTotalPages(0)
    setStatus('Upload PDF lalu convert ke gambar HQ.')
  }

  const onSelectPdf = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    let document = null

    try {
      clearResults()
      setStatus('Membaca PDF (PDFium)...')
      const library = await getPdfiumLibrary()
      document = await library.loadDocument(new Uint8Array(await file.arrayBuffer()))
      setPdfFile(file)
      setTotalPages(document.getPageCount())
      setStatus(`PDF siap: ${file.name} (${document.getPageCount()} halaman, ${formatBytes(file.size)}).`)
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Unknown error'
      setPdfFile(null)
      setTotalPages(0)
      setStatus(`Gagal membaca PDF: ${reason}`)
    } finally {
      if (document) document.destroy()
      event.target.value = ''
    }
  }

  const convertPdf = async () => {
    if (!pdfFile || isProcessing) return
    let document = null

    try {
      setIsProcessing(true)
      clearResults()
      setStatus('Memproses PDF ke gambar (Accurate engine)...')
      const library = await getPdfiumLibrary()
      document = await library.loadDocument(new Uint8Array(await pdfFile.arrayBuffer()))

      const outputs = []
      const outputExt = imageType === 'jpeg' ? 'jpg' : 'png'
      const pageCount = document.getPageCount()

      for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
        setStatus(`Render halaman ${pageNumber}/${pageCount}...`)

        const page = document.getPage(pageNumber - 1)
        const pageSize = page.getOriginalSize()
        const safeScale = getSafeScale(selectedQuality.scale, pageSize.originalWidth, pageSize.originalHeight)
        const fallbackScale = Math.max(MIN_SAFE_SCALE, safeScale * 0.82)
        let image = null

        try {
          image = await page.render({
            scale: safeScale,
            colorSpace: 'BGRA',
            renderFormFields: true,
            render: async ({ width, height, data }) => {
              return await rgbaToImageBytes(data, width, height, imageType)
            },
          })
        } catch (firstError) {
          if (!isOutOfMemoryError(firstError) || fallbackScale >= safeScale) throw firstError
          setStatus(`Memori penuh di halaman ${pageNumber}, retry skala lebih kecil...`)
          image = await page.render({
            scale: fallbackScale,
            colorSpace: 'BGRA',
            renderFormFields: true,
            render: async ({ width, height, data }) => {
              return await rgbaToImageBytes(data, width, height, imageType)
            },
          })
        }

        const blob = new Blob([image.data], { type: imageType === 'jpeg' ? 'image/jpeg' : 'image/png' })
        const fileName = `${sourceBaseName}-page-${String(pageNumber).padStart(2, '0')}.${outputExt}`
        const url = URL.createObjectURL(blob)

        outputs.push({ pageIndex: pageNumber, fileName, blob, url })
      }

      setResultImages(outputs)
      setStatus(`Selesai (PDFium). ${outputs.length} gambar siap di-download.`)
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Unknown error'
      setStatus(`Gagal convert: ${reason}`)
      clearResults()
    } finally {
      if (document) document.destroy()
      setIsProcessing(false)
    }
  }

  const downloadAllAsZip = async () => {
    if (resultImages.length === 0 || isProcessing) return
    try {
      setIsProcessing(true)
      setStatus('Membuat ZIP...')
      const zip = new JSZip()
      resultImages.forEach((item) => {
        zip.file(item.fileName, item.blob)
      })
      const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } })
      const zipUrl = URL.createObjectURL(zipBlob)
      const anchor = document.createElement('a')
      anchor.href = zipUrl
      anchor.download = `${sourceBaseName}-images-${qualityKey}.zip`
      anchor.click()
      URL.revokeObjectURL(zipUrl)
      setStatus(`ZIP siap (${formatBytes(zipBlob.size)}).`)
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Unknown error'
      setStatus(`Gagal membuat ZIP: ${reason}`)
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <main className="page pdf-to-image-page">
      <section className="hero" style={{ '--theme-color': '#0D8ABC' }}>
        <div className="hero-left">
          <div className="hero-icon" aria-hidden="true">
            <FileImage className="icon-md" />
          </div>
          <div>
            <h1>PDF to Image (HQ)</h1>
            <p>Ubah tiap halaman PDF jadi PNG/JPG resolusi tinggi langsung di browser.</p>
          </div>
        </div>
        <div className="shortcut-box">
          <span>OUTPUT</span>
          <code>Accurate (PDFium WASM)</code>
        </div>
      </section>

      <section className="card pdf-to-image-card">
        <div className="pdf-to-image-grid">
          <label className="upload-box pdf-to-image-upload-box">
            <input type="file" accept="application/pdf,.pdf" onChange={onSelectPdf} />
            <span>
              <FileUp className="icon-xs" /> Upload PDF
            </span>
          </label>

          <div className="pdf-to-image-file-panel">
            <p className="pdf-to-image-file-title">File Aktif</p>
            {pdfFile ? (
              <div className="pdf-to-image-file-row">
                <div>
                  <strong>{pdfFile.name}</strong>
                  <p>
                    {totalPages} halaman • {formatBytes(pdfFile.size)}
                  </p>
                </div>
                <button type="button" className="ghost-btn icon-btn" onClick={resetFile} disabled={isProcessing}>
                  <Trash2 className="icon-xs" /> Hapus
                </button>
              </div>
            ) : (
              <p className="pdf-to-image-empty">Belum ada PDF dipilih.</p>
            )}
          </div>

          <div className="pdf-to-image-options">
            <div className="pdf-to-image-quality-tabs" role="tablist" aria-label="Pilih kualitas">
              {Object.entries(QUALITY_OPTIONS).map(([key, profile]) => (
                <button
                  key={key}
                  type="button"
                  className={`pdf-to-image-quality-tab ${qualityKey === key ? 'active' : ''}`}
                  onClick={() => setQualityKey(key)}
                  disabled={isProcessing}
                >
                  <strong>{profile.label}</strong>
                  <span>{profile.hint}</span>
                </button>
              ))}
            </div>

            <label className="field">
              <span>Format Gambar</span>
              <select value={imageType} onChange={(event) => setImageType(event.target.value)} disabled={isProcessing}>
                <option value="png">PNG (lossless)</option>
                <option value="jpeg">JPG (ukuran lebih kecil)</option>
              </select>
            </label>
          </div>

          <div className="pdf-to-image-actions">
            <button type="button" className="primary icon-btn" onClick={convertPdf} disabled={!pdfFile || isProcessing}>
              <FileImage className="icon-sm" /> {isProcessing ? 'Memproses...' : 'Convert ke Gambar'}
            </button>
            <button
              type="button"
              className="outline icon-btn"
              onClick={downloadAllAsZip}
              disabled={resultImages.length === 0 || isProcessing}
            >
              <Download className="icon-sm" /> Download Semua (ZIP)
            </button>
          </div>
        </div>

        {status ? <p className="m4a-status">{status}</p> : null}

        {resultImages.length > 0 ? (
          <div className="pdf-to-image-result-grid">
            {resultImages.map((item) => (
              <article key={item.fileName} className="pdf-to-image-result-card">
                <img src={item.url} alt={item.fileName} className="pdf-to-image-preview" />
                <div className="pdf-to-image-meta">
                  <strong>{item.fileName}</strong>
                  <p>
                    Halaman {item.pageIndex} • {formatBytes(item.blob.size)}
                  </p>
                </div>
                <a className="outline icon-btn pdf-to-image-download-link" href={item.url} download={item.fileName}>
                  <Download className="icon-sm" /> Download
                </a>
              </article>
            ))}
          </div>
        ) : null}
      </section>
    </main>
  )
}

export default PdfToImageTool
