import { useEffect, useState } from 'react'
import {
    Clock, MapPin, Zap, CheckCircle2, AlertTriangle,
    Loader2, AlertCircle, Inbox, Image as ImageIcon,
    Activity, Users, Timer, ChevronDown, ArrowUpCircle,
    Menu, X, History
} from 'lucide-react'
import toast from 'react-hot-toast'
import { BACKEND_URL } from '../../config'

const API_BASE = BACKEND_URL;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(dateStr) {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    const days = Math.floor(hrs / 24)
    return `${days}d ago`
}

function formatCategory(cat) {
    if (!cat) return 'Other'
    return cat.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

// ─── Score colour helpers ──────────────────────────────────────────────────────

const priorityLabel = score =>
    score >= 75 ? '🔴 Critical' : score >= 50 ? '🟡 Medium' : '🟢 Low'

const scoreTextClass = score =>
    score >= 75 ? 'text-red-500' : score >= 50 ? 'text-amber-500' : 'text-emerald-500'

const scoreBgClass = score =>
    score >= 75 ? 'bg-red-500' : score >= 50 ? 'bg-amber-400' : 'bg-emerald-400'

const scoreBorderClass = score =>
    score >= 75 ? 'border-red-200 bg-red-50' : score >= 50 ? 'border-amber-200 bg-amber-50' : 'border-emerald-200 bg-emerald-50'

// ─── Sub-components ───────────────────────────────────────────────────────────

function BreakdownBar({ label, value, maxPts, color }) {
    const pct = maxPts > 0 ? Math.min(100, (value / maxPts) * 100) : 0
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
    )
}

function StatusBadge({ status }) {
    const map = {
        pending: 'bg-amber-100 text-amber-700',
        open: 'bg-blue-100 text-blue-700',
        in_progress: 'bg-indigo-100 text-indigo-700',
        resolved: 'bg-emerald-100 text-emerald-700',
        rejected: 'bg-slate-100 text-slate-500',
    }
    return (
        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${map[status] ?? 'bg-slate-100 text-slate-500'}`}>
            {status?.replace('_', ' ')}
        </span>
    )
}

// ─── Loading skeleton ──────────────────────────────────────────────────────────

function Skeleton({ className }) {
    return <div className={`animate-pulse bg-slate-200 rounded-lg ${className}`} />
}

function InboxSkeleton() {
    return (
        <div className="divide-y divide-slate-100">
            {[...Array(5)].map((_, i) => (
                <div key={i} className="px-4 py-4 space-y-2">
                    <div className="flex justify-between">
                        <Skeleton className="h-3 w-20" />
                        <Skeleton className="h-3 w-8" />
                    </div>
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                </div>
            ))}
        </div>
    )
}

// ─── Empty state ───────────────────────────────────────────────────────────────

function EmptySelection() {
    return (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-10 gap-4">
            <div className="bg-slate-100 rounded-full p-5">
                <Inbox size={36} className="text-slate-400" />
            </div>
            <div>
                <p className="font-semibold text-slate-600">No report selected</p>
                <p className="text-sm text-slate-400 mt-1">Click a ticket on the left to view its details.</p>
            </div>
        </div>
    )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function OfficerDashboardPage() {
    const [reports, setReports] = useState([])
    const [selectedReport, setSelectedReport] = useState(null)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState(null)
    const [updatingStatus, setUpdatingStatus] = useState(false)
    const [showMobileInbox, setShowMobileInbox] = useState(true)
    const [queueTab, setQueueTab] = useState('active') // 'active' | 'history'

    useEffect(() => {
        let cancelled = false
        setIsLoading(true)
        setError(null)
        setSelectedReport(null)

        const token = localStorage.getItem('token')
        const params = queueTab === 'history' ? '?status=resolved' : ''

        fetch(`${API_BASE}/api/officer/reports${params}`, {
            headers: {
                ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            }
        })
            .then(res => {
                if (!res.ok) throw new Error(`Server error ${res.status}`)
                return res.json()
            })
            .then(data => {
                if (cancelled) return
                const list = data.reports ?? []
                setReports(list)
                setSelectedReport(list[0] ?? null)
            })
            .catch(err => {
                if (cancelled) return
                setError(err.message || 'Failed to load reports.')
            })
            .finally(() => {
                if (!cancelled) setIsLoading(false)
            })

        return () => { cancelled = true }
    }, [queueTab])

    // ── Status update handler ─────────────────────────────────────────────────
    const handleStatusChange = async (reportId, newStatus) => {
        setUpdatingStatus(true)
        try {
            const token = localStorage.getItem('token')
            const res = await fetch(`${API_BASE}/api/reports/${reportId}/status`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                body: JSON.stringify({ status: newStatus })
            })

            const data = await res.json()
            if (!res.ok) throw new Error(data.message || 'Failed to update status')

            // Update local state immediately (optimistic)
            setReports(prev => prev.map(r =>
                r.id === reportId ? { ...r, status: newStatus } : r
            ))
            if (selectedReport?.id === reportId) {
                setSelectedReport(prev => ({ ...prev, status: newStatus }))
            }

            toast.success(`Status updated to "${newStatus.replace('_', ' ')}"`)

            // If resolved/rejected on the active tab, remove from active queue after a brief moment
            if (['resolved', 'rejected'].includes(newStatus) && queueTab === 'active') {
                setTimeout(() => {
                    setReports(prev => {
                        const updated = prev.filter(r => r.id !== reportId)
                        setSelectedReport(updated[0] ?? null)
                        return updated
                    })
                }, 800)
            }
        } catch (err) {
            toast.error(err.message)
        } finally {
            setUpdatingStatus(false)
        }
    }

    // Derive media URL — officer route uses multimedia_urls (TEXT[])
    const mediaUrl = selectedReport?.multimedia_urls?.[0]
        ? `${API_BASE}${selectedReport.multimedia_urls[0]}`
        : null

    const score = selectedReport?.priority_score ?? 0
    const bd = selectedReport?.priority_breakdown ?? {}
    const isResolved = selectedReport?.status === 'resolved'

    return (
        <div className="flex flex-col md:flex-row h-full">

            {/* ── Mobile header ──────────────────────────────────────── */}
            <div className="md:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-slate-200">
                <h2 className="font-bold text-slate-800 text-sm">
                    {showMobileInbox
                        ? (queueTab === 'active' ? 'Active Tickets' : 'Resolved History')
                        : selectedReport?.title || 'Report Details'}
                </h2>
                <button
                    onClick={() => setShowMobileInbox(!showMobileInbox)}
                    className="p-2 bg-slate-100 rounded-xl text-slate-600"
                >
                    {showMobileInbox ? <X size={18} /> : <Menu size={18} />}
                </button>
            </div>

            {/* ── LEFT: Inbox pane ──────────────────────────────────────────── */}
            <aside className={`w-full md:w-80 flex-shrink-0 bg-white border-r border-slate-200 flex flex-col overflow-hidden ${
                showMobileInbox ? 'flex' : 'hidden md:flex'
            }`}>

                {/* ── Tab Toggle ─────────────────────────────────────────── */}
                <div className="px-3 pt-3 pb-2 border-b border-slate-100">
                    <div className="flex bg-slate-100 p-1 rounded-xl shadow-inner">
                        <button
                            onClick={() => setQueueTab('active')}
                            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                                queueTab === 'active'
                                    ? 'bg-white text-indigo-700 shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700'
                            }`}
                        >
                            <Activity size={12} />
                            Active Issues
                        </button>
                        <button
                            onClick={() => setQueueTab('history')}
                            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                                queueTab === 'history'
                                    ? 'bg-white text-emerald-700 shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700'
                            }`}
                        >
                            <History size={12} />
                            Resolved
                        </button>
                    </div>
                </div>

                {/* Header */}
                <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 hidden md:block">
                    <h2 className="font-bold text-slate-800 text-sm">
                        {queueTab === 'active' ? 'Incoming Tickets' : 'Resolved History'}
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                        {isLoading
                            ? 'Loading…'
                            : `${reports.length} ${queueTab === 'active' ? 'unresolved' : 'resolved'} · sorted by AI score`}
                    </p>
                </div>

                {/* Error banner */}
                {error && (
                    <div className="mx-3 mt-3 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 flex items-start gap-2">
                        <AlertCircle size={14} className="text-red-500 mt-0.5 flex-shrink-0" />
                        <p className="text-xs text-red-600">{error}</p>
                    </div>
                )}

                {/* List */}
                <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
                    {isLoading ? (
                        <InboxSkeleton />
                    ) : reports.length === 0 ? (
                        <div className="flex flex-col items-center justify-center gap-2 py-16 text-center px-4">
                            <Inbox size={28} className="text-slate-300" />
                            <p className="text-xs text-slate-400">
                                {queueTab === 'active'
                                    ? 'No pending reports for your department.'
                                    : 'No resolved reports found for your department.'}
                            </p>
                        </div>
                    ) : (
                        reports.map(report => {
                            const isActive = selectedReport?.id === report.id
                            return (
                                <button
                                    key={report.id}
                                    onClick={() => {
                                        setSelectedReport(report)
                                        setShowMobileInbox(false)
                                    }}
                                    className={`w-full text-left px-4 py-3.5 transition-colors hover:bg-indigo-50
                                        ${isActive ? 'bg-indigo-50 border-l-4 border-l-indigo-600' : 'border-l-4 border-l-transparent'}`}
                                >
                                    {/* Row 1 — score badge */}
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-xs text-slate-400 font-mono truncate max-w-[140px]">
                                            #{report.id?.slice(0, 8)}
                                        </span>
                                        <span className={`text-xs font-black tabular-nums ${scoreTextClass(report.priority_score)}`}>
                                            {report.priority_score}
                                        </span>
                                    </div>

                                    {/* Row 2 — title */}
                                    <p className="text-sm font-semibold text-slate-800 leading-snug line-clamp-2">
                                        {report.title}
                                    </p>

                                    {/* Row 3 — meta */}
                                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                                        <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                                            <Clock size={10} />
                                            {timeAgo(report.created_at)}
                                        </span>
                                        <span className="text-slate-300 text-xs">·</span>
                                        <span className="text-xs text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-full">
                                            {formatCategory(report.category)}
                                        </span>
                                        {queueTab === 'history' && (
                                            <StatusBadge status={report.status} />
                                        )}
                                    </div>
                                </button>
                            )
                        })
                    )}
                </div>
            </aside>

            {/* ── RIGHT: Priority Action Panel ───────────────────────────────── */}
            <section className={`flex-1 overflow-y-auto bg-slate-50 flex flex-col ${
                showMobileInbox ? 'hidden md:flex' : 'flex'
            }`}>

                {/* Mobile back button */}
                <div className="md:hidden px-4 py-2">
                    <button
                        onClick={() => setShowMobileInbox(true)}
                        className="text-sm text-indigo-600 font-bold flex items-center gap-1"
                    >
                        ← Back to tickets
                    </button>
                </div>

                {isLoading ? (
                    <div className="flex-1 flex items-center justify-center">
                        <div className="flex flex-col items-center gap-3">
                            <Loader2 size={28} className="text-indigo-500 animate-spin" />
                            <p className="text-sm text-slate-500">Loading priority queue…</p>
                        </div>
                    </div>
                ) : !selectedReport ? (
                    <EmptySelection />
                ) : (
                    <div className="p-4 md:p-6 space-y-5">

                        {/* ── Header ────────────────────────────────────────── */}
                        <div className="flex items-start justify-between gap-4 flex-wrap">
                            <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <p className="text-xs font-mono text-slate-400">#{selectedReport.id?.slice(0, 8)}</p>
                                    <StatusBadge status={selectedReport.status} />
                                    {selectedReport.department?.name && (
                                        <span className="text-xs text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full font-medium">
                                            {selectedReport.department.name}
                                        </span>
                                    )}
                                </div>
                                <h2 className="text-lg md:text-xl font-bold text-slate-800 mt-1.5 leading-snug">
                                    {selectedReport.title}
                                </h2>
                                {selectedReport.description && (
                                    <p className="text-sm text-slate-500 mt-1 leading-relaxed">
                                        {selectedReport.description}
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* ── Media preview ─────────────────────────────────── */}
                        {mediaUrl ? (
                            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                                <img
                                    src={mediaUrl}
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

                        {/* ── AI Priority Score ─────────────────────────────── */}
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 md:p-6">
                            <div className="flex items-center gap-2 mb-5">
                                <Zap size={18} className="text-indigo-500" />
                                <h3 className="font-bold text-slate-700 text-sm uppercase tracking-wide">AI Priority Score</h3>
                            </div>

                            <div className="flex items-end gap-4 mb-4">
                                <span className={`text-5xl md:text-7xl font-black leading-none tabular-nums ${scoreTextClass(score)}`}>
                                    {score}
                                </span>
                                <div className="pb-2">
                                    <span className="text-xl md:text-2xl font-light text-slate-400">/ 100</span>
                                    <p className={`text-sm font-semibold mt-1 ${scoreTextClass(score)}`}>
                                        {priorityLabel(score)}
                                    </p>
                                </div>
                            </div>

                            <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                    className={`h-full rounded-full transition-all duration-700 ${scoreBgClass(score)}`}
                                    style={{ width: `${score}%` }}
                                />
                            </div>
                            <div className="flex justify-between text-xs text-slate-400 mt-1.5">
                                <span>0 — Low</span>
                                <span>50 — Medium</span>
                                <span>100 — Critical</span>
                            </div>
                        </div>

                        {/* ── Score Breakdown ───────────────────────────────── */}
                        {Object.keys(bd).length > 0 && (
                            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3.5">
                                <h3 className="font-bold text-slate-700 text-sm flex items-center gap-2">
                                    <Activity size={15} className="text-indigo-400" />
                                    Score Breakdown
                                    <span className="font-normal text-slate-400">(AI-generated factors)</span>
                                </h3>
                                <BreakdownBar label="Base Severity" value={bd.base_severity ?? 0} maxPts={60} color="bg-red-400" />
                                <BreakdownBar label="Proximity to Infra" value={bd.proximity ?? 0} maxPts={40} color="bg-amber-400" />
                                <BreakdownBar label="Community Vouching" value={bd.vouching ?? 0} maxPts={15} color="bg-indigo-400" />
                            </div>
                        )}

                        {/* ── Location + Details ────────────────────────────── */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                            {/* Coordinates */}
                            {selectedReport.location && (
                                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 col-span-1 sm:col-span-2">
                                    <div className="flex items-center gap-2 mb-3">
                                        <MapPin size={15} className="text-emerald-500" />
                                        <h3 className="font-bold text-slate-700 text-sm">Location</h3>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="bg-slate-50 rounded-xl px-3 py-2.5">
                                            <p className="text-xs text-slate-400 mb-0.5">Latitude</p>
                                            <p className="font-mono text-sm font-semibold text-slate-700">
                                                {selectedReport.location.latitude.toFixed(6)}
                                            </p>
                                        </div>
                                        <div className="bg-slate-50 rounded-xl px-3 py-2.5">
                                            <p className="text-xs text-slate-400 mb-0.5">Longitude</p>
                                            <p className="font-mono text-sm font-semibold text-slate-700">
                                                {selectedReport.location.longitude.toFixed(6)}
                                            </p>
                                        </div>
                                    </div>
                                    {selectedReport.address_text && (
                                        <p className="text-xs text-slate-500 mt-2 px-1">{selectedReport.address_text}</p>
                                    )}
                                </div>
                            )}

                            {/* Stats */}
                            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex items-center gap-3">
                                <div className="bg-indigo-50 rounded-full p-2">
                                    <Users size={16} className="text-indigo-500" />
                                </div>
                                <div>
                                    <p className="text-xs text-slate-400">Community Vouches</p>
                                    <p className="text-lg font-bold text-slate-800">{selectedReport.vouch_count ?? 0}</p>
                                </div>
                            </div>

                            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex items-center gap-3">
                                <div className="bg-slate-50 rounded-full p-2">
                                    <Timer size={16} className="text-slate-500" />
                                </div>
                                <div>
                                    <p className="text-xs text-slate-400">Reported</p>
                                    <p className="text-sm font-semibold text-slate-700">{timeAgo(selectedReport.created_at)}</p>
                                </div>
                            </div>
                        </div>

                        {/* ── Status Update & Actions (hidden for resolved reports) ── */}
                        {!isResolved ? (
                            <>
                                {/* Status Update Dropdown */}
                                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                                    <div className="flex items-center gap-2 mb-3">
                                        <ChevronDown size={15} className="text-slate-500" />
                                        <h3 className="font-bold text-slate-700 text-sm">Update Status</h3>
                                    </div>
                                    <div className="flex flex-col sm:flex-row gap-3">
                                        <select
                                            value={selectedReport.status || 'pending'}
                                            onChange={(e) => handleStatusChange(selectedReport.id, e.target.value)}
                                            disabled={updatingStatus}
                                            className="flex-1 bg-slate-50 border border-slate-200 text-sm font-bold rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 cursor-pointer"
                                        >
                                            <option value="pending">⏳ Pending</option>
                                            <option value="in_progress">🔧 In Progress</option>
                                            <option value="resolved">✅ Resolved</option>
                                            <option value="rejected">❌ Rejected</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Quick Action Buttons */}
                                <div className="grid grid-cols-2 gap-3 pb-2">
                                    <button
                                        onClick={() => handleStatusChange(selectedReport.id, 'in_progress')}
                                        disabled={updatingStatus || selectedReport.status === 'in_progress'}
                                        className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-semibold text-sm py-3.5 rounded-xl transition-all disabled:opacity-50 disabled:pointer-events-none"
                                    >
                                        <ArrowUpCircle size={16} />
                                        Escalate / In Progress
                                    </button>
                                    <button
                                        onClick={() => handleStatusChange(selectedReport.id, 'resolved')}
                                        disabled={updatingStatus || selectedReport.status === 'resolved'}
                                        className="flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white font-semibold text-sm py-3.5 rounded-xl transition-all disabled:opacity-50 disabled:pointer-events-none"
                                    >
                                        <CheckCircle2 size={16} />
                                        Mark Resolved
                                    </button>
                                </div>
                            </>
                        ) : (
                            /* ── Resolved Banner ─────────────────────────────── */
                            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 flex items-center gap-3">
                                <div className="bg-emerald-100 rounded-full p-2">
                                    <CheckCircle2 size={22} className="text-emerald-600" />
                                </div>
                                <div>
                                    <p className="font-bold text-emerald-800 text-sm">Issue Resolved</p>
                                    <p className="text-xs text-emerald-600 mt-0.5">
                                        {selectedReport.resolved_at
                                            ? `Closed ${timeAgo(selectedReport.resolved_at)}`
                                            : 'This issue has been marked as resolved.'}
                                    </p>
                                </div>
                            </div>
                        )}

                    </div>
                )}
            </section>
        </div>
    )
}
