import { useMemo, useState } from 'react'
import { Braces, CheckCircle2, Copy, Minimize2, RefreshCcw, XCircle } from 'lucide-react'
import Editor from '@monaco-editor/react'
import '../App.css'

const SAMPLE_JSON = `{
  "project": "Weekly Report Generator",
  "owner": {
    "name": "Kejepangan Team",
    "active": true
  },
  "members": ["Ari", "Budi", "Citra"],
  "metrics": {
    "completed": 12,
    "pending": 3,
    "ratio": 0.8
  }
}`

const getTypeLabel = (value) => {
  if (Array.isArray(value)) return `Array(${value.length})`
  if (value === null) return 'null'
  return typeof value
}

const getObjectEntries = (value) => {
  if (Array.isArray(value)) {
    return value.map((item, index) => [index, item])
  }

  return Object.entries(value)
}

const getLineAndColumn = (jsonText, position) => {
  const safePosition = Math.max(0, Math.min(position, jsonText.length))
  const before = jsonText.slice(0, safePosition)
  const lines = before.split('\n')

  return {
    line: lines.length,
    column: lines.at(-1).length + 1,
  }
}

const parseJsonText = (jsonText) => {
  try {
    return { data: JSON.parse(jsonText), error: '' }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'JSON tidak valid.'
    const positionMatch = message.match(/position\s+(\d+)/i)

    if (positionMatch) {
      const position = Number(positionMatch[1])
      const { line, column } = getLineAndColumn(jsonText, position)
      return {
        data: null,
        error: `${message} (line ${line}, column ${column})`,
      }
    }

    return { data: null, error: message }
  }
}

function JsonTreeNode({ nodeKey, value, depth = 0 }) {
  const isBranch = typeof value === 'object' && value !== null
  const [isOpen, setIsOpen] = useState(depth < 1)

  if (!isBranch) {
    return (
      <li className="json-tree-item" style={{ '--tree-depth': depth }}>
        <span className="json-tree-key">{String(nodeKey)}:</span>
        <code className="json-tree-leaf">{JSON.stringify(value)}</code>
      </li>
    )
  }

  const entries = getObjectEntries(value)

  return (
    <li className="json-tree-item" style={{ '--tree-depth': depth }}>
      <button type="button" className="json-tree-toggle" onClick={() => setIsOpen((prev) => !prev)}>
        <span className="json-tree-caret" aria-hidden="true">
          {isOpen ? '-' : '+'}
        </span>
        <span className="json-tree-key">{String(nodeKey)}</span>
        <small>{getTypeLabel(value)}</small>
      </button>

      {isOpen && entries.length > 0 ? (
        <ul className="json-tree-list">
          {entries.map(([childKey, childValue]) => (
            <JsonTreeNode key={`${String(nodeKey)}-${String(childKey)}`} nodeKey={childKey} value={childValue} depth={depth + 1} />
          ))}
        </ul>
      ) : null}

      {isOpen && entries.length === 0 ? <p className="json-tree-empty">(empty)</p> : null}
    </li>
  )
}

function JsonFormatterTool() {
  const [inputText, setInputText] = useState(SAMPLE_JSON)
  const [outputText, setOutputText] = useState(SAMPLE_JSON)
  const [status, setStatus] = useState({ type: 'idle', message: 'Siap memproses JSON.' })
  const [activeTab, setActiveTab] = useState('input')

  const treeData = useMemo(() => {
    const source = outputText.trim() ? outputText : inputText
    const { data } = parseJsonText(source)
    return data
  }, [inputText, outputText])

  const runAction = (formatter, successMessage) => {
    const source = inputText.trim()

    if (!source) {
      setStatus({ type: 'error', message: 'Input JSON masih kosong.' })
      return
    }

    const { data, error } = parseJsonText(source)

    if (error) {
      setStatus({ type: 'error', message: error })
      return
    }

    const nextOutput = formatter(data)
    setOutputText(nextOutput)
    setStatus({ type: 'success', message: successMessage })
    setActiveTab('output')
  }

  const handleValidate = () => {
    const source = inputText.trim()

    if (!source) {
      setStatus({ type: 'error', message: 'Input JSON masih kosong.' })
      return
    }

    const { error } = parseJsonText(source)

    if (error) {
      setStatus({ type: 'error', message: error })
      return
    }

    setStatus({ type: 'success', message: 'JSON valid.' })
  }

  const handleCopyOutput = async () => {
    if (!outputText.trim()) {
      setStatus({ type: 'error', message: 'Output JSON masih kosong.' })
      return
    }

    try {
      await navigator.clipboard.writeText(outputText)
      setStatus({ type: 'success', message: 'Output JSON berhasil disalin.' })
    } catch {
      setStatus({ type: 'error', message: 'Gagal menyalin output JSON.' })
    }
  }

  const resetSample = () => {
    setInputText(SAMPLE_JSON)
    setOutputText(SAMPLE_JSON)
    setStatus({ type: 'idle', message: 'Sample JSON dimuat ulang.' })
  }

  const clearAll = () => {
    setInputText('')
    setOutputText('')
    setStatus({ type: 'idle', message: 'Input dan output dikosongkan.' })
  }

  return (
    <main className="page json-tool-page">
      <section className="hero json-tool-hero" style={{ '--theme-color': '#57B5E0' }}>
        <div className="hero-left">
          <div className="hero-icon" aria-hidden="true">
            <Braces className="icon-md" />
          </div>
          <div>
            <h1>JSON Formatter & Validator</h1>
            <p>Format, minify, validate, dan lihat struktur JSON dalam tree view.</p>
          </div>
        </div>

        <div className="shortcut-box">
          <span>STATUS</span>
          <code>{status.type === 'error' ? 'Invalid JSON' : status.type === 'success' ? 'Valid JSON' : 'Ready'}</code>
        </div>
      </section>

      <section className="card json-tool-card">
        <div className="json-tool-actions">
          <button type="button" className="outline icon-btn" onClick={() => runAction((data) => JSON.stringify(data, null, 2), 'JSON berhasil diformat.') }>
            <CheckCircle2 className="icon-sm" /> Format
          </button>
          <button type="button" className="outline icon-btn" onClick={() => runAction((data) => JSON.stringify(data), 'JSON berhasil diminify.') }>
            <Minimize2 className="icon-sm" /> Minify
          </button>
          <button type="button" className="outline icon-btn" onClick={handleValidate}>
            <CheckCircle2 className="icon-sm" /> Validate
          </button>
          <button type="button" className="outline icon-btn" onClick={handleCopyOutput}>
            <Copy className="icon-sm" /> Copy Output
          </button>
          <button type="button" className="outline icon-btn" onClick={clearAll}>
            Clear
          </button>
          <button type="button" className="outline icon-btn" onClick={resetSample}>
            <RefreshCcw className="icon-sm" /> Reset Sample
          </button>
        </div>

        <p className={`json-tool-status ${status.type === 'error' ? 'error' : status.type === 'success' ? 'success' : ''}`}>
          {status.type === 'error' ? <XCircle className="icon-sm" /> : <CheckCircle2 className="icon-sm" />}
          <span>{status.message}</span>
        </p>

        <div className="md-tabs json-tool-tabs-mobile">
          <button
            type="button"
            className={`md-tab ${activeTab === 'input' ? 'active' : ''}`}
            onClick={() => setActiveTab('input')}
          >
            Input
          </button>
          <button
            type="button"
            className={`md-tab ${activeTab === 'output' ? 'active' : ''}`}
            onClick={() => setActiveTab('output')}
          >
            Output
          </button>
          <button
            type="button"
            className={`md-tab ${activeTab === 'tree' ? 'active' : ''}`}
            onClick={() => setActiveTab('tree')}
          >
            Tree
          </button>
        </div>

        <div className="json-tool-grid">
          <article className={`json-tool-pane ${activeTab === 'input' ? 'active' : ''}`}>
            <h2>Input JSON</h2>
            <Editor
              className="json-tool-monaco"
              defaultLanguage="json"
              language="json"
              value={inputText}
              onChange={(value) => setInputText(value ?? '')}
              theme="vs-dark"
              height="100%"
              options={{
                fontSize: 14,
                minimap: { enabled: false },
                lineNumbers: 'on',
                renderLineHighlight: 'all',
                roundedSelection: false,
                scrollBeyondLastLine: false,
                wordWrap: 'on',
                tabSize: 2,
                insertSpaces: true,
                automaticLayout: true,
                formatOnPaste: true,
                formatOnType: true,
                guides: {
                  indentation: true,
                  bracketPairs: true,
                },
                bracketPairColorization: {
                  enabled: true,
                },
              }}
              loading={
                <textarea
                  className="json-tool-textarea"
                  value={inputText}
                  onChange={(event) => setInputText(event.target.value)}
                  spellCheck={false}
                  placeholder='Contoh: {"name":"Kejepangan"}'
                />
              }
            />
          </article>

          <article className={`json-tool-pane ${activeTab === 'output' ? 'active' : ''}`}>
            <h2>Output JSON</h2>
            <Editor
              className="json-tool-monaco"
              defaultLanguage="json"
              language="json"
              value={outputText}
              onChange={(value) => setOutputText(value ?? '')}
              theme="vs-dark"
              height="100%"
              options={{
                fontSize: 14,
                minimap: { enabled: false },
                lineNumbers: 'on',
                renderLineHighlight: 'all',
                roundedSelection: false,
                scrollBeyondLastLine: false,
                wordWrap: 'on',
                tabSize: 2,
                insertSpaces: true,
                automaticLayout: true,
                guides: {
                  indentation: true,
                  bracketPairs: true,
                },
                bracketPairColorization: {
                  enabled: true,
                },
              }}
              loading={
                <textarea
                  className="json-tool-textarea"
                  value={outputText}
                  onChange={(event) => setOutputText(event.target.value)}
                  spellCheck={false}
                />
              }
            />
          </article>

          <article className={`json-tool-pane json-tool-tree-pane ${activeTab === 'tree' ? 'active' : ''}`}>
            <h2>Tree View</h2>
            <div className="json-tree-wrap">
              {treeData !== null ? (
                <ul className="json-tree-list">
                  <JsonTreeNode nodeKey="root" value={treeData} />
                </ul>
              ) : (
                <p className="json-tree-invalid">Tree view hanya tersedia saat JSON valid.</p>
              )}
            </div>
          </article>
        </div>
      </section>
    </main>
  )
}

export default JsonFormatterTool
