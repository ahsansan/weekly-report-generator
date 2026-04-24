import { TOOL_ROUTES } from '../lib/toolRoutes'

function Header({ pathname, onNavigate }) {
  return (
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
            onChange={(event) => onNavigate(event.target.value)}
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
  )
}

export default Header
