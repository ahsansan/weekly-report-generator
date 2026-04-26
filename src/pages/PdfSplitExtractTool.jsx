import { useEffect, useMemo, useState } from 'react'
import { Download, FileDown, FileMinus2, Files, RefreshCcw, Scissors, Trash2 } from 'lucide-react'
import { PDFDocument } from 'pdf-lib'
import JSZip from 'jszip'
import '../App.css'

const sanitizeBaseName = (fileName = 'document') =>
  fileName
    .replace(/\.pdf$/i, '')
    .replace(/[^a-zA-Z0-9-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase() || 'document'

const parseRangeToken = (token, totalPages) => {
  const normalized = token.trim()

  if (/^\d+$/.test(normalized)) {
    const pageNumber = Number(normalized)
    if (pageNumber < 1 || pageNumber > totalPages) {
      throw new Error(`Halaman ${pageNumber} di luar batas (1-${totalPages}).`)
    }

    return {
      label: `${pageNumber}`,
      pages: [pageNumber - 1],
    }
  }

  const rangeMatch = normalized.match(/^(\d+)\s*-\s*(\d+)$/)
  if (!rangeMatch) {
    throw new Error(`Format range tidak valid: "${normalized}". Gunakan contoh 1-3,5,8-10.`)
  }

  const start = Number(rangeMatch[1])
  const end = Number(rangeMatch[2])

  if (start > end) {
    throw new Error(`Range "${normalized}" tidak valid karena awal lebih besar dari akhir.`)
  }

  if (start < 1 || end > totalPages) {
    throw new Error(`Range "${normalized}" di luar batas (1-${totalPages}).`)
  }

  return {
    label: `${start}-${end}`,
    pages: Array.from({ length: end - start + 1 }, (_, index) => start - 1 + index),
  }
}

const parseRanges = (input, totalPages) => {
  const rawTokens = input
    .split(/[\n,;]+/)
    .map((token) => token.trim())
    .filter(Boolean)

  if (rawTokens.length === 0) {
    throw new Error('Range masih kosong. Contoh: 1-3, 5, 8-10')
  }

  const segments = rawTokens.map((token) => parseRangeToken(token, totalPages))

  const seen = new Set()
  const uniquePages = []

  segments.forEach((segment) => {
    segment.pages.forEach((pageIndex) => {
      if (!seen.has(pageIndex)) {
        seen.add(pageIndex)
        uniquePages.push(pageIndex)
      }
    })
  })

  return { segments, uniquePages }
}

const downloadBlobAsUrl = (blob) => URL.createObjectURL(blob)

function PdfSplitExtractTool() {
  const [pdfFile, setPdfFile] = useState(null)
  const [totalPages, setTotalPages] = useState(0)
  const [rangeInput, setRangeInput] = useState('1-2,4')
  const [status, setStatus] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [outputUrl, setOutputUrl] = useState(null)
  const [outputName, setOutputName] = useState('')

  const baseName = useMemo(() => sanitizeBaseName(pdfFile?.name || 'pdf'), [pdfFile])

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

  const loadPdfMeta = async (file) => {
    try {
      const bytes = await file.arrayBuffer()
      const doc = await PDFDocument.load(bytes)
      return doc.getPageCount()
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Unknown error'
      throw new Error(`Gagal membaca PDF: ${reason}`)
    }
  }

  const onSelectPdf = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      clearOutput()
      setStatus('Memuat metadata PDF...')
      const pageCount = await loadPdfMeta(file)
      setPdfFile(file)
      setTotalPages(pageCount)
      setStatus(`PDF siap: ${file.name} (${pageCount} halaman).`)
    } catch (error) {
      setPdfFile(null)
      setTotalPages(0)
      setStatus(error instanceof Error ? error.message : 'Gagal memuat PDF.')
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

  const createDocumentFromPages = async (sourceDoc, pageIndexes) => {
    const nextDoc = await PDFDocument.create()
    const copiedPages = await nextDoc.copyPages(sourceDoc, pageIndexes)
    copiedPages.forEach((page) => nextDoc.addPage(page))
    return nextDoc.save()
  }

  const processSplitPerPage = async () => {
    if (!pdfFile || isProcessing) return

    try {
      setIsProcessing(true)
      clearOutput()
      setStatus('Memecah PDF per halaman...')

      const sourceDoc = await PDFDocument.load(await pdfFile.arrayBuffer())
      const pageCount = sourceDoc.getPageCount()
      const zip = new JSZip()

      for (let index = 0; index < pageCount; index += 1) {
        const bytes = await createDocumentFromPages(sourceDoc, [index])
        zip.file(`${baseName}-page-${index + 1}.pdf`, bytes)
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' })
      const fileName = `${baseName}-split-pages.zip`
      const url = downloadBlobAsUrl(zipBlob)

      setOutputUrl(url)
      setOutputName(fileName)
      setStatus(`Berhasil memecah ${pageCount} halaman menjadi ZIP.`)
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Unknown error'
      setStatus(`Gagal split PDF: ${reason}`)
    } finally {
      setIsProcessing(false)
    }
  }

  const processSplitByRange = async () => {
    if (!pdfFile || isProcessing) return

    try {
      setIsProcessing(true)
      clearOutput()
      const { segments } = parseRanges(rangeInput, totalPages)
      setStatus('Memecah PDF berdasarkan range...')

      const sourceDoc = await PDFDocument.load(await pdfFile.arrayBuffer())
      const zip = new JSZip()

      for (let index = 0; index < segments.length; index += 1) {
        const segment = segments[index]
        const bytes = await createDocumentFromPages(sourceDoc, segment.pages)
        const safeLabel = segment.label.replace(/\s+/g, '')
        zip.file(`${baseName}-range-${safeLabel}.pdf`, bytes)
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' })
      const fileName = `${baseName}-split-ranges.zip`
      const url = downloadBlobAsUrl(zipBlob)

      setOutputUrl(url)
      setOutputName(fileName)
      setStatus(`Berhasil membuat ${segments.length} file berdasarkan range.`)
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Unknown error'
      setStatus(`Gagal split range: ${reason}`)
    } finally {
      setIsProcessing(false)
    }
  }

  const processExtractPages = async () => {
    if (!pdfFile || isProcessing) return

    try {
      setIsProcessing(true)
      clearOutput()
      const { uniquePages } = parseRanges(rangeInput, totalPages)
      setStatus('Mengekstrak halaman terpilih...')

      const sourceDoc = await PDFDocument.load(await pdfFile.arrayBuffer())
      const outputBytes = await createDocumentFromPages(sourceDoc, uniquePages)
      const blob = new Blob([outputBytes], { type: 'application/pdf' })
      const fileName = `${baseName}-extracted.pdf`
      const url = downloadBlobAsUrl(blob)

      setOutputUrl(url)
      setOutputName(fileName)
      setStatus(`Berhasil extract ${uniquePages.length} halaman ke 1 file PDF.`)
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Unknown error'
      setStatus(`Gagal extract: ${reason}`)
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <main className="page pdf-split-page">
      <section className="hero pdf-split-hero" style={{ '--theme-color': '#57B5E0' }}>
        <div className="hero-left">
          <div className="hero-icon" aria-hidden="true">
            <Scissors className="icon-md" />
          </div>
          <div>
            <h1>PDF Split & Extract</h1>
            <p>Pecah PDF per halaman/range, lalu extract halaman tertentu dalam satu file.</p>
          </div>
        </div>
        <div className="shortcut-box">
          <span>INFO</span>
          <code>{pdfFile ? `${totalPages} pages` : 'No PDF selected'}</code>
          <code>Range: 1-3,5,8-10</code>
        </div>
      </section>

      <section className="card pdf-split-card">
        <div className="pdf-split-grid">
          <label className="upload-box pdf-split-upload-box">
            <input type="file" accept="application/pdf,.pdf" onChange={onSelectPdf} />
            <span>
              <FileDown className="icon-xs" /> Upload PDF
            </span>
          </label>

          <div className="pdf-split-file-panel">
            <p className="pdf-split-file-title">File Aktif</p>
            {pdfFile ? (
              <div className="pdf-split-file-row">
                <div>
                  <strong>{pdfFile.name}</strong>
                  <p>{totalPages} halaman</p>
                </div>
                <button type="button" className="ghost-btn icon-btn" onClick={resetFile}>
                  <Trash2 className="icon-xs" /> Hapus
                </button>
              </div>
            ) : (
              <p className="pdf-split-empty">Belum ada file PDF dipilih.</p>
            )}
          </div>

          <label className="field full">
            <span>Range Halaman</span>
            <input
              value={rangeInput}
              onChange={(event) => setRangeInput(event.target.value)}
              placeholder="Contoh: 1-3, 5, 8-10"
              disabled={!pdfFile || isProcessing}
            />
          </label>

          <p className="pdf-split-hint">
            Pisahkan dengan koma/newline. Contoh: <code>1-3, 5, 8-10</code>
          </p>

          <div className="pdf-split-actions">
            <button
              type="button"
              className="outline icon-btn"
              onClick={processSplitPerPage}
              disabled={!pdfFile || isProcessing}
            >
              <Files className="icon-sm" /> {isProcessing ? 'Memproses...' : 'Split Per Halaman (ZIP)'}
            </button>
            <button
              type="button"
              className="outline icon-btn"
              onClick={processSplitByRange}
              disabled={!pdfFile || isProcessing}
            >
              <RefreshCcw className="icon-sm" /> {isProcessing ? 'Memproses...' : 'Split By Range (ZIP)'}
            </button>
            <button
              type="button"
              className="primary icon-btn"
              onClick={processExtractPages}
              disabled={!pdfFile || isProcessing}
            >
              <FileMinus2 className="icon-sm" /> {isProcessing ? 'Memproses...' : 'Extract Selected (PDF)'}
            </button>
          </div>
        </div>

        {status ? <p className="m4a-status">{status}</p> : null}

        {outputUrl ? (
          <div className="pdf-split-result">
            <a href={outputUrl} download={outputName} className="primary icon-btn pdf-split-download-link">
              <Download className="icon-sm" /> Download {outputName}
            </a>
          </div>
        ) : null}
      </section>
    </main>
  )
}

export default PdfSplitExtractTool
