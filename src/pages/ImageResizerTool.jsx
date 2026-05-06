import { useEffect, useState } from 'react'
import { Download, Image as ImageIcon, RefreshCcw, Scaling, Upload } from 'lucide-react'
import '../App.css'

const formatSize = (bytes) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB']
  const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const scaled = bytes / 1024 ** unitIndex
  return `${scaled.toFixed(scaled >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`
}

const loadImageElement = (url) =>
  new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Gagal memuat gambar.'))
    image.src = url
  })

const resizeImage = async (file, targetWidth, targetHeight, outputType = 'image/png') => {
  const sourceUrl = URL.createObjectURL(file)
  try {
    const sourceImage = await loadImageElement(sourceUrl)
    const canvas = document.createElement('canvas')
    canvas.width = targetWidth
    canvas.height = targetHeight
    const context = canvas.getContext('2d', { alpha: true })
    if (!context) throw new Error('Canvas tidak tersedia di browser ini.')

    context.clearRect(0, 0, targetWidth, targetHeight)
    context.drawImage(sourceImage, 0, 0, targetWidth, targetHeight)

    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob((nextBlob) => {
        if (!nextBlob) {
          reject(new Error('Gagal membuat output gambar.'))
          return
        }
        resolve(nextBlob)
      }, outputType)
    })
    return blob
  } finally {
    URL.revokeObjectURL(sourceUrl)
  }
}

const readImageDimensionsFromFile = async (file) => {
  const sourceUrl = URL.createObjectURL(file)
  try {
    const image = await loadImageElement(sourceUrl)
    return { width: image.naturalWidth, height: image.naturalHeight }
  } finally {
    URL.revokeObjectURL(sourceUrl)
  }
}

function ImageResizerTool() {
  const [sourceFiles, setSourceFiles] = useState([])
  const [resultItems, setResultItems] = useState([])
  const [sourceDimensions, setSourceDimensions] = useState({ width: 0, height: 0 })
  const [isResizing, setIsResizing] = useState(false)
  const [status, setStatus] = useState('Pilih file PNG/JPG, tentukan ukuran, lalu resize.')
  const [widthInput, setWidthInput] = useState('')
  const [heightInput, setHeightInput] = useState('')
  const [isUnlocked, setIsUnlocked] = useState(false)
  const [isUnlockModalOpen, setIsUnlockModalOpen] = useState(false)
  const [unlockPassword, setUnlockPassword] = useState('')
  const [unlockError, setUnlockError] = useState('')

  useEffect(() => {
    return () => {
      resultItems.forEach((item) => URL.revokeObjectURL(item.outputUrl))
    }
  }, [resultItems])

  const clearResults = () => {
    resultItems.forEach((item) => URL.revokeObjectURL(item.outputUrl))
    setResultItems([])
  }

  const onSelectFiles = (event) => {
    const allValidFiles = Array.from(event.target.files ?? [])
      .filter((file) => /image\/(png|jpeg)/i.test(file.type) || /\.(png|jpe?g)$/i.test(file.name))
    const validFiles = allValidFiles.slice(0, isUnlocked ? 20 : 2)
    setSourceFiles(validFiles)
    setSourceDimensions({ width: 0, height: 0 })
    clearResults()
    if (!isUnlocked && allValidFiles.length > 2) {
      setStatus('Mode default maksimal 2 file. Klik Unlock untuk buka tanpa batas.')
    } else {
      setStatus(validFiles.length > 0 ? `${validFiles.length} file dipilih.` : 'Tidak ada file PNG/JPG yang valid.')
    }

    if (validFiles.length > 0) {
      readImageDimensionsFromFile(validFiles[0])
        .then((img) => {
          setSourceDimensions({ width: img.width, height: img.height })
        })
        .catch(() => {})
    }

    event.target.value = ''
  }

  const openUnlockModal = () => {
    if (isUnlocked) return
    setUnlockPassword('')
    setUnlockError('')
    setIsUnlockModalOpen(true)
  }

  const closeUnlockModal = () => {
    if (isResizing) return
    setIsUnlockModalOpen(false)
  }

  const submitUnlock = (event) => {
    event.preventDefault()
    if (unlockPassword === 'OTW10M!') {
      setIsUnlocked(true)
      setIsUnlockModalOpen(false)
      setUnlockPassword('')
      setUnlockError('')
      setStatus('Unlimited mode aktif. Sekarang bisa upload sampai 20 file per batch.')
      return
    }
    setUnlockError('Password salah.')
  }

  const onWidthChange = (value) => {
    const safeValue = value.replace(/[^\d]/g, '')
    setWidthInput(safeValue)
    const width = Number(safeValue)
    if (!width || width <= 0 || !sourceDimensions.width || !sourceDimensions.height) {
      setHeightInput('')
      return
    }
    const nextHeight = Math.round((width / sourceDimensions.width) * sourceDimensions.height)
    setHeightInput(String(nextHeight))
  }

  const onHeightChange = (value) => {
    const safeValue = value.replace(/[^\d]/g, '')
    setHeightInput(safeValue)
    const height = Number(safeValue)
    if (!height || height <= 0 || !sourceDimensions.width || !sourceDimensions.height) {
      setWidthInput('')
      return
    }
    const nextWidth = Math.round((height / sourceDimensions.height) * sourceDimensions.width)
    setWidthInput(String(nextWidth))
  }

  const onResize = async () => {
    if (sourceFiles.length === 0 || isResizing) return

    const widthValue = Number(widthInput)
    const heightValue = Number(heightInput)
    const hasWidth = Number.isFinite(widthValue) && widthValue > 0
    const hasHeight = Number.isFinite(heightValue) && heightValue > 0

    if (!hasWidth && !hasHeight) {
      setStatus('Isi width atau height dulu.')
      return
    }

    let baseDimensions = sourceDimensions
    if ((!baseDimensions.width || !baseDimensions.height) && sourceFiles.length > 0) {
      try {
        baseDimensions = await readImageDimensionsFromFile(sourceFiles[0])
        setSourceDimensions(baseDimensions)
      } catch {
        setStatus('Gagal membaca dimensi gambar pertama.')
        return
      }
    }

    let width = hasWidth ? widthValue : 0
    let height = hasHeight ? heightValue : 0

    if (hasWidth && !hasHeight) {
      height = Math.round((width / baseDimensions.width) * baseDimensions.height)
      setHeightInput(String(height))
    } else if (!hasWidth && hasHeight) {
      width = Math.round((height / baseDimensions.height) * baseDimensions.width)
      setWidthInput(String(width))
    }

    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
      setStatus('Ukuran hasil tidak valid. Coba angka lain.')
      return
    }

    try {
      setIsResizing(true)
      clearResults()
      const resizedItems = []

      for (let index = 0; index < sourceFiles.length; index += 1) {
        const sourceFile = sourceFiles[index]
        setStatus(`Resizing ${index + 1}/${sourceFiles.length}: ${sourceFile.name}`)
        const isJpeg = /\.jpe?g$/i.test(sourceFile.name) || /image\/jpeg/i.test(sourceFile.type)
        const outputType = isJpeg ? 'image/jpeg' : 'image/png'
        const outputExt = isJpeg ? 'jpg' : 'png'
        const resizedBlob = await resizeImage(sourceFile, width, height, outputType)
        const outputUrl = URL.createObjectURL(resizedBlob)
        const outputName = `${sourceFile.name.replace(/\.(png|jpe?g)$/i, '')}-${width}x${height}.${outputExt}`

        resizedItems.push({
          id: `${sourceFile.name}-${sourceFile.lastModified}-${index}`,
          sourceName: sourceFile.name,
          sourceSize: sourceFile.size,
          outputName,
          outputSize: resizedBlob.size,
          outputUrl,
          width,
          height,
        })
      }

      setResultItems(resizedItems)
      setStatus(`Resize selesai. ${resizedItems.length} file siap di-download.`)
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Unknown resize error'
      setStatus(`Gagal resize: ${reason}`)
      clearResults()
    } finally {
      setIsResizing(false)
    }
  }

  return (
    <main className="page image-resizer-page">
      <section className="hero" style={{ '--theme-color': '#7A95FF' }}>
        <div className="hero-left">
          <div className="hero-icon" aria-hidden="true">
            <Scaling className="icon-md" />
          </div>
          <div>
            <h1>Image Resizer</h1>
            <p>Resize PNG/JPG ke ukuran yang kamu butuhkan langsung di browser.</p>
          </div>
        </div>
        <div className="shortcut-box">
          <span>FITUR</span>
          <code>Input PNG/JPG</code>
          <code>Preset + Custom Size</code>
        </div>
      </section>

      <section className="card image-resizer-card">
        <div className="image-resizer-grid">
          <label className="upload-box image-resizer-upload-box">
            <input type="file" accept=".png,.jpg,.jpeg,image/png,image/jpeg" multiple onChange={onSelectFiles} />
            <span>
              <Upload className="icon-xs" /> Pilih file PNG/JPG ({isUnlocked ? 'maks 20 file' : 'maks 2 file'})
            </span>
          </label>

          <div className="image-resizer-actions">
            <button
              type="button"
              className={`outline icon-btn ${isUnlocked ? 'm4a-unlocked-btn' : ''}`}
              onClick={openUnlockModal}
              disabled={isUnlocked}
            >
              {isUnlocked ? 'Unlocked' : 'Unlock'}
            </button>
          </div>

          <div className="image-resizer-controls">
            <div className="image-resizer-dimensions">
              <label className="field">
                <span>Width (px)</span>
                <input value={widthInput} onChange={(event) => onWidthChange(event.target.value)} placeholder="1080" />
              </label>
              <label className="field">
                <span>Height (px)</span>
                <input
                  value={heightInput}
                  onChange={(event) => onHeightChange(event.target.value)}
                  placeholder="1080"
                />
              </label>
            </div>
            <p className="image-resizer-note">
              Cukup isi salah satu ukuran. Nilai satunya otomatis ngikut aspect ratio gambar pertama.
            </p>
          </div>

          <div className="image-resizer-actions">
            <button type="button" className="primary icon-btn" onClick={onResize} disabled={sourceFiles.length === 0 || isResizing}>
              <ImageIcon className="icon-sm" /> {isResizing ? 'Resizing...' : 'Resize Gambar'}
            </button>
            <button type="button" className="outline icon-btn" onClick={clearResults} disabled={isResizing}>
              <RefreshCcw className="icon-sm" /> Reset Hasil
            </button>
          </div>
        </div>

        {status ? <p className="m4a-status">{status}</p> : null}

        {resultItems.length > 0 ? (
          <div className="image-resizer-result-grid">
            {resultItems.map((item) => (
              <article key={item.id} className="image-resizer-result-card">
                <img src={item.outputUrl} alt={item.outputName} className="image-resizer-preview" />
                <div className="image-resizer-meta">
                  <strong>{item.sourceName}</strong>
                  <p>
                    {item.width}x{item.height} | {formatSize(item.sourceSize)} {'->'} {formatSize(item.outputSize)}
                  </p>
                </div>
                <a href={item.outputUrl} download={item.outputName} className="outline icon-btn image-resizer-download-link">
                  <Download className="icon-sm" /> Download
                </a>
              </article>
            ))}
          </div>
        ) : null}
      </section>

      {isUnlockModalOpen ? (
        <div className="preview-modal" role="dialog" aria-modal="true">
          <div className="preview-backdrop" onClick={closeUnlockModal}></div>
          <section className="preview-panel m4a-unlock-modal">
            <header className="preview-head">
              <h3>Unlock Unlimited Upload</h3>
            </header>
            <form className="m4a-unlock-form" onSubmit={submitUnlock}>
              <label className="field">
                <span>Password</span>
                <input
                  type="password"
                  value={unlockPassword}
                  onChange={(event) => setUnlockPassword(event.target.value)}
                  placeholder="Masukkan password unlock"
                  autoFocus
                />
              </label>
              {unlockError ? <p className="m4a-unlock-error">{unlockError}</p> : null}
              <div className="m4a-unlock-actions">
                <button type="button" className="ghost-btn icon-btn" onClick={closeUnlockModal}>
                  Batal
                </button>
                <button type="submit" className="primary icon-btn">
                  Unlock
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </main>
  )
}

export default ImageResizerTool
