import { useEffect, useState } from 'react'
import {
    Clock, MapPin, Zap, CheckCircle2, AlertTriangle,
    Loader2, AlertCircle, Inbox, Image as ImageIcon,
    Users, Timer, Building2, Activity,
} from 'lucide-react'

const API_BASE = 'http://10.10.64.148:3000'

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

    useEffect(() => {
        let cancelled = false
        setIsLoading(true)
        setError(null)

        fetch(`${API_BASE}/api/officer/reports`)
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
    }, [])

    // Derive media URL — officer route uses multimedia_urls (TEXT[])
    const mediaUrl = selectedReport?.multimedia_urls?.[0]
        ? `${API_BASE}${selectedReport.multimedia_urls[0]}`
        : null

    const score = selectedReport?.priority_score ?? 0
    const bd = selectedReport?.priority_breakdown ?? {}

    return (
        <div className="flex h-full">

            {/* ── LEFT: Inbox pane ──────────────────────────────────────────── */}
            <aside className="w-80 flex-shrink-0 bg-white border-r border-slate-200 flex flex-col overflow-hidden">

                {/* Header */}
                <div className="px-4 py-4 border-b border-slate-200 bg-slate-50">
                    <h2 className="font-bold text-slate-800 text-sm">Incoming Tickets</h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                        {isLoading ? 'Loading…' : `${reports.length} unresolved · sorted by AI score`}
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
                            <p className="text-xs text-slate-400">No pending reports right now.</p>
                        </div>
                    ) : (
                        reports.map(report => {
                            const isActive = selectedReport?.id === report.id
                            return (
                                <button
                                    key={report.id}
                                    onClick={() => setSelectedReport(report)}
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
                                    </div>
                                </button>
                            )
                        })
                    )}
                </div>
            </aside>

            {/* ── RIGHT: Priority Action Panel ───────────────────────────────── */}
            <section className="flex-1 overflow-y-auto bg-slate-50 flex flex-col">

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
                    <div className="p-6 space-y-5">

                        {/* ── Header ────────────────────────────────────────── */}
                        <div className="flex items-start justify-between gap-4">
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
                                <h2 className="text-xl font-bold text-slate-800 mt-1.5 leading-snug">
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
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                            <div className="flex items-center gap-2 mb-5">
                                <Zap size={18} className="text-indigo-500" />
                                <h3 className="font-bold text-slate-700 text-sm uppercase tracking-wide">AI Priority Score</h3>
                            </div>

                            <div className="flex items-end gap-4 mb-4">
                                <span className={`text-7xl font-black leading-none tabular-nums ${scoreTextClass(score)}`}>
                                    {score}
                                </span>
                                <div className="pb-2">
                                    <span className="text-2xl font-light text-slate-400">/ 100</span>
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
                                <BreakdownBar label="Base Severity" value={bd.base_severity ?? 0} maxPts={30} color="bg-red-400" />
                                <BreakdownBar label="Community Vouching" value={bd.vouching ?? 0} maxPts={30} color="bg-indigo-400" />
                                <BreakdownBar label="Proximity to Infra" value={bd.proximity ?? 0} maxPts={20} color="bg-amber-400" />
                                <BreakdownBar label="Time Escalation" value={bd.time_decay ?? 0} maxPts={20} color="bg-slate-400" />
                            </div>
                        )}

                        {/* ── Location + Details ────────────────────────────── */}
                        <div className="grid grid-cols-2 gap-4">

                            {/* Coordinates */}
                            {selectedReport.location && (
                                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 col-span-2">
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

                        {/* ── Action Buttons ────────────────────────────────── */}
                        <div className="grid grid-cols-2 gap-3 pb-2">
                            <button className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-semibold text-sm py-3.5 rounded-xl transition-all">
                                <AlertTriangle size={16} />
                                Escalate Issue
                            </button>
                            <button className="flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white font-semibold text-sm py-3.5 rounded-xl transition-all">
                                <CheckCircle2 size={16} />
                                Mark Resolved
                            </button>
                        </div>

                    </div>
                )}
            </section>
        </div>
    )
}
