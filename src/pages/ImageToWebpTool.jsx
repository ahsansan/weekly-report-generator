import { useEffect, useMemo, useState } from 'react'
import { Download, ImageDown, RefreshCcw, Upload } from 'lucide-react'
import '../App.css'

const formatSize = (bytes) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
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

const convertImageToWebp = async (file, qualityValue) => {
  const sourceUrl = URL.createObjectURL(file)

  try {
    const image = await loadImageElement(sourceUrl)
    const canvas = document.createElement('canvas')
    canvas.width = image.naturalWidth || image.width
    canvas.height = image.naturalHeight || image.height

    const context = canvas.getContext('2d', { alpha: true })
    if (!context) {
      throw new Error('Canvas tidak tersedia di browser ini.')
    }
    context.drawImage(image, 0, 0)

    const webpBlob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Browser tidak mendukung export WEBP.'))
            return
          }
          resolve(blob)
        },
        'image/webp',
        qualityValue,
      )
    })

    return webpBlob
  } finally {
    URL.revokeObjectURL(sourceUrl)
  }
}

function ImageToWebpTool() {
  const [sourceFiles, setSourceFiles] = useState([])
  const [resultItems, setResultItems] = useState([])
  const [quality, setQuality] = useState(0.98)
  const [isConverting, setIsConverting] = useState(false)
  const [status, setStatus] = useState('Pilih file PNG/JPG lalu convert ke WEBP.')
  const [isUnlocked, setIsUnlocked] = useState(false)
  const [isUnlockModalOpen, setIsUnlockModalOpen] = useState(false)
  const [unlockPassword, setUnlockPassword] = useState('')
  const [unlockError, setUnlockError] = useState('')

  useEffect(() => {
    return () => {
      resultItems.forEach((item) => {
        URL.revokeObjectURL(item.outputUrl)
        URL.revokeObjectURL(item.previewUrl)
      })
    }
  }, [resultItems])

  const clearResults = () => {
    resultItems.forEach((item) => {
      URL.revokeObjectURL(item.outputUrl)
      URL.revokeObjectURL(item.previewUrl)
    })
    setResultItems([])
  }

  const onSelectFiles = (event) => {
    const selectedFiles = Array.from(event.target.files ?? [])
      .filter((file) => /image\/(png|jpeg)/i.test(file.type) || /\.(png|jpe?g)$/i.test(file.name))
      .slice(0, isUnlocked ? 20 : 2)

    setSourceFiles(selectedFiles)
    clearResults()
    setStatus(
      selectedFiles.length > 0
        ? `${selectedFiles.length} file dipilih. Siap convert.`
        : 'Tidak ada file PNG/JPG yang valid.',
    )
    if (!isUnlocked && selectedFiles.length >= 2) {
      const originalCount = Array.from(event.target.files ?? []).filter(
        (file) => /image\/(png|jpeg)/i.test(file.type) || /\.(png|jpe?g)$/i.test(file.name),
      ).length
      if (originalCount > 2) {
        setStatus('Mode default maksimal 2 file. Klik Unlock untuk buka tanpa batas.')
      }
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
    if (isConverting) return
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

  const onConvert = async () => {
    if (sourceFiles.length === 0 || isConverting) return

    try {
      setIsConverting(true)
      clearResults()
      const convertedItems = []

      for (let index = 0; index < sourceFiles.length; index += 1) {
        const sourceFile = sourceFiles[index]
        setStatus(`Converting ${index + 1}/${sourceFiles.length}: ${sourceFile.name}`)
        const webpBlob = await convertImageToWebp(sourceFile, quality)
        const outputUrl = URL.createObjectURL(webpBlob)

        convertedItems.push({
          id: `${sourceFile.name}-${sourceFile.lastModified}-${index}`,
          sourceName: sourceFile.name,
          sourceSize: sourceFile.size,
          outputName: sourceFile.name.replace(/\.(png|jpe?g)$/i, '') + '.webp',
          outputSize: webpBlob.size,
          outputUrl,
          previewUrl: outputUrl,
        })
      }

      setResultItems(convertedItems)
      setStatus(`Selesai. ${convertedItems.length} file WEBP siap diunduh.`)
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Unknown conversion error'
      setStatus(`Gagal convert: ${reason}`)
      clearResults()
    } finally {
      setIsConverting(false)
    }
  }

  const totalSummary = useMemo(() => {
    if (resultItems.length === 0) return null
    const sourceTotal = resultItems.reduce((sum, item) => sum + item.sourceSize, 0)
    const outputTotal = resultItems.reduce((sum, item) => sum + item.outputSize, 0)
    const delta = sourceTotal - outputTotal
    const ratio = sourceTotal > 0 ? (outputTotal / sourceTotal) * 100 : 100
    return {
      sourceTotal,
      outputTotal,
      delta,
      ratio,
    }
  }, [resultItems])

  return (
    <main className="page image-webp-page">
      <section className="hero" style={{ '--theme-color': '#3BAA8A' }}>
        <div className="hero-left">
          <div className="hero-icon" aria-hidden="true">
            <ImageDown className="icon-md" />
          </div>
          <div>
            <h1>PNG/JPG to WEBP</h1>
            <p>Kompres gambar untuk web dengan kualitas tinggi langsung di browser.</p>
          </div>
        </div>
        <div className="shortcut-box">
          <span>FITUR</span>
          <code>Input PNG/JPG</code>
          <code>Output WEBP</code>
        </div>
      </section>

      <section className="card image-webp-card">
        <div className="image-webp-grid">
          <label className="upload-box image-webp-upload-box">
            <input type="file" accept=".png,.jpg,.jpeg,image/png,image/jpeg" multiple onChange={onSelectFiles} />
            <span>
              <Upload className="icon-xs" /> Pilih file PNG/JPG ({isUnlocked ? 'maks 20 file' : 'maks 2 file'})
            </span>
          </label>

          <div className="image-webp-actions">
            <button
              type="button"
              className={`outline icon-btn ${isUnlocked ? 'm4a-unlocked-btn' : ''}`}
              onClick={openUnlockModal}
              disabled={isUnlocked}
            >
              {isUnlocked ? 'Unlocked' : 'Unlock'}
            </button>
          </div>

          <div className="image-webp-controls">
            <label className="field">
              <span>Quality: {Math.round(quality * 100)}%</span>
              <input
                type="range"
                min={80}
                max={100}
                value={Math.round(quality * 100)}
                onChange={(event) => setQuality(Number(event.target.value) / 100)}
              />
            </label>
            <p className="image-webp-note">
              Pakai 98-100% untuk kualitas visual paling aman. Dimensi/aspect ratio tetap.
            </p>
          </div>

          <div className="image-webp-actions">
            <button
              type="button"
              className="primary icon-btn"
              onClick={onConvert}
              disabled={sourceFiles.length === 0 || isConverting}
            >
              <ImageDown className="icon-sm" /> {isConverting ? 'Converting...' : 'Convert ke WEBP'}
            </button>
            <button type="button" className="outline icon-btn" onClick={clearResults} disabled={isConverting}>
              <RefreshCcw className="icon-sm" /> Reset Hasil
            </button>
          </div>
        </div>

        {status ? <p className="m4a-status">{status}</p> : null}

        {totalSummary ? (
          <p className="image-webp-summary">
            Total: {formatSize(totalSummary.sourceTotal)} {'->'} {formatSize(totalSummary.outputTotal)} (
            {totalSummary.ratio.toFixed(1)}%). Hemat {formatSize(Math.max(totalSummary.delta, 0))}.
          </p>
        ) : null}

        {resultItems.length > 0 ? (
          <div className="image-webp-result-grid">
            {resultItems.map((item) => (
              <article key={item.id} className="image-webp-result-card">
                <img src={item.previewUrl} alt={item.outputName} className="image-webp-preview" />
                <div className="image-webp-meta">
                  <strong>{item.sourceName}</strong>
                  <p>
                    {formatSize(item.sourceSize)} {'->'} {formatSize(item.outputSize)}
                  </p>
                </div>
                <a href={item.outputUrl} download={item.outputName} className="outline icon-btn image-webp-download-link">
                  <Download className="icon-sm" /> Download WEBP
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

export default ImageToWebpTool
