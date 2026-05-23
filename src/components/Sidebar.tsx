import React, { useState } from 'react';
import {
  LayoutDashboard,
  UserCircle,
  Settings,
  LogOut,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';


interface SidebarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentPage, onNavigate }) => {
  const [isOpen, setIsOpen] = useState(() => window.innerWidth >= 768);

  const menuItems = [
    { icon: LayoutDashboard, label: 'Dashboard', id: 'dashboard' },
    { icon: CheckSquare, label: 'Tasks', id: 'tasks' },
    { icon: UserCircle, label: 'Profile', id: 'profile' },
    { icon: Settings, label: 'Settings', id: 'settings' },
  ];

  return (
    <div
      className={`relative flex flex-col h-full bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transition-all duration-300 ease-in-out ${
        isOpen ? 'w-64' : 'w-16'
      }`}
    >
      {/* Toggle button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="absolute -right-3 top-8 z-10 w-6 h-6 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-center justify-center shadow-sm hover:shadow-md transition-shadow text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
      >
        {isOpen ? <ChevronLeft size={12} /> : <ChevronRight size={12} />}
      </button>

      {/* Header */}
      <div className={`px-4 mb-8 mt-8 overflow-hidden`}>
        {isOpen ? (
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white whitespace-nowrap">
            Task Manager
          </h1>
        ) : (
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center mx-auto">
            <CheckSquare className="w-4 h-4 text-white" />
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2">
        <ul className="space-y-1">
          {menuItems.map((item) => (
            <li key={item.id}>
              <button
                onClick={() => onNavigate(item.id)}
                title={!isOpen ? item.label : undefined}
                className={`w-full flex items-center py-2 text-sm rounded-lg transition-colors ${
                  isOpen ? 'px-4' : 'px-0 justify-center'
                } ${
                  currentPage === item.id
                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                <item.icon className={`w-5 h-5 shrink-0 ${isOpen ? 'mr-3' : ''}`} />
                {isOpen && <span className="whitespace-nowrap">{item.label}</span>}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {/* Footer */}
      <div className={`mt-auto space-y-4 px-2 pb-8`}>

        <button
          onClick={() => onNavigate('logout')}
          title={!isOpen ? 'Logout' : undefined}
          className={`w-full flex items-center py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors ${
            isOpen ? 'px-4' : 'px-0 justify-center'
          }`}
        >
          <LogOut className={`w-5 h-5 shrink-0 ${isOpen ? 'mr-3' : ''}`} />
          {isOpen && <span className="whitespace-nowrap">Logout</span>}
        </button>
      </div>
    </div>
  );
};
