import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { TOOL_ROUTES } from '../lib/toolRoutes'

function Header({ pathname, onNavigate }) {
  const [isPaletteOpen, setIsPaletteOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const searchInputRef = useRef(null)

  const groupedTools = TOOL_ROUTES.reduce((groups, tool) => {
    const groupName = tool.group || 'Other'
    if (!groups[groupName]) {
      groups[groupName] = []
    }
    groups[groupName].push(tool)
    return groups
  }, {})

  const filteredTools = useMemo(() => {
    const search = query.trim().toLowerCase()
    if (!search) return TOOL_ROUTES
    return TOOL_ROUTES.filter((tool) => {
      const haystack = `${tool.label} ${tool.group || ''}`.toLowerCase()
      return haystack.includes(search)
    })
  }, [query])

  useEffect(() => {
    const onKeyDown = (event) => {
      const isOpenShortcut = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k'
      if (isOpenShortcut) {
        event.preventDefault()
        setIsPaletteOpen(true)
        return
      }

      if (event.key === 'Escape') {
        setIsPaletteOpen(false)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    if (!isPaletteOpen) return
    const animationId = window.requestAnimationFrame(() => {
      searchInputRef.current?.focus()
    })
    return () => window.cancelAnimationFrame(animationId)
  }, [isPaletteOpen])

  useEffect(() => {
    if (!isPaletteOpen) return
    const activeIndex = filteredTools.findIndex((tool) => tool.path === pathname)
    setHighlightedIndex(activeIndex >= 0 ? activeIndex : 0)
  }, [isPaletteOpen, pathname, filteredTools])

  useEffect(() => {
    if (!isPaletteOpen) return
    if (filteredTools.length === 0) {
      setHighlightedIndex(-1)
      return
    }
    setHighlightedIndex((currentIndex) => {
      if (currentIndex < 0) return 0
      if (currentIndex > filteredTools.length - 1) return filteredTools.length - 1
      return currentIndex
    })
  }, [filteredTools, isPaletteOpen])

  useEffect(() => {
    if (!isPaletteOpen || highlightedIndex < 0) return
    const selectedElement = document.getElementById(`tools-command-item-${highlightedIndex}`)
    selectedElement?.scrollIntoView({ block: 'nearest' })
  }, [highlightedIndex, isPaletteOpen])

  const closePalette = () => {
    setIsPaletteOpen(false)
    setQuery('')
    setHighlightedIndex(0)
  }

  const handleNavigate = (nextPath) => {
    onNavigate(nextPath)
    closePalette()
  }

  return (
    <header className="tools-nav-wrap">
      <nav className="tools-nav" aria-label="Tools navigation">
        <div className="tools-nav-select-wrap">
          <div className="tools-nav-head">
            <label htmlFor="tools-nav-select" className="tools-nav-title">
              Tools
            </label>
            <button type="button" className="tools-nav-search-trigger" onClick={() => setIsPaletteOpen(true)}>
              Search <kbd>Ctrl/Cmd+K</kbd>
            </button>
          </div>
          <select
            id="tools-nav-select"
            className="tools-nav-select"
            value={pathname}
            onChange={(event) => handleNavigate(event.target.value)}
          >
            {Object.entries(groupedTools).map(([groupName, tools]) => (
              <optgroup key={groupName} label={groupName}>
                {tools.map((tool) => (
                  <option key={tool.path} value={tool.path}>
                    {tool.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
      </nav>

      {isPaletteOpen
        ? createPortal(
            <div className="tools-command-overlay" onClick={closePalette}>
              <div
                className="tools-command-panel"
                role="dialog"
                aria-modal="true"
                aria-label="Search tools"
                onClick={(event) => event.stopPropagation()}
              >
                <input
                  ref={searchInputRef}
                  type="text"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'ArrowDown') {
                      event.preventDefault()
                      setHighlightedIndex((currentIndex) => {
                        if (filteredTools.length === 0) return -1
                        return currentIndex >= filteredTools.length - 1 ? 0 : currentIndex + 1
                      })
                      return
                    }

                    if (event.key === 'ArrowUp') {
                      event.preventDefault()
                      setHighlightedIndex((currentIndex) => {
                        if (filteredTools.length === 0) return -1
                        return currentIndex <= 0 ? filteredTools.length - 1 : currentIndex - 1
                      })
                      return
                    }

                    if (event.key === 'Enter' && filteredTools.length > 0) {
                      event.preventDefault()
                      const safeIndex =
                        highlightedIndex >= 0 && highlightedIndex < filteredTools.length ? highlightedIndex : 0
                      handleNavigate(filteredTools[safeIndex].path)
                    }
                  }}
                  className="tools-command-input"
                  placeholder="Cari tool..."
                />

                {filteredTools.length > 0 ? (
                  <ul className="tools-command-list">
                    {filteredTools.map((tool, index) => (
                      <li key={tool.path}>
                        <button
                          id={`tools-command-item-${index}`}
                          type="button"
                          className={`tools-command-item${index === highlightedIndex ? ' active' : ''}`}
                          onClick={() => handleNavigate(tool.path)}
                          onMouseEnter={() => setHighlightedIndex(index)}
                        >
                          <span>{tool.label}</span>
                          <small>{tool.group || 'Other'}</small>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="tools-command-empty">Tidak ada tool yang cocok.</p>
                )}
              </div>
            </div>,
            document.body,
          )
        : null}
    </header>
  )
}

export default Header
