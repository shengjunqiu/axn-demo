import { NAV_GROUPS, type V2PageId } from '../constants'

export function Sidebar({
  page,
  expanded,
  onToggle,
  onNavigate,
}: {
  page: V2PageId
  expanded: number[]
  onToggle: (index: number) => void
  onNavigate: (page: V2PageId) => void
}) {
  return (
    <aside className="sidebar">
      <nav aria-label="业务导航">
        {NAV_GROUPS.map((group, index) => {
          const open = expanded.includes(index)
          return (
            <div className="nav-group" key={group.name}>
              <button
                type="button"
                className={`nav-top${group.page === page ? ' active' : ''}`}
                aria-expanded={group.children ? open : undefined}
                onClick={() => group.page ? onNavigate(group.page) : onToggle(index)}
              >
                <span className="nav-icon">{group.icon}</span>
                <span>{group.name}</span>
                {group.children ? <span className="chevron">{open ? '⌃' : '⌄'}</span> : null}
              </button>
              {group.children ? (
                <div className="nav-children" hidden={!open}>
                  {group.children.map(child => (
                    <button
                      key={child.page}
                      type="button"
                      className={`nav-child${child.page === page ? ' active' : ''}`}
                      aria-current={child.page === page ? 'page' : undefined}
                      onClick={() => onNavigate(child.page)}
                    >
                      {child.name}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          )
        })}
      </nav>
    </aside>
  )
}
