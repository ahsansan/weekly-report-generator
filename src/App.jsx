import { useEffect, useState } from 'react'
import './App.css'
import WeeklyReportTool from './pages/WeeklyReportTool'
import MarkdownToPdfTool from './pages/MarkdownToPdfTool'
import M4aToMp3Tool from './pages/M4aToMp3Tool'
import PdfMergeTool from './pages/PdfMergeTool'
import PdfSignatureTool from './pages/PdfSignatureTool'
import HtmlEditorTool from './pages/HtmlEditorTool'
import TextDiffTool from './pages/TextDiffTool'
import Header from './components/Header'
import Footer from './components/Footer'
import { TOOL_ROUTES } from './lib/toolRoutes'

const getInitialPath = () => {
  const currentPath = window.location.pathname || '/'
  return TOOL_ROUTES.some((route) => route.path === currentPath) ? currentPath : '/'
}

const PAGE_TITLES = {
  '/': 'Weekly Report Generator - Kejepangan Tools',
  '/md-to-pdf': 'Convert Markdown to PDF - Kejepangan Tools',
  '/m4a-to-mp3': 'Convert M4A to MP3 - Kejepangan Tools',
  '/pdf-merge': 'PDF Merger - Kejepangan Tools',
  '/pdf-sign': 'PDF Signature - Kejepangan Tools',
  '/html-editor': 'HTML Editor - Kejepangan Tools',
  '/text-diff': 'Text Diff Checker - Kejepangan Tools',
}

function App() {
  const [pathname, setPathname] = useState(getInitialPath)

  useEffect(() => {
    document.title = PAGE_TITLES[pathname] || 'Weekly Report Generator'
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
    <div className="app-wrapper">
      <Header pathname={pathname} onNavigate={navigate} />

      <div className="app-content">
        {pathname === '/md-to-pdf' ? (
          <MarkdownToPdfTool />
        ) : pathname === '/m4a-to-mp3' ? (
          <M4aToMp3Tool />
        ) : pathname === '/pdf-merge' ? (
          <PdfMergeTool />
        ) : pathname === '/pdf-sign' ? (
          <PdfSignatureTool />
        ) : pathname === '/html-editor' ? (
          <HtmlEditorTool />
        ) : pathname === '/text-diff' ? (
          <TextDiffTool />
        ) : (
          <WeeklyReportTool />
        )}
      </div>

      <Footer />
    </div>
  )
}

export default App
