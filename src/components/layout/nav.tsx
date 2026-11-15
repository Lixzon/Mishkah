import { useAppSelector } from '../../store';
import { APP_NAME, APP_NAME_AR, APP_TAGLINE } from '../../lib/constants';
import { NavLink } from 'react-router-dom';
import { Icon, type IconName } from '../ui/Icon';
import { MihrabLogo } from '../ui/MihrabLogo';

interface NavItem {
  to: string;
  icon: IconName;
  label: string;
  end?: boolean;
}

export const MAIN_ITEMS: NavItem[] = [
  { to: '/', icon: 'book', label: 'Read', end: true },
  { to: '/library', icon: 'list', label: 'Library' },
  { to: '/guidance', icon: 'quote', label: 'Guidance' },
  { to: '/progress', icon: 'progress', label: 'Progress' },
  { to: '/profile', icon: 'user', label: 'Profile' },
];

export function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-line bg-surface md:flex">
      <div className="flex items-center gap-3 px-5 py-5">
        <MihrabLogo size={40} className="shrink-0 drop-shadow-sm" />
        <div className="leading-tight">
          <div className="text-[15px] font-bold text-ink">{APP_NAME}</div>
          <div className="text-xs text-accent" style={{ direction: 'rtl' }}>
            {APP_NAME_AR} · القرآن
          </div>
        </div>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-2">
        {MAIN_ITEMS.map((it) => (
          <NavLink
            key={it.to}
            to={it.to}
            end={it.end}
            className={({ isActive }) =>
              `group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive ? 'bg-accent/12 text-accent' : 'text-mut hover:bg-surface2 hover:text-ink'
              }`
            }
          >
            <Icon name={it.icon} size={19} />
            {it.label}
          </NavLink>
        ))}
      </nav>
      <div className="px-5 py-4 text-[11px] leading-relaxed text-mut">
        <div style={{ direction: 'rtl', textAlign: 'center' }} className="text-sm">
          بسم الله الرحمن الرحيم
        </div>
        <div className="mt-1 text-center">{APP_TAGLINE}</div>
      </div>
    </aside>
  );
}

export function MobileNav() {
  const readingMode = useAppSelector((s) => s.settings.readingMode);
  const items = MAIN_ITEMS.filter((i) => i.to !== '/downloads');
  if (readingMode) return null;
  return (
    <nav
      className="safe-b fixed inset-x-0 bottom-0 z-30 flex items-stretch justify-around border-t border-line bg-surface/95 backdrop-blur md:hidden"
      style={{ paddingTop: 4 }}
    >
      {items.map((it) => (
        <NavLink
          key={it.to}
          to={it.to}
          end={it.end}
          className={({ isActive }) =>
            `flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-lg py-1.5 text-[10px] font-medium transition-colors ${
              isActive ? 'text-accent' : 'text-mut'
            }`
          }
        >
          {({ isActive }) => (
            <>
              <Icon name={it.icon} size={22} />
              {it.label}
              <span
                className={`h-1 w-1 rounded-full ${isActive ? 'bg-accent' : 'bg-transparent'}`}
              />
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
