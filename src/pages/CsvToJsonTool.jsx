import { useState } from 'react'
import { CheckCircle2, Copy, Download, FileJson2, RefreshCcw, Upload, XCircle } from 'lucide-react'
import * as XLSX from 'xlsx'
import '../App.css'

const SAMPLE_CSV = `name,team,hours,status
Ari,Frontend,12,done
Budi,Backend,8,in_progress
Citra,QA,10,done`

const parseCsvToJson = (csvText) => {
  const workbook = XLSX.read(csvText, { type: 'string' })
  const firstSheetName = workbook.SheetNames[0]

  if (!firstSheetName) {
    throw new Error('CSV tidak memiliki data yang bisa dibaca.')
  }

  const worksheet = workbook.Sheets[firstSheetName]
  return XLSX.utils.sheet_to_json(worksheet, { defval: '' })
}

function CsvToJsonTool() {
  const [csvInput, setCsvInput] = useState(SAMPLE_CSV)
  const [jsonOutput, setJsonOutput] = useState('')
  const [status, setStatus] = useState({ type: 'idle', message: 'Siap convert CSV ke JSON.' })
  const [activeTab, setActiveTab] = useState('input')

  const onUploadCsv = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const text = await file.text()
      setCsvInput(text)
      setStatus({ type: 'success', message: `File dipilih: ${file.name}` })
      setActiveTab('input')
    } catch {
      setStatus({ type: 'error', message: 'Gagal membaca file CSV.' })
    } finally {
      event.target.value = ''
    }
  }

  const convertToJson = () => {
    if (!csvInput.trim()) {
      setStatus({ type: 'error', message: 'Input CSV masih kosong.' })
      return
    }

    try {
      const parsedRows = parseCsvToJson(csvInput)
      const formatted = JSON.stringify(parsedRows, null, 2)
      setJsonOutput(formatted)
      setStatus({
        type: 'success',
        message: `Konversi selesai. ${parsedRows.length} baris data berhasil diproses.`,
      })
      setActiveTab('output')
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Unknown error'
      setStatus({ type: 'error', message: `Gagal convert CSV: ${reason}` })
    }
  }

  const copyOutput = async () => {
    if (!jsonOutput.trim()) {
      setStatus({ type: 'error', message: 'Output JSON masih kosong.' })
      return
    }

    try {
      await navigator.clipboard.writeText(jsonOutput)
      setStatus({ type: 'success', message: 'Output JSON berhasil disalin.' })
    } catch {
      setStatus({ type: 'error', message: 'Gagal menyalin output JSON.' })
    }
  }

  const downloadOutput = () => {
    if (!jsonOutput.trim()) {
      setStatus({ type: 'error', message: 'Output JSON masih kosong.' })
      return
    }

    const blob = new Blob([jsonOutput], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'converted.json'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const clearAll = () => {
    setCsvInput('')
    setJsonOutput('')
    setStatus({ type: 'idle', message: 'Input dan output dikosongkan.' })
    setActiveTab('input')
  }

  const resetSample = () => {
    setCsvInput(SAMPLE_CSV)
    setJsonOutput('')
    setStatus({ type: 'idle', message: 'Sample CSV dimuat ulang.' })
    setActiveTab('input')
  }

  return (
    <main className="page csv-json-page">
      <section className="hero" style={{ '--theme-color': '#57B5E0' }}>
        <div className="hero-left">
          <div className="hero-icon" aria-hidden="true">
            <FileJson2 className="icon-md" />
          </div>
          <div>
            <h1>CSV to JSON</h1>
            <p>Konversi data CSV menjadi JSON langsung di browser.</p>
          </div>
        </div>

        <div className="shortcut-box">
          <span>FITUR</span>
          <code>Input CSV/Text</code>
          <code>Output JSON</code>
        </div>
      </section>

      <section className="card csv-json-card">
        <div className="csv-json-actions">
          <label className="outline icon-btn">
            <input
              type="file"
              accept=".csv,.txt,text/csv,text/plain"
              onChange={onUploadCsv}
              hidden
            />
            <Upload className="icon-sm" /> Upload CSV
          </label>
          <button type="button" className="primary icon-btn" onClick={convertToJson}>
            <FileJson2 className="icon-sm" /> Convert
          </button>
          <button type="button" className="outline icon-btn" onClick={copyOutput}>
            <Copy className="icon-sm" /> Copy JSON
          </button>
          <button type="button" className="outline icon-btn" onClick={downloadOutput}>
            <Download className="icon-sm" /> Download JSON
          </button>
          <button type="button" className="outline icon-btn" onClick={clearAll}>
            Clear
          </button>
          <button type="button" className="outline icon-btn" onClick={resetSample}>
            <RefreshCcw className="icon-sm" /> Reset Sample
          </button>
        </div>

        <p className={`csv-json-status ${status.type === 'error' ? 'error' : status.type === 'success' ? 'success' : ''}`}>
          {status.type === 'error' ? <XCircle className="icon-sm" /> : <CheckCircle2 className="icon-sm" />}
          <span>{status.message}</span>
        </p>

        <div className="md-tabs csv-json-tabs-mobile">
          <button
            type="button"
            className={`md-tab ${activeTab === 'input' ? 'active' : ''}`}
            onClick={() => setActiveTab('input')}
          >
            CSV Input
          </button>
          <button
            type="button"
            className={`md-tab ${activeTab === 'output' ? 'active' : ''}`}
            onClick={() => setActiveTab('output')}
          >
            JSON Output
          </button>
        </div>

        <div className="csv-json-grid">
          <article className={`csv-json-pane ${activeTab === 'input' ? 'active' : ''}`}>
            <h2>CSV Input</h2>
            <textarea
              className="csv-json-textarea"
              value={csvInput}
              onChange={(event) => setCsvInput(event.target.value)}
              spellCheck={false}
              placeholder={'name,team,hours\nAri,Frontend,12'}
            />
          </article>

          <article className={`csv-json-pane ${activeTab === 'output' ? 'active' : ''}`}>
            <h2>JSON Output</h2>
            <textarea
              className="csv-json-textarea"
              value={jsonOutput}
              onChange={(event) => setJsonOutput(event.target.value)}
              spellCheck={false}
              placeholder="Hasil konversi JSON akan muncul di sini..."
            />
          </article>
        </div>
      </section>
    </main>
  )
}

export default CsvToJsonTool
