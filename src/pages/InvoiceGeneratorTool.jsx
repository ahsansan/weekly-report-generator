import { useEffect, useMemo, useRef, useState } from 'react'
import { jsPDF } from 'jspdf'
import { Building2, ClipboardPaste, Download, FileSpreadsheet, FileText, Receipt, RotateCcw } from 'lucide-react'
import * as XLSX from 'xlsx'
import '../App.css'

const DRAFT_KEY = 'invoice-generator-draft'
const PDF_EXPORT_WIDTH = 794

const DEFAULT_RAW_TEXT = `RINCIAN TOP UP 

Akun = Nominal
- BA Maulana Ahsan = 3.000.000
KODE UNIK : 480
Biaya admin : 4.000
Fee 2% : 60.000

Total = 3.064.480

BNI : 8808610186611024
BRI : 13281610198580219
PERMATA : 8214610193377932
BSI : 9655610185760092`

const toDateInputValue = (dateValue = new Date()) => {
  const year = dateValue.getFullYear()
  const month = String(dateValue.getMonth() + 1).padStart(2, '0')
  const date = String(dateValue.getDate()).padStart(2, '0')
  return `${year}-${month}-${date}`
}

const addDaysToInputDate = (inputDate, dayCount) => {
  const baseDate = inputDate ? new Date(`${inputDate}T00:00:00`) : new Date()
  if (Number.isNaN(baseDate.getTime())) return toDateInputValue()
  baseDate.setDate(baseDate.getDate() + dayCount)
  return toDateInputValue(baseDate)
}

const makeDefaultForm = () => {
  const invoiceDate = toDateInputValue()
  return {
    invoiceNumber: makeInvoiceNumber(),
    invoiceDate,
    dueDate: addDaysToInputDate(invoiceDate, 1),
    sellerName: 'BONG AFFAND',
    sellerInfo: 'Professional Whitelist Account Service',
    partnerTelephone: '6285212261642',
    partnerEmail: '',
    buyerName: 'Kejepangan',
    notes: 'Pembayaran mohon dilakukan sesuai total invoice termasuk kode unik.',
  }
}

const parseAmount = (value = '') => {
  const digits = value.replace(/[^\d]/g, '')
  return digits ? Number.parseInt(digits, 10) : 0
}

const formatCurrency = (value = 0) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value)

const formatDate = (value) => {
  if (!value) return '-'
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
}

const formatDateForExcelImport = (value) => {
  if (!value) return ''
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${day}/${month}/${date.getFullYear()}`
}

const toSafeFileName = (value, fallback = 'invoice') => {
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-')
  return normalized.replace(/-+/g, '-').replace(/^-|-$/g, '') || fallback
}

const makeInvoiceNumber = () => {
  const datePart = toDateInputValue().replaceAll('-', '')
  return `INV-${datePart}-001`
}

const parseInvoiceText = (rawText = '') => {
  const lines = rawText
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  const items = []
  const charges = []
  const banks = []
  let title = 'Invoice'
  let total = 0
  let uniqueCode = 0

  lines.forEach((line) => {
    const titleMatch = line.match(/^RINCIAN\s+(.+)$/i)
    if (titleMatch) {
      title = `Invoice ${titleMatch[1].trim()}`
      return
    }

    const itemMatch = line.match(/^-\s*(.+?)\s*=\s*([\d.,]+)$/)
    if (itemMatch) {
      items.push({ name: itemMatch[1].trim(), amount: parseAmount(itemMatch[2]) })
      return
    }

    const totalMatch = line.match(/^Total\s*[=:]\s*([\d.,]+)$/i)
    if (totalMatch) {
      total = parseAmount(totalMatch[1])
      return
    }

    const chargeMatch = line.match(/^(KODE UNIK|Biaya admin|Fee\s*\d+%?)\s*:\s*([\d.,]+)$/i)
    if (chargeMatch) {
      const chargeName = chargeMatch[1].replace(/\s+/g, ' ').trim()
      const chargeAmount = parseAmount(chargeMatch[2])
      if (/^KODE UNIK$/i.test(chargeName)) {
        uniqueCode += chargeAmount
      } else {
        charges.push({ name: chargeName, amount: chargeAmount })
      }
      return
    }

    const bankMatch = line.match(/^([A-Z][A-Z0-9 ]{1,20})\s*:\s*([0-9 ]{6,})$/i)
    if (bankMatch) {
      banks.push({ name: bankMatch[1].trim().toUpperCase(), number: bankMatch[2].replace(/\s+/g, '') })
    }
  })

  const subtotal = items.reduce((sum, item) => sum + item.amount, 0)
  if (uniqueCode > 0) {
    const adminCharge = charges.find((charge) => /^Biaya admin$/i.test(charge.name))
    if (adminCharge) {
      adminCharge.amount += uniqueCode
    } else {
      charges.unshift({ name: 'Biaya admin', amount: uniqueCode })
    }
  }
  const chargeTotal = charges.reduce((sum, charge) => sum + charge.amount, 0)

  return {
    title,
    items,
    charges,
    banks,
    subtotal,
    total: total || subtotal + chargeTotal,
  }
}

const FORMAT_BULK_HEADERS = [
  '*Supplier Name ',
  '*Partner Telephone Number ',
  'Email',
  '*No. Invoice ',
  '*Date ',
  '*Due Date ',
  'Product SKU',
  '*Item Name ',
  '*Item Description ',
  '*Qty ',
  '*Price ',
  'Uom',
  'Discount Type',
  'Discount per Line',
  'Nama Pajak',
  'Diskon Total',
  'Syarat dan Ketentuan',
  'Keterangan',
]

const INSTRUCTION_ROWS = [
  ['Instruksi pengisian Form Bulk Import Invoice'],
  [],
  ['1', 'Masukkan data seperti contoh:'],
  ['', '(kolom bertanda * / bold bersifat wajib atau required)'],
  [
    '',
    '*Supplier Name ',
    'Partner Telephone Number',
    'Email',
    '*No. Invoice ',
    '*Date ',
    '*Due Date ',
    'Product SKU',
    '*Item Name ',
    '*Item Description ',
    '*Qty ',
    '*Price ',
    'Discount Type ',
    'Discount per Line ',
    'Nama Pajak ',
    'Diskon Total ',
    'Syarat dan Ketentuan ',
    'Catatan ',
  ],
  [
    '',
    'PT. ABC',
    '628123456',
    '',
    'EXP/2022/001',
    '23/03/2018',
    '04/05/2018',
    'HP-128',
    'HP Simple, 128 Gb',
    'HP Simple, 4" Display, 128 Gb Memory',
    2,
    5000000,
    '%',
    5,
    'PPN 10% EXCLUSIVE',
    20000,
    '',
    '',
  ],
  ['', 'PT. ABC', '628123456', '', 'EXP/2022/001', '23/03/2018', '04/05/2018', '', 'Ongkos Kirim', 'Ongkos Kirim Pos', 1, 20000, 'Rp', 20000, '', 20000, '', ''],
  ['', 'PT. Mobil Internasional', '', 'ptmobil@company.com', 'EXP/2022/002', '03/04/2018', '03/05/2018', 'MOB-123', 'Mobil 123', 'Mobil 123, 2000 cc', 1, 80000000, '', 10, 'PPN 10% EXCLUSIVE', '', '', ''],
  [],
  ['2', 'Pastikan data Supplier Name yang Anda input sudah terdata pada akun Paper Anda, jika tidak, data akan ditolak.'],
  ['3', 'Anda wajib mengisi salah satu: Partner Telephone Number atau Email'],
  ['4', 'Format tanggal yang dapat diterima adalah DD/MM/YYYY (cth. 23/03/2022)'],
  ['5', 'Pastikan Anda menginput Nama Pajak yang telah terdaftar pada sheet TaxID_Company jika tidak, data 1 Invoice yang sama akan ditolak.'],
  ['6', 'Product SKU akan mencari data produk dengan kode SKU yang sama dalam sistem Paper.id dan akan berpengaruh pada Stok Anda.'],
  ['7', 'Jika Product SKU yang Anda input tidak sesuai yang terdaftar di sistem Paper.id, dokumen Invoice Anda tidak akan berpengaruh pada perhitungan Stok Anda.'],
  ['8', 'Anda tidak perlu menambahkan kolom Grand Total, hal tersebut akan dihitung secara otomatis oleh sistem kami.'],
  ['9', 'Jika Anda memiliki lebih dari 1 produk pada Invoice Anda, Anda harus memiliki Supplier Name, No Invoice, Date, Due Date, Diskon Total yang sama (lihat kolom berwarna kuning), jika tidak, data akan ditolak.'],
  ['10', 'Jika Anda menginput discount per line, maka pastikan anda telah menginput discount type'],
  ['11', 'Pengaturan mengenai Keterangan dan Syarat & Ketentuan akan mengikuti Pengaturan Anda pada Pengaturan Invoice'],
]

const TAX_ROWS = [
  ['Nama Pajak', 'Pajak 1 (%)', 'Pajak 2 (%)', 'Kategori', '', '', 'Discount Type'],
  ['PPH 21 NPWP 2.5%', '(2.50)', '', 'exclusive', '', '', 'Fixed'],
  ['PPN 12% EXCLUSIVE (DPP 11/12)', '12.00', '', 'exclusive', '', '', '%'],
  ['PPN 12% INCLUSIVE (DPP 11/12)', '12.00', '', 'inclusive', '', '', ''],
  ['PPN 1% INCLUSIVE', '1.00', '', 'inclusive', '', '', ''],
  ['PPN 1.1% INCLUSIVE', '1.10', '', 'inclusive', '', '', ''],
  ['PPH 23 NPWP 2%', '(2.00)', '', 'exclusive', '', '', ''],
  ['PPN 10% INCLUSIVE', '10.00', '', 'inclusive', '', '', ''],
  ['PPN 12% INCLUSIVE', '12.00', '', 'inclusive', '', '', ''],
  ['PPN 11% EXCLUSIVE', '11.00', '', 'exclusive', '', '', ''],
  ['PPH 23 Non NPWP 4%', '(4.00)', '', 'exclusive', '', '', ''],
  ['PPH 21 3% Gross Up', '3.09', '', 'exclusive', '', '', ''],
  ['PPH 21 2.5% Gross Up', '2.56', '', 'exclusive', '', '', ''],
  ['PPN 1% EXCLUSIVE', '1.00', '', 'exclusive', '', '', ''],
  ['PPN 12% EXCLUSIVE', '12.00', '', 'exclusive', '', '', ''],
  ['PPN 1.1% EXCLUSIVE', '1.10', '', 'exclusive', '', '', ''],
  ['PPN 10% EXCLUSIVE', '10.00', '', 'exclusive', '', '', ''],
  ['PPN 11% INCLUSIVE', '11.00', '', 'inclusive', '', '', ''],
]

const padRows = (rows, columnCount, rowCount = 1000) => {
  const padded = rows.map((row) => Array.from({ length: columnCount }, (_, index) => row[index] ?? ''))
  while (padded.length < rowCount) {
    padded.push(Array.from({ length: columnCount }, () => ''))
  }
  return padded
}

const setSheetRange = (worksheet, range) => {
  worksheet['!ref'] = range
}

const applyColumnWidths = (worksheet, widths) => {
  worksheet['!cols'] = widths.map((wch) => ({ wch }))
}

const loadDraft = () => {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function InvoiceGeneratorTool() {
  const draft = loadDraft()
  const defaultForm = makeDefaultForm()
  const [rawText, setRawText] = useState(draft?.rawText ?? DEFAULT_RAW_TEXT)
  const [form, setForm] = useState({
    ...defaultForm,
    ...draft?.form,
    dueDate: draft?.form?.dueDate || addDaysToInputDate(draft?.form?.invoiceDate ?? defaultForm.invoiceDate, 1),
  })
  const [isExporting, setIsExporting] = useState(false)
  const invoice = useMemo(() => parseInvoiceText(rawText), [rawText])
  const exportRef = useRef(null)

  useEffect(() => {
    const timeout = setTimeout(() => {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ rawText, form }))
    }, 250)
    return () => clearTimeout(timeout)
  }, [rawText, form])

  const updateForm = (field, value) => {
    setForm((current) => {
      if (field === 'invoiceDate') {
        return { ...current, invoiceDate: value, dueDate: addDaysToInputDate(value, 1) }
      }
      return { ...current, [field]: value }
    })
  }

  const resetDraft = () => {
    setRawText(DEFAULT_RAW_TEXT)
    setForm(makeDefaultForm())
    localStorage.removeItem(DRAFT_KEY)
  }

  const pasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (text.trim()) setRawText(text)
    } catch {
      alert('Gagal membaca clipboard.')
    }
  }

  const downloadExcel = async () => {
    const invoiceLines = [
      ...invoice.items.map((item) => ({
        name: item.name,
        description: invoice.title,
        amount: item.amount,
      })),
      ...invoice.charges.map((charge) => ({
        name: charge.name,
        description: charge.name,
        amount: charge.amount,
      })),
    ]

    const rows = invoiceLines.length > 0 ? invoiceLines : [{ name: invoice.title, description: invoice.title, amount: 0 }]
    const dataRows = rows.map((line) => [
        form.sellerName,
        form.partnerTelephone,
        form.partnerEmail,
        form.invoiceNumber,
        formatDateForExcelImport(form.invoiceDate),
        formatDateForExcelImport(form.dueDate),
        '',
        line.name,
        line.description,
        1,
        line.amount,
        '',
        '',
        '',
        '',
        '',
        '',
        form.notes,
      ])

    let workbook
    try {
      const response = await fetch('/import-purchase-invoice-template.xlsx')
      if (!response.ok) throw new Error('Template tidak ditemukan')
      const buffer = await response.arrayBuffer()
      workbook = XLSX.read(buffer, { type: 'array', cellStyles: true })
      const formatBulkSheet = workbook.Sheets.format_bulk
      if (!formatBulkSheet) throw new Error('Sheet format_bulk tidak ditemukan')
      XLSX.utils.sheet_add_aoa(formatBulkSheet, dataRows, { origin: 'A2' })
      setSheetRange(formatBulkSheet, 'A1:R1000')
    } catch {
      const formatBulkRows = [FORMAT_BULK_HEADERS, ...dataRows]
      workbook = XLSX.utils.book_new()
      const instructionSheet = XLSX.utils.aoa_to_sheet(padRows(INSTRUCTION_ROWS, 18))
      const taxSheet = XLSX.utils.aoa_to_sheet(padRows(TAX_ROWS, 7))
      const uomSheet = XLSX.utils.aoa_to_sheet([['Name', 'Symbol']])
      const formatBulkSheet = XLSX.utils.aoa_to_sheet(padRows(formatBulkRows, 18))

      setSheetRange(instructionSheet, 'A1:R1000')
      setSheetRange(taxSheet, 'A1:G1000')
      setSheetRange(uomSheet, 'A1:B1')
      setSheetRange(formatBulkSheet, 'A1:R1000')

      applyColumnWidths(instructionSheet, [8, 28, 22, 24, 18, 14, 14, 16, 24, 32, 10, 14, 16, 18, 22, 16, 24, 24])
      applyColumnWidths(taxSheet, [34, 14, 14, 14, 8, 8, 16])
      applyColumnWidths(uomSheet, [20, 14])
      applyColumnWidths(formatBulkSheet, [26, 24, 26, 18, 14, 14, 16, 28, 32, 10, 14, 10, 16, 18, 22, 16, 24, 34])

      XLSX.utils.book_append_sheet(workbook, instructionSheet, 'Instruction')
      XLSX.utils.book_append_sheet(workbook, taxSheet, 'TaxID_Company')
      XLSX.utils.book_append_sheet(workbook, uomSheet, 'UOM')
      XLSX.utils.book_append_sheet(workbook, formatBulkSheet, 'format_bulk')
    }

    const xlsxBuffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' })
    const blob = new Blob([xlsxBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${toSafeFileName(form.invoiceNumber, 'invoice')}-paper-import.xlsx`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const downloadPdf = async () => {
    if (isExporting) return

    try {
      setIsExporting(true)
      const targetElement = exportRef.current
      if (!targetElement) throw new Error('Preview invoice tidak ditemukan')
      if (document.fonts?.ready) await document.fonts.ready

      const renderShell = document.createElement('div')
      renderShell.className = 'invoice-export-shell'
      const clonedElement = targetElement.cloneNode(true)
      renderShell.appendChild(clonedElement)
      document.body.appendChild(renderShell)

      const { default: html2canvas } = await import('html2canvas')
      const canvas = await html2canvas(clonedElement, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        windowWidth: PDF_EXPORT_WIDTH,
      })

      const pdf = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait', compress: true })
      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      const margin = 0
      const contentWidth = pageWidth - margin * 2
      const pxPerPt = canvas.width / contentWidth
      const pageSliceHeightPx = Math.max(1, Math.floor((pageHeight - margin * 2) * pxPerPt))

      let offsetY = 0
      let pageIndex = 0
      while (offsetY < canvas.height) {
        const sliceHeight = Math.min(pageSliceHeightPx, canvas.height - offsetY)
        const pageCanvas = document.createElement('canvas')
        pageCanvas.width = canvas.width
        pageCanvas.height = sliceHeight
        const ctx = pageCanvas.getContext('2d')
        if (!ctx) throw new Error('Gagal membuat canvas PDF')
        ctx.drawImage(canvas, 0, offsetY, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight)

        if (pageIndex > 0) pdf.addPage()
        pdf.addImage(pageCanvas.toDataURL('image/png'), 'PNG', margin, margin, contentWidth, sliceHeight / pxPerPt, undefined, 'FAST')

        offsetY += sliceHeight
        pageIndex += 1
      }

      document.body.removeChild(renderShell)
      pdf.save(`${toSafeFileName(form.invoiceNumber, 'invoice')}.pdf`)
    } catch {
      alert('Gagal membuat PDF invoice.')
    } finally {
      const oldShell = document.querySelector('.invoice-export-shell')
      if (oldShell?.parentNode) oldShell.parentNode.removeChild(oldShell)
      setIsExporting(false)
    }
  }

  return (
    <main className="page invoice-page">
      <section className="hero invoice-hero" style={{ '--theme-color': '#0f766e' }}>
        <div className="hero-left">
          <div className="hero-icon" aria-hidden="true">
            <Receipt className="icon-md" />
          </div>
          <div>
            <h1>Invoice Generator</h1>
            <p>Buat invoice profesional dari rincian transaksi dan export ke PDF.</p>
          </div>
        </div>
        <div className="shortcut-box">
          <span>OUTPUT</span>
          <code>Preview Invoice</code>
          <code>Download PDF</code>
        </div>
      </section>

      <section className="invoice-workspace">
        <article className="card invoice-editor-card">
          <div className="invoice-editor-head">
            <div>
              <h2>Data Invoice</h2>
              <p>Paste format rincian top up, lalu lengkapi metadata invoice.</p>
            </div>
            <div className="invoice-actions">
              <button type="button" className="outline icon-btn" onClick={pasteFromClipboard}>
                <ClipboardPaste className="icon-sm" /> Paste
              </button>
              <button type="button" className="outline icon-btn" onClick={resetDraft}>
                <RotateCcw className="icon-sm" /> Reset
              </button>
              <button type="button" className="primary icon-btn" onClick={downloadPdf} disabled={isExporting}>
                <Download className="icon-sm" /> {isExporting ? 'Generating...' : 'Download PDF'}
              </button>
              <button type="button" className="primary icon-btn" onClick={downloadExcel}>
                <FileSpreadsheet className="icon-sm" /> Export Excel
              </button>
            </div>
          </div>

          <div className="invoice-editor-body">
            <div className="invoice-fields">
              <label className="field">
                <span>No Invoice</span>
                <input value={form.invoiceNumber} onChange={(event) => updateForm('invoiceNumber', event.target.value)} />
              </label>
              <label className="field">
                <span>Tanggal</span>
                <input type="date" value={form.invoiceDate} onChange={(event) => updateForm('invoiceDate', event.target.value)} />
              </label>
              <label className="field">
                <span>Jatuh Tempo</span>
                <input type="date" value={form.dueDate} onChange={(event) => updateForm('dueDate', event.target.value)} />
              </label>
              <label className="field">
                <span>Pelanggan</span>
                <input value={form.buyerName} onChange={(event) => updateForm('buyerName', event.target.value)} />
              </label>
              <label className="field">
                <span>Nama Bisnis</span>
                <input value={form.sellerName} onChange={(event) => updateForm('sellerName', event.target.value)} />
              </label>
              <label className="field">
                <span>Info Bisnis</span>
                <input value={form.sellerInfo} onChange={(event) => updateForm('sellerInfo', event.target.value)} />
              </label>
              <label className="field">
                <span>Telepon Supplier</span>
                <input value={form.partnerTelephone} onChange={(event) => updateForm('partnerTelephone', event.target.value)} />
              </label>
              <label className="field">
                <span>Email Supplier</span>
                <input value={form.partnerEmail} onChange={(event) => updateForm('partnerEmail', event.target.value)} />
              </label>
            </div>

            <label className="field">
              <span>Rincian Transaksi</span>
              <textarea
                className="invoice-raw-input"
                value={rawText}
                onChange={(event) => setRawText(event.target.value)}
                spellCheck="false"
              />
            </label>

            <label className="field">
              <span>Catatan</span>
              <textarea
                className="invoice-note-input"
                value={form.notes}
                onChange={(event) => updateForm('notes', event.target.value)}
              />
            </label>
          </div>
        </article>

        <article className="invoice-preview-card">
          <div className="invoice-preview-toolbar">
            <span>
              <FileText className="icon-sm" /> Live Preview
            </span>
          </div>
          <InvoiceDocument form={form} invoice={invoice} exportRef={exportRef} />
        </article>
      </section>
    </main>
  )
}

function InvoiceDocument({ form, invoice, exportRef }) {
  return (
    <div className="invoice-paper" ref={exportRef}>
      <header className="invoice-paper-head">
        <div>
          <div className="invoice-brand-mark">
            <Building2 className="icon-sm" />
          </div>
          <h2>{form.sellerName || 'Nama Bisnis'}</h2>
          <p>{form.sellerInfo || 'Info bisnis'}</p>
        </div>
        <div className="invoice-title-block">
          <h1>INVOICE</h1>
          <span>{form.invoiceNumber || '-'}</span>
        </div>
      </header>

      <section className="invoice-meta-grid">
        <div>
          <span>Ditagihkan Kepada</span>
          <strong>{form.buyerName || 'Customer'}</strong>
        </div>
        <div>
          <span>Tanggal Invoice</span>
          <strong>{formatDate(form.invoiceDate)}</strong>
        </div>
        <div>
          <span>Jatuh Tempo</span>
          <strong>{formatDate(form.dueDate)}</strong>
        </div>
      </section>

      <section className="invoice-section">
        <div className="invoice-section-head">
          <h3>{invoice.title}</h3>
        </div>
        <table className="invoice-table">
          <thead>
            <tr>
              <th>Deskripsi</th>
              <th>Nominal</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.length > 0 ? (
              invoice.items.map((item, index) => (
                <tr key={`${item.name}-${index}`}>
                  <td>{item.name}</td>
                  <td>{formatCurrency(item.amount)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td>Belum ada item</td>
                <td>{formatCurrency(0)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="invoice-summary">
        <div className="invoice-bank-box">
          <h3>Rekening Pembayaran</h3>
          {invoice.banks.length > 0 ? (
            <div className="invoice-bank-list">
              {invoice.banks.map((bank) => (
                <div key={`${bank.name}-${bank.number}`}>
                  <span>{bank.name}</span>
                  <strong>{bank.number}</strong>
                </div>
              ))}
            </div>
          ) : (
            <p>Belum ada rekening.</p>
          )}
        </div>

        <div className="invoice-total-box">
          <div>
            <span>Subtotal</span>
            <strong>{formatCurrency(invoice.subtotal)}</strong>
          </div>
          {invoice.charges.map((charge) => (
            <div key={charge.name}>
              <span>{charge.name}</span>
              <strong>{formatCurrency(charge.amount)}</strong>
            </div>
          ))}
          <div className="invoice-grand-total">
            <span>Total</span>
            <strong>{formatCurrency(invoice.total)}</strong>
          </div>
        </div>
      </section>

      <footer className="invoice-paper-foot">
        <p>{form.notes}</p>
        <span>Terima kasih atas kepercayaan Anda.</span>
      </footer>
    </div>
  )
}

export default InvoiceGeneratorTool
