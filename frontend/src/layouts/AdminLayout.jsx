import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { BarChart3, LogOut, Building2 } from 'lucide-react'

export default function AdminLayout() {
    const navigate = useNavigate();

    const handleLogout = () => {
        localStorage.clear();
        navigate('/login');
    };

    return (
        <div className="min-h-screen bg-slate-100">
            {/* Top Navigation */}
            <header className="bg-slate-900 text-white px-6 py-3 shadow-lg sticky top-0 z-10">
                <div className="max-w-screen-2xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Building2 size={22} className="text-indigo-400" />
                        <div>
                            <span className="font-bold text-sm">CivicReport</span>
                            <span className="ml-2 text-xs bg-indigo-600 text-white px-2 py-0.5 rounded-full">Admin</span>
                        </div>
                    </div>

                    <nav className="flex items-center gap-1">
                        <NavLink
                            to="/admin/dashboard"
                            className={({ isActive }) =>
                                `flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${isActive ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-800'
                                }`
                            }
                        >
                            <BarChart3 size={16} />
                            <span>City Dashboard</span>
                        </NavLink>
                    </nav>

                    <button onClick={handleLogout} className="flex items-center gap-2 text-slate-400 hover:text-white text-sm transition-colors">
                        <LogOut size={16} />
                        <span>Sign Out</span>
                    </button>
                </div>
            </header>

            {/* Wide Content */}
            <main className="max-w-screen-2xl mx-auto px-6 py-6">
                <Outlet />
            </main>
        </div>
    )
}
