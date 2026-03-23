import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { LayoutDashboard, LogOut, ShieldCheck } from 'lucide-react'

export default function OfficerLayout() {
    const navigate = useNavigate();

    const handleLogout = () => {
        localStorage.clear();
        navigate('/login');
    };

    return (
        <div className="flex h-screen bg-slate-100 overflow-hidden">
            {/* Sidebar */}
            <aside className="w-56 bg-slate-900 text-white flex flex-col flex-shrink-0">
                <div className="px-5 py-5 border-b border-slate-700">
                    <div className="flex items-center gap-2">
                        <ShieldCheck size={22} className="text-indigo-400" />
                        <div>
                            <h1 className="text-sm font-bold">CivicReport</h1>
                            <p className="text-xs text-slate-400">Officer Dashboard</p>
                        </div>
                    </div>
                </div>

                <nav className="flex-1 px-3 py-4 space-y-1">
                    <NavLink
                        to="/officer/dashboard"
                        className={({ isActive }) =>
                            `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${isActive
                                ? 'bg-indigo-600 text-white'
                                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                            }`
                        }
                    >
                        <LayoutDashboard size={18} />
                        <span>Inbox & Priority</span>
                    </NavLink>
                </nav>

                <div className="px-3 py-4 border-t border-slate-700">
                    <button onClick={handleLogout} className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-sm text-slate-400 hover:bg-slate-800 hover:text-white transition-colors">
                        <LogOut size={18} />
                        <span>Sign Out</span>
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-hidden">
                <Outlet />
            </main>
        </div>
    )
}
