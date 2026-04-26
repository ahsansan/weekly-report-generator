import { useEffect, useState } from 'react'
import { Download, FileSpreadsheet, RefreshCcw, Upload } from 'lucide-react'
import * as XLSX from 'xlsx'
import '../App.css'

function CsvToXlsxTool() {
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

  const convertToXlsx = async () => {
    if (!sourceFile || isProcessing) return

    try {
      setIsProcessing(true)
      setStatus('Membaca file CSV...')
      clearOutput()

      const csvText = await sourceFile.text()
      const parsedWorkbook = XLSX.read(csvText, { type: 'string' })
      const firstSheetName = parsedWorkbook.SheetNames[0]
      if (!firstSheetName) throw new Error('Isi CSV tidak terbaca.')
      const worksheet = parsedWorkbook.Sheets[firstSheetName]

      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1')

      const xlsxBuffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' })
      const blob = new Blob([xlsxBuffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      const nextUrl = URL.createObjectURL(blob)
      const nextName = sourceFile.name.replace(/\.(csv|txt)$/i, '') || 'converted'

      setOutputUrl(nextUrl)
      setOutputName(`${nextName}.xlsx`)
      setStatus('Konversi selesai. File XLSX siap di-download.')
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Unknown error'
      setStatus(`Gagal convert CSV ke XLSX: ${reason}`)
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <main className="page">
      <section className="hero" style={{ '--theme-color': '#57B5E0' }}>
        <div className="hero-left">
          <div className="hero-icon" aria-hidden="true">
            <FileSpreadsheet className="icon-md" />
          </div>
          <div>
            <h1>CSV to XLSX</h1>
            <p>Konversi file CSV ke Excel (.xlsx) langsung di browser.</p>
          </div>
        </div>
        <div className="shortcut-box">
          <span>FITUR</span>
          <code>Input .csv/.txt</code>
          <code>Output .xlsx</code>
        </div>
      </section>

      <section className="card m4a-card">
        <div className="m4a-grid">
          <label className="upload-box m4a-upload-box">
            <input type="file" accept=".csv,.txt,text/csv,text/plain" onChange={onSelectFile} />
            <span>
              <Upload className="icon-xs" /> Pilih file CSV
            </span>
          </label>

          <div className="m4a-meta">
            <p className="m4a-meta-title">File terpilih</p>
            <p>{sourceFile ? `${sourceFile.name} (${Math.ceil(sourceFile.size / 1024)} KB)` : 'Belum ada file'}</p>
          </div>

          <div className="md-toolbar-actions">
            <button type="button" className="primary icon-btn" onClick={convertToXlsx} disabled={!sourceFile || isProcessing}>
              <FileSpreadsheet className="icon-sm" /> {isProcessing ? 'Converting...' : 'Convert ke XLSX'}
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

export default CsvToXlsxTool
