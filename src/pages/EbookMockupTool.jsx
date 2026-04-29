import { useEffect, useRef, useState } from 'react'
import { BookOpenText, Download, FileImage, FileText, RefreshCcw, Upload, X } from 'lucide-react'
import { jsPDF } from 'jspdf'
import * as pdfjsLib from 'pdfjs-dist'
import '../App.css'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).href

const COVER_W = 1000
const MOCKUP_W = 1400
const MOCKUP_H = 1600

const TEMPLATE_OPTIONS = [
  { id: 'book-showcase', label: 'Book Showcase' },
  { id: 'perspective', label: 'Perspective 3D' },
  { id: 'flat', label: 'Flat Clean' },
  { id: 'stack', label: 'Stack Books' },
  { id: 'spotlight', label: 'Spotlight' },
  { id: 'angled-float', label: 'Angled Float' },
]

const readFileAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('Gagal membaca file.'))
    reader.readAsDataURL(file)
  })

const drawRoundedRectPath = (ctx, x, y, width, height, radius) => {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2))
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + width - r, y)
  ctx.quadraticCurveTo(x + width, y, x + width, y + r)
  ctx.lineTo(x + width, y + height - r)
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height)
  ctx.lineTo(x + r, y + height)
  ctx.quadraticCurveTo(x, y + height, x, y + height - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

const drawCover = (ctx, coverImg, x, y, width, height, radius = 20) => {
  drawRoundedRectPath(ctx, x, y, width, height, radius)
  ctx.clip()
  ctx.drawImage(coverImg, x, y, width, height)
}

const drawHardBook = (ctx, coverImg, options) => {
  const {
    x,
    y,
    width,
    height,
    spineWidth = 32,
    radius = 16,
    tiltDeg = 0,
    pageDepth = 16,
    coverShade = 0.12,
  } = options

  const tiltRad = (tiltDeg * Math.PI) / 180
  const cx = x + width / 2
  const cy = y + height / 2

  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(tiltRad)
  ctx.translate(-cx, -cy)

  // layered contact shadow for better realism
  ctx.fillStyle = 'rgba(0, 0, 0, 0.24)'
  ctx.filter = 'blur(18px)'
  ctx.fillRect(x + 8, y + height - 6, width + 24, 28)
  ctx.fillStyle = 'rgba(0, 0, 0, 0.12)'
  ctx.filter = 'blur(30px)'
  ctx.fillRect(x + 22, y + height - 2, width + 20, 44)
  ctx.filter = 'none'

  // page block base
  ctx.fillStyle = '#f4f6fb'
  drawRoundedRectPath(ctx, x + 8, y + 8, width, height, radius)
  ctx.fill()

  // right page plane (3D thickness)
  const sideGrad = ctx.createLinearGradient(x + width - 4, 0, x + width + pageDepth, 0)
  sideGrad.addColorStop(0, '#d9e1ee')
  sideGrad.addColorStop(0.7, '#becada')
  sideGrad.addColorStop(1, '#a9b8cc')
  ctx.fillStyle = sideGrad
  ctx.beginPath()
  ctx.moveTo(x + width, y + 10)
  ctx.lineTo(x + width + pageDepth, y + 6)
  ctx.lineTo(x + width + pageDepth, y + height - 8)
  ctx.lineTo(x + width, y + height - 4)
  ctx.closePath()
  ctx.fill()

  // bottom page plane (3D thickness)
  const bottomGrad = ctx.createLinearGradient(0, y + height - 2, 0, y + height + pageDepth)
  bottomGrad.addColorStop(0, '#e9edf5')
  bottomGrad.addColorStop(1, '#c5d0e0')
  ctx.fillStyle = bottomGrad
  ctx.beginPath()
  ctx.moveTo(x + 10, y + height)
  ctx.lineTo(x + width + 2, y + height)
  ctx.lineTo(x + width + pageDepth, y + height + pageDepth - 2)
  ctx.lineTo(x + pageDepth, y + height + pageDepth)
  ctx.closePath()
  ctx.fill()

  // subtle page lines
  ctx.strokeStyle = 'rgba(124, 139, 161, 0.24)'
  ctx.lineWidth = 1
  for (let i = 0; i < 12; i += 1) {
    const yy = y + 20 + i * ((height - 40) / 11)
    ctx.beginPath()
    ctx.moveTo(x + width + 3, yy)
    ctx.lineTo(x + width + pageDepth - 1, yy - 2)
    ctx.stroke()
  }

  // spine
  const spineGrad = ctx.createLinearGradient(x - spineWidth, 0, x + 6, 0)
  spineGrad.addColorStop(0, '#71839d')
  spineGrad.addColorStop(0.5, '#9cafc6')
  spineGrad.addColorStop(1, '#dbe4f0')
  ctx.fillStyle = spineGrad
  drawRoundedRectPath(ctx, x - spineWidth, y + 3, spineWidth, height - 6, Math.max(8, radius - 6))
  ctx.fill()

  // spine groove
  ctx.strokeStyle = 'rgba(45, 64, 92, 0.28)'
  ctx.lineWidth = 1.2
  ctx.beginPath()
  ctx.moveTo(x - spineWidth + 6, y + 12)
  ctx.lineTo(x - spineWidth + 6, y + height - 12)
  ctx.stroke()

  // front cover
  ctx.save()
  drawCover(ctx, coverImg, x, y, width, height, radius)
  ctx.restore()

  // glossy lamination overlay
  const gloss = ctx.createLinearGradient(x, y, x + width, y + height * 0.5)
  gloss.addColorStop(0, 'rgba(255,255,255,0.26)')
  gloss.addColorStop(0.25, 'rgba(255,255,255,0.1)')
  gloss.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = gloss
  drawRoundedRectPath(ctx, x, y, width, height, radius)
  ctx.fill()

  // edge ambient occlusion
  ctx.fillStyle = 'rgba(22, 33, 52, 0.16)'
  drawRoundedRectPath(ctx, x + width - pageDepth, y + 4, pageDepth, height - 8, 8)
  ctx.fill()

  // top highlight
  ctx.strokeStyle = `rgba(255, 255, 255, ${coverShade})`
  ctx.lineWidth = 2
  drawRoundedRectPath(ctx, x + 6, y + 6, width - 12, height - 12, Math.max(8, radius - 6))
  ctx.stroke()

  ctx.restore()
}

const renderTemplate = (ctx, coverImg, templateId) => {
  ctx.clearRect(0, 0, MOCKUP_W, MOCKUP_H)

  if (templateId === 'book-showcase') {
    drawHardBook(ctx, coverImg, {
      x: 120,
      y: 210,
      width: 430,
      height: 640,
      spineWidth: 26,
      tiltDeg: -2,
      pageDepth: 14,
      radius: 12,
    })
    drawHardBook(ctx, coverImg, {
      x: 835,
      y: 190,
      width: 410,
      height: 620,
      spineWidth: 24,
      tiltDeg: 1.6,
      pageDepth: 14,
      radius: 12,
    })
    drawHardBook(ctx, coverImg, {
      x: 400,
      y: 670,
      width: 470,
      height: 700,
      spineWidth: 28,
      tiltDeg: 0.6,
      pageDepth: 16,
      radius: 14,
      coverShade: 0.2,
    })
    return
  }

  if (templateId === 'flat') {
    drawHardBook(ctx, coverImg, {
      x: 380,
      y: 220,
      width: 650,
      height: 980,
      spineWidth: 24,
      tiltDeg: 0,
      pageDepth: 12,
      radius: 16,
    })
    return
  }

  if (templateId === 'stack') {
    ctx.save()
    ctx.fillStyle = '#ced9eb'
    drawRoundedRectPath(ctx, 250, 330, 620, 930, 20)
    ctx.fill()
    ctx.fillStyle = '#b9c8de'
    drawRoundedRectPath(ctx, 305, 290, 620, 930, 20)
    ctx.fill()
    ctx.restore()

    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)'
    ctx.filter = 'blur(20px)'
    ctx.fillRect(330, 1225, 690, 55)
    ctx.filter = 'none'

    drawHardBook(ctx, coverImg, {
      x: 360,
      y: 250,
      width: 650,
      height: 980,
      spineWidth: 26,
      tiltDeg: -0.5,
      pageDepth: 13,
      radius: 16,
    })
    return
  }

  if (templateId === 'spotlight') {
    drawHardBook(ctx, coverImg, {
      x: 385,
      y: 230,
      width: 640,
      height: 980,
      spineWidth: 26,
      tiltDeg: -6,
      pageDepth: 14,
      radius: 18,
    })
    return
  }

  if (templateId === 'angled-float') {
    drawHardBook(ctx, coverImg, {
      x: 390,
      y: 250,
      width: 640,
      height: 960,
      spineWidth: 28,
      tiltDeg: -14,
      pageDepth: 14,
      radius: 18,
      coverShade: 0.24,
    })
    return
  }

  // default: perspective
  const mockX = 340
  const mockY = 180
  const coverW = 760
  const coverH = 1140
  drawHardBook(ctx, coverImg, {
    x: mockX,
    y: mockY,
    width: coverW,
    height: coverH,
    spineWidth: 34,
    tiltDeg: -2.5,
    pageDepth: 16,
    radius: 18,
  })

  ctx.fillStyle = 'rgba(0, 0, 0, 0.2)'
  ctx.filter = 'blur(20px)'
  ctx.fillRect(mockX + 20, mockY + coverH - 6, coverW + 40, 48)
  ctx.filter = 'none'

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)'
  ctx.lineWidth = 2
  drawRoundedRectPath(ctx, mockX + 12, mockY + 12, coverW - 24, coverH - 24, 18)
  ctx.stroke()
}

function EbookMockupTool() {
  const [inputFile, setInputFile] = useState(null)
  const [coverDataUrl, setCoverDataUrl] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [status, setStatus] = useState('')
  const [outputBaseName, setOutputBaseName] = useState('ebook-mockup')
  const [mockupResults, setMockupResults] = useState([])

  const mockupCanvasRef = useRef(null)

  useEffect(() => {
    return () => {
      mockupResults.forEach((item) => {
        URL.revokeObjectURL(item.pngUrl)
        URL.revokeObjectURL(item.pdfUrl)
      })
    }
  }, [mockupResults])

  const clearOutputs = () => {
    mockupResults.forEach((item) => {
      URL.revokeObjectURL(item.pngUrl)
      URL.revokeObjectURL(item.pdfUrl)
    })
    setMockupResults([])
  }

  const resetAll = () => {
    clearOutputs()
    setInputFile(null)
    setCoverDataUrl('')
    setStatus('')
    setOutputBaseName('ebook-mockup')
  }

  const loadCoverFromPdf = async (file) => {
    const arrayBuffer = await file.arrayBuffer()
    const doc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
    const firstPage = await doc.getPage(1)
    const sourceViewport = firstPage.getViewport({ scale: 1 })
    const scale = COVER_W / sourceViewport.width
    const viewport = firstPage.getViewport({ scale })

    const pageCanvas = document.createElement('canvas')
    pageCanvas.width = Math.round(viewport.width)
    pageCanvas.height = Math.round(viewport.height)

    await firstPage.render({
      canvasContext: pageCanvas.getContext('2d'),
      viewport,
    }).promise

    return pageCanvas.toDataURL('image/png')
  }

  const onSelectCover = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsProcessing(true)
    setStatus('Memproses cover...')
    clearOutputs()

    try {
      const isPdf = /application\/pdf/i.test(file.type) || /\.pdf$/i.test(file.name)
      const dataUrl = isPdf ? await loadCoverFromPdf(file) : await readFileAsDataUrl(file)

      setInputFile(file)
      setCoverDataUrl(dataUrl)
      const baseName = (file.name || 'ebook-cover').replace(/\.(pdf|png|jpg|jpeg|webp)$/i, '')
      setOutputBaseName(baseName || 'ebook-mockup')
      setStatus('Cover siap. Klik Generate Semua Opsi.')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      setStatus(`Gagal membaca file: ${message}`)
      setInputFile(null)
      setCoverDataUrl('')
    } finally {
      setIsProcessing(false)
      event.target.value = ''
    }
  }

  const generateAllMockups = async () => {
    if (!coverDataUrl || !mockupCanvasRef.current) return

    setIsProcessing(true)
    setStatus('Membuat beberapa opsi mockup...')
    clearOutputs()

    try {
      const canvas = mockupCanvasRef.current
      canvas.width = MOCKUP_W
      canvas.height = MOCKUP_H
      const ctx = canvas.getContext('2d')

      const coverImg = new Image()
      await new Promise((resolve, reject) => {
        coverImg.onload = resolve
        coverImg.onerror = () => reject(new Error('Cover image gagal dimuat.'))
        coverImg.src = coverDataUrl
      })

      const results = []
      for (const template of TEMPLATE_OPTIONS) {
        renderTemplate(ctx, coverImg, template.id)

        const pngBlob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
        if (!pngBlob) throw new Error('Tidak bisa membuat output PNG.')
        const pngUrl = URL.createObjectURL(pngBlob)

        const imageDataUrl = canvas.toDataURL('image/png')
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'px', format: [canvas.width, canvas.height] })
        pdf.addImage(imageDataUrl, 'PNG', 0, 0, canvas.width, canvas.height)
        const pdfUrl = URL.createObjectURL(pdf.output('blob'))

        results.push({ id: template.id, label: template.label, imageDataUrl, pngUrl, pdfUrl })
      }

      setMockupResults(results)
      setStatus(`Berhasil bikin ${results.length} opsi mockup. Pilih dan download yang paling cocok.`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      setStatus(`Gagal generate mockup: ${message}`)
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <main className="page ebook-mockup-page">
      <section className="hero" style={{ '--theme-color': '#4A90E2' }}>
        <div className="hero-left">
          <div className="hero-icon" aria-hidden="true">
            <BookOpenText className="icon-md" />
          </div>
          <div>
            <h1>Ebook Mockup Creator</h1>
            <p>Upload cover PNG/PDF lalu generate beberapa opsi mockup ebook seperti flow Canva.</p>
          </div>
        </div>
        <div className="shortcut-box">
          <span>FITUR</span>
          <code>6 Mockup Styles</code>
          <code>Export PNG/PDF</code>
        </div>
      </section>

      <section className="card ebook-mockup-card">
        <div className="ebook-mockup-grid">
          <label className="upload-box ebook-mockup-upload-box">
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,application/pdf,.pdf,.png,.jpg,.jpeg,.webp"
              onChange={onSelectCover}
              disabled={isProcessing}
            />
            <span>
              <Upload className="icon-xs" /> {inputFile ? inputFile.name : 'Pilih Cover (PNG atau PDF)'}
            </span>
          </label>

          <div className="ebook-mockup-actions">
            <button
              type="button"
              className="primary icon-btn"
              onClick={generateAllMockups}
              disabled={!coverDataUrl || isProcessing}
            >
              <RefreshCcw className="icon-sm" /> {isProcessing ? 'Memproses...' : 'Generate Semua Opsi'}
            </button>
            <button type="button" className="ghost-btn icon-btn" onClick={resetAll} disabled={isProcessing}>
              <X className="icon-sm" /> Reset
            </button>
          </div>

          <div className="ebook-mockup-results">
            {mockupResults.length > 0 ? (
              mockupResults.map((item) => (
                <article key={item.id} className="ebook-mockup-result-card">
                  <header>
                    <h3>{item.label}</h3>
                  </header>
                  <img src={item.imageDataUrl} alt={`${item.label} preview`} className="ebook-mockup-preview-image" />
                  <div className="ebook-mockup-downloads">
                    <a href={item.pngUrl} download={`${outputBaseName}-${item.id}.png`} className="outline icon-btn">
                      <FileImage className="icon-sm" /> PNG
                    </a>
                    <a href={item.pdfUrl} download={`${outputBaseName}-${item.id}.pdf`} className="outline icon-btn">
                      <FileText className="icon-sm" /> PDF
                    </a>
                  </div>
                </article>
              ))
            ) : (
              <div className="ebook-mockup-preview-empty">Preview beberapa opsi mockup muncul di sini.</div>
            )}
          </div>

          <canvas ref={mockupCanvasRef} className="ebook-mockup-hidden-canvas" />
        </div>

        {status ? (
          <p className="m4a-status">
            <Download className="icon-xs" /> {status}
          </p>
        ) : null}
      </section>
    </main>
  )
}

export default EbookMockupTool
