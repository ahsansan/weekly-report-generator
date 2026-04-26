import { useEffect, useState } from 'react'
import { Download, FileText, RefreshCcw, Upload } from 'lucide-react'
import * as XLSX from 'xlsx'
import '../App.css'

function XlsxToCsvTool() {
  const [sourceFile, setSourceFile] = useState(null)
  const [outputUrl, setOutputUrl] = useState('')
  const [outputName, setOutputName] = useState('')
  const [status, setStatus] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)

  useEffect(() => {
    return () => {
      if (outputUrl) URL.revokeObjectURL(outputUrl)
    }
  }, [outputUrl])

  const clearOutput = () => {
    if (outputUrl) URL.revokeObjectURL(outputUrl)
    setOutputUrl('')
    setOutputName('')
  }

  const onSelectFile = (event) => {
    const file = event.target.files?.[0] ?? null
    setSourceFile(file)
    clearOutput()
    setStatus(file ? `File dipilih: ${file.name}` : '')
    event.target.value = ''
  }

  const resetAll = () => {
    setSourceFile(null)
    clearOutput()
    setStatus('')
  }

  const convertToCsv = async () => {
    if (!sourceFile || isProcessing) return

    try {
      setIsProcessing(true)
      setStatus('Membaca file XLSX...')
      clearOutput()

      const buffer = await sourceFile.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: 'array' })
      const firstSheetName = workbook.SheetNames[0]
      if (!firstSheetName) throw new Error('Sheet tidak ditemukan di file XLSX.')

      const worksheet = workbook.Sheets[firstSheetName]
      const csvText = XLSX.utils.sheet_to_csv(worksheet)
      const blob = new Blob([`\uFEFF${csvText}`], { type: 'text/csv;charset=utf-8' })
      const nextUrl = URL.createObjectURL(blob)
      const nextName = sourceFile.name.replace(/\.(xlsx|xls)$/i, '') || 'converted'

      setOutputUrl(nextUrl)
      setOutputName(`${nextName}.csv`)
      setStatus(`Konversi selesai. Sheet "${firstSheetName}" diexport ke CSV.`)
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Unknown error'
      setStatus(`Gagal convert XLSX ke CSV: ${reason}`)
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <main className="page">
      <section className="hero" style={{ '--theme-color': '#57B5E0' }}>
        <div className="hero-left">
          <div className="hero-icon" aria-hidden="true">
            <FileText className="icon-md" />
          </div>
          <div>
            <h1>XLSX to CSV</h1>
            <p>Konversi file Excel (.xlsx/.xls) ke CSV langsung di browser.</p>
          </div>
        </div>
        <div className="shortcut-box">
          <span>FITUR</span>
          <code>Input .xlsx/.xls</code>
          <code>Output .csv</code>
        </div>
      </section>

      <section className="card m4a-card">
        <div className="m4a-grid">
          <label className="upload-box m4a-upload-box">
            <input
              type="file"
              accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              onChange={onSelectFile}
            />
            <span>
              <Upload className="icon-xs" /> Pilih file XLSX/XLS
            </span>
          </label>

          <div className="m4a-meta">
            <p className="m4a-meta-title">File terpilih</p>
            <p>{sourceFile ? `${sourceFile.name} (${Math.ceil(sourceFile.size / 1024)} KB)` : 'Belum ada file'}</p>
          </div>

          <div className="md-toolbar-actions">
            <button type="button" className="primary icon-btn" onClick={convertToCsv} disabled={!sourceFile || isProcessing}>
              <FileText className="icon-sm" /> {isProcessing ? 'Converting...' : 'Convert ke CSV'}
            </button>
            <button type="button" className="outline icon-btn" onClick={resetAll} disabled={isProcessing}>
              <RefreshCcw className="icon-sm" /> Reset
            </button>
          </div>
        </div>

        {status ? <p className="m4a-status">{status}</p> : null}

        {outputUrl ? (
          <div className="m4a-result">
            <a href={outputUrl} download={outputName} className="primary icon-btn m4a-download-all">
              <Download className="icon-sm" /> Download {outputName}
            </a>
          </div>
        ) : null}
      </section>
    </main>
  )
}

export default XlsxToCsvTool
