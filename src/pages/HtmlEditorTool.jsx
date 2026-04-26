import { useMemo, useState } from 'react'
import { Code2, Download, Eye, RefreshCcw } from 'lucide-react'
import Editor from '@monaco-editor/react'
import '../App.css'

const DEFAULT_HTML = `<!doctype html>
<html lang="id">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Preview HTML</title>
    <style>
      body {
        font-family: system-ui, sans-serif;
        margin: 24px;
        background: #f8fbff;
        color: #20324d;
      }

      .card {
        max-width: 560px;
        padding: 18px;
        border-radius: 14px;
        border: 1px solid #dbe6f5;
        background: #ffffff;
      }

      h1 {
        margin: 0 0 10px;
      }
    </style>
  </head>
  <body>
    <article class="card">
      <h1>Hello HTML Editor</h1>
      <p>Silakan edit kode di panel kiri, hasilnya langsung muncul di preview kanan.</p>
    </article>
  </body>
</html>
`

function HtmlEditorTool() {
  const [htmlCode, setHtmlCode] = useState(DEFAULT_HTML)
  const [activeTab, setActiveTab] = useState('editor')
  const previewDoc = useMemo(() => htmlCode, [htmlCode])

  const resetDefault = () => {
    setHtmlCode(DEFAULT_HTML)
  }

  const saveAsHtml = () => {
    const blob = new Blob([htmlCode], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'html-editor.html'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <main className="page html-editor-page">
      <section className="hero html-editor-hero" style={{ '--theme-color': '#57B5E0' }}>
        <div className="hero-left">
          <div className="hero-icon" aria-hidden="true">
            <Code2 className="icon-md" />
          </div>
          <div>
            <h1>HTML Editor</h1>
            <p>Tulis HTML dan lihat preview secara langsung.</p>
          </div>
        </div>
        <div className="shortcut-box">
          <span>FITUR</span>
          <code>Live Preview</code>
          <code>Reset Template</code>
        </div>
      </section>

      <section className="card html-editor-card">
        <div className="html-editor-actions">
          <button type="button" className="outline icon-btn" onClick={saveAsHtml}>
            <Download className="icon-sm" /> Save as HTML
          </button>
          <button type="button" className="outline icon-btn" onClick={resetDefault}>
            <RefreshCcw className="icon-sm" /> Reset
          </button>
        </div>

        <div className="md-tabs html-editor-tabs-mobile">
          <button
            type="button"
            className={`md-tab ${activeTab === 'editor' ? 'active' : ''}`}
            onClick={() => setActiveTab('editor')}
          >
            <Code2 className="icon-sm" /> HTML
          </button>
          <button
            type="button"
            className={`md-tab ${activeTab === 'preview' ? 'active' : ''}`}
            onClick={() => setActiveTab('preview')}
          >
            <Eye className="icon-sm" /> Preview
          </button>
        </div>

        <div className="html-editor-split">
          <article className={`html-editor-pane ${activeTab === 'editor' ? 'active' : ''}`}>
            <h2>HTML Code</h2>
            <Editor
              className="html-editor-monaco"
              defaultLanguage="html"
              language="html"
              value={htmlCode}
              onChange={(value) => setHtmlCode(value ?? '')}
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
                  className="html-editor-textarea"
                  value={htmlCode}
                  onChange={(event) => setHtmlCode(event.target.value)}
                  spellCheck={false}
                />
              }
            />
          </article>

          <article className={`html-editor-pane ${activeTab === 'preview' ? 'active' : ''}`}>
            <h2>Live Preview</h2>
            <div className="html-editor-preview-wrap">
              <iframe
                className="html-editor-preview"
                srcDoc={previewDoc}
                title="HTML live preview"
                sandbox="allow-scripts"
              />
            </div>
          </article>
        </div>
      </section>
    </main>
  )
}

export default HtmlEditorTool
