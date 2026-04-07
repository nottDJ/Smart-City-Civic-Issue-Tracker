import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import toast from 'react-hot-toast';
import L from 'leaflet';
import { Trash2, Users, Map as MapIcon, Shield, Ban, CheckCircle, Sparkles } from 'lucide-react';
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

export default function AdminDashboardPage() {
    const [reports, setReports] = useState([]);
    const [users, setUsers] = useState([]);
    const [activeTab, setActiveTab] = useState('reports');
    const [userFilter, setUserFilter] = useState('all');
    const [isLoading, setIsLoading] = useState(true);
    const [updatingStatusId, setUpdatingStatusId] = useState(null);

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

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const token = localStorage.getItem('token');
                const headers = {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                };

                // Fetch Reports
                const resReports = await fetch(`${BACKEND_URL}/api/reports`);
                let fetchedReports = [];
                if (resReports.ok) {
                    const dataReports = await resReports.json();
                    if (dataReports && dataReports.status === 'ok' && Array.isArray(dataReports.reports)) {
                        fetchedReports = dataReports.reports;
                    } else if (Array.isArray(dataReports)) {
                        fetchedReports = dataReports;
                    }
                    // Sort by severity priority then vouch_count
                    fetchedReports.sort((a, b) => {
                        const sevA = SEVERITY_ORDER.indexOf(a.severity || 'medium');
                        const sevB = SEVERITY_ORDER.indexOf(b.severity || 'medium');
                        if (sevA !== sevB) return sevA - sevB;
                        return (parseInt(b.vouch_count) || 0) - (parseInt(a.vouch_count) || 0);
                    });
                    setReports(fetchedReports);

                    const totalVouches = fetchedReports.reduce((sum, r) => sum + (parseInt(r.vouch_count) || 0), 0);
                    setStats({
                        totalIssues: fetchedReports.length,
                        totalVouches
                    });
                }

                // Fetch Users
                const resUsers = await fetch(`${BACKEND_URL}/api/users`, { headers });
                if (resUsers.ok) {
                    const dataUsers = await resUsers.json();
                    if (dataUsers.status === 'ok' && Array.isArray(dataUsers.users)) {
                        setUsers(dataUsers.users);
                    }
                }

            } catch (error) {
                console.error('Failed to fetch data:', error);
                toast.error('Failed to load dashboard data.');
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, []);

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
            toast.success('Status updated!');
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

    if (isLoading) {
        return (
            <div className="p-8 h-full flex items-center justify-center bg-slate-50">
                <div className="flex flex-col items-center gap-3">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                    <p className="text-slate-500 font-medium">Loading geospatial data...</p>
                </div>
            </div>
        );
    }

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
                <div className="flex-1 overflow-hidden relative z-0 grid md:grid-cols-3">
                    {/* Left Column: Priority Inbox */}
                    <div className="overflow-y-auto border-r border-slate-200 bg-slate-50 p-4 space-y-4">
                        <h2 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-2 px-2">Priority Inbox</h2>

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

                        {filteredReports.map((report) => {
                            const sev = report.severity || 'medium';
                            const sevStyle = SEVERITY_COLORS[sev] || SEVERITY_COLORS.medium;
                            return (
                                <div key={report.id} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow">
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${sevStyle.badge}`}>
                                                {sev}
                                            </span>
                                            {report.department_name && (
                                                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                                                    {report.department_name}
                                                </span>
                                            )}
                                        </div>
                                        <span className="text-xs font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-md flex items-center gap-1">
                                            🔥 {report.vouch_count || 0}
                                        </span>
                                    </div>
                                    <h3 className="font-bold text-slate-900 text-sm leading-snug mb-1">
                                        {report.title}
                                    </h3>
                                    <p className="text-xs text-slate-500 mb-3 line-clamp-2">{report.description}</p>
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-4">
                                        <div className="flex items-center gap-2">
                                            <label className="text-xs font-semibold text-slate-500 shrink-0">Status:</label>
                                            <select
                                                value={report.status || 'pending'}
                                                onChange={(e) => handleStatusChange(report.id, e.target.value)}
                                                disabled={updatingStatusId === report.id}
                                                className="bg-slate-50 border border-slate-200 text-xs font-bold rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 w-full sm:w-auto"
                                            >
                                                <option value="pending">Pending</option>
                                                <option value="in_progress">In Progress</option>
                                                <option value="resolved">Resolved</option>
                                                <option value="rejected">Rejected</option>
                                            </select>
                                        </div>
                                        <button
                                            onClick={() => handleDeleteReport(report.id)}
                                            className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100 flex items-center justify-center"
                                            title="Delete Report"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
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
                                attribution='&amp;copy OpenStreetMap'
                                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                            />

                            {filteredReports.map((report) => {
                                let lat, lng;
                                if (report.location) {
                                    if (report.location.type === 'Point' && Array.isArray(report.location.coordinates)) {
                                        lng = report.location.coordinates[0];
                                        lat = report.location.coordinates[1];
                                    } else if (typeof report.location === 'string') {
                                        const match = report.location.match(/POINT\(([^ ]+)\s+([^)]+)\)/i);
                                        if (match) {
                                            lng = parseFloat(match[1]);
                                            lat = parseFloat(match[2]);
                                        }
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
                                                            {report.department_name || report.category}
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
                                                        <span className="font-semibold text-slate-500">Status</span>
                                                        <span className="capitalize font-medium text-amber-600">{report.status}</span>
                                                    </div>

                                                    <div className="flex justify-between items-center bg-slate-50 p-2 rounded border border-slate-100">
                                                        <span className="font-semibold text-slate-500">Vouches</span>
                                                        <span className="font-bold text-slate-800 flex items-center gap-1">
                                                            🔥 {report.vouch_count || 0}
                                                        </span>
                                                    </div>

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
