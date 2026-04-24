import { useState } from 'react'
import { Download, Eye, FilePlus2, Files, GripVertical, Trash2, X } from 'lucide-react'
import { PDFDocument } from 'pdf-lib'
import '../App.css'

let _idCounter = 0
const genId = () => String((_idCounter += 1))

function PdfMergeTool() {
  const [pdfItems, setPdfItems] = useState([])
  const [isMerging, setIsMerging] = useState(false)
  const [status, setStatus] = useState('')
  const [outputUrl, setOutputUrl] = useState(null)
  const [outputName, setOutputName] = useState('')
  const [isUnlocked, setIsUnlocked] = useState(false)
  const [isUnlockModalOpen, setIsUnlockModalOpen] = useState(false)
  const [unlockPassword, setUnlockPassword] = useState('')
  const [unlockError, setUnlockError] = useState('')
  const [dragOverId, setDragOverId] = useState(null)
  const [draggingId, setDraggingId] = useState(null)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)

  const maxFiles = isUnlocked ? Infinity : 2

  const resetOutput = () => {
    if (outputUrl) URL.revokeObjectURL(outputUrl)
    setOutputUrl(null)
    setOutputName('')
  }

  const onSelectFile = (event) => {
    const selected = Array.from(event.target.files ?? [])
    const remaining = maxFiles - pdfItems.length
    const toAdd = isUnlocked ? selected : selected.slice(0, Math.max(0, remaining))

    if (!isUnlocked && selected.length > remaining) {
      setStatus(
        `Mode default maksimal ${maxFiles} file. ${pdfItems.length} file sudah dipilih. Klik Unlock untuk buka tanpa batas.`
      )
    } else {
      setStatus('')
    }

    if (toAdd.length === 0) {
      event.target.value = ''
      return
    }

    const newItems = toAdd.map((file) => ({ id: genId(), file }))
    setPdfItems((prev) => [...prev, ...newItems])
    resetOutput()
    event.target.value = ''
  }

  const removeItem = (id) => {
    setPdfItems((prev) => prev.filter((item) => item.id !== id))
    resetOutput()
    setStatus('')
  }

  const moveItem = (fromIndex, toIndex) => {
    setPdfItems((prev) => {
      const next = [...prev]
      const [moved] = next.splice(fromIndex, 1)
      next.splice(toIndex, 0, moved)
      return next
    })
    resetOutput()
  }

  // drag-and-drop reorder
  const onDragStart = (id) => setDraggingId(id)
  const onDragEnd = () => {
    setDraggingId(null)
    setDragOverId(null)
  }
  const onDragOver = (event, id) => {
    event.preventDefault()
    setDragOverId(id)
  }
  const onDrop = (event, targetId) => {
    event.preventDefault()
    if (!draggingId || draggingId === targetId) return
    const fromIndex = pdfItems.findIndex((i) => i.id === draggingId)
    const toIndex = pdfItems.findIndex((i) => i.id === targetId)
    if (fromIndex !== -1 && toIndex !== -1) moveItem(fromIndex, toIndex)
    setDraggingId(null)
    setDragOverId(null)
  }

  const openUnlockModal = () => {
    if (isUnlocked) return
    setUnlockPassword('')
    setUnlockError('')
    setIsUnlockModalOpen(true)
  }

  const closeUnlockModal = () => {
    if (isMerging) return
    setIsUnlockModalOpen(false)
  }

  const submitUnlock = (event) => {
    event.preventDefault()
    if (unlockPassword === 'OTW10M!') {
      setIsUnlocked(true)
      setIsUnlockModalOpen(false)
      setUnlockPassword('')
      setUnlockError('')
      setStatus('Unlimited mode aktif. Sekarang bisa upload PDF tanpa batas.')
      return
    }
    setUnlockError('Password salah.')
  }

  const buildMergedBytes = async () => {
    const mergedDoc = await PDFDocument.create()
    for (let i = 0; i < pdfItems.length; i++) {
      const { file } = pdfItems[i]
      setStatus(`Memuat PDF ${i + 1}/${pdfItems.length}: ${file.name}`)
      const arrayBuffer = await file.arrayBuffer()
      const srcDoc = await PDFDocument.load(arrayBuffer)
      const pages = await mergedDoc.copyPages(srcDoc, srcDoc.getPageIndices())
      pages.forEach((page) => mergedDoc.addPage(page))
    }
    return mergedDoc.save()
  }

  const mergePdfs = async () => {
    if (pdfItems.length < 2 || isMerging) return
    try {
      setIsMerging(true)
      resetOutput()
      setStatus('Memproses dan menggabungkan PDF...')
      const mergedBytes = await buildMergedBytes()
      const blob = new Blob([mergedBytes], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const name = `merged-pdf-${Date.now()}.pdf`
      setOutputUrl(url)
      setOutputName(name)
      setStatus(`Berhasil! ${pdfItems.length} PDF digabungkan. Klik tombol download di bawah.`)
    } catch (error) {
      const reason =
        error instanceof Error ? error.message : typeof error === 'string' ? error : 'Unknown error'
      setStatus(`Gagal merge PDF: ${reason}`)
      resetOutput()
    } finally {
      setIsMerging(false)
    }
  }

  const openPreview = async () => {
    if (pdfItems.length < 2 || isMerging) return
    try {
      setIsMerging(true)
      setStatus('Membuat preview...')
      const mergedBytes = await buildMergedBytes()
      const blob = new Blob([mergedBytes], { type: 'application/pdf' })
      // reuse outputUrl if already merged; otherwise create a temp one just for preview
      if (outputUrl) URL.revokeObjectURL(outputUrl)
      const url = URL.createObjectURL(blob)
      const name = `merged-pdf-${Date.now()}.pdf`
      setOutputUrl(url)
      setOutputName(name)
      setIsPreviewOpen(true)
      setStatus(`Preview siap. ${pdfItems.length} PDF digabungkan.`)
    } catch (error) {
      const reason =
        error instanceof Error ? error.message : typeof error === 'string' ? error : 'Unknown error'
      setStatus(`Gagal membuat preview: ${reason}`)
    } finally {
      setIsMerging(false)
    }
  }

  const closePreview = () => {
    setIsPreviewOpen(false)
  }

  return (
    <main className="page pdf-merge-page">
      <section className="hero pdf-merge-hero" style={{ '--theme-color': '#57B5E0' }}>
        <div className="hero-left">
          <div className="hero-icon" aria-hidden="true">
            <Files className="icon-md" />
          </div>
          <div>
            <h1>PDF Merger</h1>
            <p>Gabungkan beberapa file PDF langsung di browser, tanpa upload ke server.</p>
          </div>
        </div>
        <div className="shortcut-box">
          <span>FITUR</span>
          <code>Input .pdf</code>
          <code>Output .pdf</code>
        </div>
      </section>

      <section className="card pdf-merge-card">
        <div className="pdf-merge-grid">
          {/* Upload + Unlock row */}
          <div className="pdf-merge-top-row">
            <label
              className={`upload-box pdf-merge-upload-box${pdfItems.length >= maxFiles && !isUnlocked ? ' upload-box-disabled' : ''}`}
            >
              <input
                type="file"
                accept="application/pdf,.pdf"
                multiple
                disabled={pdfItems.length >= maxFiles && !isUnlocked}
                onChange={onSelectFile}
              />
              <span>
                <FilePlus2 className="icon-xs" /> Tambah PDF ({isUnlocked ? 'unlimited' : `maks ${maxFiles} file`})
              </span>
            </label>

            <button
              type="button"
              className={`outline icon-btn ${isUnlocked ? 'm4a-unlocked-btn' : ''}`}
              onClick={openUnlockModal}
              disabled={isUnlocked}
            >
              {isUnlocked ? 'Unlocked' : 'Unlock'}
            </button>
          </div>

          {/* File list / order panel */}
          <div className="pdf-merge-list-panel">
            <p className="pdf-merge-list-label">
              Urutan PDF{' '}
              <span className="pdf-merge-list-hint">— drag untuk ubah urutan</span>
            </p>

            {pdfItems.length === 0 ? (
              <div className="pdf-merge-empty">Belum ada PDF. Tambah minimal 2 file.</div>
            ) : (
              <ol className="pdf-merge-list">
                {pdfItems.map((item, index) => (
                  <li
                    key={item.id}
                    className={`pdf-merge-list-item${draggingId === item.id ? ' dragging' : ''}${dragOverId === item.id ? ' drag-over' : ''}`}
                    draggable
                    onDragStart={() => onDragStart(item.id)}
                    onDragEnd={onDragEnd}
                    onDragOver={(e) => onDragOver(e, item.id)}
                    onDrop={(e) => onDrop(e, item.id)}
                  >
                    <span className="pdf-merge-drag-handle" aria-hidden="true">
                      <GripVertical className="icon-xs" />
                    </span>
                    <span className="pdf-merge-item-no">{index + 1}</span>
                    <span className="pdf-merge-item-name" title={item.file.name}>
                      {item.file.name}
                    </span>
                    <span className="pdf-merge-item-size">
                      {Math.ceil(item.file.size / 1024)} KB
                    </span>
                    <button
                      type="button"
                      className="pdf-merge-remove-btn"
                      onClick={() => removeItem(item.id)}
                      aria-label={`Hapus ${item.file.name}`}
                    >
                      <Trash2 className="icon-xs" />
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </div>

          {/* Action buttons */}
          <div className="pdf-merge-actions">
            <button
              type="button"
              className="outline icon-btn"
              onClick={openPreview}
              disabled={pdfItems.length < 2 || isMerging}
            >
              <Eye className="icon-sm" /> Preview PDF
            </button>
            <button
              type="button"
              className="primary icon-btn"
              onClick={mergePdfs}
              disabled={pdfItems.length < 2 || isMerging}
            >
              <Files className="icon-sm" /> {isMerging ? 'Memproses...' : 'Merge & Download'}
            </button>
          </div>
        </div>

        {status ? <p className="m4a-status">{status}</p> : null}

        {outputUrl && !isPreviewOpen ? (
          <div className="pdf-merge-result">
            <a
              href={outputUrl}
              download={outputName}
              className="primary icon-btn pdf-merge-download-link"
            >
              <Download className="icon-sm" /> Download {outputName}
            </a>
          </div>
        ) : null}
      </section>

      {/* Preview Modal */}
      {isPreviewOpen && (
        <div className="preview-modal" role="dialog" aria-modal="true">
          <div className="preview-backdrop" onClick={closePreview}></div>
          <section className="preview-panel">
            <header className="preview-head">
              <h3>Preview PDF</h3>
              <div className="pdf-merge-preview-actions">
                {outputUrl && (
                  <a
                    href={outputUrl}
                    download={outputName}
                    className="outline icon-btn pdf-merge-download-link"
                  >
                    <Download className="icon-xs" /> Download
                  </a>
                )}
                <button type="button" className="ghost-btn icon-btn" onClick={closePreview}>
                  <X className="icon-xs" /> Tutup
                </button>
              </div>
            </header>
            <div className="preview-pdf-wrap">
              {outputUrl ? (
                <iframe title="PDF Preview" src={outputUrl} className="preview-pdf-frame" />
              ) : (
                <div className="preview-empty">Preview belum tersedia.</div>
              )}
            </div>
          </section>
        </div>
      )}

      {/* Unlock Modal */}
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

export default PdfMergeTool
