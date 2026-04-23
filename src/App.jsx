import { useEffect, useState } from 'react'
import './App.css'
import WeeklyReportTool from './pages/WeeklyReportTool'
import MarkdownToPdfTool from './pages/MarkdownToPdfTool'
import M4aToMp3Tool from './pages/M4aToMp3Tool'
import { TOOL_ROUTES } from './lib/toolRoutes'

const getInitialPath = () => {
  const currentPath = window.location.pathname || '/'
  return TOOL_ROUTES.some((route) => route.path === currentPath) ? currentPath : '/'
}

function App() {
  const [pathname, setPathname] = useState(getInitialPath)

  useEffect(() => {
    const pageTitle =
      pathname === '/md-to-pdf'
        ? 'Convert Markdown to PDF'
        : pathname === '/m4a-to-mp3'
          ? 'Convert M4A to MP3'
          : 'Weekly Report Generator'
    document.title = pageTitle
  }, [pathname])

  useEffect(() => {
    const onPopState = () => setPathname(getInitialPath())
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  const navigate = (nextPath) => {
    if (pathname === nextPath) return
    window.history.pushState({}, '', nextPath)
    setPathname(nextPath)
  }

  return (
    <>
      <header className="tools-nav-wrap">
        <nav className="tools-nav" aria-label="Tools navigation">
          <div className="tools-nav-select-wrap">
            <label htmlFor="tools-nav-select" className="tools-nav-title">
              Tools
            </label>
            <select
              id="tools-nav-select"
              className="tools-nav-select"
              value={pathname}
              onChange={(event) => navigate(event.target.value)}
            >
              {TOOL_ROUTES.map((tool) => (
                <option key={tool.path} value={tool.path}>
                  {tool.label}
                </option>
              ))}
            </select>
          </div>
        </nav>
      </header>

      {pathname === '/md-to-pdf' ? (
        <MarkdownToPdfTool />
      ) : pathname === '/m4a-to-mp3' ? (
        <M4aToMp3Tool />
      ) : (
        <WeeklyReportTool />
      )}
    </>
  )
}

export default App
