import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import {
    UserCircle2, X, MapPin, Zap, Clock, Users,
    ChevronRight, Image as ImageIcon, Sparkles
} from 'lucide-react';
import { BACKEND_URL } from '../../config';

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(dateStr) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
}

const severityConfig = {
    critical: { bg: 'bg-red-100', text: 'text-red-700', dot: 'bg-red-500' },
    high: { bg: 'bg-orange-100', text: 'text-orange-700', dot: 'bg-orange-500' },
    medium: { bg: 'bg-yellow-100', text: 'text-yellow-700', dot: 'bg-yellow-500' },
    low: { bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500' },
};

const scoreTextClass = s => s >= 75 ? 'text-red-500' : s >= 50 ? 'text-amber-500' : 'text-emerald-500';
const scoreBgClass = s => s >= 75 ? 'bg-red-500' : s >= 50 ? 'bg-amber-400' : 'bg-emerald-400';

// ── Detail Modal ──────────────────────────────────────────────────────────────

function ReportDetailModal({ report, onClose, categories, onVouch }) {
    if (!report) return null;

    const sev = severityConfig[report.severity] || severityConfig.low;
    const score = report.priority_score ?? 0;
    const mediaUrl = report.multimedia_urls?.[0]
        ? `${BACKEND_URL}${report.multimedia_urls[0]}`
        : null;

    // Parse GeoJSON location
    let lat = null, lng = null;
    if (report.location) {
        if (report.location.coordinates) {
            lng = report.location.coordinates[0];
            lat = report.location.coordinates[1];
        } else if (report.location.latitude) {
            lat = report.location.latitude;
            lng = report.location.longitude;
        }
    }

    return (
        <AnimatePresence>
            <motion.div
                key="modal-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
                onClick={onClose}
            />
            <motion.div
                key="modal-content"
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                className="fixed inset-x-0 bottom-0 z-50 max-h-[92vh] bg-[#FAFAFA] rounded-t-[2rem] overflow-y-auto overscroll-contain shadow-2xl md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-[2rem] md:max-w-xl md:w-full md:max-h-[85vh]"
                onClick={e => e.stopPropagation()}
            >
                {/* Drag handle (mobile) */}
                <div className="sticky top-0 z-10 bg-[#FAFAFA] pt-3 pb-2 flex justify-center md:hidden">
                    <div className="w-10 h-1 bg-slate-300 rounded-full" />
                </div>

                {/* Close button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 z-20 bg-white/80 backdrop-blur border border-slate-200 rounded-full p-2 text-slate-500 hover:text-slate-800 hover:bg-white transition-all shadow-sm"
                >
                    <X size={18} />
                </button>

                <div className="px-5 pb-8 space-y-5 pt-1 md:pt-5">

                    {/* ── Badges row ─────────────────────────────────── */}
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-900 bg-slate-100 px-3 py-1.5 rounded-full">
                            {categories.find(c => c.value === report.category)?.label || report.category}
                        </span>
                        <span className={`text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-full ${
                            report.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                            report.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                            report.status === 'resolved' ? 'bg-emerald-100 text-emerald-800' :
                            report.status === 'rejected' ? 'bg-red-100 text-red-800' :
                            'bg-slate-100 text-slate-800'
                        }`}>
                            {report.status ? report.status.replace('_', ' ') : 'Pending'}
                        </span>
                        {report.severity && (
                            <span className={`text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-full flex items-center gap-1.5 ${sev.bg} ${sev.text}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${sev.dot}`} />
                                {report.severity}
                            </span>
                        )}
                        <span className="text-[11px] font-bold tracking-wide text-slate-400 uppercase ml-auto">
                            {timeAgo(report.created_at)}
                        </span>
                    </div>

                    {/* ── Title & Description ──────────────────────── */}
                    <div>
                        <h2 className="text-xl font-black tracking-[-0.03em] text-slate-900 leading-tight">
                            {report.title}
                        </h2>
                        {report.description && (
                            <p className="text-sm text-slate-500 mt-2 leading-relaxed">
                                {report.description}
                            </p>
                        )}
                    </div>

                    {/* ── Media ────────────────────────────────────── */}
                    {mediaUrl ? (
                        <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-sm bg-white">
                            <img
                                src={mediaUrl}
                                alt="Evidence"
                                className="w-full max-h-64 object-cover"
                                onError={e => { e.currentTarget.style.display = 'none' }}
                            />
                        </div>
                    ) : (
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex items-center gap-3 text-slate-400">
                            <ImageIcon size={18} />
                            <p className="text-sm">No evidence media submitted</p>
                        </div>
                    )}

                    {/* ── AI Priority Score ────────────────────────── */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                        <div className="flex items-center gap-2 mb-4">
                            <Zap size={16} className="text-indigo-500" />
                            <h3 className="font-bold text-slate-700 text-xs uppercase tracking-wide">AI Priority Score</h3>
                        </div>

                        <div className="flex items-end gap-3 mb-3">
                            <span className={`text-5xl font-black leading-none tabular-nums ${scoreTextClass(score)}`}>
                                {score}
                            </span>
                            <div className="pb-1">
                                <span className="text-xl font-light text-slate-400">/ 100</span>
                            </div>
                        </div>

                        <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                                className={`h-full rounded-full transition-all duration-700 ${scoreBgClass(score)}`}
                                style={{ width: `${score}%` }}
                            />
                        </div>
                        <div className="flex justify-between text-[10px] text-slate-400 mt-1.5 font-medium">
                            <span>0 — Low</span>
                            <span>50 — Medium</span>
                            <span>100 — Critical</span>
                        </div>
                    </div>

                    {/* ── Department ───────────────────────────────── */}
                    {report.department_name && (
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex items-center gap-3">
                            <div className="bg-indigo-50 rounded-xl p-2.5">
                                <Sparkles size={16} className="text-indigo-500" />
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Routed to Department</p>
                                <p className="text-sm font-bold text-slate-800">{report.department_name}</p>
                            </div>
                        </div>
                    )}

                    {/* ── Location ─────────────────────────────────── */}
                    {(report.address_text || lat !== null) && (
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                            <div className="flex items-center gap-2 mb-3">
                                <MapPin size={15} className="text-emerald-500" />
                                <h3 className="font-bold text-slate-700 text-xs uppercase tracking-wide">Location</h3>
                            </div>
                            {report.address_text && (
                                <p className="text-sm text-slate-600 leading-relaxed mb-3">{report.address_text}</p>
                            )}
                            {lat !== null && (
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-slate-50 rounded-xl px-3 py-2.5">
                                        <p className="text-[10px] text-slate-400 mb-0.5">Latitude</p>
                                        <p className="font-mono text-sm font-semibold text-slate-700">
                                            {parseFloat(lat).toFixed(6)}
                                        </p>
                                    </div>
                                    <div className="bg-slate-50 rounded-xl px-3 py-2.5">
                                        <p className="text-[10px] text-slate-400 mb-0.5">Longitude</p>
                                        <p className="font-mono text-sm font-semibold text-slate-700">
                                            {parseFloat(lng).toFixed(6)}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── Vouch section ────────────────────────────── */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="bg-indigo-50 rounded-full p-2">
                                    <Users size={16} className="text-indigo-500" />
                                </div>
                                <div>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Community Vouches</p>
                                    <p className="text-2xl font-black text-slate-900 tabular-nums leading-none mt-0.5">{report.vouch_count ?? 0}</p>
                                </div>
                            </div>
                            <motion.button
                                whileTap={!report.hasVouched ? { scale: 0.92 } : {}}
                                onClick={() => onVouch(report.id)}
                                disabled={report.hasVouched}
                                className={`px-5 py-3 rounded-2xl font-bold text-[12px] uppercase tracking-wider transition-colors shadow-lg ${report.hasVouched
                                    ? 'bg-slate-50 text-emerald-600 border border-emerald-500/20 shadow-none cursor-not-allowed'
                                    : 'bg-slate-900 text-white shadow-slate-900/20 hover:bg-black'
                                }`}
                            >
                                {report.hasVouched ? '✓ Vouched' : 'Vouch It'}
                            </motion.button>
                        </div>
                    </div>

                    {/* ── Reported time ────────────────────────────── */}
                    <div className="flex items-center gap-2 text-xs text-slate-400 justify-center pb-2">
                        <Clock size={12} />
                        <span>Reported {new Date(report.created_at).toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>
    );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ExploreIssuesPage() {
    const [issues, setIssues] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeCategory, setActiveCategory] = useState('all');
    const [sortBy, setSortBy] = useState('newest');
    const [selectedIssue, setSelectedIssue] = useState(null);

    const CATEGORIES = [
        { label: 'All', value: 'all' },
        { label: 'Pothole / Road Damage', value: 'pothole' },
        { label: 'Streetlight Outage', value: 'street_light' },
        { label: 'Garbage / Sanitation', value: 'garbage' },
        { label: 'Water Leakage / Pipe Burst', value: 'water_leak' },
        { label: 'Encroachment', value: 'encroachment' },
        { label: 'Sewage Overflow', value: 'sewage' },
        { label: 'Illegal Construction', value: 'illegal_construction' },
        { label: 'Noise Pollution', value: 'noise_pollution' },
        { label: 'Fallen Tree / Branch', value: 'tree_hazard' },
        { label: 'Other', value: 'other' }
    ];

    useEffect(() => {
        fetchIssues();
    }, []);

    const fetchIssues = async () => {
        try {
            const response = await fetch(`${BACKEND_URL}/api/reports`);
            const data = await response.json();

            if (data && data.status === 'ok' && Array.isArray(data.reports)) {
                setIssues(data.reports);
            } else if (Array.isArray(data)) {
                setIssues(data);
            } else {
                console.error('Backend returned an error instead of expected array format:', data);
                toast.error('Failed to load issues.');
                setIssues([]);
            }
        } catch (error) {
            console.error('ExploreIssues GET request failed:', error);
            toast.error('Failed to load issues.');
            setIssues([]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleVouch = async (id) => {
        const token = localStorage.getItem('token');
        if (!token) {
            toast.error('You must be logged in to vouch!');
            return;
        }

        setIssues(prevIssues => prevIssues.map(issue =>
            issue.id === id ? { ...issue, vouch_count: issue.vouch_count + 1, hasVouched: true } : issue
        ));
        if (selectedIssue?.id === id) {
            setSelectedIssue(prev => ({ ...prev, vouch_count: prev.vouch_count + 1, hasVouched: true }));
        }

        try {
            const response = await fetch(`${BACKEND_URL}/api/reports/${id}/vouch`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                toast.success('Vouch recorded! AI Priority increased.', { icon: '🔥' });
            } else {
                setIssues(prevIssues => prevIssues.map(issue =>
                    issue.id === id ? { ...issue, vouch_count: Math.max(0, issue.vouch_count - 1), hasVouched: false } : issue
                ));
                if (selectedIssue?.id === id) {
                    setSelectedIssue(prev => ({ ...prev, vouch_count: Math.max(0, prev.vouch_count - 1), hasVouched: false }));
                }
                toast.error('You have already vouched for this issue.');
            }
        } catch (error) {
            setIssues(prevIssues => prevIssues.map(issue =>
                issue.id === id ? { ...issue, vouch_count: Math.max(0, issue.vouch_count - 1), hasVouched: false } : issue
            ));
            if (selectedIssue?.id === id) {
                setSelectedIssue(prev => ({ ...prev, vouch_count: Math.max(0, prev.vouch_count - 1), hasVouched: false }));
            }
            toast.error('Network error. Could not record vouch.');
        }
    };

    const filteredAndSortedIssues = useMemo(() => {
        let result = issues;
        if (activeCategory !== 'all') {
            result = result.filter(issue => issue.category === activeCategory);
        }
        
        return [...result].sort((a, b) => {
            if (sortBy === 'newest') {
                return new Date(b.created_at) - new Date(a.created_at);
            } else if (sortBy === 'priority') {
                return (b.priority_score ?? b.vouch_count) - (a.priority_score ?? a.vouch_count);
            }
            return 0;
        });
    }, [issues, activeCategory, sortBy]);

    // Lock body scroll when modal is open
    useEffect(() => {
        if (selectedIssue) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => { document.body.style.overflow = ''; };
    }, [selectedIssue]);

    if (isLoading) {
        return (
            <div className="min-h-screen bg-[#FAFAFA] pb-20">
                <div className="bg-[#FAFAFA]/80 backdrop-blur-2xl px-6 py-6 sticky top-0 z-10 border-b border-black/[0.03]">
                    <div className="max-w-lg mx-auto flex items-center justify-between">
                        <h1 className="text-3xl font-black text-slate-900 tracking-[-0.04em]">Local Issues</h1>
                        <Link to="/citizen/profile" className="w-10 h-10 flex items-center justify-center bg-white border border-slate-200 rounded-2xl text-slate-500 hover:text-indigo-600 hover:border-indigo-200 shadow-sm transition-all active:scale-95">
                            <UserCircle2 size={22} />
                        </Link>
                    </div>
                </div>
                <div className="p-4 space-y-6 max-w-lg mx-auto pt-6">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden animate-pulse">
                            <div className="w-full h-56 bg-slate-200/60"></div>
                            <div className="p-6">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="h-6 w-24 bg-slate-200/80 rounded-full"></div>
                                    <div className="h-4 w-16 bg-slate-200/80 rounded-lg"></div>
                                </div>
                                <div className="h-8 w-3/4 bg-slate-200/80 rounded-lg mb-6"></div>
                                <div className="flex items-center justify-between border-t border-slate-100 pt-5">
                                    <div className="h-10 w-20 bg-slate-200/80 rounded-xl"></div>
                                    <div className="h-12 w-32 bg-slate-200/80 rounded-2xl"></div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (!isLoading && issues.length === 0) {
        return (
            <div className="min-h-screen bg-[#FAFAFA] pb-20 overflow-x-hidden">
                <div className="bg-[#FAFAFA]/80 backdrop-blur-2xl px-6 py-6 sticky top-0 z-10 border-b border-black/[0.03]">
                    <div className="max-w-lg mx-auto flex items-center justify-between">
                        <h1 className="text-3xl font-black text-slate-900 tracking-[-0.04em]">Local Issues</h1>
                        <Link to="/citizen/profile" className="w-10 h-10 flex items-center justify-center bg-white border border-slate-200 rounded-2xl text-slate-500 hover:text-indigo-600 hover:border-indigo-200 shadow-sm transition-all active:scale-95">
                            <UserCircle2 size={22} />
                        </Link>
                    </div>
                </div>
                <div className="px-4 py-12 max-w-lg mx-auto">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        transition={{ type: "spring", stiffness: 300, damping: 24 }}
                        className="bg-white rounded-[2rem] shadow-[0_20px_40px_rgba(0,0,0,0.03)] border border-black/[0.03] p-12 text-center"
                    >
                        <div className="bg-slate-50 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 text-5xl shadow-inner border border-black/[0.02]">
                            🌍
                        </div>
                        <h2 className="text-2xl font-black tracking-[-0.03em] text-slate-900 mb-2">No issues found</h2>
                        <p className="text-slate-500 font-medium text-sm leading-relaxed">Your neighborhood is completely clear. Enjoy the peace, or be the first to report something!</p>
                    </motion.div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#FAFAFA] pb-20 overflow-x-hidden">
            <div className="bg-[#FAFAFA]/80 backdrop-blur-2xl sticky top-0 z-10 border-b border-black/[0.03]">
                <div className="px-6 py-4">
                    <div className="max-w-lg mx-auto flex items-center justify-between">
                        <h1 className="text-3xl font-black text-slate-900 tracking-[-0.04em]">Local Issues</h1>
                        <Link to="/citizen/profile" className="w-10 h-10 flex items-center justify-center bg-white border border-slate-200 rounded-2xl text-slate-500 hover:text-indigo-600 hover:border-indigo-200 shadow-sm transition-all active:scale-95">
                            <UserCircle2 size={22} />
                        </Link>
                    </div>
                </div>
                
                <div className="px-6 pb-4">
                    <div className="max-w-lg mx-auto flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
                        <div className="flex w-full overflow-x-auto gap-2 pb-1 sm:pb-0 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                            {CATEGORIES.map(category => (
                                <button
                                    key={category.value}
                                    onClick={() => setActiveCategory(category.value)}
                                    className={`shrink-0 px-4 py-2 rounded-full text-sm font-bold transition-all ${
                                        activeCategory === category.value
                                            ? 'bg-indigo-600 text-white shadow-md'
                                            : 'bg-white text-slate-600 border border-slate-200 hover:border-indigo-200 hover:bg-slate-50'
                                    }`}
                                >
                                    {category.label}
                                </button>
                            ))}
                        </div>
                        <div className="shrink-0 flex items-center self-end sm:self-auto">
                            <select
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value)}
                                className="appearance-none bg-white border border-slate-200 text-slate-700 py-2 pl-4 pr-10 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all cursor-pointer shadow-sm"
                                style={{
                                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
                                    backgroundRepeat: 'no-repeat',
                                    backgroundPosition: 'right 0.5rem center',
                                    backgroundSize: '1.2em'
                                }}
                            >
                                <option value="newest">Newest First</option>
                                <option value="priority">Highest Priority</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            <div className="p-4 space-y-6 max-w-lg mx-auto pt-6">
                {filteredAndSortedIssues.length === 0 && (
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="text-center py-12 bg-white rounded-[2rem] border border-black/[0.03] shadow-[0_8px_30px_rgb(0,0,0,0.03)]"
                    >
                        <div className="text-4xl mb-4">🔍</div>
                        <h3 className="text-xl font-bold text-slate-900 mb-2">No matching issues</h3>
                        <p className="text-slate-500 font-medium text-sm">Try clearing your filters.</p>
                        <button
                            onClick={() => { setActiveCategory('all'); setSortBy('newest'); }}
                            className="mt-6 px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-sm transition-colors active:scale-95"
                        >
                            Reset Filters
                        </button>
                    </motion.div>
                )}
                {filteredAndSortedIssues.map((issue, idx) => {

                    const sev = severityConfig[issue.severity] || severityConfig.low;

                    return (
                        <motion.div
                            key={issue.id}
                            initial={{ opacity: 0, y: 60 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true, margin: "-40px" }}
                            transition={{ type: "spring", stiffness: 260, damping: 20, delay: idx * 0.05 }}
                            whileHover={{ y: -8, scale: 1.01 }}
                            onClick={() => setSelectedIssue(issue)}
                            className="group bg-white rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.03)] border border-black/[0.03] overflow-hidden cursor-pointer active:scale-[0.98] transition-transform"
                        >
                            {issue.multimedia_urls && issue.multimedia_urls[0] && (
                                <div className="overflow-hidden w-full h-56 relative bg-slate-100">
                                    <motion.img
                                        src={`${BACKEND_URL}${issue.multimedia_urls[0]}`}
                                        alt="Issue evidence"
                                        whileHover={{ scale: 1.05 }}
                                        transition={{ duration: 0.6, ease: "easeOut" }}
                                        className="w-full h-full object-cover"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />
                                </div>
                            )}
                            <div className="p-6">
                                <div className="flex justify-between items-center mb-4">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-900 bg-slate-100 px-3 py-1.5 rounded-full">
                                            {CATEGORIES.find(c => c.value === issue.category)?.label || issue.category}
                                        </span>
                                        <span className={`text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-full ${
                                            issue.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                            issue.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                                            issue.status === 'resolved' ? 'bg-emerald-100 text-emerald-800' :
                                            issue.status === 'rejected' ? 'bg-red-100 text-red-800' :
                                            'bg-slate-100 text-slate-800'
                                        }`}>
                                            {issue.status ? issue.status.replace('_', ' ') : 'Pending'}
                                        </span>
                                        {issue.severity && (
                                            <span className={`text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-full flex items-center gap-1 ${sev.bg} ${sev.text}`}>
                                                <span className={`w-1.5 h-1.5 rounded-full ${sev.dot}`} />
                                                {issue.severity}
                                            </span>
                                        )}
                                    </div>
                                    <span className="text-[11px] font-bold tracking-wide text-slate-400 uppercase shrink-0">
                                        {new Date(issue.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                    </span>
                                </div>
                                <h3 className="text-[22px] font-black tracking-[-0.03em] text-slate-900 leading-[1.2] mb-6">{issue.title}</h3>

                                <div className="flex items-center justify-between border-t border-black/[0.03] pt-5">
                                    <div className="flex flex-col">
                                        <span className="font-black text-3xl text-slate-900 tracking-tighter leading-none">{issue.vouch_count}</span>
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1">Vouches</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <motion.button
                                            whileTap={!issue.hasVouched ? { scale: 0.92 } : {}}
                                            onClick={(e) => { e.stopPropagation(); handleVouch(issue.id); }}
                                            disabled={issue.hasVouched}
                                            className={`px-6 py-3.5 rounded-2xl font-bold text-[13px] uppercase tracking-wider transition-colors duration-300 shadow-xl ${issue.hasVouched
                                                ? 'bg-slate-50 text-emerald-600 border border-emerald-500/20 shadow-none cursor-not-allowed'
                                                : 'bg-slate-900 text-white shadow-slate-900/20 hover:bg-black'
                                                }`}
                                        >
                                            {issue.hasVouched ? 'Vouched' : 'Vouch It'}
                                        </motion.button>
                                        <div className="text-slate-300 group-hover:text-indigo-400 transition-colors">
                                            <ChevronRight size={20} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    );
                })}
            </div>

            {/* ── Detail Modal ──────────────────────────────────────────── */}
            <AnimatePresence>
                {selectedIssue && (
                    <ReportDetailModal
                        report={selectedIssue}
                        onClose={() => setSelectedIssue(null)}
                        categories={CATEGORIES}
                        onVouch={handleVouch}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}