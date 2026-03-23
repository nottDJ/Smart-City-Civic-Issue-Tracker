import { useRef, useState } from 'react'
import {
    Camera, MapPin, ChevronDown, Send,
    Loader2, AlertCircle, CheckCircle2,
    X, FileAudio, FileVideo,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { motion, AnimatePresence } from 'framer-motion'

const API_BASE = 'http://localhost:3000'

const CATEGORIES = [
    { label: 'Pothole / Road Damage', value: 'pothole' },
    { label: 'Streetlight Outage', value: 'street_light' },
    { label: 'Garbage / Sanitation', value: 'garbage' },
    { label: 'Water Leakage / Pipe Burst', value: 'water_leak' },
    { label: 'Encroachment', value: 'encroachment' },
    { label: 'Sewage Overflow', value: 'sewage' },
    { label: 'Illegal Construction', value: 'illegal_construction' },
    { label: 'Noise Pollution', value: 'noise_pollution' },
    { label: 'Fallen Tree / Branch', value: 'tree_hazard' },
    { label: 'Other', value: 'other' },
]

const INITIAL_FORM = { title: '', category: '', description: '' }

export default function ReportIssuePage() {
    // ── Form fields ────────────────────────────────────────────────────────────
    const [form, setForm] = useState(INITIAL_FORM)

    // ── Media state ────────────────────────────────────────────────────────────
    const [mediaFile, setMediaFile] = useState(null)
    const [mediaPreview, setMediaPreview] = useState(null)
    const fileInputRef = useRef(null)

    function handleFileChange(e) {
        const file = e.target.files?.[0]
        if (!file) return
        setMediaFile(file)
        setMediaPreview(file.type.startsWith('image/') ? URL.createObjectURL(file) : null)
    }

    function clearMedia() {
        setMediaFile(null)
        setMediaPreview(null)
        if (fileInputRef.current) fileInputRef.current.value = ''
    }

    // ── GPS state ──────────────────────────────────────────────────────────────
    const [location, setLocation] = useState(null)
    const [locationLoading, setLocationLoading] = useState(false)
    const [locationError, setLocationError] = useState(null)

    function fetchGPS() {
        if (!navigator.geolocation) {
            setLocationError('Geolocation is not supported by this browser.')
            return
        }
        setLocationLoading(true)
        setLocationError(null)
        setLocation(null)

        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setLocation({
                    lat: pos.coords.latitude.toFixed(5),
                    lng: pos.coords.longitude.toFixed(5),
                })
                setLocationLoading(false)
            },
            (err) => {
                const messages = {
                    1: 'Location permission denied. Please allow access and try again.',
                    2: 'Position unavailable. Check your GPS signal.',
                    3: 'Request timed out. Please try again.',
                }
                setLocationError(messages[err.code] ?? 'An unknown error occurred.')
                setLocationLoading(false)
            },
            { enableHighAccuracy: true, timeout: 10000 }
        )
    }

    // ── Submit state ───────────────────────────────────────────────────────────
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [submitSuccess, setSubmitSuccess] = useState(null) // created report object
    const [submitError, setSubmitError] = useState(null)

    async function handleSubmit(e) {
        e.preventDefault()
        setSubmitError(null)

        // ── Client-side validation ───────────────────────────────────────────────
        if (!form.title.trim()) {
            setSubmitError('Please enter a title for the issue.')
            return
        }
        if (!form.category) {
            setSubmitError('Please select a category.')
            return
        }
        if (!location) {
            setSubmitError('Please fetch your GPS location before submitting.')
            return
        }

        // ── Build FormData ───────────────────────────────────────────────────────
        // Do NOT set Content-Type manually — the browser sets it (with boundary)
        const body = new FormData()
        body.append('title', form.title.trim())
        body.append('description', form.description.trim())
        body.append('category', form.category)
        body.append('lat', location.lat)
        body.append('lng', location.lng)
        if (mediaFile) body.append('media', mediaFile)

        setIsSubmitting(true)
        try {
            const token = localStorage.getItem('token')
            const res = await fetch(`${API_BASE}/api/reports`, {
                method: 'POST',
                headers: {
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                body
            })
            const data = await res.json()

            if (!res.ok) {
                throw new Error(data.message || `Server error ${res.status}`)
            }

            // ── Success — reset all form state ──────────────────────────────────────
            setSubmitSuccess(data.report)
            toast.success('Report submitted successfully!')
            setForm(INITIAL_FORM)
            clearMedia()
            setLocation(null)
            setLocationError(null)

        } catch (err) {
            const errorMsg = err.message || 'Failed to submit. Please try again.'
            setSubmitError(errorMsg)
            toast.error(errorMsg)
        } finally {
            setIsSubmitting(false)
        }
    }

    // ── Helpers ────────────────────────────────────────────────────────────────
    const isVideo = mediaFile?.type.startsWith('video/')
    const isAudio = mediaFile?.type.startsWith('audio/')

    // ── Success screen ─────────────────────────────────────────────────────────
    const renderFilePreview = (file) => {
        if (file.type.startsWith('image/')) {
            return <img src={URL.createObjectURL(file)} alt="Preview" className="w-full h-full object-cover" />
        } else if (file.type.startsWith('video/')) {
            return <video src={URL.createObjectURL(file)} controls className="w-full h-full object-cover" />
        } else if (file.type.startsWith('audio/')) {
            return (
                <div className="flex flex-col items-center justify-center h-full text-slate-500">
                    <FileAudio size={36} />
                    <span className="text-xs mt-1">{file.name}</span>
                </div>
            )
        }
        return null
    }

    return (
        <div className="min-h-screen bg-[#FAFAFA] pb-24 font-sans text-slate-900 selection:bg-indigo-500/30">
            {/* Header */}
            <div className="bg-[#FAFAFA]/80 backdrop-blur-2xl px-6 py-6 sticky top-0 z-10 border-b border-black/[0.03]">
                <h1 className="text-3xl font-black text-slate-900 tracking-[-0.04em] max-w-lg mx-auto">Report Issue</h1>
            </div>

            <div className="p-4 max-w-lg mx-auto pt-6">
                <AnimatePresence mode="popLayout">
                    {submitError && (
                        <motion.div
                            key="error"
                            initial={{ opacity: 0, y: -10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95, y: -10 }}
                            className="mb-6 bg-red-50 border border-red-100 text-red-600 px-4 py-3.5 rounded-2xl text-sm flex items-start gap-3"
                        >
                            <AlertCircle size={18} className="shrink-0 mt-0.5" />
                            <span className="font-medium">{submitError}</span>
                        </motion.div>
                    )}
                </AnimatePresence>

                <AnimatePresence mode="wait">
                    {submitSuccess ? (
                        <motion.div
                            key="success"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            transition={{ type: "spring", stiffness: 300, damping: 25 }}
                            className="bg-white rounded-[2rem] shadow-[0_20px_40px_rgba(0,0,0,0.03)] border border-black/[0.03] p-10 text-center"
                        >
                            <div className="mx-auto w-20 h-20 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mb-6 shadow-inner border border-emerald-100">
                                <CheckCircle2 size={40} />
                            </div>
                            <h2 className="text-2xl font-black tracking-[-0.03em] text-slate-900 mb-2">Report Submitted</h2>
                            <p className="text-slate-500 font-medium mb-8">Thank you for helping improve our city. We'll route this to the correct department.</p>

                            <motion.button
                                whileTap={{ scale: 0.95 }}
                                onClick={() => {
                                    setSubmitSuccess(null)
                                    setForm(INITIAL_FORM)
                                    clearMedia()
                                    setLocation(null)
                                }}
                                className="bg-slate-900 hover:bg-black text-white font-bold tracking-wide py-4 px-8 rounded-2xl shadow-xl shadow-slate-900/20 transition-colors"
                            >
                                Submit Another Report →
                            </motion.button>
                        </motion.div>
                    ) : (
                        <motion.form
                            key="form"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: -20 }}
                            transition={{ duration: 0.3, ease: "easeInOut" }}
                            onSubmit={handleSubmit}
                            className="bg-white rounded-[2rem] shadow-[0_12px_40px_rgba(0,0,0,0.04)] border border-black/[0.03] p-6 lg:p-8 space-y-8"
                        >
                            {/* Title */}
                            <div className="space-y-2">
                                <label className="text-xs font-bold tracking-wide uppercase text-slate-500 ml-1">Title</label>
                                <input
                                    type="text"
                                    name="title"
                                    required
                                    value={form.title}
                                    onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                                    placeholder="E.g., Pothole on Main Street"
                                    className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3.5 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm focus:outline-none focus:ring-4 focus:ring-slate-900/10 focus:border-slate-400 transition-all font-medium"
                                />
                            </div>

                            {/* Description */}
                            <div className="space-y-2">
                                <label className="text-xs font-bold tracking-wide uppercase text-slate-500 ml-1">Description</label>
                                <textarea
                                    name="description"
                                    required
                                    rows="3"
                                    value={form.description}
                                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                                    placeholder="Provide more details about the issue..."
                                    className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3.5 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm focus:outline-none focus:ring-4 focus:ring-slate-900/10 focus:border-slate-400 transition-all font-medium resize-none"
                                ></textarea>
                            </div>

                            {/* Category */}
                            <div className="space-y-2">
                                <label className="text-xs font-bold tracking-wide uppercase text-slate-500 ml-1">Category</label>
                                <div className="relative">
                                    <select
                                        name="category"
                                        value={form.category}
                                        required
                                        onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                                        className="w-full appearance-none bg-white border border-slate-200 rounded-2xl px-4 py-3.5 text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-4 focus:ring-slate-900/10 focus:border-slate-400 transition-all font-bold tracking-wide"
                                    >
                                        <option value="" disabled>Select a category</option>
                                        {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                                    </select>
                                    <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none">
                                        <ChevronDown size={18} className="text-slate-400" />
                                    </div>
                                </div>
                            </div>

                            {/* Media Capture */}
                            <div className="space-y-2">
                                <label className="text-xs font-bold tracking-wide uppercase text-slate-500 ml-1">Evidence (Optional)</label>

                                {mediaPreview ? (
                                    <div className="relative aspect-video rounded-2xl overflow-hidden bg-slate-100 border border-black/[0.03] group">
                                        <img src={mediaPreview} alt="Preview" className="w-full h-full object-cover" />
                                        <button
                                            type="button"
                                            onClick={clearMedia}
                                            className="absolute top-3 right-3 bg-black/50 hover:bg-black/70 backdrop-blur text-white p-2 rounded-full transition-all"
                                        >
                                            <X size={16} strokeWidth={3} />
                                        </button>
                                    </div>
                                ) : mediaFile ? (
                                    <div className="flex flex-col items-center gap-2 py-6 px-4 text-center border-2 border-slate-200 rounded-2xl relative w-full">
                                        {isVideo ? <FileVideo size={36} className="text-slate-400" />
                                            : isAudio ? <FileAudio size={36} className="text-slate-400" />
                                                : <Camera size={36} className="text-slate-400" />}
                                        <p className="text-sm font-bold tracking-tight text-slate-700 break-all">{mediaFile.name}</p>
                                        <p className="text-xs font-bold text-slate-400">{(mediaFile.size / 1024).toFixed(1)} KB</p>
                                        <button type="button" onClick={clearMedia}
                                            className="absolute top-3 right-3 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-full p-1.5 transition-colors">
                                            <X size={14} />
                                        </button>
                                    </div>
                                ) : (
                                    <div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed border-slate-200 rounded-2xl p-6 text-center hover:bg-slate-50 transition-colors group relative cursor-pointer overflow-hidden leading-tight">
                                        <div className="mx-auto w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 group-hover:scale-110 group-hover:text-slate-600 transition-all mb-3 text-2xl">
                                            📷
                                        </div>
                                        <span className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">Capture or Upload</span>
                                        <p className="text-xs text-slate-400 font-medium mt-1">Photos, videos, or audio</p>
                                    </div>
                                )}

                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*,video/*,audio/*"
                                    capture="environment"
                                    className="hidden"
                                    onChange={handleFileChange}
                                />
                            </div>

                            {/* Location */}
                            <div className="space-y-2">
                                <label className="text-xs font-bold tracking-wide uppercase text-slate-500 ml-1">Location <span className="text-red-400">*</span></label>

                                {locationError && !locationLoading && (
                                    <div className="bg-red-50 rounded-xl px-4 py-3 flex items-start gap-3 border border-red-200 mb-3">
                                        <AlertCircle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
                                        <p className="text-sm text-red-600">{locationError}</p>
                                    </div>
                                )}

                                <button
                                    type="button"
                                    onClick={fetchGPS}
                                    disabled={locationLoading}
                                    className={`w-full flex items-center justify-center gap-2 font-bold py-3.5 px-4 rounded-2xl transition-colors text-sm ${location
                                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-100 hover:bg-emerald-100'
                                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-transparent'}`}
                                >
                                    {locationLoading ? (
                                        <><Loader2 size={18} className="animate-spin" /> Acquiring...</>
                                    ) : location ? (
                                        <><span className="text-[16px]">📍</span> GPS Location Acquired ✓</>
                                    ) : (
                                        <><span className="text-[16px]">📍</span> Attach Current Location</>
                                    )}
                                </button>
                            </div>

                            {/* Submit Button */}
                            <div className="pt-4 border-t border-black/[0.03]">
                                <motion.button
                                    whileTap={!(isSubmitting || !location) ? { scale: 0.95 } : {}}
                                    type="submit"
                                    disabled={isSubmitting || !location}
                                    className="w-full bg-slate-900 hover:bg-black text-white font-bold tracking-wide py-4.5 px-6 rounded-2xl shadow-xl shadow-slate-900/20 transition-colors disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2 leading-none h-[54px]"
                                >
                                    {isSubmitting ? (
                                        <>
                                            <Loader2 size={18} className="animate-spin" />
                                            <span>Submitting...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Send size={18} />
                                            <span>Submit Report →</span>
                                        </>
                                    )}
                                </motion.button>
                            </div>
                        </motion.form>
                    )}
                </AnimatePresence>
            </div>
        </div>
    )
}
