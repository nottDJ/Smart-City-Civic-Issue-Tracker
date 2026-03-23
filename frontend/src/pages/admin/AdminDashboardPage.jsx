import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import toast from 'react-hot-toast';

export default function AdminDashboardPage() {
    const [reports, setReports] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    const [stats, setStats] = useState({
        totalIssues: 0,
        totalVouches: 0,
    });

    useEffect(() => {
        const fetchReports = async () => {
            try {
                const response = await fetch('http://localhost:3000/api/reports');
                const data = await response.json();

                let fetchedReports = [];
                if (data && data.status === 'ok' && Array.isArray(data.reports)) {
                    fetchedReports = data.reports;
                } else if (Array.isArray(data)) {
                    fetchedReports = data;
                }

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

            {/* Main Map Body */}
            <div className="flex-1 relative z-0 h-[80vh] lg:h-auto min-h-[600px]">
                <MapContainer
                    center={[13.033, 80.180]} // Chennai Default Focus
                    zoom={12}
                    className="h-full w-full z-0"
                    zoomControl={false}
                >
                    <TileLayer
                        attribution='&amp;copy <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
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

                        return (
                            <Marker key={report.id} position={[lat, lng]}>
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
    );
}
