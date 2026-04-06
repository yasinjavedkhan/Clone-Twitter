"use client";

import { useEffect, useState } from "react";
import { Phone, PhoneOff, Video, X, User, Volume2, VolumeX, Pause, Play, Mic, MicOff } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface CallUIProps {
    status: 'calling' | 'ringing' | 'connected' | 'ended' | 'incoming';
    type: 'voice' | 'video';
    otherUser: any;
    connectedAt: number | null;
    onEnd: () => void;
    onAccept?: () => void;
    onReject?: () => void;
    isSpeakerActive?: boolean;
    onToggleSpeaker?: () => void;
    isHoldActive?: boolean;
    onToggleHold?: () => void;
    isMuted?: boolean;
    onToggleMute?: () => void;
}

export default function CallUI({ 
    status, type, otherUser, connectedAt, onEnd, onAccept, onReject,
    isSpeakerActive, onToggleSpeaker, isHoldActive, onToggleHold, isMuted, onToggleMute 
}: CallUIProps) {
    const { user: currentUser } = useAuth();
    const [duration, setDuration] = useState(0);

    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (status === 'connected' && connectedAt) {
            interval = setInterval(() => {
                const now = Date.now();
                setDuration(Math.floor((now - connectedAt) / 1000));
            }, 1000);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [status, connectedAt]);

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const getStatusText = () => {
        if (status === 'incoming') return 'Incoming Call...';
        if (status === 'calling') return 'Calling...';
        if (status === 'ringing') return 'Ringing...';
        if (status === 'connected') return formatTime(duration);
        if (status === 'ended') return 'Call Ended';
        return '';
    };

    return (
        <div className="fixed inset-0 z-[9999] bg-[#050505] flex flex-col items-center justify-between py-20 px-6 animate-in fade-in duration-500 overflow-hidden">
            {/* Background Video (Remote) */}
            {type === 'video' && status === 'connected' && (
                <div id="remote-video-container" className="absolute inset-0 z-0 bg-black animate-in fade-in duration-1000 overflow-hidden" />
            )}

            {/* Background Blur Effect (Voice or Non-Connected) */}
            {!(type === 'video' && status === 'connected') && (
                <div className="absolute inset-0 z-0">
                    {otherUser?.profileImage ? (
                        <img 
                            src={otherUser.profileImage} 
                            className="w-full h-full object-cover opacity-20 blur-3xl scale-150" 
                            alt="Background" 
                        />
                    ) : (
                        <div className="w-full h-full bg-twitter-blue/10 blur-3xl" />
                    )}
                </div>
            )}

            {/* Top Section: Status & User Info */}
            <div className="relative z-10 flex flex-col items-center gap-8 w-full">
                <div className="bg-white/5 border border-white/10 px-4 py-1.5 rounded-full flex items-center gap-2 backdrop-blur-md">
                   <div className={`w-2 h-2 rounded-full animate-pulse ${status === 'connected' ? 'bg-green-500' : 'bg-twitter-blue'}`} />
                   <span className="text-white/60 text-[11px] font-black uppercase tracking-[0.2em]">
                       {status === 'connected' ? 'Secure Call' : 'System Ready'}
                   </span>
                </div>

                <div className="flex flex-col items-center gap-6">
                    <div className="relative">
                        {status !== 'connected' && (
                            <>
                                <div className="absolute inset-0 bg-twitter-blue/20 rounded-full animate-ping" />
                                <div className="absolute inset-0 bg-twitter-blue/10 rounded-full animate-pulse scale-125" />
                            </>
                        )}
                        <div className="relative w-40 h-40 rounded-full border-4 border-white/10 overflow-hidden shadow-2xl ring-8 ring-white/5">
                            {otherUser?.profileImage ? (
                                <img src={otherUser.profileImage} className="w-full h-full object-cover" alt="User" />
                            ) : (
                                <div className="w-full h-full bg-twitter-blue flex items-center justify-center text-6xl font-black text-white">
                                    {otherUser?.displayName?.[0] || otherUser?.username?.[0] || "?"}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="text-center space-y-2">
                        <h2 className="text-3xl font-black text-white tracking-tight drop-shadow-md">
                            {otherUser?.displayName || otherUser?.username || "Someone"}
                        </h2>
                        <p className={`text-sm font-bold tracking-widest uppercase transition-colors duration-300 ${status === 'connected' ? 'text-green-500' : 'text-twitter-blue animate-pulse'}`}>
                            {getStatusText()}
                        </p>
                    </div>
                </div>
            </div>

            {/* Bottom Section: Controls */}
            <div className="relative z-10 flex items-center justify-center gap-12 w-full max-w-sm mb-10">
                {status === 'incoming' ? (
                    <div className="flex flex-col items-center gap-10 w-full animate-in fade-in zoom-in duration-500">
                        <p className="text-twitter-blue font-black uppercase tracking-[0.3em] text-[10px] animate-pulse">
                            Incoming {type === 'video' ? 'Video' : 'Voice'} Call...
                        </p>
                        <div className="flex items-center justify-center gap-12 w-full max-w-sm">
                            <button 
                                onClick={onReject}
                                className="group flex flex-col items-center gap-3"
                            >
                                <div className="w-16 h-16 rounded-full bg-red-600 flex items-center justify-center text-white hover:bg-red-700 transition-all hover:scale-110 active:scale-95 shadow-xl shadow-red-900/30">
                                    <PhoneOff className="w-8 h-8" />
                                </div>
                                <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em]">Reject</span>
                            </button>

                            <button 
                                onClick={onAccept}
                                className="group flex flex-col items-center gap-3"
                            >
                                <div className="w-16 h-16 rounded-full bg-green-500 flex items-center justify-center text-white hover:bg-green-600 transition-all hover:scale-110 active:scale-95 shadow-xl shadow-green-900/30 animate-bounce">
                                    {type === 'video' ? <Video className="w-8 h-8" /> : <Phone className="w-8 h-8" />}
                                </div>
                                <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em]">Accept</span>
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-10 w-full h-full">
                        {/* Secondary Controls (Speaker, Hold, Mute) - ONLY visible in Connected State */}
                        {status === 'connected' && (
                            <div className="flex items-center justify-center gap-8 w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <button 
                                    onClick={onToggleSpeaker}
                                    className="group flex flex-col items-center gap-2 transition-transform active:scale-90"
                                >
                                    <div className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 ${isSpeakerActive ? 'bg-white text-black shadow-lg shadow-white/10' : 'bg-white/10 text-white hover:bg-white/20'}`}>
                                        {isSpeakerActive ? <Volume2 className="w-6 h-6" /> : <VolumeX className="w-6 h-6" />}
                                    </div>
                                    <span className="text-[9px] font-black uppercase tracking-widest text-white/40">{isSpeakerActive ? 'Speaker On' : 'Speaker Off'}</span>
                                </button>

                                <button 
                                    onClick={onToggleMute}
                                    className="group flex flex-col items-center gap-2 transition-transform active:scale-90"
                                >
                                    <div className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 ${isMuted ? 'bg-red-500 text-white shadow-lg shadow-red-500/10' : 'bg-white/10 text-white hover:bg-white/20'}`}>
                                        {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                                    </div>
                                    <span className="text-[9px] font-black uppercase tracking-widest text-white/40">Mute</span>
                                </button>

                                <button 
                                    onClick={onToggleHold}
                                    className="group flex flex-col items-center gap-2 transition-transform active:scale-90"
                                >
                                    <div className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 ${isHoldActive ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/10' : 'bg-white/10 text-white hover:bg-white/20'}`}>
                                        {isHoldActive ? <Play className="w-6 h-6" /> : <Pause className="w-6 h-6" />}
                                    </div>
                                    <span className="text-[9px] font-black uppercase tracking-widest text-white/40">{isHoldActive ? 'Resume' : 'Hold'}</span>
                                </button>
                            </div>
                        )}

                        {/* End Call Button - Visible in all other non-incoming states */}
                        {status !== 'ended' && (
                            <button 
                                onClick={onEnd}
                                className="group flex flex-col items-center gap-4 transition-transform active:scale-90"
                            >
                                <div className="w-20 h-20 bg-red-600 rounded-full hover:bg-red-700 transition-all duration-300 flex items-center justify-center shadow-2xl shadow-red-900/40 transform hover:rotate-[135deg]">
                                    <PhoneOff className="w-10 h-10 text-white" />
                                </div>
                                <span className="text-[11px] text-red-500 font-black uppercase tracking-[0.4em] drop-shadow-sm">End Call</span>
                            </button>
                        )}

                        {status === 'ended' && (
                             <div className="text-red-500 font-black uppercase tracking-[0.5em] text-sm animate-pulse">
                                 Disconnected
                             </div>
                        )}
                    </div>
                )}
            </div>

            {/* Current User Small Profile (WhatsApp style PiP) */}
            <div className="absolute top-20 right-6 z-20 animate-in slide-in-from-right duration-700">
                <div className="relative w-28 h-40 rounded-2xl border border-white/20 overflow-hidden shadow-2xl backdrop-blur-md bg-white/5">
                    {/* Local Video Stream Container */}
                    {type === 'video' && status === 'connected' ? (
                        <div id="local-video-container" className="w-full h-full bg-black mirror" />
                    ) : (
                        <>
                            {currentUser?.photoURL || (currentUser as any)?.profileImage ? (
                                <img 
                                    src={currentUser?.photoURL || (currentUser as any)?.profileImage} 
                                    className="w-full h-full object-cover" 
                                    alt="Me" 
                                />
                            ) : (
                                <div className="w-full h-full bg-gray-800 flex items-center justify-center text-xl font-bold text-white uppercase">
                                    {currentUser?.displayName?.[0] || "?"}
                                </div>
                            )}
                        </>
                    )}
                    <div className="absolute bottom-1 right-1">
                         <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_5px_rgba(34,197,94,0.8)]" />
                    </div>
                </div>
            </div>
        </div>
    );
}
