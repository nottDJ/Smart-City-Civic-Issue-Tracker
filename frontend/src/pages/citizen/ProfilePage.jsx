import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import { Camera, MapPin, ChevronLeft, UserCircle2, ArrowRight } from 'lucide-react';

export default function ProfilePage() {
    const [myReports, setMyReports] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const userName = user.email ? user.email.split('@')[0] : 'Civic Hero';

    useEffect(() => {
        fetchMyReports();
    }, []);

    const fetchMyReports = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch('http://10.10.64.148:3000/api/reports/me', {
                headers: {
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                }
            });
            const data = await response.json();

            if (data && data.status === 'ok' && Array.isArray(data.reports)) {
                setMyReports(data.reports);
            } else {
                toast.error('Failed to load your personal reports.');
                setMyReports([]);
            }
        } catch (error) {
            console.error('Fetch /api/reports/me failed:', error);
            toast.error('Failed to load your profile.');
            setMyReports([]);
        } finally {
            setIsLoading(false);
        }
    };

    const StatusBadge = ({ status }) => {
        const styles = {
            pending: 'bg-amber-100 text-amber-700 border-amber-200',
            in_progress: 'bg-blue-100 text-blue-700 border-blue-200',
            resolved: 'bg-emerald-100 text-emerald-700 border-emerald-200'
        };
        const activeStyle = styles[status] || styles.pending;
        const displayLabel = status.replace('_', ' ');

        return (
            <span className={`px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-full border ${activeStyle}`}>
                {displayLabel}
            </span>
        );
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-[#FAFAFA] pb-24">
                <div className="bg-[#FAFAFA]/80 backdrop-blur-2xl px-6 py-6 sticky top-0 z-10 border-b border-black/[0.03]">
                    <h1 className="text-3xl font-black text-slate-900 tracking-[-0.04em] max-w-lg mx-auto">My Impact</h1>
                </div>
                <div className="p-4 max-w-lg mx-auto space-y-4">
                    <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100 animate-pulse h-32"></div>
                    <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100 animate-pulse h-48"></div>
                    <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100 animate-pulse h-48"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#FAFAFA] pb-32 overflow-x-hidden font-sans text-slate-900">
            {/* Header */}
            <div className="bg-[#FAFAFA]/80 backdrop-blur-2xl px-5 py-5 sticky top-0 z-10 border-b border-black/[0.03] transition-all flex items-center gap-4">
                <Link to="/citizen/explore" className="w-10 h-10 flex items-center justify-center bg-white border border-slate-200 rounded-2xl text-slate-500 hover:text-slate-900 shadow-sm active:scale-95 transition-all">
                    <ChevronLeft size={20} />
                </Link>
                <h1 className="text-2xl font-black tracking-tight text-slate-900">My Impact</h1>
            </div>

            <div className="p-4 max-w-lg mx-auto pt-6 space-y-6">
                {/* Profile Card */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ type: "spring", stiffness: 300, damping: 24 }}
                    className="bg-white rounded-[2rem] shadow-[0_12px_40px_rgba(0,0,0,0.04)] border border-black/[0.03] p-6 lg:p-8 flex items-center gap-5"
                >
                    <div className="w-16 h-16 rounded-full bg-indigo-50 text-indigo-500 flex items-center justify-center shadow-inner border border-indigo-100">
                        <UserCircle2 size={36} strokeWidth={1.5} />
                    </div>
                    <div>
                        <h2 className="text-xl font-black tracking-[-0.03em] leading-tight text-slate-900 capitalize">{userName}</h2>
                        <p className="text-slate-500 font-medium text-sm mt-0.5">
                            {myReports.length} {myReports.length === 1 ? 'Report' : 'Reports'} Submitted
                        </p>
                    </div>
                </motion.div>

                {/* Feed */}
                <div className="space-y-4">
                    {myReports.length === 0 ? (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-white rounded-[2rem] shadow-sm border border-black/[0.03] p-10 text-center mt-6"
                        >
                            <div className="mx-auto w-16 h-16 bg-slate-50 text-3xl flex items-center justify-center rounded-full mb-4 shadow-inner border border-slate-200/60">
                                🏙️
                            </div>
                            <h3 className="text-xl font-black tracking-tight text-slate-900 mb-2">No reports yet</h3>
                            <p className="text-slate-500 text-sm mb-6 leading-relaxed px-4">You haven't reported any civic issues. Become a hero in your neighborhood today.</p>

                            <Link to="/citizen/report">
                                <motion.button
                                    whileTap={{ scale: 0.95 }}
                                    className="bg-slate-900 hover:bg-black text-white font-bold tracking-wide py-3.5 px-6 rounded-2xl shadow-xl shadow-slate-900/20 transition-colors flex items-center gap-2 mx-auto"
                                >
                                    <span>Create First Report</span>
                                    <ArrowRight size={16} />
                                </motion.button>
                            </Link>
                        </motion.div>
                    ) : (
                        myReports.map((report, idx) => (
                            <motion.div
                                key={report.id}
                                initial={{ opacity: 0, y: 40 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ type: "spring", stiffness: 260, damping: 20, delay: idx * 0.05 }}
                                className="group bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.03)] border border-black/[0.03] overflow-hidden flex flex-col sm:flex-row"
                            >
                                {report.multimedia_urls && report.multimedia_urls[0] ? (
                                    <div className="sm:w-32 h-44 sm:h-auto shrink-0 bg-slate-100 overflow-hidden">
                                        <img src={`http://10.10.64.148:3000${report.multimedia_urls[0]}`} alt="Issue" className="w-full h-full object-cover" />
                                    </div>
                                ) : (
                                    <div className="sm:w-32 h-16 sm:h-auto shrink-0 bg-slate-50 flex items-center justify-center text-slate-300">
                                        <Camera size={24} />
                                    </div>
                                )}

                                <div className="p-5 flex-1 flex flex-col min-w-0 justify-between">
                                    <div>
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
                                                {new Date(report.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                            </span>
                                            <StatusBadge status={report.status} />
                                        </div>
                                        <h3 className="text-lg font-black tracking-[-0.02em] text-slate-900 leading-tight mb-2 line-clamp-2">
                                            {report.title}
                                        </h3>
                                        <span className="inline-block text-[10px] font-bold tracking-wider text-slate-500 uppercase bg-slate-100 px-2 py-1 rounded-md">
                                            {report.category}
                                        </span>
                                    </div>

                                    <div className="mt-4 pt-4 border-t border-black/[0.03] flex items-center gap-2 text-slate-400 text-xs font-bold uppercase tracking-wider">
                                        <span>{report.vouch_count} Vouches</span>
                                    </div>
                                </div>
                            </motion.div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
