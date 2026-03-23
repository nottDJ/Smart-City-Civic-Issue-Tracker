import { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { PlusCircle, Map, LogOut } from 'lucide-react'
import { motion, useScroll, useMotionValueEvent } from 'framer-motion'

export default function CitizenLayout() {
    const navigate = useNavigate()
    const [hidden, setHidden] = useState(false)
    const { scrollY } = useScroll()

    useMotionValueEvent(scrollY, "change", (latest) => {
        const previous = scrollY.getPrevious()
        if (latest > previous && latest > 150) {
            setHidden(true)
        } else {
            setHidden(false)
        }
    })

    const handleLogout = () => {
        localStorage.clear()
        navigate('/login')
    }

    return (
        <div className="flex flex-col min-h-screen bg-[#FAFAFA] font-sans text-slate-900 selection:bg-indigo-500/30">
            {/* Top Header - Ultra Glassmorphic */}
            <header className="bg-white/60 backdrop-blur-2xl border-b border-black/[0.03] px-5 py-4 sticky top-0 z-30 transition-all">
                <div className="flex items-center justify-between max-w-lg mx-auto">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-slate-800 to-black flex items-center justify-center text-white shadow-xl shadow-black/10">
                            <span className="text-xl leading-none">🏛️</span>
                        </div>
                        <div className="flex flex-col">
                            <h1 className="text-[19px] font-black tracking-[-0.04em] text-slate-900 leading-none">CivicReport</h1>
                            <p className="text-[10px] font-bold tracking-widest uppercase text-slate-400 mt-1">Citizen Portal</p>
                        </div>
                    </div>

                    {/* Minimalist Logout */}
                    <button
                        onClick={handleLogout}
                        className="w-10 h-10 flex items-center justify-center rounded-2xl hover:bg-black/5 text-slate-400 hover:text-slate-900 transition-colors"
                        title="Sign Out"
                    >
                        <LogOut size={18} strokeWidth={2.5} />
                    </button>
                </div>
            </header>

            {/* Page Content */}
            <main className="flex-1 pb-32">
                <Outlet />
            </main>

            {/* Stark Black Floating Dynamic Dock */}
            <div className="fixed bottom-6 inset-x-0 z-40 pointer-events-none flex justify-center px-4">
                <motion.nav
                    variants={{
                        visible: { y: 0, opacity: 1, scale: 1 },
                        hidden: { y: 120, opacity: 0, scale: 0.9 }
                    }}
                    animate={hidden ? "hidden" : "visible"}
                    transition={{ type: "spring", stiffness: 260, damping: 20 }}
                    className="pointer-events-auto flex items-center bg-slate-950/90 backdrop-blur-3xl border border-white/10 shadow-[0_20px_40px_rgba(0,0,0,0.25)] rounded-[2rem] p-1.5 w-full max-w-[320px]"
                >
                    <NavLink
                        to="/citizen/report"
                        className={({ isActive }) =>
                            `flex-1 relative flex flex-col items-center justify-center gap-1 py-3 text-[10px] font-bold uppercase tracking-wider transition-colors duration-500 rounded-3xl ${isActive ? 'text-white bg-white/10' : 'text-slate-400 hover:text-slate-200'}`
                        }
                    >
                        {({ isActive }) => (
                            <motion.div whileTap={{ scale: 0.85 }} className="flex flex-col items-center gap-1 w-full relative">
                                <PlusCircle size={22} strokeWidth={isActive ? 2.5 : 2} className={`transition-transform duration-500 ${isActive ? 'scale-110 text-indigo-400 drop-shadow-[0_0_8px_rgba(129,140,248,0.5)]' : ''}`} />
                                <span>Report</span>
                            </motion.div>
                        )}
                    </NavLink>

                    <NavLink
                        to="/citizen/explore"
                        className={({ isActive }) =>
                            `flex-1 relative flex flex-col items-center justify-center gap-1 py-3 text-[10px] font-bold uppercase tracking-wider transition-colors duration-500 rounded-3xl ${isActive ? 'text-white bg-white/10' : 'text-slate-400 hover:text-slate-200'}`
                        }
                    >
                        {({ isActive }) => (
                            <motion.div whileTap={{ scale: 0.85 }} className="flex flex-col items-center gap-1 w-full relative">
                                <Map size={22} strokeWidth={isActive ? 2.5 : 2} className={`transition-transform duration-500 ${isActive ? 'scale-110 text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.5)]' : ''}`} />
                                <span>Explore</span>
                            </motion.div>
                        )}
                    </NavLink>
                </motion.nav>
            </div>
        </div>
    )
}
