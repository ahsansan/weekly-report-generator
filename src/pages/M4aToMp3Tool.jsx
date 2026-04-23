import { useEffect, useState } from 'react'
import { AudioLines, Download, FileText, Upload } from 'lucide-react'
import JSZip from 'jszip'
import { getFfmpeg } from '../lib/ffmpeg'
import '../App.css'

function M4aToMp3Tool() {
  const [sourceFiles, setSourceFiles] = useState([])
  const [isConverting, setIsConverting] = useState(false)
  const [status, setStatus] = useState('')
  const [outputs, setOutputs] = useState([])
  const [isUnlocked, setIsUnlocked] = useState(false)
  const [isUnlockModalOpen, setIsUnlockModalOpen] = useState(false)
  const [unlockPassword, setUnlockPassword] = useState('')
  const [unlockError, setUnlockError] = useState('')
  const [isZipping, setIsZipping] = useState(false)

  useEffect(() => {
    return () => {
      outputs.forEach((output) => URL.revokeObjectURL(output.url))
    }
  }, [outputs])

  const resetOutput = () => {
    outputs.forEach((output) => URL.revokeObjectURL(output.url))
    setOutputs([])
  }

  const onSelectFile = (event) => {
    const selectedFiles = Array.from(event.target.files ?? [])
    const limitedFiles = !isUnlocked ? selectedFiles.slice(0, 2) : selectedFiles
    setSourceFiles(limitedFiles)
    resetOutput()
    if (!isUnlocked && selectedFiles.length > 2) {
      setStatus('Mode default maksimal 2 file. Klik Unlock untuk buka tanpa batas.')
    } else {
      setStatus('')
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
      setStatus('Unlimited mode aktif. Sekarang bisa upload file tanpa batas.')
      return
    }
    setUnlockError('Password salah.')
  }

  const downloadAll = async () => {
    if (outputs.length === 0 || isZipping) return

    try {
      setIsZipping(true)
      setStatus('Menyiapkan ZIP untuk semua file MP3...')
      const zip = new JSZip()

      for (const output of outputs) {
        const response = await fetch(output.url)
        const blob = await response.blob()
        zip.file(output.name, blob)
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' })
      const zipUrl = URL.createObjectURL(zipBlob)
      const anchor = document.createElement('a')
      anchor.href = zipUrl
      anchor.download = `converted-mp3-${Date.now()}.zip`
      document.body.appendChild(anchor)
      anchor.click()
      document.body.removeChild(anchor)
      URL.revokeObjectURL(zipUrl)
      setStatus(`ZIP berhasil dibuat. ${outputs.length} file diunduh.`)
    } catch (error) {
      const reason =
        error instanceof Error ? error.message : typeof error === 'string' ? error : 'Unknown zip error'
      setStatus(`Gagal membuat ZIP: ${reason}`)
    } finally {
      setIsZipping(false)
    }
  }

  const convertToMp3 = async () => {
    if (sourceFiles.length === 0 || isConverting) return

    try {
      setIsConverting(true)
      setStatus('Memuat engine converter...')
      resetOutput()

      const ffmpeg = await getFfmpeg()
      const { fetchFile } = await import('@ffmpeg/util')
      const nextOutputs = []

      for (let index = 0; index < sourceFiles.length; index += 1) {
        const sourceFile = sourceFiles[index]
        const fileLabel = `${index + 1}/${sourceFiles.length}`
        setStatus(`Mengonversi ${fileLabel}: ${sourceFile.name}`)

        const sourceBuffer = await fetchFile(sourceFile)
        const inputName = `input-${Date.now()}-${index}.m4a`
        const outputFileName = sourceFile.name.replace(/\.m4a$/i, '') || `audio-${index + 1}`
        const outputFile = `${outputFileName}.mp3`

        await ffmpeg.writeFile(inputName, sourceBuffer)
        await ffmpeg.exec(['-i', inputName, '-vn', '-ar', '44100', '-ac', '2', '-b:a', '192k', outputFile])

        const outputData = await ffmpeg.readFile(outputFile)
        const outputBlob = new Blob([outputData], { type: 'audio/mpeg' })
        const outputUrl = URL.createObjectURL(outputBlob)

        nextOutputs.push({
          id: `${outputFile}-${index}`,
          name: outputFile,
          url: outputUrl,
        })

        await Promise.allSettled([ffmpeg.deleteFile(inputName), ffmpeg.deleteFile(outputFile)])
      }

      setOutputs(nextOutputs)
      setStatus(`Konversi selesai. ${nextOutputs.length} file MP3 siap di-download.`)
    } catch (error) {
      const reason =
        error instanceof Error ? error.message : typeof error === 'string' ? error : 'Unknown conversion error'
      setStatus(`Gagal convert M4A ke MP3: ${reason}`)
      resetOutput()
    } finally {
      setIsConverting(false)
    }
  }

  return (
    <main className="page m4a-page">
      <section className="hero m4a-hero" style={{ '--theme-color': '#57B5E0' }}>
        <div className="hero-left">
          <div className="hero-icon" aria-hidden="true">
            <AudioLines className="icon-md" />
          </div>
          <div>
            <h1>M4A to MP3 Converter</h1>
            <p>Konversi file audio langsung di browser tanpa upload ke server.</p>
          </div>
        </div>
        <div className="shortcut-box">
          <span>FITUR</span>
          <code>Input .m4a</code>
          <code>Output .mp3</code>
        </div>
      </section>

      <section className="card m4a-card">
        <div className="m4a-grid">
          <label className="upload-box m4a-upload-box">
            <input type="file" accept=".m4a,audio/mp4,audio/x-m4a" multiple onChange={onSelectFile} />
            <span>
              <Upload className="icon-xs" /> Pilih file M4A ({isUnlocked ? 'unlimited' : 'maks 2 file'})
            </span>
          </label>

          <div className="m4a-actions-row">
            <button
              type="button"
              className={`outline icon-btn ${isUnlocked ? 'm4a-unlocked-btn' : ''}`}
              onClick={openUnlockModal}
              disabled={isUnlocked}
            >
              {isUnlocked ? 'Unlocked' : 'Unlock'}
            </button>
          </div>

          <div className="m4a-meta">
            <p className="m4a-meta-title">File terpilih</p>
            {sourceFiles.length > 0 ? (
              <>
                <p>{sourceFiles.length} file dipilih</p>
                <ul className="m4a-file-list">
                  {sourceFiles.map((file) => (
                    <li key={`${file.name}-${file.lastModified}`}>
                      {file.name} ({Math.ceil(file.size / 1024)} KB)
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p>Belum ada file</p>
            )}
          </div>

          <button
            type="button"
            className="primary icon-btn"
            onClick={convertToMp3}
            disabled={sourceFiles.length === 0 || isConverting}
          >
            <FileText className="icon-sm" /> {isConverting ? 'Converting...' : 'Convert ke MP3'}
          </button>
        </div>

        {status ? <p className="m4a-status">{status}</p> : null}

        {outputs.length > 0 ? (
          <div className="m4a-result">
            <button type="button" className="primary icon-btn m4a-download-all" onClick={downloadAll} disabled={isZipping}>
              <Download className="icon-sm" /> {isZipping ? 'Membuat ZIP...' : 'Download All (.zip)'}
            </button>
            {outputs.map((output) => (
              <article key={output.id} className="m4a-result-item">
                <audio controls src={output.url} className="m4a-player">
                  Browser kamu belum support audio player.
                </audio>
                <a href={output.url} download={output.name} className="outline icon-btn m4a-download-link">
                  <Download className="icon-sm" /> Download {output.name}
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


export default M4aToMp3Tool
