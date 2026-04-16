import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import toast from 'react-hot-toast';
import L from 'leaflet';
import {
    Trash2, Users, Map as MapIcon, Shield, Ban, CheckCircle, Sparkles,
    UserPlus, Loader2, Building2, X, History, Activity, Zap, MapPin,
    Image as ImageIcon, Timer, ChevronDown, ArrowUpCircle, CheckCircle2,
    Clock, AlertCircle
} from 'lucide-react';
import { BACKEND_URL } from '../../config';

// ─── Severity-based marker icons ──────────────────────────────────────────────
const makeIcon = (color) => new L.Icon({
    iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${color}.png`,
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

const SEVERITY_ICONS = {
    critical: makeIcon('red'),
    high:     makeIcon('orange'),
    medium:   makeIcon('yellow'),
    low:      makeIcon('blue'),
};

const SEVERITY_COLORS = {
    critical: { bg: 'bg-red-500',    text: 'text-red-700',    badge: 'bg-red-50 text-red-700 border-red-200' },
    high:     { bg: 'bg-orange-500', text: 'text-orange-700', badge: 'bg-orange-50 text-orange-700 border-orange-200' },
    medium:   { bg: 'bg-yellow-400', text: 'text-yellow-700', badge: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
    low:      { bg: 'bg-blue-400',   text: 'text-blue-700',   badge: 'bg-blue-50 text-blue-700 border-blue-200' },
};

const SEVERITY_ORDER = ['critical', 'high', 'medium', 'low'];

// ─── Helpers (shared with Officer dashboard style) ────────────────────────────

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

const priorityLabel = score =>
    score >= 75 ? '🔴 Critical' : score >= 50 ? '🟡 Medium' : '🟢 Low';

const scoreTextClass = score =>
    score >= 75 ? 'text-red-500' : score >= 50 ? 'text-amber-500' : 'text-emerald-500';

const scoreBgClass = score =>
    score >= 75 ? 'bg-red-500' : score >= 50 ? 'bg-amber-400' : 'bg-emerald-400';

// ─── Sub-components ───────────────────────────────────────────────────────────

function BreakdownBar({ label, value, maxPts, color }) {
    const pct = maxPts > 0 ? Math.min(100, (value / maxPts) * 100) : 0;
    return (
        <div>
            <div className="flex justify-between text-xs mb-1 text-slate-600">
                <span>{label}</span>
                <span className="font-semibold tabular-nums">{value.toFixed(1)} <span className="text-slate-400 font-normal">/ {maxPts} pts</span></span>
            </div>
            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                    className={`h-full rounded-full transition-all duration-500 ${color}`}
                    style={{ width: `${pct}%` }}
                />
            </div>
        </div>
    );
}

function StatusBadge({ status }) {
    const map = {
        pending: 'bg-amber-100 text-amber-700',
        open: 'bg-blue-100 text-blue-700',
        in_progress: 'bg-indigo-100 text-indigo-700',
        resolved: 'bg-emerald-100 text-emerald-700',
        rejected: 'bg-slate-100 text-slate-500',
    };
    return (
        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${map[status] ?? 'bg-slate-100 text-slate-500'}`}>
            {status?.replace('_', ' ')}
        </span>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AdminDashboardPage() {
    const location = useLocation();
    const navigate = useNavigate();
    const [reports, setReports] = useState([]);
    const [users, setUsers] = useState([]);
    const [activeTab, setActiveTab] = useState('reports');
    const [userFilter, setUserFilter] = useState('all');
    const [isLoading, setIsLoading] = useState(true);
    const [updatingStatusId, setUpdatingStatusId] = useState(null);

    useEffect(() => {
        const handleReset = () => {
            setActiveTab('reports');
            setReportQueueTab('active');
            setSelectedAdminReport(null);
        };
        window.addEventListener('resetAdminTab', handleReset);
        return () => window.removeEventListener('resetAdminTab', handleReset);
    }, []);

    // Severity filter — which severities are visible on the map
    const [severityFilter, setSeverityFilter] = useState({
        critical: true,
        high: true,
        medium: true,
        low: true,
    });

    const [stats, setStats] = useState({
        totalIssues: 0,
        totalVouches: 0,
    });

    // ─── Add Officer state ───────────────────────────────────────────────────
    const [departments, setDepartments] = useState([]);
    const [officerForm, setOfficerForm] = useState({
        full_name: '',
        email: '',
        password: '',
        department_id: '',
    });
    const [isCreatingOfficer, setIsCreatingOfficer] = useState(false);

    // ─── NEW: Report queue tab and detail drawer ────────────────────────────
    const [reportQueueTab, setReportQueueTab] = useState('active'); // 'active' | 'history'
    const [selectedAdminReport, setSelectedAdminReport] = useState(null);

    // ─── Fetch users & departments (once) ────────────────────────────────────
    useEffect(() => {
        const fetchUsersAndDepts = async () => {
            try {
                const token = localStorage.getItem('token');
                const headers = {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                };

                // Fetch Users
                const resUsers = await fetch(`${BACKEND_URL}/api/users`, { headers });
                if (resUsers.ok) {
                    const dataUsers = await resUsers.json();
                    if (dataUsers.status === 'ok' && Array.isArray(dataUsers.users)) {
                        setUsers(dataUsers.users);
                    }
                }

                // Fetch Departments (for the Add Officer form)
                const resDepts = await fetch(`${BACKEND_URL}/api/departments`);
                if (resDepts.ok) {
                    const dataDepts = await resDepts.json();
                    if (dataDepts.status === 'ok' && Array.isArray(dataDepts.departments)) {
                        setDepartments(dataDepts.departments);
                    }
                }
            } catch (error) {
                console.error('Failed to fetch users/departments:', error);
            }
        };
        fetchUsersAndDepts();
    }, []);

    // ─── Fetch reports (depends on reportQueueTab) ───────────────────────────
    useEffect(() => {
        let cancelled = false;
        const fetchReports = async () => {
            setIsLoading(true);
            setSelectedAdminReport(null);
            try {
                const token = localStorage.getItem('token');
                const headers = {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                };

                const statusParam = reportQueueTab === 'history' ? '?status=resolved&limit=100' : '?limit=100';
                const resReports = await fetch(`${BACKEND_URL}/api/officer/reports${statusParam}`, { headers });

                if (!cancelled && resReports.ok) {
                    const dataReports = await resReports.json();
                    const fetchedReports = dataReports?.reports || [];
                    setReports(fetchedReports);
                    setStats({
                        totalIssues: dataReports?.total || fetchedReports.length,
                        totalVouches: fetchedReports.reduce((sum, r) => sum + (parseInt(r.vouch_count) || 0), 0)
                    });
                }
            } catch (error) {
                if (!cancelled) {
                    console.error('Failed to fetch reports:', error);
                    toast.error('Failed to load reports.');
                }
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        };
        fetchReports();
        return () => { cancelled = true; };
    }, [reportQueueTab]);

    const handleStatusChange = async (reportId, newStatus) => {
        try {
            setUpdatingStatusId(reportId);
            const token = localStorage.getItem('token');
            const res = await fetch(`${BACKEND_URL}/api/reports/${reportId}/status`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                body: JSON.stringify({ status: newStatus })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to update status');

            setReports(prev => prev.map(r => r.id === reportId ? { ...r, status: newStatus } : r));

            // Update detail drawer if open
            if (selectedAdminReport?.id === reportId) {
                setSelectedAdminReport(prev => ({ ...prev, status: newStatus }));
            }

            toast.success('Status updated!');

            // If resolved on the active tab, remove from active list
            if (['resolved', 'rejected'].includes(newStatus) && reportQueueTab === 'active') {
                setTimeout(() => {
                    setReports(prev => prev.filter(r => r.id !== reportId));
                    if (selectedAdminReport?.id === reportId) {
                        setSelectedAdminReport(null);
                    }
                }, 800);
            }
        } catch (error) {
            toast.error(error.message);
        } finally {
            setUpdatingStatusId(null);
        }
    };

    const handleDeleteReport = async (reportId) => {
        if (!window.confirm("Are you sure you want to delete this report? This cannot be undone.")) return;

        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${BACKEND_URL}/api/reports/${reportId}`, {
                method: 'DELETE',
                headers: {
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                }
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to delete report');

            setReports(prev => prev.filter(r => r.id !== reportId));
            if (selectedAdminReport?.id === reportId) {
                setSelectedAdminReport(null);
            }
            toast.success('Report deleted.');
        } catch (error) {
            toast.error(error.message);
        }
    };

    const handleBlockUser = async (userId) => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${BACKEND_URL}/api/users/${userId}/block`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to update user status');

            setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_active: data.user.is_active } : u));
            toast.success(data.message);
        } catch (error) {
            toast.error(error.message);
        }
    };

    const handleDeleteUser = async (userId) => {
        if (!window.confirm("Are you sure you want to permanently delete this user?\n\nIMPORTANT: ALL of their reports and vouches will be securely wiped. This cannot be undone.")) return;

        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${BACKEND_URL}/api/users/${userId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to delete user');

            setUsers(prev => prev.filter(u => u.id !== userId));
            toast.success(data.message);
        } catch (error) {
            toast.error(error.message);
        }
    };

    // ─── Create Officer handler ──────────────────────────────────────────────
    const handleCreateOfficer = async (e) => {
        e.preventDefault();
        const { full_name, email, password, department_id } = officerForm;

        if (!full_name || !email || !password || !department_id) {
            toast.error('Please fill in all fields.');
            return;
        }
        if (password.length < 6) {
            toast.error('Password must be at least 6 characters.');
            return;
        }

        setIsCreatingOfficer(true);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${BACKEND_URL}/api/admin/officers`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ full_name, email, password, department_id: parseInt(department_id) })
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.message || 'Failed to create officer.');
            }

            toast.success(data.message || 'Officer created successfully!');

            // Add the new officer to the users list with department info
            if (data.officer) {
                setUsers(prev => [{
                    id: data.officer.id,
                    full_name: data.officer.full_name,
                    email: data.officer.email,
                    role: 'officer',
                    is_active: true,
                    created_at: data.officer.created_at
                }, ...prev]);
            }

            // Reset form
            setOfficerForm({ full_name: '', email: '', password: '', department_id: '' });

        } catch (error) {
            toast.error(error.message);
        } finally {
            setIsCreatingOfficer(false);
        }
    };

    const toggleSeverity = (sev) => {
        setSeverityFilter(prev => ({ ...prev, [sev]: !prev[sev] }));
    };

    const filteredUsers = users.filter(u => {
        if (userFilter === 'citizen') return u.role === 'citizen';
        if (userFilter === 'staff') return u.role === 'admin' || u.role === 'officer';
        return true;
    });

    // Filter reports by active severity filters
    const filteredReports = reports.filter(r => severityFilter[r.severity || 'medium']);

    if (isLoading && reports.length === 0) {
        return (
            <div className="p-8 h-full flex items-center justify-center bg-slate-50">
                <div className="flex flex-col items-center gap-3">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                    <p className="text-slate-500 font-medium">Loading geospatial data...</p>
                </div>
            </div>
        );
    }

    // ─── Detail drawer helpers ───────────────────────────────────────────────
    const sel = selectedAdminReport;
    const selMediaUrl = sel?.multimedia_urls?.[0] ? `${BACKEND_URL}${sel.multimedia_urls[0]}` : null;
    const selScore = sel?.priority_score ?? 0;
    const selBd = sel?.priority_breakdown ?? {};
    const selIsResolved = sel?.status === 'resolved';

    return (
        <div className="h-full flex flex-col bg-slate-50 overflow-hidden">
            {/* Top Bar for Stats and Navigation */}
            <div className="bg-white border-b border-slate-200 p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Admin Dashboard</h1>
                    <p className="text-sm text-slate-500 mt-1">Platform management and command center</p>
                </div>

                {/* Tabs */}
                <div className="flex bg-slate-100 p-1 rounded-xl shadow-inner mx-auto sm:mx-0">
                    <button
                        onClick={() => setActiveTab('reports')}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${activeTab === 'reports' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <MapIcon size={18} />
                        Command Center
                    </button>
                    <button
                        onClick={() => setActiveTab('addOfficer')}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${activeTab === 'addOfficer' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <UserPlus size={18} />
                        Add Officer
                    </button>
                    <button
                        onClick={() => setActiveTab('users')}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${activeTab === 'users' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <Users size={18} />
                        Manage Users
                    </button>
                </div>

                <div className="flex items-center gap-4 ml-auto">
                    <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-2 text-center">
                        <div className="text-2xl font-black text-indigo-700">{stats.totalIssues}</div>
                        <div className="text-[10px] font-bold text-indigo-600 uppercase tracking-wide">Total Issues</div>
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            {activeTab === 'reports' ? (
                /* ─── REPORTS / MAP VIEW ─── */
                <div className="flex-1 overflow-hidden relative z-0 grid grid-cols-1 md:grid-cols-3">
                    {/* Left Column: Priority Inbox */}
                    <div className="overflow-y-auto max-h-[50vh] md:max-h-none border-b md:border-b-0 md:border-r border-slate-200 bg-slate-50 flex flex-col">

                        {/* ── Active / History Sub-tabs ─────────────────────── */}
                        <div className="px-3 pt-3 pb-2 border-b border-slate-100">
                            <div className="flex bg-slate-100 p-1 rounded-xl shadow-inner">
                                <button
                                    onClick={() => setReportQueueTab('active')}
                                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                                        reportQueueTab === 'active'
                                            ? 'bg-white text-indigo-700 shadow-sm'
                                            : 'text-slate-500 hover:text-slate-700'
                                    }`}
                                >
                                    <Activity size={12} />
                                    Active Issues
                                </button>
                                <button
                                    onClick={() => setReportQueueTab('history')}
                                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                                        reportQueueTab === 'history'
                                            ? 'bg-white text-emerald-700 shadow-sm'
                                            : 'text-slate-500 hover:text-slate-700'
                                    }`}
                                >
                                    <History size={12} />
                                    Resolved
                                </button>
                            </div>
                        </div>

                        <div className="p-4 space-y-4 flex-1 overflow-y-auto">
                            <h2 className="text-sm font-black text-slate-400 uppercase tracking-widest px-2">
                                {reportQueueTab === 'active' ? 'Priority Inbox' : 'Resolved History'}
                            </h2>

                            {/* Severity Filter Toggles */}
                            <div className="flex gap-2 px-2 flex-wrap">
                                {SEVERITY_ORDER.map(sev => (
                                    <button
                                        key={sev}
                                        onClick={() => toggleSeverity(sev)}
                                        className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border transition-all ${
                                            severityFilter[sev]
                                            ? `${SEVERITY_COLORS[sev].badge}`
                                            : 'bg-slate-100 text-slate-400 border-slate-200 opacity-50'
                                        }`}
                                    >
                                        {sev}
                                    </button>
                                ))}
                            </div>

                            {isLoading ? (
                                <div className="flex flex-col items-center justify-center gap-3 py-12">
                                    <Loader2 size={24} className="text-indigo-500 animate-spin" />
                                    <p className="text-xs text-slate-400">Loading reports…</p>
                                </div>
                            ) : filteredReports.length === 0 ? (
                                <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
                                    <AlertCircle size={24} className="text-slate-300" />
                                    <p className="text-xs text-slate-400">
                                        {reportQueueTab === 'active'
                                            ? 'No active reports found.'
                                            : 'No resolved reports found.'}
                                    </p>
                                </div>
                            ) : (
                                filteredReports.map((report) => {
                                    const sev = report.severity || 'medium';
                                    const sevStyle = SEVERITY_COLORS[sev] || SEVERITY_COLORS.medium;
                                    const isSelected = selectedAdminReport?.id === report.id;
                                    return (
                                        <div
                                            key={report.id}
                                            onClick={() => setSelectedAdminReport(report)}
                                            className={`bg-white border rounded-2xl p-4 shadow-sm hover:shadow-md transition-all cursor-pointer ${
                                                isSelected
                                                    ? 'border-indigo-400 ring-2 ring-indigo-100'
                                                    : 'border-slate-200 hover:border-indigo-200'
                                            }`}
                                        >
                                            <div className="flex justify-between items-start mb-2">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${sevStyle.badge}`}>
                                                        {sev}
                                                    </span>
                                                    {report.department?.name && (
                                                        <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                                                            {report.department.name}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className={`text-xs font-black tabular-nums ${scoreTextClass(report.priority_score)}`}>
                                                        {report.priority_score ?? '–'}
                                                    </span>
                                                    <span className="text-xs font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-md flex items-center gap-1">
                                                        🔥 {report.vouch_count || 0}
                                                    </span>
                                                </div>
                                            </div>
                                            <h3 className="font-bold text-slate-900 text-sm leading-snug mb-1">
                                                {report.title}
                                            </h3>
                                            <p className="text-xs text-slate-500 mb-3 line-clamp-2">{report.description}</p>
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <StatusBadge status={report.status} />
                                                    <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                                                        <Clock size={10} />
                                                        {timeAgo(report.created_at)}
                                                    </span>
                                                </div>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleDeleteReport(report.id); }}
                                                    className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100 flex items-center justify-center"
                                                    title="Delete Report"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>

                    {/* Right Columns: Live Map */}
                    <div className="md:col-span-2 relative z-0 h-full min-h-[400px]">
                        <MapContainer
                            center={[13.033, 80.180]}
                            zoom={12}
                            className="h-full w-full z-0"
                            zoomControl={false}
                        >
                            <TileLayer
                                attribution='&copy OpenStreetMap'
                                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                            />

                            {filteredReports.map((report) => {
                                let lat, lng;
                                if (report.location) {
                                    // New format from officer reports API
                                    if (report.location.latitude !== undefined && report.location.longitude !== undefined) {
                                        lat = report.location.latitude;
                                        lng = report.location.longitude;
                                    }
                                    // Legacy GeoJSON format
                                    else if (report.location.type === 'Point' && Array.isArray(report.location.coordinates)) {
                                        lng = report.location.coordinates[0];
                                        lat = report.location.coordinates[1];
                                    }
                                }

                                if (!lat || !lng) return null;

                                const sev = report.severity || 'medium';
                                const currentIcon = SEVERITY_ICONS[sev] || SEVERITY_ICONS.medium;

                                return (
                                    <Marker key={report.id} position={[lat, lng]} icon={currentIcon}>
                                        <Popup className="civic-popup rounded-xl">
                                            <div className="font-sans min-w-[220px]">
                                                <div className="bg-indigo-600 text-white p-3 -m-[13px] mb-2 rounded-t-[11px]">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="text-[10px] uppercase font-bold tracking-wider opacity-80">
                                                            {report.department?.name || report.category}
                                                        </span>
                                                    </div>
                                                    <h3 className="font-semibold text-sm leading-tight m-0">{report.title}</h3>
                                                </div>

                                                <div className="pt-2 text-slate-600 text-xs space-y-2">
                                                    <div className="flex justify-between items-center bg-slate-50 p-2 rounded border border-slate-100">
                                                        <span className="font-semibold text-slate-500">Severity</span>
                                                        <span className={`capitalize font-bold px-2 py-0.5 rounded text-[10px] border ${
                                                            (SEVERITY_COLORS[sev] || SEVERITY_COLORS.medium).badge
                                                        }`}>{sev}</span>
                                                    </div>

                                                    <div className="flex justify-between items-center bg-slate-50 p-2 rounded border border-slate-100">
                                                        <span className="font-semibold text-slate-500">Priority</span>
                                                        <span className={`font-bold ${scoreTextClass(report.priority_score)}`}>
                                                            {report.priority_score ?? '–'} / 100
                                                        </span>
                                                    </div>

                                                    <div className="flex justify-between items-center bg-slate-50 p-2 rounded border border-slate-100">
                                                        <span className="font-semibold text-slate-500">Status</span>
                                                        <span className="capitalize font-medium text-amber-600">{report.status}</span>
                                                    </div>

                                                    <div className="flex justify-between items-center bg-slate-50 p-2 rounded border border-slate-100">
                                                        <span className="font-semibold text-slate-500">Vouches</span>
                                                        <span className="font-bold text-slate-800 flex items-center gap-1">
                                                            🔥 {report.vouch_count || 0}
                                                        </span>
                                                    </div>

                                                    <button
                                                        onClick={() => setSelectedAdminReport(report)}
                                                        className="w-full mt-1 bg-indigo-50 text-indigo-700 font-bold text-[11px] py-1.5 rounded-lg hover:bg-indigo-100 transition-colors"
                                                    >
                                                        View Full Details →
                                                    </button>

                                                    <p className="text-[10px] text-slate-400 font-mono mt-2 pt-2 border-t border-slate-100 text-center">
                                                        ID: {report.id}
                                                    </p>
                                                </div>
                                            </div>
                                        </Popup>
                                    </Marker>
                                );
                            })}
                        </MapContainer>

                        {/* ─── Severity Legend (floating over the map) ─── */}
                        <div className="absolute bottom-6 left-6 z-[1000] bg-white/95 backdrop-blur-xl rounded-2xl shadow-xl border border-slate-200 p-4 space-y-2.5">
                            <div className="flex items-center gap-1.5 text-xs font-black text-slate-700 uppercase tracking-widest mb-1">
                                <Sparkles size={14} className="text-indigo-500" />
                                Severity Legend
                            </div>
                            {SEVERITY_ORDER.map(sev => (
                                <div key={sev} className="flex items-center gap-2.5">
                                    <div className={`w-3 h-3 rounded-full ${SEVERITY_COLORS[sev].bg} shadow-sm ring-1 ring-black/10`} />
                                    <span className="text-xs font-bold text-slate-600 capitalize">{sev}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* ─── Detail Drawer (overlays when a report is selected) ─── */}
                    {selectedAdminReport && (
                        <div className="fixed inset-0 z-[2000] flex">
                            {/* Backdrop */}
                            <div
                                className="absolute inset-0 bg-black/30 backdrop-blur-sm"
                                onClick={() => setSelectedAdminReport(null)}
                            />

                            {/* Panel */}
                            <div className="ml-auto relative w-full max-w-xl bg-white shadow-2xl overflow-y-auto border-l border-slate-200">
                                {/* Sticky Header */}
                                <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-md border-b border-slate-100 px-5 py-3 flex items-center justify-between">
                                    <h3 className="font-bold text-slate-800 text-sm">Report Details</h3>
                                    <button
                                        onClick={() => setSelectedAdminReport(null)}
                                        className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
                                    >
                                        <X size={18} className="text-slate-500" />
                                    </button>
                                </div>

                                {/* Content — replicates Officer dashboard detail */}
                                <div className="p-5 space-y-5">

                                    {/* ── Header ─────────────────────────────── */}
                                    <div>
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="text-xs font-mono text-slate-400">
                                                #{sel.id?.slice(0, 8)}
                                            </span>
                                            <StatusBadge status={sel.status} />
                                            {sel.department?.name && (
                                                <span className="text-xs text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full font-medium">
                                                    {sel.department.name}
                                                </span>
                                            )}
                                        </div>
                                        <h2 className="text-lg font-bold text-slate-800 mt-1.5 leading-snug">
                                            {sel.title}
                                        </h2>
                                        {sel.description && (
                                            <p className="text-sm text-slate-500 mt-1 leading-relaxed">
                                                {sel.description}
                                            </p>
                                        )}
                                        {sel.reported_by?.name && (
                                            <p className="text-xs text-slate-400 mt-2">
                                                Reported by <span className="font-semibold text-slate-600">{sel.reported_by.name}</span>
                                            </p>
                                        )}
                                    </div>

                                    {/* ── Media preview ──────────────────────── */}
                                    {selMediaUrl ? (
                                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                                            <img
                                                src={selMediaUrl}
                                                alt="Submitted evidence"
                                                className="w-full max-h-64 object-cover"
                                                onError={e => { e.currentTarget.style.display = 'none' }}
                                            />
                                        </div>
                                    ) : (
                                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex items-center gap-3 text-slate-400">
                                            <ImageIcon size={20} />
                                            <p className="text-sm">No evidence media submitted</p>
                                        </div>
                                    )}

                                    {/* ── AI Priority Score ──────────────────── */}
                                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                                        <div className="flex items-center gap-2 mb-4">
                                            <Zap size={18} className="text-indigo-500" />
                                            <h3 className="font-bold text-slate-700 text-sm uppercase tracking-wide">AI Priority Score</h3>
                                        </div>

                                        <div className="flex items-end gap-4 mb-4">
                                            <span className={`text-5xl font-black leading-none tabular-nums ${scoreTextClass(selScore)}`}>
                                                {selScore}
                                            </span>
                                            <div className="pb-1">
                                                <span className="text-xl font-light text-slate-400">/ 100</span>
                                                <p className={`text-sm font-semibold mt-1 ${scoreTextClass(selScore)}`}>
                                                    {priorityLabel(selScore)}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full rounded-full transition-all duration-700 ${scoreBgClass(selScore)}`}
                                                style={{ width: `${selScore}%` }}
                                            />
                                        </div>
                                        <div className="flex justify-between text-xs text-slate-400 mt-1.5">
                                            <span>0 — Low</span>
                                            <span>50 — Medium</span>
                                            <span>100 — Critical</span>
                                        </div>
                                    </div>

                                    {/* ── Score Breakdown ────────────────────── */}
                                    {Object.keys(selBd).length > 0 && (
                                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3.5">
                                            <h3 className="font-bold text-slate-700 text-sm flex items-center gap-2">
                                                <Activity size={15} className="text-indigo-400" />
                                                Score Breakdown
                                                <span className="font-normal text-slate-400">(AI-generated factors)</span>
                                            </h3>
                                            <BreakdownBar label="Base Severity" value={selBd.base_severity ?? 0} maxPts={30} color="bg-red-400" />
                                            <BreakdownBar label="Community Vouching" value={selBd.vouching ?? 0} maxPts={30} color="bg-indigo-400" />
                                            <BreakdownBar label="Proximity to Infra" value={selBd.proximity ?? 0} maxPts={20} color="bg-amber-400" />
                                            <BreakdownBar label="Time Escalation" value={selBd.time_decay ?? 0} maxPts={20} color="bg-slate-400" />
                                        </div>
                                    )}

                                    {/* ── Location + Details ─────────────────── */}
                                    <div className="grid grid-cols-2 gap-4">
                                        {sel.location && (
                                            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 col-span-2">
                                                <div className="flex items-center gap-2 mb-3">
                                                    <MapPin size={15} className="text-emerald-500" />
                                                    <h3 className="font-bold text-slate-700 text-sm">Location</h3>
                                                </div>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div className="bg-slate-50 rounded-xl px-3 py-2.5">
                                                        <p className="text-xs text-slate-400 mb-0.5">Latitude</p>
                                                        <p className="font-mono text-sm font-semibold text-slate-700">
                                                            {sel.location.latitude?.toFixed(6) ?? '–'}
                                                        </p>
                                                    </div>
                                                    <div className="bg-slate-50 rounded-xl px-3 py-2.5">
                                                        <p className="text-xs text-slate-400 mb-0.5">Longitude</p>
                                                        <p className="font-mono text-sm font-semibold text-slate-700">
                                                            {sel.location.longitude?.toFixed(6) ?? '–'}
                                                        </p>
                                                    </div>
                                                </div>
                                                {sel.address_text && (
                                                    <p className="text-xs text-slate-500 mt-2 px-1">{sel.address_text}</p>
                                                )}
                                            </div>
                                        )}

                                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex items-center gap-3">
                                            <div className="bg-indigo-50 rounded-full p-2">
                                                <Users size={16} className="text-indigo-500" />
                                            </div>
                                            <div>
                                                <p className="text-xs text-slate-400">Community Vouches</p>
                                                <p className="text-lg font-bold text-slate-800">{sel.vouch_count ?? 0}</p>
                                            </div>
                                        </div>

                                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex items-center gap-3">
                                            <div className="bg-slate-50 rounded-full p-2">
                                                <Timer size={16} className="text-slate-500" />
                                            </div>
                                            <div>
                                                <p className="text-xs text-slate-400">Reported</p>
                                                <p className="text-sm font-semibold text-slate-700">{timeAgo(sel.created_at)}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* ── Status Update & Actions ────────────── */}
                                    {!selIsResolved ? (
                                        <>
                                            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                                                <div className="flex items-center gap-2 mb-3">
                                                    <ChevronDown size={15} className="text-slate-500" />
                                                    <h3 className="font-bold text-slate-700 text-sm">Update Status</h3>
                                                </div>
                                                <select
                                                    value={sel.status || 'pending'}
                                                    onChange={(e) => handleStatusChange(sel.id, e.target.value)}
                                                    disabled={updatingStatusId === sel.id}
                                                    className="w-full bg-slate-50 border border-slate-200 text-sm font-bold rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 cursor-pointer"
                                                >
                                                    <option value="pending">⏳ Pending</option>
                                                    <option value="in_progress">🔧 In Progress</option>
                                                    <option value="resolved">✅ Resolved</option>
                                                    <option value="rejected">❌ Rejected</option>
                                                </select>
                                            </div>

                                            <div className="grid grid-cols-2 gap-3">
                                                <button
                                                    onClick={() => handleStatusChange(sel.id, 'in_progress')}
                                                    disabled={updatingStatusId === sel.id || sel.status === 'in_progress'}
                                                    className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-semibold text-sm py-3 rounded-xl transition-all disabled:opacity-50 disabled:pointer-events-none"
                                                >
                                                    <ArrowUpCircle size={16} />
                                                    Escalate
                                                </button>
                                                <button
                                                    onClick={() => handleStatusChange(sel.id, 'resolved')}
                                                    disabled={updatingStatusId === sel.id || sel.status === 'resolved'}
                                                    className="flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white font-semibold text-sm py-3 rounded-xl transition-all disabled:opacity-50 disabled:pointer-events-none"
                                                >
                                                    <CheckCircle2 size={16} />
                                                    Mark Resolved
                                                </button>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 flex items-center gap-3">
                                            <div className="bg-emerald-100 rounded-full p-2">
                                                <CheckCircle2 size={22} className="text-emerald-600" />
                                            </div>
                                            <div>
                                                <p className="font-bold text-emerald-800 text-sm">Issue Resolved</p>
                                                <p className="text-xs text-emerald-600 mt-0.5">
                                                    {sel.resolved_at
                                                        ? `Closed ${timeAgo(sel.resolved_at)}`
                                                        : 'This issue has been marked as resolved.'}
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    {/* Delete button */}
                                    <div className="pt-2 border-t border-slate-100">
                                        <button
                                            onClick={() => handleDeleteReport(sel.id)}
                                            className="flex items-center gap-2 text-red-500 hover:text-red-700 text-xs font-bold hover:bg-red-50 px-3 py-2 rounded-lg transition-colors"
                                        >
                                            <Trash2 size={14} />
                                            Delete This Report Permanently
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            ) : activeTab === 'addOfficer' ? (
                /* ─── ADD OFFICER VIEW ─── */
                <div className="flex-1 overflow-y-auto bg-slate-100 p-6 lg:p-10">
                    <div className="max-w-2xl mx-auto">
                        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                            {/* Header */}
                            <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-8 py-6">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                                        <UserPlus size={24} className="text-white" />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-bold text-white">Create Officer Account</h2>
                                        <p className="text-indigo-200 text-sm mt-0.5">Assign a new municipal officer to a department</p>
                                    </div>
                                </div>
                            </div>

                            {/* Form */}
                            <form onSubmit={handleCreateOfficer} className="p-8 space-y-6">
                                {/* Full Name */}
                                <div>
                                    <label htmlFor="officer-name" className="block text-sm font-bold text-slate-700 mb-2">
                                        Full Name
                                    </label>
                                    <input
                                        id="officer-name"
                                        type="text"
                                        placeholder="e.g. Rajesh Kumar"
                                        value={officerForm.full_name}
                                        onChange={(e) => setOfficerForm(prev => ({ ...prev, full_name: e.target.value }))}
                                        className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-slate-50 placeholder:text-slate-400 transition-all"
                                        required
                                    />
                                </div>

                                {/* Email */}
                                <div>
                                    <label htmlFor="officer-email" className="block text-sm font-bold text-slate-700 mb-2">
                                        Email Address
                                    </label>
                                    <input
                                        id="officer-email"
                                        type="email"
                                        placeholder="officer@municipality.gov.in"
                                        value={officerForm.email}
                                        onChange={(e) => setOfficerForm(prev => ({ ...prev, email: e.target.value }))}
                                        className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-slate-50 placeholder:text-slate-400 transition-all"
                                        required
                                    />
                                </div>

                                {/* Temporary Password */}
                                <div>
                                    <label htmlFor="officer-password" className="block text-sm font-bold text-slate-700 mb-2">
                                        Temporary Password
                                    </label>
                                    <input
                                        id="officer-password"
                                        type="password"
                                        placeholder="Min 6 characters"
                                        value={officerForm.password}
                                        onChange={(e) => setOfficerForm(prev => ({ ...prev, password: e.target.value }))}
                                        className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-slate-50 placeholder:text-slate-400 transition-all"
                                        minLength={6}
                                        required
                                    />
                                    <p className="text-xs text-slate-400 mt-1.5">The officer should change this after their first login.</p>
                                </div>

                                {/* Department Assignment */}
                                <div>
                                    <label htmlFor="officer-department" className="block text-sm font-bold text-slate-700 mb-2">
                                        <Building2 size={14} className="inline mr-1.5 -mt-0.5" />
                                        Department Assignment
                                    </label>
                                    <select
                                        id="officer-department"
                                        value={officerForm.department_id}
                                        onChange={(e) => setOfficerForm(prev => ({ ...prev, department_id: e.target.value }))}
                                        className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-slate-50 transition-all appearance-none cursor-pointer"
                                        required
                                    >
                                        <option value="">Select a department...</option>
                                        {departments.map(dept => (
                                            <option key={dept.id} value={dept.id}>
                                                {dept.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* Submit Button */}
                                <button
                                    type="submit"
                                    disabled={isCreatingOfficer}
                                    className="w-full flex items-center justify-center gap-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-bold py-3.5 px-6 rounded-xl shadow-lg shadow-indigo-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                                >
                                    {isCreatingOfficer ? (
                                        <>
                                            <Loader2 size={18} className="animate-spin" />
                                            Creating Officer...
                                        </>
                                    ) : (
                                        <>
                                            <UserPlus size={18} />
                                            Create Officer Account
                                        </>
                                    )}
                                </button>
                            </form>
                        </div>

                        {/* Info Card */}
                        <div className="mt-6 bg-indigo-50 border border-indigo-100 rounded-2xl p-5">
                            <div className="flex items-start gap-3">
                                <Shield size={20} className="text-indigo-600 mt-0.5 shrink-0" />
                                <div>
                                    <h4 className="text-sm font-bold text-indigo-900">Security Notice</h4>
                                    <p className="text-xs text-indigo-700 mt-1 leading-relaxed">
                                        Officers are created with a forced <span className="font-mono bg-indigo-100 px-1 py-0.5 rounded">officer</span> role.
                                        This cannot be overridden from this form. Passwords are hashed with bcrypt before being stored.
                                        Advise the officer to change their temporary password upon first login.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                /* ─── MANAGE USERS VIEW ─── */
                <div className="flex-1 overflow-y-auto bg-slate-100 p-6 lg:p-10">
                    <div className="max-w-6xl mx-auto space-y-6">
                        <div className="flex items-center justify-between mb-8">
                            <div>
                                <h2 className="text-xl font-bold text-slate-900">Platform Users</h2>
                                <p className="text-sm text-slate-500">Manage citizens, officers, and administrators.</p>
                            </div>
                            <div className="flex bg-white rounded-lg p-1 border border-slate-200">
                                {['all', 'citizen', 'staff'].map((filter) => (
                                    <button
                                        key={filter}
                                        onClick={() => setUserFilter(filter)}
                                        className={`px-4 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-colors ${userFilter === filter ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:bg-slate-50'}`}
                                    >
                                        {filter}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden line-clamp-none">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
                                            <th className="px-6 py-4">User</th>
                                            <th className="px-6 py-4">Role</th>
                                            <th className="px-6 py-4">Status</th>
                                            <th className="px-6 py-4 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {filteredUsers.length === 0 ? (
                                            <tr>
                                                <td colSpan="4" className="px-6 py-12 text-center text-slate-400 font-medium">
                                                    No users found.
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredUsers.map((user) => (
                                                <tr key={user.id} className="hover:bg-slate-50/50 transition-colors">
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold">
                                                                {user.full_name.charAt(0).toUpperCase()}
                                                            </div>
                                                            <div>
                                                                <div className="font-bold text-slate-900 text-sm">{user.full_name}</div>
                                                                <div className="text-xs text-slate-500">{user.email}</div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider border
                                                            ${user.role === 'admin' ? 'bg-purple-50 text-purple-700 border-purple-100' : 
                                                              user.role === 'officer' ? 'bg-blue-50 text-blue-700 border-blue-100' : 
                                                              'bg-slate-100 text-slate-600 border-slate-200'}`}
                                                        >
                                                            {user.role === 'admin' && <Shield size={12} />}
                                                            {user.role}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        {user.is_active ? (
                                                            <span className="inline-flex items-center gap-1.5 text-emerald-600 text-xs font-bold bg-emerald-50 px-2 py-1 rounded-md">
                                                                <CheckCircle size={14} /> Active
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1.5 text-red-600 text-xs font-bold bg-red-50 px-2 py-1 rounded-md">
                                                                <Ban size={14} /> Blocked
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center justify-end gap-2">
                                                            <button
                                                                onClick={() => handleBlockUser(user.id)}
                                                                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                                                                    user.is_active 
                                                                    ? 'text-amber-700 bg-amber-50 border-amber-100 hover:bg-amber-100' 
                                                                    : 'text-emerald-700 bg-emerald-50 border-emerald-100 hover:bg-emerald-100'
                                                                }`}
                                                            >
                                                                {user.is_active ? 'Block' : 'Unblock'}
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeleteUser(user.id)}
                                                                className="p-1.5 text-red-500 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors border border-transparent hover:border-red-100"
                                                                title="Permanently Delete User"
                                                            >
                                                                <Trash2 size={18} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
