import { useEffect, useState } from 'react';
import './App.css';
import WeeklyReportTool from './pages/WeeklyReportTool';
import MarkdownToPdfTool from './pages/MarkdownToPdfTool';
import M4aToMp3Tool from './pages/M4aToMp3Tool';
import PdfMergeTool from './pages/PdfMergeTool';
import PdfSplitExtractTool from './pages/PdfSplitExtractTool';
import PdfSignatureTool from './pages/PdfSignatureTool';
import PdfTextEditorTool from './pages/PdfTextEditorTool';
import PdfResizeA4Tool from './pages/PdfResizeA4Tool';
import PdfCompressTool from './pages/PdfCompressTool';
import PdfToImageTool from './pages/PdfToImageTool';
import EbookMockupTool from './pages/EbookMockupTool';
import ImageToWebpTool from './pages/ImageToWebpTool';
import ImageToPdfTool from './pages/ImageToPdfTool';
import ImageResizerTool from './pages/ImageResizerTool';
import HtmlEditorTool from './pages/HtmlEditorTool';
import TextDiffTool from './pages/TextDiffTool';
import CsvToXlsxTool from './pages/CsvToXlsxTool';
import CsvToJsonTool from './pages/CsvToJsonTool';
import XlsxToCsvTool from './pages/XlsxToCsvTool';
import JsonFormatterTool from './pages/JsonFormatterTool';
import CaseConverterTool from './pages/CaseConverterTool';
import Header from './components/Header';
import Footer from './components/Footer';
import { TOOL_ROUTES } from './lib/toolRoutes';

const getInitialPath = () => {
  const currentPath = window.location.pathname || '/'
  return TOOL_ROUTES.some((route) => route.path === currentPath) ? currentPath : '/'
}

const PAGE_TITLES = {
  '/': 'Weekly Report Generator - Kejepangan Tools',
  '/md-to-pdf': 'Convert Markdown to PDF - Kejepangan Tools',
  '/pdf-merge': 'PDF Merger - Kejepangan Tools',
  '/pdf-split-extract': 'PDF Split & Extract - Kejepangan Tools',
  '/pdf-sign': 'PDF Signature - Kejepangan Tools',
  '/pdf-text-editor': 'PDF Text Editor - Kejepangan Tools',
  '/pdf-resize': 'PDF Resize - Kejepangan Tools',
  '/pdf-compress': 'PDF Compress - Kejepangan Tools',
  '/pdf-to-image': 'PDF to Image - Kejepangan Tools',
  '/ebook-mockup': 'Ebook Mockup Creator - Kejepangan Tools',
  '/image-to-webp': 'PNG/JPG to WEBP - Kejepangan Tools',
  '/image-to-pdf': 'Image to PDF - Kejepangan Tools',
  '/image-resizer': 'Image Resizer - Kejepangan Tools',
  '/m4a-to-mp3': 'Convert M4A to MP3 - Kejepangan Tools',
  '/html-editor': 'HTML Editor - Kejepangan Tools',
  '/text-diff': 'Text Diff Checker - Kejepangan Tools',
  '/csv-to-xlsx': 'CSV to XLSX - Kejepangan Tools',
  '/csv-to-json': 'CSV to JSON - Kejepangan Tools',
  '/xlsx-to-csv': 'XLSX to CSV - Kejepangan Tools',
  '/json-formatter': 'JSON Formatter & Validator - Kejepangan Tools',
  '/case-converter': 'Case Converter - Kejepangan Tools',
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
        ) : pathname === '/pdf-split-extract' ? (
          <PdfSplitExtractTool />
        ) : pathname === '/pdf-sign' ? (
          <PdfSignatureTool />
        ) : pathname === '/pdf-text-editor' ? (
          <PdfTextEditorTool />
        ) : pathname === '/pdf-resize' ? (
          <PdfResizeA4Tool />
        ) : pathname === '/pdf-compress' ? (
          <PdfCompressTool />
        ) : pathname === '/pdf-to-image' ? (
          <PdfToImageTool />
        ) : pathname === '/ebook-mockup' ? (
          <EbookMockupTool />
        ) : pathname === '/image-to-webp' ? (
          <ImageToWebpTool />
        ) : pathname === '/image-to-pdf' ? (
          <ImageToPdfTool />
        ) : pathname === '/image-resizer' ? (
          <ImageResizerTool />
        ) : pathname === '/html-editor' ? (
          <HtmlEditorTool />
        ) : pathname === '/text-diff' ? (
          <TextDiffTool />
        ) : pathname === '/csv-to-xlsx' ? (
          <CsvToXlsxTool />
        ) : pathname === '/csv-to-json' ? (
          <CsvToJsonTool />
        ) : pathname === '/xlsx-to-csv' ? (
          <XlsxToCsvTool />
        ) : pathname === '/json-formatter' ? (
          <JsonFormatterTool />
        ) : pathname === '/case-converter' ? (
          <CaseConverterTool />
        ) : (
          <WeeklyReportTool />
        )}
      </div>

      <Footer />
    </div>
  )
}

export default App

