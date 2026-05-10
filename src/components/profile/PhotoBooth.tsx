'use client';
import { useState, useRef, useEffect } from 'react';
import {
    Camera,
    Image as ImageIcon,
    Sparkles,
    Share2,
    Check,
    Instagram,
    Twitter,
    Wand2,
    ArrowRight,
    RefreshCw,
    UserPlus,
    Download,
    MessageCircle,
    Copy,
    ExternalLink
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toPng } from 'html-to-image';
import download from 'downloadjs';

export default function PhotoBooth() {
    const [capturedImage, setCapturedImage] = useState<string | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedAvatar, setGeneratedAvatar] = useState<string | null>(null);
    const [framedImage, setFramedImage] = useState<string | null>(null);
    const [nickname, setNickname] = useState('O3.Scholar');
    const [step, setStep] = useState<'hero' | 'preview' | 'result'>('hero');
    const [shareMessage, setShareMessage] = useState("Hey, I found the Best preparation platform for Jee/Neet! Check out ORIGIN AI.");
    const [referralLink, setReferralLink] = useState("https://origin-ai.vercel.app");
    
    const fileInputRef = useRef<HTMLInputElement>(null);
    const cameraInputRef = useRef<HTMLInputElement>(null);
    const frameTemplateRef = useRef<HTMLDivElement>(null);

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setCapturedImage(reader.result as string);
                setStep('preview');
            };
            reader.readAsDataURL(file);
        }
    };

    const handleGenerate = async () => {
        setIsGenerating(true);
        // Step 1: Simulated AI processing
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Step 2: Trigger frame generation from template
        setTimeout(async () => {
            if (frameTemplateRef.current) {
                try {
                    const dataUrl = await toPng(frameTemplateRef.current, {
                        quality: 0.95,
                        pixelRatio: 2,
                    });
                    setFramedImage(dataUrl);
                    setIsGenerating(false);
                    setStep('result');
                } catch (err) {
                    console.error('Frame generation failed:', err);
                    setIsGenerating(false);
                    setStep('result');
                }
            }
        }, 500);
    };

    const handleDownload = () => {
        if (framedImage) {
            download(framedImage, `Origin_Memory_${Date.now()}.png`);
        }
    };

    const shareToWhatsApp = () => {
        const text = encodeURIComponent(`Hey, I found the Best preparation platform for Jee/Neet! Check out ORIGIN AI.\n\nJoin here: https://origin-ai.vercel.app`);
        window.open(`https://wa.me/?text=${text}`, '_blank');
    };

    const shareToTwitter = () => {
        const text = encodeURIComponent(`Hey, I found the Best preparation platform for Jee/Neet! Check out ORIGIN AI.\n\nJoin here: https://origin-ai.vercel.app`);
        window.open(`https://twitter.com/intent/tweet?text=${text}`, '_blank');
    };

    const handleShare = async (platform?: 'whatsapp' | 'twitter') => {
        if (!framedImage) return;

        const fullMessage = `Hey, I found the Best preparation platform for Jee/Neet! Check out ORIGIN AI.\n\nJoin here: https://origin-ai.vercel.app`;

        try {
            const response = await fetch(framedImage);
            const blob = await response.blob();
            const filename = `Origin_Scholar_${nickname.replace(/\s+/g, '_')}_${Date.now()}.png`;
            const file = new File([blob], filename, { type: 'image/png' });

            // If platform is specified, we try to use native share with the file first
            // If it's not supported or fails, we fall back to the platform's URL scheme
            if (navigator.share && navigator.canShare({ files: [file] })) {
                await navigator.share({
                    files: [file],
                    text: fullMessage
                });
            } else {
                // Fallback to text-only if file sharing isn't supported
                if (platform === 'whatsapp') {
                    window.open(`https://wa.me/?text=${encodeURIComponent(fullMessage)}`, '_blank');
                } else if (platform === 'twitter') {
                    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(fullMessage)}`, '_blank');
                }
            }
        } catch (err) {
            console.error('Sharing failed:', err);
            // Emergency fallback
            window.open(`https://wa.me/?text=${encodeURIComponent(fullMessage)}`, '_blank');
        }
    };

    const reset = () => {
        setCapturedImage(null);
        setGeneratedAvatar(null);
        setFramedImage(null);
        setStep('hero');
    };

    return (
        <div className="w-full relative overflow-hidden rounded-[2.5rem] bg-[#030014] border border-white/5 shadow-2xl min-h-[700px] flex flex-col p-8 sm:p-12 group/booth">
            {/* Deep Gradient Background & Grid */}
            <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-[0.03] mix-blend-overlay z-0 pointer-events-none"></div>
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] z-0 pointer-events-none"></div>

            {/* Hidden Frame Template for Export */}
            <div className="absolute left-[-9999px] top-[-9999px]">
                <div 
                    ref={frameTemplateRef}
                    className="w-[1080px] h-[1080px] bg-card p-12 flex flex-col items-center justify-center relative overflow-hidden"
                    style={{ fontFamily: 'system-ui, sans-serif' }}
                >
                    {/* Frame Decoration */}
                    <div className="absolute inset-0 border-[40px] border-[#030014]"></div>
                    <div className="absolute inset-[40px] border-2 border-primary/20"></div>
                    
                    {/* Content Area */}
                    <div className="w-full h-full flex flex-col p-12 bg-[#030014] relative">
                        {/* User Photo */}
                        <div className="flex-1 w-full rounded-3xl overflow-hidden border-4 border-white/10 relative">
                            {capturedImage && (
                                <img src={capturedImage} alt="User" className="w-full h-full object-cover" />
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                        </div>

                        {/* Branding Footer */}
                        <div className="pt-10 flex items-center justify-between">
                            <div className="space-y-2">
                                <h2 className="text-white text-5xl font-black tracking-tight">{nickname}</h2>
                                <p className="text-primary/80 text-xl font-bold uppercase tracking-widest">ORIGIN AI • {new Date().getFullYear()}</p>
                            </div>
                            <div className="flex items-center gap-6">
                                <img src="/origin-new.jpg" alt="Origin Logo" className="w-24 h-24 rounded-2xl object-cover border-2 border-primary/50" />
                                <div className="text-right">
                                    <p className="text-white text-2xl font-black">Best Prep Platform</p>
                                    <p className="text-slate-400 text-lg font-bold">JEE / NEET / FOUNDATION</p>
                                </div>
                            </div>
                        </div>

                        {/* Aesthetic Elements */}
                        <div className="absolute top-16 right-16 px-6 py-3 rounded-full bg-primary text-white font-black text-xl tracking-[0.2em] uppercase shadow-lg shadow-primary/40">
                            Verified Scholar
                        </div>
                    </div>
                </div>
            </div>

            {/* Soft Radial Lighting Glows */}
            <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-primary/20 rounded-full blur-[120px] z-0 pointer-events-none mix-blend-screen transition-all duration-1000 group-hover/booth:bg-primary/30"></div>
            <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-primary/20 rounded-full blur-[100px] z-0 pointer-events-none mix-blend-screen transition-all duration-1000 group-hover/booth:bg-primary/20"></div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[40%] h-[40%] bg-primary/10 rounded-full blur-[80px] z-0 pointer-events-none"></div>

            <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*"
                onChange={handleFileUpload}
            />
            <input
                type="file"
                ref={cameraInputRef}
                className="hidden"
                accept="image/*"
                capture="user"
                onChange={handleFileUpload}
            />

            <div className="relative z-10 flex-1 flex flex-col w-full h-full">
                <AnimatePresence mode="wait">
                    {step === 'hero' && (
                        <motion.div
                            key="hero"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0, filter: 'blur(10px)', scale: 0.95 }}
                            transition={{ duration: 0.5 }}
                            className="flex-1 flex flex-col lg:flex-row items-center justify-between gap-12 w-full h-full"
                        >
                            {/* Left Side: Copy & CTAs */}
                            <div className="flex-1 space-y-8 z-10 mt-8 lg:mt-0 text-center lg:text-left flex flex-col items-center lg:items-start">
                                {/* Glowing Badge */}
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.2 }}
                                    className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-md shadow-[0_0_15px_var(--primary)]"
                                >
                                    <Sparkles className="w-3.5 h-3.5 text-primary/80" />
                                    <span className="text-[10px] sm:text-xs font-bold text-primary/60 uppercase tracking-[0.3em]">Origin Branded</span>
                                </motion.div>

                                {/* Heading */}
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.3 }}
                                    className="space-y-4"
                                >
                                    <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-white via-white to-white/40 leading-[1.1]">
                                        Scholar <br className="hidden lg:block" />
                                        <span className="bg-gradient-to-r from-primary/80 via-primary to-primary/60 bg-clip-text text-transparent">Photobooth</span>
                                    </h1>
                                    <p className="text-lg text-slate-400 font-medium max-w-md leading-relaxed mx-auto lg:mx-0">
                                        Create your custom Origin scholar memory. Take a photo, apply the frame, and share your journey.
                                    </p>
                                </motion.div>

                                {/* CTAs */}
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.4 }}
                                    className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto"
                                >
                                    <button
                                        onClick={() => fileInputRef.current?.click()}
                                        className="w-full sm:w-auto relative group px-8 py-4 rounded-full bg-primary font-bold text-white shadow-[0_0_40px_var(--primary)] hover:opacity-90 transition-all duration-300 hover:-translate-y-1 overflow-hidden"
                                    >
                                        <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out"></div>
                                        <span className="relative z-10 flex items-center justify-center gap-2 text-sm">
                                            Upload Photo <ImageIcon className="w-4 h-4" />
                                        </span>
                                    </button>
                                    <button 
                                        onClick={() => cameraInputRef.current?.click()}
                                        className="w-full sm:w-auto px-8 py-4 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 font-bold text-white backdrop-blur-md transition-all duration-300 hover:-translate-y-1 flex items-center justify-center gap-2 text-sm"
                                    >
                                        Use Camera <Camera className="w-4 h-4" />
                                    </button>
                                </motion.div>

                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: 0.6 }}
                                    className="flex items-center gap-4 text-slate-500 text-sm font-medium mt-4 lg:mt-0"
                                >
                                    <div className="flex -space-x-3">
                                        {[1, 2, 3].map(i => (
                                            <div key={i} className="w-8 h-8 rounded-full border-2 border-[#030014] bg-primary/20 flex items-center justify-center overflow-hidden">
                                                <img src={`https://i.pravatar.cc/100?img=${i + 15}`} alt="user" className="w-full h-full object-cover opacity-80" />
                                            </div>
                                        ))}
                                    </div>
                                    <span>Joined by 5,000+ Scholars</span>
                                </motion.div>
                            </div>

                            {/* Right Side: Visual Demo */}
                            <div className="flex-1 relative w-full aspect-square lg:aspect-auto lg:h-[500px] flex items-center justify-center mt-12 lg:mt-0">
                                <div className="relative w-full max-w-sm aspect-[3/4] bg-white/5 rounded-3xl border border-white/10 p-4 shadow-2xl rotate-6 group-hover:rotate-3 transition-transform duration-700">
                                    <div className="w-full h-[75%] rounded-2xl bg-slate-800/50 overflow-hidden mb-4">
                                        <img src="https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=500&h=700&fit=crop" alt="Demo" className="w-full h-full object-cover grayscale opacity-50" />
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <div className="space-y-1">
                                            <div className="h-4 w-24 bg-white/10 rounded"></div>
                                            <div className="h-3 w-16 bg-white/5 rounded"></div>
                                        </div>
                                        <div className="w-10 h-10 rounded-lg bg-primary/20 border border-primary/30"></div>
                                    </div>
                                    <div className="absolute inset-0 bg-gradient-to-tr from-primary/10 to-transparent pointer-events-none"></div>
                                </div>
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                    <div className="w-64 h-64 bg-primary/20 blur-[100px] rounded-full"></div>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {step === 'preview' && capturedImage && (
                        <motion.div
                            key="preview"
                            initial={{ opacity: 0, scale: 0.95, filter: 'blur(10px)' }}
                            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                            exit={{ opacity: 0, scale: 0.95, filter: 'blur(10px)' }}
                            className="w-full h-full flex flex-col items-center justify-center p-4 lg:p-12 z-10"
                        >
                            <div className="relative aspect-square w-full max-w-lg rounded-[2.5rem] overflow-hidden border border-white/10 shadow-[0_0_100px_rgba(0,0,0,0.5)] bg-slate-900">
                                <img src={capturedImage} alt="Capture" className="w-full h-full object-cover" />

                                {isGenerating && (
                                    <div className="absolute inset-0 bg-black/70 backdrop-blur-xl flex flex-col items-center justify-center text-center p-8 z-20">
                                        <div className="relative mb-8">
                                            <div className="w-24 h-24 rounded-full border-4 border-primary/20 border-t-primary animate-[spin_1.5s_linear_infinite]" />
                                            <div className="absolute inset-0 m-auto w-16 h-16 bg-primary/20 rounded-full blur-xl animate-pulse"></div>
                                            <Sparkles className="absolute inset-0 m-auto w-8 h-8 text-primary/80 animate-pulse" />
                                        </div>
                                        <h3 className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-primary/80 to-primary/60 font-black text-2xl uppercase tracking-[0.2em]">Applying Frame</h3>
                                        <p className="text-slate-400 text-xs mt-3 uppercase font-bold tracking-widest">Optimizing for sharing...</p>
                                    </div>
                                )}

                                {/* Overlay gradient for premium feel */}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none"></div>
                            </div>

                            {!isGenerating && (
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.3 }}
                                    className="flex gap-4 w-full max-w-lg mt-8"
                                >
                                    <button
                                        className="flex-1 h-14 rounded-full border border-primary/20 hover:bg-primary/10 text-white font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-colors backdrop-blur-md"
                                        onClick={reset}
                                    >
                                        <RefreshCw className="w-4 h-4" /> Retake
                                    </button>
                                    <button
                                        className="flex-[2] h-14 px-8 rounded-full bg-primary hover:opacity-90 text-white font-black uppercase tracking-widest shadow-[0_0_30px_var(--primary)] flex items-center justify-center gap-2 transition-all group"
                                        onClick={handleGenerate}
                                    >
                                        Apply Origin Frame <Sparkles className="w-4 h-4 group-hover:rotate-12 transition-transform" />
                                    </button>
                                </motion.div>
                            )}
                        </motion.div>
                    )}

                    {step === 'result' && framedImage && (
                        <motion.div
                            key="result"
                            initial={{ opacity: 0, scale: 0.95, filter: 'blur(10px)' }}
                            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                            className="w-full h-full grid grid-cols-1 lg:grid-cols-2 gap-12 items-center z-10 p-4 lg:p-8"
                        >
                            <div className="relative group perspective-1000 mx-auto w-full max-w-md">
                                <div className="absolute inset-0 bg-primary/20 blur-[100px] group-hover:bg-primary/30 transition-all duration-700 pointer-events-none" />
                                <motion.div
                                    className="relative aspect-square rounded-[2.5rem] overflow-hidden border border-primary/20 shadow-[0_0_80px_var(--primary)]"
                                    whileHover={{ rotateY: 5, rotateX: -5 }}
                                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                                    style={{ transformStyle: "preserve-3d" }}
                                >
                                    <img src={framedImage} alt="Framed Result" className="w-full h-full object-contain bg-slate-900" />
                                </motion.div>
                            </div>

                            <div className="space-y-8 max-w-md mx-auto lg:mx-0 w-full">
                                <div className="space-y-4 text-center lg:text-left">
                                    <div className="inline-flex items-center justify-center lg:justify-start gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase tracking-widest mb-2">
                                        <Check className="w-3 h-3" /> Frame Applied Successfully
                                    </div>
                                    <h3 className="text-4xl md:text-5xl font-black text-white tracking-tighter leading-tight">Your Scholar <br /><span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-primary/80 to-primary/60">Memory Card</span></h3>
                                    
                                    <div className="space-y-2 text-left pt-2">
                                        <label className="text-[10px] font-black text-primary uppercase tracking-widest ml-1">Nickname on Card</label>
                                        <input
                                            type="text"
                                            value={nickname}
                                            onChange={(e) => setNickname(e.target.value)}
                                            className="w-full h-12 px-5 rounded-xl bg-white/5 border border-white/10 text-white font-bold text-sm outline-none focus:border-primary/50 transition-all"
                                            placeholder="Scholars Name..."
                                        />
                                        <p className="text-[10px] text-slate-500 font-medium italic">*Update nickname and click "Apply" again to refresh card</p>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <button 
                                        onClick={handleDownload}
                                        className="w-full h-16 rounded-2xl bg-white/5 text-white border border-white/10 hover:bg-white/10 transition-all flex items-center justify-center gap-3 font-black uppercase tracking-widest shadow-xl group"
                                    >
                                        <Download className="w-5 h-5 group-hover:translate-y-0.5 transition-transform" /> Download Photo
                                    </button>

                                    <div className="grid grid-cols-2 gap-4">
                                        <button 
                                            onClick={() => handleShare('whatsapp')}
                                            className="h-14 rounded-2xl bg-[#25D366]/10 border border-[#25D366]/20 hover:bg-[#25D366]/20 transition-all flex items-center justify-center gap-2 text-[#25D366] font-bold uppercase tracking-widest text-xs"
                                        >
                                            <MessageCircle className="w-4 h-4" /> WhatsApp
                                        </button>
                                        <button 
                                            onClick={() => handleShare()}
                                            className="h-14 rounded-2xl bg-primary hover:opacity-90 transition-all flex items-center justify-center gap-2 text-white font-bold uppercase tracking-widest text-xs shadow-lg shadow-primary/20"
                                        >
                                            <Share2 className="w-4 h-4" /> Share Card
                                        </button>
                                    </div>
                                    
                                    <div className="flex gap-4">
                                        <button 
                                            onClick={() => handleShare('twitter')}
                                            className="flex-1 h-14 rounded-2xl bg-[#1DA1F2]/10 border border-[#1DA1F2]/20 hover:bg-[#1DA1F2]/20 transition-all flex items-center justify-center gap-2 text-[#1DA1F2] font-bold uppercase tracking-widest text-xs"
                                        >
                                            <Twitter className="w-4 h-4" /> Twitter
                                        </button>
                                        <button 
                                            onClick={() => {
                                                const fullMessage = `Hey, I found the Best preparation platform for Jee/Neet! Check out ORIGIN AI.\n\nJoin here: https://origin-ai.vercel.app`;
                                                navigator.clipboard.writeText(fullMessage);
                                                alert('Branded message & link copied!');
                                            }}
                                            className="flex-1 h-14 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all flex items-center justify-center gap-2 text-primary font-bold uppercase tracking-widest text-xs"
                                        >
                                            <Copy className="w-4 h-4" /> Copy Link
                                        </button>
                                    </div>
                                </div>

                                <button
                                    onClick={reset}
                                    className="w-full text-center text-slate-500 hover:text-white font-bold uppercase tracking-widest text-xs transition-colors mt-2"
                                >
                                    Create Another Memory
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Footer / Info */}
            <div className="mt-8 pt-6 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between z-10 gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20">
                        <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                        <p className="text-white font-bold text-sm tracking-tight">Share your success</p>
                        <p className="text-slate-500 text-xs font-medium">Tag @OriginAI to get featured</p>
                    </div>
                </div>
                <button 
                    onClick={() => window.open(referralLink, '_blank')}
                    className="group flex items-center gap-2 px-6 py-3 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 backdrop-blur-md transition-all duration-300"
                >
                    <span className="text-xs font-bold text-white uppercase tracking-widest">Visit Origin AI</span>
                    <ExternalLink className="w-4 h-4 text-white group-hover:translate-x-1 transition-transform duration-300" />
                </button>
            </div>
        </div>
    );
}

