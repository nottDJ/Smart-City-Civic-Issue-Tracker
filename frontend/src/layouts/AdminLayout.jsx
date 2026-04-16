import { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { BarChart3, LogOut, Building2, Menu, X } from 'lucide-react'

export default function AdminLayout() {
    const navigate = useNavigate();
    const [menuOpen, setMenuOpen] = useState(false);

    const handleLogout = () => {
        localStorage.clear();
        navigate('/login');
    };

    return (
        <div className="min-h-screen bg-slate-100">
            {/* Top Navigation */}
            <header className="bg-slate-900 text-white px-4 md:px-6 py-3 shadow-lg sticky top-0 z-10">
                <div className="max-w-screen-2xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Building2 size={22} className="text-indigo-400" />
                        <div>
                            <span className="font-bold text-sm">CivicReport</span>
                            <span className="ml-2 text-xs bg-indigo-600 text-white px-2 py-0.5 rounded-full">Admin</span>
                        </div>
                    </div>

                    {/* Desktop nav (removed City Dashboard btn) */}
                    <nav className="hidden md:flex items-center gap-1">
                    </nav>

                    <div className="flex items-center gap-2">
                        <button onClick={handleLogout} className="hidden md:flex items-center gap-2 text-slate-400 hover:text-white text-sm transition-colors">
                            <LogOut size={16} />
                            <span>Sign Out</span>
                        </button>

                        {/* Mobile hamburger */}
                        <button
                            className="md:hidden text-slate-400 hover:text-white p-1"
                            onClick={() => setMenuOpen(!menuOpen)}
                        >
                            {menuOpen ? <X size={22} /> : <Menu size={22} />}
                        </button>
                    </div>
                </div>

                {/* Mobile dropdown menu */}
                {menuOpen && (
                    <div className="md:hidden mt-3 border-t border-slate-700 pt-3 pb-1 space-y-1">
                        <button
                            onClick={handleLogout}
                            className="flex items-center gap-2 px-4 py-2.5 w-full text-left rounded-lg text-sm text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
                        >
                            <LogOut size={16} />
                            <span>Sign Out</span>
                        </button>
                    </div>
                )}
            </header>

            {/* Wide Content — responsive padding */}
            <main className="max-w-screen-2xl mx-auto px-4 md:px-6 py-4 md:py-6">
                <Outlet />
            </main>
        </div>
    )
}
