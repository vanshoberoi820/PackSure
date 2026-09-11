import { NavLink, useLocation } from 'react-router-dom';
import { Home, ScanLine, ClipboardList, FileText, User } from 'lucide-react';

const NAV_ITEMS = [
  { to: '/', icon: Home, label: 'Home' },
  { to: '/inspections', icon: ClipboardList, label: 'Inspections' },
  { to: '/scan', icon: ScanLine, label: 'Scan', primary: true },
  { to: '/reports', icon: FileText, label: 'Reports' },
  { to: '/profile', icon: User, label: 'Profile' },
];

export default function BottomNav() {
  const location = useLocation();

  // Hide on login, scan, result, evidence, review, compare pages
  const hidePaths = ['/login', '/scan', '/result', '/evidence', '/review', '/compare'];
  if (hidePaths.some((p) => location.pathname.startsWith(p))) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-100 shadow-lg">
      <div className="max-w-md mx-auto flex items-end justify-around px-2 pb-1 pt-1">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = item.to === '/'
            ? location.pathname === '/'
            : location.pathname.startsWith(item.to);

          if (item.primary) {
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className="flex flex-col items-center -mt-5"
              >
                <div
                  className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all duration-200 ${
                    isActive
                      ? 'bg-primary-600 scale-110 shadow-primary-300'
                      : 'bg-primary-600 hover:bg-primary-700'
                  }`}
                >
                  <Icon className="w-6 h-6 text-white" strokeWidth={2.5} />
                </div>
                <span className="text-[10px] font-semibold mt-1 text-primary-600">
                  {item.label}
                </span>
              </NavLink>
            );
          }

          return (
            <NavLink
              key={item.to}
              to={item.to}
              className="flex flex-col items-center py-2 px-3 min-w-[60px]"
            >
              <Icon
                className={`w-5 h-5 transition-colors ${
                  isActive ? 'text-primary-600' : 'text-gray-400'
                }`}
                strokeWidth={isActive ? 2.5 : 1.8}
              />
              <span
                className={`text-[10px] mt-1 transition-colors ${
                  isActive ? 'text-primary-600 font-semibold' : 'text-gray-400 font-medium'
                }`}
              >
                {item.label}
              </span>
              {isActive && (
                <div className="w-1 h-1 rounded-full bg-primary-600 mt-0.5" />
              )}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
