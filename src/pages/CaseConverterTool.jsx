import { useMemo, useState } from 'react'
import { Copy, Download, Eraser, RotateCcw } from 'lucide-react'
import '../App.css'

const getWordCount = (text = '') => {
  const words = text.trim().match(/\S+/g)
  return words ? words.length : 0
}

const toSentenceCase = (value = '') => {
  const lower = value.toLowerCase()
  let nextUpper = true
  let output = ''

  for (let index = 0; index < lower.length; index += 1) {
    const char = lower[index]
    if (/[a-z]/i.test(char) && nextUpper) {
      output += char.toUpperCase()
      nextUpper = false
      continue
    }

    output += char
    if (/[.!?]/.test(char)) nextUpper = true
  }

  return output
}

const toTitleCase = (value = '') =>
  value.toLowerCase().replace(/\b([a-z])/g, (match) => match.toUpperCase())

const toToggleCase = (value = '') =>
  value
    .split('')
    .map((char) => {
      if (char >= 'a' && char <= 'z') return char.toUpperCase()
      if (char >= 'A' && char <= 'Z') return char.toLowerCase()
      return char
    })
    .join('')

const toAlternateCase = (value = '') => {
  let shouldUppercase = false
  return value
    .split('')
    .map((char) => {
      if (/[a-z]/i.test(char)) {
        shouldUppercase = !shouldUppercase
        return shouldUppercase ? char.toUpperCase() : char.toLowerCase()
      }
      return char
    })
    .join('')
}

const toSnackCaseFromSpaces = (value = '', forceUppercase = false) => {
  const normalized = value
    .split('\n')
    .map((line) =>
      line
        .replace(/[^a-zA-Z0-9]+/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_+|_+$/g, ''),
    )
    .join('\n')

  return forceUppercase ? normalized.toUpperCase() : normalized.toLowerCase()
}

function CaseConverterTool() {
  const [text, setText] = useState('')
  const [originalText, setOriginalText] = useState('')
  const [activeMode, setActiveMode] = useState('')

  const charCount = useMemo(() => text.length, [text])
  const wordCount = useMemo(() => getWordCount(text), [text])

  const applyCase = (mode) => {
    setActiveMode(mode)
    setText((previous) => {
      if (!previous) return previous

      switch (mode) {
        case 'toggle':
          return toToggleCase(previous)
        case 'sentence':
          return toSentenceCase(previous)
        case 'lower':
          return previous.toLowerCase()
        case 'upper':
          return previous.toUpperCase()
        case 'capitalize':
          return toTitleCase(previous)
        case 'alternate':
          return toAlternateCase(previous)
        case 'lowerSnack':
          return toSnackCaseFromSpaces(previous, false)
        case 'upperSnack':
          return toSnackCaseFromSpaces(previous, true)
        default:
          return previous
      }
    })
  }

  const copyText = async () => {
    try {
      if (!text) return
      await navigator.clipboard.writeText(text)
    } catch {
      alert('Gagal menyalin teks.')
    }
  }

  const downloadText = () => {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'case-converter.txt'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const resetText = () => {
    setText(originalText)
    setActiveMode('')
  }

  return (
    <main className="page case-converter-page">
      <section className="card case-converter-card">
        <div className="case-converter-editor">
          <textarea
            className="case-converter-textarea"
            value={text}
            onChange={(event) => {
              const nextValue = event.target.value
              setText(nextValue)
              setOriginalText(nextValue)
              setActiveMode('')
            }}
            spellCheck={false}
            placeholder="Tulis atau tempel teks di sini..."
          />

          <div className="case-converter-small-actions" aria-label="Quick actions">
            <button type="button" className="case-converter-mini-btn" onClick={downloadText} disabled={!text}>
              <Download className="icon-sm" />
            </button>
            <button type="button" className="case-converter-mini-btn" onClick={copyText} disabled={!text}>
              <Copy className="icon-sm" />
            </button>
            <button
              type="button"
              className="case-converter-mini-btn"
              onClick={resetText}
              disabled={text === originalText}
              title="Reset ke teks semula"
            >
              <RotateCcw className="icon-sm" />
            </button>
            <button
              type="button"
              className="case-converter-mini-btn case-converter-mini-btn-primary"
              onClick={() => {
                setText('')
                setActiveMode('')
              }}
              disabled={!text}
            >
              <Eraser className="icon-sm" />
            </button>
          </div>
        </div>

        <div className="case-converter-counts">
          <p>Character Count: {charCount}</p>
          <p>Word Count: {wordCount}</p>
        </div>

        <div className="case-converter-actions">
          <button
            type="button"
            className={`case-converter-btn ${activeMode === 'toggle' ? 'active' : ''}`}
            onClick={() => applyCase('toggle')}
          >
            tOGGLE cASE
          </button>
          <button
            type="button"
            className={`case-converter-btn ${activeMode === 'sentence' ? 'active' : ''}`}
            onClick={() => applyCase('sentence')}
          >
            Sentence Case
          </button>
          <button
            type="button"
            className={`case-converter-btn ${activeMode === 'lower' ? 'active' : ''}`}
            onClick={() => applyCase('lower')}
          >
            lower case
          </button>
          <button
            type="button"
            className={`case-converter-btn ${activeMode === 'upper' ? 'active' : ''}`}
            onClick={() => applyCase('upper')}
          >
            UPPER CASE
          </button>
          <button
            type="button"
            className={`case-converter-btn ${activeMode === 'capitalize' ? 'active' : ''}`}
            onClick={() => applyCase('capitalize')}
          >
            Capitalize Word
          </button>
          <button
            type="button"
            className={`case-converter-btn ${activeMode === 'alternate' ? 'active' : ''}`}
            onClick={() => applyCase('alternate')}
          >
            aLtErNaTe cAsE
          </button>
          <button
            type="button"
            className={`case-converter-btn ${activeMode === 'lowerSnack' ? 'active' : ''}`}
            onClick={() => applyCase('lowerSnack')}
          >
            lower_snack_case
          </button>
          <button
            type="button"
            className={`case-converter-btn ${activeMode === 'upperSnack' ? 'active' : ''}`}
            onClick={() => applyCase('upperSnack')}
          >
            UPPER_SNACK_CASE
          </button>
        </div>
      </section>
    </main>
  )
}

export default CaseConverterTool
