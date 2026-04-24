function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="app-footer">
      <div className="app-footer-inner">
        <span className="app-footer-brand">🛠️ Tools by Kejepangan</span>
        <span className="app-footer-note">
          Data diproses lokal di browser — tidak ada yang dikirim ke server
        </span>
        <span className="app-footer-year">© {year}</span>
      </div>
    </footer>
  )
}

export default Footer
