import { useMemo, useRef, useState } from 'react'
import { ArrowLeftRight, Download, FileDiff, RefreshCcw, Upload } from 'lucide-react'
import { DiffEditor } from '@monaco-editor/react'
import '../App.css'

const DEFAULT_OLD_TEXT = `Halo tim,

Ini versi lama dokumen.
- Fitur A sudah selesai
- Fitur B masih proses
`

const DEFAULT_NEW_TEXT = `Halo tim,

Ini versi baru dokumen.
- Fitur A sudah selesai
- Fitur B sudah selesai
- Fitur C baru ditambahkan
`

const countLines = (value = '') => (value.length === 0 ? 0 : value.split('\n').length)

function TextDiffTool() {
  const [leftText, setLeftText] = useState(DEFAULT_OLD_TEXT)
  const [rightText, setRightText] = useState(DEFAULT_NEW_TEXT)
  const [activeTab, setActiveTab] = useState('diff')
  const leftUploadRef = useRef(null)
  const rightUploadRef = useRef(null)

  const isSame = useMemo(() => leftText === rightText, [leftText, rightText])
  const leftLineCount = useMemo(() => countLines(leftText), [leftText])
  const rightLineCount = useMemo(() => countLines(rightText), [rightText])

  const resetSample = () => {
    setLeftText(DEFAULT_OLD_TEXT)
    setRightText(DEFAULT_NEW_TEXT)
  }

  const clearAll = () => {
    setLeftText('')
    setRightText('')
  }

  const swapTexts = () => {
    setLeftText(rightText)
    setRightText(leftText)
  }

  const saveRightAsText = () => {
    const blob = new Blob([rightText], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'text-diff-result.txt'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const readUploadedText = async (event, setValue) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const content = await file.text()
      setValue(content)
    } catch {
      alert('Gagal membaca file teks.')
    } finally {
      event.target.value = ''
    }
  }

  return (
    <main className="page text-diff-page">
      <section className="hero text-diff-hero" style={{ '--theme-color': '#57B5E0' }}>
        <div className="hero-left">
          <div className="hero-icon" aria-hidden="true">
            <FileDiff className="icon-md" />
          </div>
          <div>
            <h1>Text Diff Checker</h1>
            <p>Bandingkan dua teks/file dengan highlight perubahan real-time.</p>
          </div>
        </div>
        <div className="shortcut-box">
          <span>STATUS</span>
          <code>{isSame ? 'No Differences' : 'Differences Found'}</code>
          <code>{leftLineCount} {'->'} {rightLineCount} lines</code>
        </div>
      </section>

      <section className="card text-diff-card">
        <div className="text-diff-actions">
          <input
            ref={leftUploadRef}
            type="file"
            accept=".txt,.md,.json,.js,.jsx,.ts,.tsx,.css,.scss,.html,.xml,.yml,.yaml,.csv,text/plain"
            onChange={(event) => readUploadedText(event, setLeftText)}
            hidden
          />
          <input
            ref={rightUploadRef}
            type="file"
            accept=".txt,.md,.json,.js,.jsx,.ts,.tsx,.css,.scss,.html,.xml,.yml,.yaml,.csv,text/plain"
            onChange={(event) => readUploadedText(event, setRightText)}
            hidden
          />
          <button type="button" className="outline icon-btn" onClick={() => leftUploadRef.current?.click()}>
            <Upload className="icon-sm" /> Upload Left
          </button>
          <button type="button" className="outline icon-btn" onClick={() => rightUploadRef.current?.click()}>
            <Upload className="icon-sm" /> Upload Right
          </button>
          <button type="button" className="outline icon-btn" onClick={swapTexts}>
            <ArrowLeftRight className="icon-sm" /> Swap
          </button>
          <button type="button" className="outline icon-btn" onClick={saveRightAsText}>
            <Download className="icon-sm" /> Save Right
          </button>
          <button type="button" className="outline icon-btn" onClick={clearAll}>
            Clear
          </button>
          <button type="button" className="outline icon-btn" onClick={resetSample}>
            <RefreshCcw className="icon-sm" /> Reset Sample
          </button>
        </div>

        <div className="md-tabs text-diff-tabs-mobile">
          <button
            type="button"
            className={`md-tab ${activeTab === 'diff' ? 'active' : ''}`}
            onClick={() => setActiveTab('diff')}
          >
            Diff View
          </button>
          <button
            type="button"
            className={`md-tab ${activeTab === 'left' ? 'active' : ''}`}
            onClick={() => setActiveTab('left')}
          >
            Left
          </button>
          <button
            type="button"
            className={`md-tab ${activeTab === 'right' ? 'active' : ''}`}
            onClick={() => setActiveTab('right')}
          >
            Right
          </button>
        </div>

        <div className="text-diff-body">
          <article className={`text-diff-pane text-diff-diff-pane ${activeTab === 'diff' ? 'active' : ''}`}>
            <h2>Diff Result</h2>
            <DiffEditor
              className="text-diff-monaco"
              original={leftText}
              modified={rightText}
              language="plaintext"
              theme="vs-dark"
              height="100%"
              options={{
                readOnly: false,
                renderSideBySide: true,
                automaticLayout: true,
                minimap: { enabled: false },
                fontSize: 14,
                lineNumbers: 'on',
                wordWrap: 'on',
                scrollBeyondLastLine: false,
                renderOverviewRuler: true,
                diffWordWrap: 'on',
                originalEditable: true,
              }}
              onMount={(editor) => {
                const model = editor.getModel()
                if (!model) return
                model.original.setValue(leftText)
                model.modified.setValue(rightText)
                model.original.onDidChangeContent(() => setLeftText(model.original.getValue()))
                model.modified.onDidChangeContent(() => setRightText(model.modified.getValue()))
              }}
            />
          </article>

          <article className={`text-diff-pane ${activeTab === 'left' ? 'active' : ''}`}>
            <h2>Left Text</h2>
            <textarea
              className="text-diff-textarea"
              value={leftText}
              onChange={(event) => setLeftText(event.target.value)}
              spellCheck={false}
            />
          </article>

          <article className={`text-diff-pane ${activeTab === 'right' ? 'active' : ''}`}>
            <h2>Right Text</h2>
            <textarea
              className="text-diff-textarea"
              value={rightText}
              onChange={(event) => setRightText(event.target.value)}
              spellCheck={false}
            />
          </article>
        </div>
      </section>
    </main>
  )
}

export default TextDiffTool
