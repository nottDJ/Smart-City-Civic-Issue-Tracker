import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import { Camera, MapPin, ChevronLeft, UserCircle2, ArrowRight, Heart, FileText } from 'lucide-react';
import { BACKEND_URL } from '../../config';

export default function ProfilePage() {
    const [myReports, setMyReports] = useState([]);
    const [vouchedReports, setVouchedReports] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('reported');
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const userName = user.full_name || (user.email ? user.email.split('@')[0] : 'Civic Hero');

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const token = localStorage.getItem('token');
            const headers = {
                ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            };

            // Fetch reports created by user
            const [reportsRes, vouchesRes] = await Promise.all([
                fetch(`${BACKEND_URL}/api/reports/me`, { headers }),
                fetch(`${BACKEND_URL}/api/reports/my-vouches`, { headers })
            ]);

            const reportsData = await reportsRes.json();
            if (reportsData && reportsData.status === 'ok' && Array.isArray(reportsData.reports)) {
                setMyReports(reportsData.reports);
            }

            const vouchesData = await vouchesRes.json();
            if (vouchesData && vouchesData.status === 'ok' && Array.isArray(vouchesData.reports)) {
                setVouchedReports(vouchesData.reports);
            }
        } catch (error) {
            console.error('Fetch profile data failed:', error);
            toast.error('Failed to load your profile.');
        } finally {
            setIsLoading(false);
        }
    };

    const StatusBadge = ({ status }) => {
        const styles = {
            pending: 'bg-amber-100 text-amber-700 border-amber-200',
            in_progress: 'bg-blue-100 text-blue-700 border-blue-200',
            resolved: 'bg-emerald-100 text-emerald-700 border-emerald-200',
            rejected: 'bg-red-100 text-red-700 border-red-200'
        };
        const activeStyle = styles[status] || styles.pending;
        const displayLabel = (status || 'pending').replace('_', ' ');

        return (
            <span className={`px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-full border ${activeStyle}`}>
                {displayLabel}
            </span>
        );
    };

    const totalImpact = myReports.length + vouchedReports.length;
    const totalVouches = myReports.reduce((sum, r) => sum + (r.vouch_count || 0), 0);
    const resolvedCount = myReports.filter(r => r.status === 'resolved').length;

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

    const displayReports = activeTab === 'reported' ? myReports : vouchedReports;

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
                    className="bg-white rounded-[2rem] shadow-[0_12px_40px_rgba(0,0,0,0.04)] border border-black/[0.03] p-6 lg:p-8"
                >
                    <div className="flex items-center gap-5 mb-5">
                        <div className="w-16 h-16 rounded-full bg-indigo-50 text-indigo-500 flex items-center justify-center shadow-inner border border-indigo-100">
                            <UserCircle2 size={36} strokeWidth={1.5} />
                        </div>
                        <div>
                            <h2 className="text-xl font-black tracking-[-0.03em] leading-tight text-slate-900 capitalize">{userName}</h2>
                            <p className="text-slate-500 font-medium text-sm mt-0.5">
                                {totalImpact} Total Impact Actions
                            </p>
                        </div>
                    </div>

                    {/* Stats row */}
                    <div className="grid grid-cols-3 gap-3">
                        <div className="bg-slate-50 rounded-2xl p-3 text-center border border-black/[0.02]">
                            <p className="text-2xl font-black text-slate-900">{myReports.length}</p>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-1">Reported</p>
                        </div>
                        <div className="bg-slate-50 rounded-2xl p-3 text-center border border-black/[0.02]">
                            <p className="text-2xl font-black text-indigo-600">{vouchedReports.length}</p>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-1">Vouched</p>
                        </div>
                        <div className="bg-slate-50 rounded-2xl p-3 text-center border border-black/[0.02]">
                            <p className="text-2xl font-black text-emerald-600">{resolvedCount}</p>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-1">Resolved</p>
                        </div>
                    </div>
                </motion.div>

                {/* Tab Switcher */}
                <div className="flex bg-white rounded-2xl p-1.5 border border-slate-200 shadow-sm">
                    <button
                        onClick={() => setActiveTab('reported')}
                        className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all ${
                            activeTab === 'reported'
                                ? 'bg-slate-900 text-white shadow-lg'
                                : 'text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        <FileText size={16} />
                        My Reports ({myReports.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('vouched')}
                        className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all ${
                            activeTab === 'vouched'
                                ? 'bg-slate-900 text-white shadow-lg'
                                : 'text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        <Heart size={16} />
                        Vouched For ({vouchedReports.length})
                    </button>
                </div>

                {/* Feed */}
                <div className="space-y-4">
                    {displayReports.length === 0 ? (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-white rounded-[2rem] shadow-sm border border-black/[0.03] p-10 text-center mt-6"
                        >
                            <div className="mx-auto w-16 h-16 bg-slate-50 text-3xl flex items-center justify-center rounded-full mb-4 shadow-inner border border-slate-200/60">
                                {activeTab === 'reported' ? '🏙️' : '🤝'}
                            </div>
                            <h3 className="text-xl font-black tracking-tight text-slate-900 mb-2">
                                {activeTab === 'reported' ? 'No reports yet' : 'No vouches yet'}
                            </h3>
                            <p className="text-slate-500 text-sm mb-6 leading-relaxed px-4">
                                {activeTab === 'reported'
                                    ? "You haven't reported any civic issues. Become a hero in your neighborhood today."
                                    : "You haven't vouched for any issues yet. Head to Explore to support your community."
                                }
                            </p>

                            <Link to={activeTab === 'reported' ? '/citizen/report' : '/citizen/explore'}>
                                <motion.button
                                    whileTap={{ scale: 0.95 }}
                                    className="bg-slate-900 hover:bg-black text-white font-bold tracking-wide py-3.5 px-6 rounded-2xl shadow-xl shadow-slate-900/20 transition-colors flex items-center gap-2 mx-auto"
                                >
                                    <span>{activeTab === 'reported' ? 'Create First Report' : 'Explore Issues'}</span>
                                    <ArrowRight size={16} />
                                </motion.button>
                            </Link>
                        </motion.div>
                    ) : (
                        displayReports.map((report, idx) => (
                            <motion.div
                                key={report.id}
                                initial={{ opacity: 0, y: 40 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ type: "spring", stiffness: 260, damping: 20, delay: idx * 0.05 }}
                                className="group bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.03)] border border-black/[0.03] overflow-hidden flex flex-col sm:flex-row"
                            >
                                {report.multimedia_urls && report.multimedia_urls[0] ? (
                                    <div className="sm:w-32 h-44 sm:h-auto shrink-0 bg-slate-100 overflow-hidden">
                                        <img src={`${BACKEND_URL}${report.multimedia_urls[0]}`} alt="Issue" className="w-full h-full object-cover" />
                                    </div>
                                ) : (
                                    <div className="sm:w-32 h-16 sm:h-auto shrink-0 bg-slate-50 flex items-center justify-center text-slate-300">
                                        <Camera size={24} />
                                    </div>
                                )}

                                <div className="p-5 flex-1 flex flex-col min-w-0 justify-between">
                                    <div>
                                        <div className="flex justify-between items-start mb-2 flex-wrap gap-2">
                                            <span className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
                                                {new Date(report.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                            </span>
                                            <StatusBadge status={report.status} />
                                        </div>
                                        <h3 className="text-lg font-black tracking-[-0.02em] text-slate-900 leading-tight mb-2 line-clamp-2">
                                            {report.title}
                                        </h3>
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="inline-block text-[10px] font-bold tracking-wider text-slate-500 uppercase bg-slate-100 px-2 py-1 rounded-md">
                                                {report.category}
                                            </span>
                                            {report.department_name && (
                                                <span className="inline-block text-[10px] font-bold tracking-wider text-indigo-600 uppercase bg-indigo-50 px-2 py-1 rounded-md">
                                                    {report.department_name}
                                                </span>
                                            )}
                                            {activeTab === 'vouched' && (
                                                <span className="inline-block text-[10px] font-bold tracking-wider text-pink-600 uppercase bg-pink-50 px-2 py-1 rounded-md">
                                                    ♥ Vouched
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="mt-4 pt-4 border-t border-black/[0.03] flex items-center gap-2 text-slate-400 text-xs font-bold uppercase tracking-wider">
                                        <span>🔥 {report.vouch_count} Vouches</span>
                                        {report.severity && (
                                            <>
                                                <span className="text-slate-300">·</span>
                                                <span className={`capitalize ${
                                                    report.severity === 'critical' ? 'text-red-500' :
                                                    report.severity === 'high' ? 'text-orange-500' :
                                                    report.severity === 'medium' ? 'text-yellow-600' :
                                                    'text-blue-500'
                                                }`}>{report.severity}</span>
                                            </>
                                        )}
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
