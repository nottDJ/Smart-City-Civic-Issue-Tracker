import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import toast from 'react-hot-toast';
import L from 'leaflet';
import { Trash2 } from 'lucide-react';
import { BACKEND_URL } from '../../config';

// Icons for different statuses
const iconPending = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

const iconInProgress = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-yellow.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

const iconResolved = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

export default function AdminDashboardPage() {
    const [reports, setReports] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [updatingStatusId, setUpdatingStatusId] = useState(null)

    const [stats, setStats] = useState({
        totalIssues: 0,
        totalVouches: 0,
    });

    useEffect(() => {
        const fetchReports = async () => {
            try {
                const response = await fetch(`${BACKEND_URL}/api/reports`);
                const data = await response.json();

                let fetchedReports = [];
                if (data && data.status === 'ok' && Array.isArray(data.reports)) {
                    fetchedReports = data.reports;
                } else if (Array.isArray(data)) {
                    fetchedReports = data;
                }

                // Sort by vouch_count descending
                fetchedReports.sort((a, b) => (parseInt(b.vouch_count) || 0) - (parseInt(a.vouch_count) || 0));

                setReports(fetchedReports);

                // Compute quick stats
                const totalVouches = fetchedReports.reduce((sum, r) => sum + (parseInt(r.vouch_count) || 0), 0);
                setStats({
                    totalIssues: fetchedReports.length,
                    totalVouches
                });

            } catch (error) {
                console.error('Failed to fetch reports:', error);
                toast.error('Failed to load map data.');
            } finally {
                setIsLoading(false);
            }
        };

        fetchReports();
    }, []);

    const handleStatusChange = async (reportId, newStatus) => {
        try {
            setUpdatingStatusId(reportId)
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
            setUpdatingStatusId(null)
        }
    }

    const handleDelete = async (reportId) => {
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
    }

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
        <div className="h-full flex flex-col bg-slate-50">
            {/* Top Bar for Stats */}
            <div className="bg-white border-b border-slate-200 p-6 flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Command Center</h1>
                    <p className="text-sm text-slate-500 mt-1">Real-time geospatial overview of civilian reports</p>
                </div>

                <div className="flex items-center gap-6">
                    <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-2 text-center">
                        <div className="text-2xl font-black text-indigo-700">{stats.totalIssues}</div>
                        <div className="text-xs font-semibold text-indigo-600 uppercase tracking-wide">Total Issues</div>
                    </div>
                    <div className="bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-2 text-center">
                        <div className="text-2xl font-black text-emerald-700">{stats.totalVouches}</div>
                        <div className="text-xs font-semibold text-emerald-600 uppercase tracking-wide">Total Vouches</div>
                    </div>
                </div>
            </div>

            {/* Split Screen Layout */}
            <div className="flex-1 relative z-0 grid md:grid-cols-3 min-h-[600px] h-[80vh] lg:h-[calc(100vh-100px)]">
                {/* Left Column: Priority Inbox */}
                <div className="overflow-y-auto border-r border-slate-200 bg-slate-50 p-4 space-y-4 max-h-[80vh] lg:max-h-full">
                    <h2 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-2 px-2">Priority Inbox</h2>
                    {reports.map((report) => (
                        <div key={report.id} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex justify-between items-start mb-2">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                                    {report.category.replace('_', ' ')}
                                </span>
                                <span className="text-xs font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-md flex items-center gap-1">
                                    🔥 {report.vouch_count || 0}
                                </span>
                            </div>
                            <h3 className="font-bold text-slate-900 text-sm leading-snug mb-3">
                                {report.title}
                            </h3>
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
                                    onClick={() => handleDelete(report.id)}
                                    className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100 flex items-center justify-center"
                                    title="Delete Report"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Right Columns: Live Map */}
                <div className="md:col-span-2 relative z-0 h-[400px] md:h-full">
                    <MapContainer
                        center={[13.033, 80.180]} // Chennai Default Focus
                        zoom={12}
                        className="h-full w-full z-0"
                        zoomControl={false}
                    >
                        <TileLayer
                            attribution='&amp;copy OpenStreetMap'
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        />

                        {reports.map((report) => {
                            let lat, lng;
                            // Safely parse location whether it is a GeoJSON object or a WKT String POINT(x y)
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

                            let currentIcon = iconPending;
                            if (report.status === 'in_progress') currentIcon = iconInProgress;
                            if (report.status === 'resolved') currentIcon = iconResolved;

                            return (
                                <Marker key={report.id} position={[lat, lng]} icon={currentIcon}>
                                    <Popup className="civic-popup rounded-xl">
                                        <div className="font-sans min-w-[200px]">
                                            <div className="bg-indigo-600 text-white p-3 -m-[13px] mb-2 rounded-t-[11px]">
                                                <span className="text-[10px] uppercase font-bold tracking-wider opacity-80 block mb-1">
                                                    {report.category}
                                                </span>
                                                <h3 className="font-semibold text-sm leading-tight m-0">{report.title}</h3>
                                            </div>

                                            <div className="pt-2 text-slate-600 text-xs space-y-2">
                                                <div className="flex justify-between items-center bg-slate-50 p-2 rounded border border-slate-100">
                                                    <span className="font-semibold text-slate-500">Status</span>
                                                    <span className="capitalize font-medium text-amber-600">{report.status}</span>
                                                </div>

                                                <div className="flex justify-between items-center bg-slate-50 p-2 rounded border border-slate-100">
                                                    <span className="font-semibold text-slate-500">Priority Score</span>
                                                    <span className="font-bold text-slate-800 flex items-center gap-1">
                                                        🔥 {report.vouch_count || 0} vouches
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
                </div>
            </div>
        </div>
    );
}
