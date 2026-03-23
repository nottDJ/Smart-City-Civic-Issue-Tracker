import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import { UserCircle2 } from 'lucide-react';

export default function ExploreIssuesPage() {
    const [issues, setIssues] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeCategory, setActiveCategory] = useState('all');
    const [sortBy, setSortBy] = useState('newest');

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
            const response = await fetch('http://10.10.64.148:3000/api/reports');
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

        // 1. Optimistic Update: Use 'prevIssues' to guarantee we never use stale data
        setIssues(prevIssues => prevIssues.map(issue =>
            issue.id === id ? { ...issue, vouch_count: issue.vouch_count + 1, hasVouched: true } : issue
        ));

        try {
            const response = await fetch(`http://10.10.64.148:3000/api/reports/${id}/vouch`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                toast.success('Vouch recorded! AI Priority increased.', { icon: '🔥' });
            } else {
                // 2. Revert Safely: Math.max ensures the count can literally NEVER drop below zero
                setIssues(prevIssues => prevIssues.map(issue =>
                    issue.id === id ? { ...issue, vouch_count: Math.max(0, issue.vouch_count - 1), hasVouched: false } : issue
                ));
                toast.error('You have already vouched for this issue.');
            }
        } catch (error) {
            // 3. Revert Safely on network failure
            setIssues(prevIssues => prevIssues.map(issue =>
                issue.id === id ? { ...issue, vouch_count: Math.max(0, issue.vouch_count - 1), hasVouched: false } : issue
            ));
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
                return b.vouch_count - a.vouch_count;
            }
            return 0;
        });
    }, [issues, activeCategory, sortBy]);

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
                {filteredAndSortedIssues.map((issue, idx) => (
                    <motion.div
                        key={issue.id}
                        initial={{ opacity: 0, y: 60 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: "-40px" }}
                        transition={{ type: "spring", stiffness: 260, damping: 20, delay: idx * 0.05 }}
                        whileHover={{ y: -8, scale: 1.01 }}
                        className="group bg-white rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.03)] border border-black/[0.03] overflow-hidden"
                    >
                        {issue.multimedia_urls && issue.multimedia_urls[0] && (
                            <div className="overflow-hidden w-full h-56 relative bg-slate-100">
                                <motion.img
                                    src={`http://10.10.64.148:3000${issue.multimedia_urls[0]}`}
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
                                <span className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-900 bg-slate-100 px-3 py-1.5 rounded-full">
                                    {CATEGORIES.find(c => c.value === issue.category)?.label || issue.category}
                                </span>
                                <span className="text-[11px] font-bold tracking-wide text-slate-400 uppercase">
                                    {new Date(issue.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                </span>
                            </div>
                            <h3 className="text-[22px] font-black tracking-[-0.03em] text-slate-900 leading-[1.2] mb-6">{issue.title}</h3>

                            <div className="flex items-center justify-between border-t border-black/[0.03] pt-5">
                                <div className="flex flex-col">
                                    <span className="font-black text-3xl text-slate-900 tracking-tighter leading-none">{issue.vouch_count}</span>
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1">Vouches</span>
                                </div>
                                <motion.button
                                    whileTap={!issue.hasVouched ? { scale: 0.92 } : {}}
                                    onClick={() => handleVouch(issue.id)}
                                    disabled={issue.hasVouched}
                                    className={`px-6 py-3.5 rounded-2xl font-bold text-[13px] uppercase tracking-wider transition-colors duration-300 shadow-xl ${issue.hasVouched
                                        ? 'bg-slate-50 text-emerald-600 border border-emerald-500/20 shadow-none cursor-not-allowed'
                                        : 'bg-slate-900 text-white shadow-slate-900/20 hover:bg-black'
                                        }`}
                                >
                                    {issue.hasVouched ? 'Vouched' : 'Vouch It'}
                                </motion.button>
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>
        </div>
    );
}