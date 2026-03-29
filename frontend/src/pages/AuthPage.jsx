import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, User, MonitorSpeaker, Loader2, AlertCircle, Phone, Home, MapPin, CreditCard, CheckCircle2 } from 'lucide-react';
import { BACKEND_URL } from '../config';

export default function AuthPage() {
    const navigate = useNavigate();
    const [isLogin, setIsLogin] = useState(true);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const [form, setForm] = useState({
        full_name: '',
        email: '',
        password: '',
        phone: '',
        home_address: '',
        current_address: '',
        aadhaar_number: ''
    });

    const [isEmailVerified, setIsEmailVerified] = useState(false);
    const [isMobileVerified, setIsMobileVerified] = useState(false);
    const [emailOtp, setEmailOtp] = useState('');
    const [mobileOtp, setMobileOtp] = useState('');
    const [emailOtpSent, setEmailOtpSent] = useState(false);
    const [mobileOtpSent, setMobileOtpSent] = useState(false);
    const [emailLoading, setEmailLoading] = useState(false);
    const [mobileLoading, setMobileLoading] = useState(false);

    const handleChange = (e) => {
        let val = e.target.value;
        if (e.target.name === 'aadhaar_number') {
            val = val.replace(/\D/g, '').slice(0, 12);
        }
        setForm(prev => ({ ...prev, [e.target.name]: val }));
    };

    const toggleMode = () => {
        setIsLogin(!isLogin);
        setError('');
        setForm({
            full_name: '', email: '', password: '', phone: '',
            home_address: '', current_address: '', aadhaar_number: ''
        });
        setIsEmailVerified(false);
        setIsMobileVerified(false);
        setEmailOtpSent(false);
        setMobileOtpSent(false);
        setEmailOtp('');
        setMobileOtp('');
    };

    const handleSendOtp = async (type) => {
        const contact = type === 'email' ? form.email : form.phone;
        if (!contact) {
            setError(`Please enter your ${type} first.`);
            return;
        }

        const setLoading = type === 'email' ? setEmailLoading : setMobileLoading;
        const setSent = type === 'email' ? setEmailOtpSent : setMobileOtpSent;

        setLoading(true);
        setError('');
        try {
            const res = await fetch(`${BACKEND_URL}/api/auth/send-otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contact, type })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to send OTP.');
            setSent(true);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOtp = async (type) => {
        const contact = type === 'email' ? form.email : form.phone;
        const otp = type === 'email' ? emailOtp : mobileOtp;
        if (!otp) {
            setError('Please enter the OTP.');
            return;
        }

        const setLoading = type === 'email' ? setEmailLoading : setMobileLoading;
        const setVerified = type === 'email' ? setIsEmailVerified : setIsMobileVerified;

        setLoading(true);
        setError('');
        try {
            const res = await fetch(`${BACKEND_URL}/api/auth/verify-otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contact, otp })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to verify OTP.');
            setVerified(true);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!isLogin) {
            if (form.aadhaar_number.length !== 12) {
                setError('Aadhaar number must be exactly 12 digits.');
                return;
            }
            if (!isEmailVerified || !isMobileVerified) {
                setError('Please verify both your email and mobile number before registering.');
                return;
            }
        }

        setIsLoading(true);
        setError('');

        const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
        const url = `${BACKEND_URL}${endpoint}`;

        try {
            const payload = isLogin ? { email: form.email, password: form.password } : form;
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.message || 'Authentication failed. Please try again.');
            }

            // Success: Store token & user data
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));

            // Redirect based on role dynamically
            if (data.user.role === 'admin') {
                navigate('/admin/dashboard');
            } else if (data.user.role === 'officer') {
                navigate('/officer/dashboard');
            } else {
                navigate('/citizen/explore');
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen grid lg:grid-cols-2 bg-[#FAFAFA] text-slate-900 font-sans selection:bg-indigo-500/30">
            {/* Left side: Premium mesh gradient */}
            <div className="hidden lg:flex flex-col justify-between bg-gradient-to-br from-indigo-900 via-indigo-600 to-fuchsia-700 animate-gradient-shift p-14 text-white overflow-hidden relative">
                {/* Abstract overlapping glow orbs */}
                <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-indigo-500/40 rounded-full blur-[100px] pointer-events-none mix-blend-screen" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-fuchsia-600/40 rounded-full blur-[100px] pointer-events-none mix-blend-screen" />

                <div className="relative z-10 flex items-center gap-3">
                    <div className="w-12 h-12 bg-white/10 backdrop-blur-xl border border-white/20 text-white rounded-2xl flex items-center justify-center shadow-2xl">
                        <MonitorSpeaker size={24} className="shrink-0" />
                    </div>
                    <span className="text-2xl font-black tracking-tight tracking-[-0.03em]">CivicReport</span>
                </div>

                <div className="relative z-10 space-y-8 max-w-lg mb-12">
                    <h1 className="text-[3.5rem] font-black leading-[1.05] tracking-[-0.04em]">
                        Power to the people,<br />
                        <span className="text-white/60">one report at a time.</span>
                    </h1>
                    <p className="text-white/80 text-lg leading-relaxed font-medium max-w-md">
                        Join your community to report local issues, vouch for priorities, and hold your city accountable with AI-driven routing.
                    </p>
                </div>

                <div className="relative z-10 text-xs font-bold tracking-widest uppercase text-white/50">
                    © {new Date().getFullYear()} Civic Issue Reporting System
                </div>
            </div>

            {/* Right side: Minimalist Auth Form */}
            <div className="flex flex-col justify-center px-6 sm:px-12 lg:px-24 py-12 bg-[#FAFAFA]">
                <div className="w-full max-w-[400px] mx-auto space-y-10 opacity-0 animate-fade-in-up">
                    {/* Mobile header (hidden on desktop) */}
                    <div className="flex lg:hidden items-center justify-center gap-3 mb-10">
                        <div className="w-12 h-12 bg-slate-900 text-white rounded-2xl flex items-center justify-center shadow-xl">
                            <MonitorSpeaker size={24} />
                        </div>
                        <span className="text-2xl font-black tracking-[-0.03em] text-slate-900">CivicReport</span>
                    </div>

                    <div className="space-y-3">
                        <h2 className="text-3xl font-black tracking-[-0.04em] text-slate-900">
                            {isLogin ? 'Welcome back' : 'Create an account'}
                        </h2>
                        <p className="text-base text-slate-500 font-medium">
                            {isLogin ? 'Enter your details to sign in.' : 'Enter your details to get started.'}
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        {error && (
                            <div className="bg-red-50 border border-red-100 text-red-600 px-4 py-3.5 rounded-2xl text-sm flex items-start gap-3 animate-in fade-in zoom-in-95 duration-200">
                                <AlertCircle size={18} className="shrink-0 mt-0.5" />
                                <span className="font-medium">{error}</span>
                            </div>
                        )}

                        {!isLogin && (
                            <div className="space-y-2">
                                <label className="text-xs font-bold tracking-wide uppercase text-slate-500 ml-1">Full Name</label>
                                <div className="relative">
                                    <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                    <input
                                        type="text"
                                        name="full_name"
                                        required={!isLogin}
                                        value={form.full_name}
                                        onChange={handleChange}
                                        placeholder="Jane Doe"
                                        className="w-full bg-white border border-slate-200 rounded-2xl pl-12 pr-4 py-3.5 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm focus:outline-none focus:ring-4 focus:ring-slate-900/10 focus:border-slate-400 transition-all font-medium"
                                    />
                                </div>
                            </div>
                        )}

                        {!isLogin && (
                            <>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold tracking-wide uppercase text-slate-500 ml-1">Current Address</label>
                                    <div className="relative">
                                        <MapPin size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                        <input
                                            type="text" name="current_address" required={!isLogin}
                                            value={form.current_address} onChange={handleChange}
                                            placeholder="123 Main St, City"
                                            className="w-full bg-white border border-slate-200 rounded-2xl pl-12 pr-4 py-3.5 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm focus:outline-none focus:ring-4 focus:ring-slate-900/10 focus:border-slate-400 font-medium"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold tracking-wide uppercase text-slate-500 ml-1">Home Address</label>
                                    <div className="relative">
                                        <Home size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                        <input
                                            type="text" name="home_address" required={!isLogin}
                                            value={form.home_address} onChange={handleChange}
                                            placeholder="Same as current, or permanent address"
                                            className="w-full bg-white border border-slate-200 rounded-2xl pl-12 pr-4 py-3.5 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm focus:outline-none focus:ring-4 focus:ring-slate-900/10 focus:border-slate-400 font-medium"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold tracking-wide uppercase text-slate-500 ml-1">Aadhaar Number</label>
                                    <div className="relative">
                                        <CreditCard size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                        <input
                                            type="text" name="aadhaar_number" required={!isLogin}
                                            value={form.aadhaar_number} onChange={handleChange}
                                            placeholder="12-digit Aadhaar"
                                            className="w-full bg-white border border-slate-200 rounded-2xl pl-12 pr-4 py-3.5 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm focus:outline-none focus:ring-4 focus:ring-slate-900/10 focus:border-slate-400 font-medium tracking-widest font-mono"
                                        />
                                    </div>
                                </div>
                                
                                {/* Registration Mobile Field with OTP */}
                                <div className="space-y-2">
                                    <label className="text-xs font-bold tracking-wide uppercase text-slate-500 ml-1">Mobile Number</label>
                                    <div className="flex gap-2">
                                        <div className="relative flex-1">
                                            <Phone size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                            <input
                                                type="text" name="phone" required={!isLogin}
                                                value={form.phone} onChange={handleChange}
                                                disabled={isMobileVerified || mobileOtpSent}
                                                placeholder="+919876543210"
                                                className="w-full bg-white border border-slate-200 rounded-2xl pl-12 pr-4 py-3.5 text-sm text-slate-900 disabled:bg-slate-50 placeholder:text-slate-400 shadow-sm focus:outline-none focus:ring-4 focus:ring-slate-900/10 focus:border-slate-400 font-medium"
                                            />
                                        </div>
                                        {isMobileVerified ? (
                                            <div className="flex items-center justify-center bg-green-50 text-green-600 px-4 rounded-2xl border border-green-200">
                                                <CheckCircle2 size={20} />
                                            </div>
                                        ) : !mobileOtpSent ? (
                                            <button type="button" onClick={() => handleSendOtp('mobile')} disabled={mobileLoading || !form.phone} className="bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-50 px-4 rounded-2xl text-sm font-bold transition-colors shrink-0">
                                                {mobileLoading ? <Loader2 size={16} className="animate-spin" /> : 'Send OTP'}
                                            </button>
                                        ) : null}
                                    </div>
                                    {!isMobileVerified && mobileOtpSent && (
                                        <div className="flex gap-2 mt-2 animate-in fade-in slide-in-from-top-2">
                                            <input
                                                type="text" value={mobileOtp} onChange={e => setMobileOtp(e.target.value)}
                                                placeholder="6-digit OTP" maxLength={6}
                                                className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 text-sm font-medium tracking-widest text-center"
                                            />
                                            <button type="button" onClick={() => handleVerifyOtp('mobile')} disabled={mobileLoading || mobileOtp.length < 6} className="bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 px-5 rounded-2xl text-sm font-bold transition-colors">
                                                {mobileLoading ? <Loader2 size={16} className="animate-spin" /> : 'Verify'}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}

                        {isLogin ? (
                            <div className="space-y-2">
                                <label className="text-xs font-bold tracking-wide uppercase text-slate-500 ml-1">Email</label>
                                <div className="relative">
                                    <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                    <input
                                        type="email" name="email" required
                                        value={form.email} onChange={handleChange}
                                        placeholder="jane@example.com"
                                        className="w-full bg-white border border-slate-200 rounded-2xl pl-12 pr-4 py-3.5 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm focus:outline-none focus:ring-4 focus:ring-slate-900/10 focus:border-slate-400 transition-all font-medium"
                                    />
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <label className="text-xs font-bold tracking-wide uppercase text-slate-500 ml-1">Email</label>
                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                        <input
                                            type="email" name="email" required
                                            value={form.email} onChange={handleChange}
                                            disabled={isEmailVerified || emailOtpSent}
                                            placeholder="jane@example.com"
                                            className="w-full bg-white border border-slate-200 rounded-2xl pl-12 pr-4 py-3.5 text-sm text-slate-900 disabled:bg-slate-50 placeholder:text-slate-400 shadow-sm focus:outline-none focus:ring-4 focus:ring-slate-900/10 focus:border-slate-400 font-medium"
                                        />
                                    </div>
                                    {isEmailVerified ? (
                                        <div className="flex items-center justify-center bg-green-50 text-green-600 px-4 rounded-2xl border border-green-200">
                                            <CheckCircle2 size={20} />
                                        </div>
                                    ) : !emailOtpSent ? (
                                        <button type="button" onClick={() => handleSendOtp('email')} disabled={emailLoading || !form.email} className="bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-50 px-4 rounded-2xl text-sm font-bold transition-colors shrink-0">
                                            {emailLoading ? <Loader2 size={16} className="animate-spin" /> : 'Send OTP'}
                                        </button>
                                    ) : null}
                                </div>
                                {!isEmailVerified && emailOtpSent && (
                                    <div className="flex gap-2 mt-2 animate-in fade-in slide-in-from-top-2">
                                        <input
                                            type="text" value={emailOtp} onChange={e => setEmailOtp(e.target.value)}
                                            placeholder="6-digit OTP" maxLength={6}
                                            className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 text-sm font-medium tracking-widest text-center"
                                        />
                                        <button type="button" onClick={() => handleVerifyOtp('email')} disabled={emailLoading || emailOtp.length < 6} className="bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 px-5 rounded-2xl text-sm font-bold transition-colors">
                                            {emailLoading ? <Loader2 size={16} className="animate-spin" /> : 'Verify'}
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="space-y-2">
                            <label className="text-xs font-bold tracking-wide uppercase text-slate-500 ml-1">Password</label>
                            <div className="relative">
                                <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                <input
                                    type="password"
                                    name="password"
                                    required
                                    value={form.password}
                                    onChange={handleChange}
                                    placeholder="••••••••"
                                    className="w-full bg-white border border-slate-200 rounded-2xl pl-12 pr-4 py-3.5 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm focus:outline-none focus:ring-4 focus:ring-slate-900/10 focus:border-slate-400 transition-all font-medium"
                                />
                            </div>
                        </div>

                        <div className="pt-4">
                            <button
                                type="submit"
                                disabled={isLoading || (!isLogin && (!isEmailVerified || !isMobileVerified))}
                                className="w-full bg-slate-900 hover:bg-black text-white font-bold tracking-wide py-4 px-4 rounded-2xl shadow-xl shadow-slate-900/20 transition-all active:scale-[0.98] disabled:opacity-70 disabled:pointer-events-none flex items-center justify-center gap-2"
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 size={18} className="animate-spin" />
                                        <span>{isLogin ? 'Signing in...' : 'Creating account...'}</span>
                                    </>
                                ) : (
                                    <span>{isLogin ? 'Sign In →' : 'Create Account →'}</span>
                                )}
                            </button>
                        </div>
                    </form>

                    <div className="text-center text-[13px] font-medium pt-4">
                        <span className="text-slate-500">
                            {isLogin ? "Don't have an account? " : "Already have an account? "}
                        </span>
                        <button
                            onClick={toggleMode}
                            type="button"
                            className="font-bold text-slate-900 hover:text-indigo-600 transition-colors ml-1"
                        >
                            {isLogin ? 'Create one' : 'Sign in'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
