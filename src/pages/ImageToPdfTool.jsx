import { useEffect, useMemo, useState } from 'react'
import { Download, FileImage, FileUp, RefreshCcw } from 'lucide-react'
import { jsPDF } from 'jspdf'
import '../App.css'

const PAGE_PRESETS_MM = {
  a4: { label: 'A4 (210 x 297 mm)', width: 210, height: 297 },
  a5: { label: 'A5 (148 x 210 mm)', width: 148, height: 210 },
  letter: { label: 'Letter (216 x 279 mm)', width: 216, height: 279 },
}

const formatBytes = (bytes) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const exp = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / 1024 ** exp
  return `${value >= 100 ? value.toFixed(0) : value.toFixed(1)} ${units[exp]}`
}

const loadImageElement = (url) =>
  new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Gagal memuat gambar.'))
    image.src = url
  })

const imageElementToDataUrl = (image, format = 'JPEG') => {
  const canvas = document.createElement('canvas')
  canvas.width = image.naturalWidth || image.width
  canvas.height = image.naturalHeight || image.height
  const context = canvas.getContext('2d', { alpha: true })
  if (!context) throw new Error('Canvas context tidak tersedia di browser ini.')
  context.drawImage(image, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL(format === 'PNG' ? 'image/png' : 'image/jpeg', format === 'PNG' ? undefined : 0.97)
}

const sanitizeBaseName = (fileName = 'images') =>
  fileName
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[^a-zA-Z0-9-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase() || 'images'

function ImageToPdfTool() {
  const [sourceFiles, setSourceFiles] = useState([])
  const [previewItems, setPreviewItems] = useState([])
  const [outputUrl, setOutputUrl] = useState(null)
  const [outputName, setOutputName] = useState('')
  const [outputSize, setOutputSize] = useState(0)
  const [isProcessing, setIsProcessing] = useState(false)
  const [status, setStatus] = useState('Pilih gambar PNG/JPG lalu convert ke PDF.')
  const [pagePreset, setPagePreset] = useState('a4')
  const [isCustomSize, setIsCustomSize] = useState(false)
  const [widthMm, setWidthMm] = useState('210')
  const [heightMm, setHeightMm] = useState('297')
  const [orientation, setOrientation] = useState('portrait')

  const pageSize = useMemo(() => {
    if (isCustomSize) {
      const w = Number(widthMm)
      const h = Number(heightMm)
      return {
        width: Number.isFinite(w) && w > 0 ? w : 210,
        height: Number.isFinite(h) && h > 0 ? h : 297,
      }
    }
    const preset = PAGE_PRESETS_MM[pagePreset] ?? PAGE_PRESETS_MM.a4
    return { width: preset.width, height: preset.height }
  }, [isCustomSize, widthMm, heightMm, pagePreset])

  useEffect(() => {
    return () => {
      previewItems.forEach((item) => URL.revokeObjectURL(item.previewUrl))
      if (outputUrl) URL.revokeObjectURL(outputUrl)
    }
  }, [previewItems, outputUrl])

  const clearOutput = () => {
    if (outputUrl) URL.revokeObjectURL(outputUrl)
    setOutputUrl(null)
    setOutputName('')
    setOutputSize(0)
  }

  const clearAll = () => {
    previewItems.forEach((item) => URL.revokeObjectURL(item.previewUrl))
    setSourceFiles([])
    setPreviewItems([])
    clearOutput()
    setStatus('Pilih gambar PNG/JPG lalu convert ke PDF.')
  }

  const onSelectFiles = (event) => {
    const files = Array.from(event.target.files ?? []).filter(
      (file) => /image\/(png|jpeg)/i.test(file.type) || /\.(png|jpe?g)$/i.test(file.name)
    )
    previewItems.forEach((item) => URL.revokeObjectURL(item.previewUrl))
    clearOutput()

    const items = files.map((file, index) => ({
      id: `${file.name}-${file.lastModified}-${index}`,
      file,
      previewUrl: URL.createObjectURL(file),
    }))

    setSourceFiles(files)
    setPreviewItems(items)
    setStatus(files.length > 0 ? `${files.length} gambar siap diproses.` : 'Tidak ada file PNG/JPG yang valid.')
    event.target.value = ''
  }

  const onConvert = async () => {
    if (sourceFiles.length === 0 || isProcessing) return
    const width = pageSize.width
    const height = pageSize.height
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
      setStatus('Ukuran halaman tidak valid.')
      return
    }

    try {
      setIsProcessing(true)
      clearOutput()
      setStatus('Membuat PDF...')

      const isLandscape = orientation === 'landscape'
      const pageWidth = isLandscape ? height : width
      const pageHeight = isLandscape ? width : height
      const pdf = new jsPDF({
        orientation: isLandscape ? 'landscape' : 'portrait',
        unit: 'mm',
        format: [pageWidth, pageHeight],
        compress: true,
      })

      for (let i = 0; i < sourceFiles.length; i += 1) {
        const file = sourceFiles[i]
        setStatus(`Memproses gambar ${i + 1}/${sourceFiles.length}: ${file.name}`)
        const sourceUrl = URL.createObjectURL(file)
        const image = await loadImageElement(sourceUrl)
        URL.revokeObjectURL(sourceUrl)

        const imgRatio = image.naturalWidth / image.naturalHeight
        const pageRatio = pageWidth / pageHeight
        let drawWidth = pageWidth
        let drawHeight = pageHeight
        if (imgRatio > pageRatio) {
          drawHeight = pageWidth / imgRatio
        } else {
          drawWidth = pageHeight * imgRatio
        }
        const x = (pageWidth - drawWidth) / 2
        const y = (pageHeight - drawHeight) / 2

        if (i > 0) pdf.addPage([pageWidth, pageHeight], isLandscape ? 'landscape' : 'portrait')

        const imageType = /image\/png/i.test(file.type) || /\.png$/i.test(file.name) ? 'PNG' : 'JPEG'
        const imageDataUrl = imageElementToDataUrl(image, imageType)
        pdf.addImage(imageDataUrl, imageType, x, y, drawWidth, drawHeight, undefined, 'FAST')
      }

      const blob = pdf.output('blob')
      const url = URL.createObjectURL(blob)
      const outputBase = sanitizeBaseName(sourceFiles[0]?.name || 'images')
      setOutputName(`${outputBase}-${isCustomSize ? 'custom' : pagePreset}.pdf`)
      setOutputUrl(url)
      setOutputSize(blob.size)
      setStatus(`Selesai. PDF ${sourceFiles.length} halaman siap di-download.`)
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Unknown error'
      setStatus(`Gagal convert: ${reason}`)
      clearOutput()
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <main className="page image-to-pdf-page">
      <section className="hero" style={{ '--theme-color': '#4A86E8' }}>
        <div className="hero-left">
          <div className="hero-icon" aria-hidden="true">
            <FileImage className="icon-md" />
          </div>
          <div>
            <h1>Image to PDF</h1>
            <p>Gabungkan PNG/JPG jadi PDF dengan ukuran halaman A4 atau custom.</p>
          </div>
        </div>
        <div className="shortcut-box">
          <span>OUTPUT</span>
          <code>A4 / Letter / Custom</code>
        </div>
      </section>

      <section className="card image-to-pdf-card">
        <div className="image-to-pdf-grid">
          <label className="upload-box image-to-pdf-upload-box">
            <input type="file" accept=".png,.jpg,.jpeg,image/png,image/jpeg" multiple onChange={onSelectFiles} />
            <span>
              <FileUp className="icon-xs" /> Pilih gambar PNG/JPG
            </span>
          </label>

          <div className="image-to-pdf-options">
            <label className="field">
              <span>Ukuran Halaman</span>
              <select
                value={isCustomSize ? 'custom' : pagePreset}
                onChange={(event) => {
                  const value = event.target.value
                  if (value === 'custom') {
                    setIsCustomSize(true)
                  } else {
                    setIsCustomSize(false)
                    setPagePreset(value)
                  }
                }}
              >
                {Object.entries(PAGE_PRESETS_MM).map(([key, preset]) => (
                  <option key={key} value={key}>
                    {preset.label}
                  </option>
                ))}
                <option value="custom">Custom (mm)</option>
              </select>
            </label>

            <label className="field">
              <span>Orientasi</span>
              <select value={orientation} onChange={(event) => setOrientation(event.target.value)}>
                <option value="portrait">Portrait</option>
                <option value="landscape">Landscape</option>
              </select>
            </label>

            {isCustomSize ? (
              <div className="image-to-pdf-custom-row">
                <label className="field">
                  <span>Lebar (mm)</span>
                  <input value={widthMm} onChange={(event) => setWidthMm(event.target.value.replace(/[^\d.]/g, ''))} />
                </label>
                <label className="field">
                  <span>Tinggi (mm)</span>
                  <input value={heightMm} onChange={(event) => setHeightMm(event.target.value.replace(/[^\d.]/g, ''))} />
                </label>
              </div>
            ) : null}
          </div>

          <div className="image-to-pdf-actions">
            <button type="button" className="primary icon-btn" onClick={onConvert} disabled={sourceFiles.length === 0 || isProcessing}>
              <FileImage className="icon-sm" /> {isProcessing ? 'Memproses...' : 'Convert ke PDF'}
            </button>
            <button type="button" className="outline icon-btn" onClick={clearAll} disabled={isProcessing}>
              <RefreshCcw className="icon-sm" /> Reset
            </button>
          </div>
        </div>

        {status ? <p className="m4a-status">{status}</p> : null}

        {outputUrl ? (
          <div className="image-to-pdf-result">
            <a href={outputUrl} download={outputName} className="primary icon-btn image-to-pdf-download-link">
              <Download className="icon-sm" /> Download {outputName} ({formatBytes(outputSize)})
            </a>
          </div>
        ) : null}

        {previewItems.length > 0 ? (
          <div className="image-to-pdf-preview-grid">
            {previewItems.map((item) => (
              <article key={item.id} className="image-to-pdf-preview-card">
                <img src={item.previewUrl} alt={item.file.name} className="image-to-pdf-preview-image" />
                <p>{item.file.name}</p>
              </article>
            ))}
          </div>
        ) : null}
      </section>
    </main>
  )
}

export default ImageToPdfTool
