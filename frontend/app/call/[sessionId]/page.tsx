'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const WS_BASE = API_BASE.replace(/^http/, 'ws');
/** Shorter slices = less wait after the advisor stops talking before STT runs (tradeoff: more API calls). */
const MIC_SLICE_MS = 1500;

type CallStatus = 'prejoin' | 'connecting' | 'ringing' | 'live' | 'ended' | 'error';

export default function CallPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params?.sessionId as string;
  const [status, setStatus] = useState<CallStatus>('prejoin');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [joinStarted, setJoinStarted] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const bufferQueueRef = useRef<AudioBuffer[]>([]);
  const htmlAudioQueueRef = useRef<HTMLAudioElement[]>([]);
  const htmlAudioPlayingRef = useRef(false);
  /** Currently playing HTMLAudioElement — pause on barge-in. */
  const currentHtmlAudioRef = useRef<HTMLAudioElement | null>(null);
  const micAnalyserRef = useRef<AnalyserNode | null>(null);
  const micVadCtxRef = useRef<AudioContext | null>(null);
  const vadActiveRef = useRef(false);
  const vadRafRef = useRef<number | null>(null);
  const bargeSpeechStreakRef = useRef(0);
  const lastBargeAtRef = useRef(0);
  const advisorBargeInRef = useRef<() => void>(() => {});
  const decodeChainRef = useRef(Promise.resolve());
  const isPlayingRef = useRef(false);
  const intentionalCloseRef = useRef(false);
  /** When false, advisor mic chunks are not sent (AI is speaking — avoid echo + non-stop replies). */
  const micMaySendRef = useRef(false);
  const releaseMicTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleAdvisorTurnRef = useRef<() => void>(() => {});

  const ringOscRef = useRef<{ stop: () => void } | null>(null);

  const ensureAudioCtx = useCallback(async () => {
    const win = window as Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext };
    const AC = window.AudioContext || win.webkitAudioContext;
    if (!AC) return;
    if (!audioCtxRef.current) audioCtxRef.current = new AC();
    if (audioCtxRef.current.state === 'suspended') await audioCtxRef.current.resume();
  }, []);

  const playRingTone = useCallback(async () => {
    await ensureAudioCtx();
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.connect(ctx.destination);
    let stopped = false;
    const playBurst = (startTime: number) => {
      if (stopped) return;
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      osc1.frequency.value = 440;
      osc2.frequency.value = 480;
      osc1.connect(gain);
      osc2.connect(gain);
      gain.gain.setValueAtTime(0.12, startTime);
      gain.gain.setValueAtTime(0, startTime + 0.8);
      osc1.start(startTime);
      osc2.start(startTime);
      osc1.stop(startTime + 0.8);
      osc2.stop(startTime + 0.8);
    };
    const now = ctx.currentTime;
    playBurst(now + 0.1);
    playBurst(now + 1.6);
    playBurst(now + 3.1);
    ringOscRef.current = {
      stop: () => {
        stopped = true;
        gain.gain.cancelScheduledValues(ctx.currentTime);
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.disconnect();
      },
    };
  }, [ensureAudioCtx]);

  const stopRingTone = useCallback(() => {
    ringOscRef.current?.stop();
    ringOscRef.current = null;
  }, []);

  const playNextHtmlAudioRef = useRef<() => void>(() => {});

  const playNextHtmlAudio = useCallback(() => {
    if (htmlAudioPlayingRef.current || htmlAudioQueueRef.current.length === 0) return;
    const el = htmlAudioQueueRef.current.shift()!;
    currentHtmlAudioRef.current = el;
    htmlAudioPlayingRef.current = true;
    el.onended = () => {
      if (currentHtmlAudioRef.current === el) currentHtmlAudioRef.current = null;
      htmlAudioPlayingRef.current = false;
      playNextHtmlAudioRef.current();
      scheduleAdvisorTurnRef.current();
    };
    el.play().catch(() => {
      currentHtmlAudioRef.current = null;
      htmlAudioPlayingRef.current = false;
      setAudioBlocked(true);
      setErrorMsg('Could not play AI audio. Tap "Enable Audio" below.');
    });
  }, []);

  playNextHtmlAudioRef.current = playNextHtmlAudio;

  const tryReleaseMicAfterAi = useCallback(() => {
    if (
      bufferQueueRef.current.length > 0 ||
      isPlayingRef.current ||
      htmlAudioQueueRef.current.length > 0 ||
      htmlAudioPlayingRef.current
    ) {
      return;
    }
    if (releaseMicTimerRef.current) clearTimeout(releaseMicTimerRef.current);
    releaseMicTimerRef.current = setTimeout(() => {
      if (
        bufferQueueRef.current.length > 0 ||
        isPlayingRef.current ||
        htmlAudioQueueRef.current.length > 0 ||
        htmlAudioPlayingRef.current
      ) {
        scheduleAdvisorTurnRef.current();
        releaseMicTimerRef.current = null;
        return;
      }
      micMaySendRef.current = true;
      const rec = recorderRef.current;
      const ws = wsRef.current;
      if (rec && ws?.readyState === WebSocket.OPEN) {
        try {
          if (rec.state === 'paused' && typeof rec.resume === 'function') rec.resume();
          else if (rec.state === 'inactive') rec.start(MIC_SLICE_MS);
        } catch {
          /* ignore */
        }
        if (!intervalRef.current) {
          intervalRef.current = setInterval(() => {
            if (!micMaySendRef.current || !recorderRef.current) return;
            const r = recorderRef.current;
              if (r.state === 'recording') {
              r.stop();
                r.start(MIC_SLICE_MS);
            }
          }, MIC_SLICE_MS);
        }
      }
      releaseMicTimerRef.current = null;
    }, 120);
  }, []);

  scheduleAdvisorTurnRef.current = tryReleaseMicAfterAi;

  /** Stop customer TTS and open the mic — used when the advisor talks over the AI (barge-in). */
  const advisorBargeIn = useCallback(() => {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (now - lastBargeAtRef.current < 550) return;
    if (!htmlAudioPlayingRef.current && htmlAudioQueueRef.current.length === 0) return;
    lastBargeAtRef.current = now;

    for (const el of htmlAudioQueueRef.current) {
      try {
        el.pause();
        el.removeAttribute('src');
      } catch {
        /* ignore */
      }
    }
    htmlAudioQueueRef.current = [];
    const cur = currentHtmlAudioRef.current;
    if (cur) {
      try {
        cur.pause();
        cur.removeAttribute('src');
      } catch {
        /* ignore */
      }
      currentHtmlAudioRef.current = null;
    }
    htmlAudioPlayingRef.current = false;
    bufferQueueRef.current = [];
    isPlayingRef.current = false;

    if (releaseMicTimerRef.current) {
      clearTimeout(releaseMicTimerRef.current);
      releaseMicTimerRef.current = null;
    }
    micMaySendRef.current = true;
    const rec = recorderRef.current;
    const ws = wsRef.current;
    if (rec && ws?.readyState === WebSocket.OPEN) {
      try {
        if (rec.state === 'paused' && typeof rec.resume === 'function') rec.resume();
        else if (rec.state === 'inactive') rec.start(MIC_SLICE_MS);
      } catch {
        /* ignore */
      }
      if (!intervalRef.current) {
        intervalRef.current = setInterval(() => {
          if (!micMaySendRef.current || !recorderRef.current) return;
          const r = recorderRef.current;
          if (r.state === 'recording') {
            r.stop();
            r.start(MIC_SLICE_MS);
          }
        }, MIC_SLICE_MS);
      }
    }
  }, []);

  advisorBargeInRef.current = advisorBargeIn;

  const blockMicWhileAiSpeaks = useCallback(() => {
    micMaySendRef.current = false;
    if (releaseMicTimerRef.current) {
      clearTimeout(releaseMicTimerRef.current);
      releaseMicTimerRef.current = null;
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    const rec = recorderRef.current;
    if (!rec) return;
    try {
      if (typeof rec.pause === 'function' && rec.state === 'recording') {
        rec.pause();
      } else if (rec.state === 'recording') {
        rec.stop();
      }
    } catch {
      /* ignore */
    }
  }, []);

  const playNextBuffer = useCallback(async () => {
    if (isPlayingRef.current || bufferQueueRef.current.length === 0) return;
    const buf = bufferQueueRef.current.shift()!;
    try {
      await ensureAudioCtx();
      const ctx = audioCtxRef.current;
      if (!ctx) return;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      isPlayingRef.current = true;
      src.onended = () => {
        isPlayingRef.current = false;
        void playNextBuffer();
        scheduleAdvisorTurnRef.current();
      };
      src.start();
    } catch {
      isPlayingRef.current = false;
      setAudioBlocked(true);
      setErrorMsg('Could not play AI audio. Tap "Enable Audio" below.');
    }
  }, [ensureAudioCtx]);

  const decodeMp3Base64 = useCallback(
    async (b64: string) => {
      await ensureAudioCtx();
      const ctx = audioCtxRef.current;
      if (!ctx) throw new Error('No AudioContext');
      const binary = atob(b64);
      const len = binary.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
      // Must use exact byte range; raw .buffer can be larger than len and breaks MP3 decode.
      const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
      return ctx.decodeAudioData(ab);
    },
    [ensureAudioCtx]
  );

  useEffect(() => {
    if (sessionId === 'demo') {
      setJoinStarted(true);
      setStatus('live');
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    }
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId || sessionId === 'demo') return;
    if (!joinStarted) return;

    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) {
      setErrorMsg('Not logged in');
      setStatus('error');
      return;
    }

    const url = `${WS_BASE}/api/practice/browser-stream?session_id=${encodeURIComponent(sessionId)}&token=${encodeURIComponent(token)}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    let firstAudioReceived = false;

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string);
        if (msg.type === 'audio' && msg.data) {
          if (!firstAudioReceived) {
            firstAudioReceived = true;
            stopRingTone();
            setStatus('live');
            if (!timerRef.current) {
              timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
            }
          }
          blockMicWhileAiSpeaks();
          const b64 = msg.data as string;
          const audio = new Audio(`data:audio/mpeg;base64,${b64}`);
          htmlAudioQueueRef.current.push(audio);
          playNextHtmlAudioRef.current();
          return;
        }
        if (msg.type === 'error' && msg.message) {
          setErrorMsg(String(msg.message));
          setStatus('error');
        }
      } catch {
        /* ignore */
      }
    };

    ws.onopen = async () => {
      micMaySendRef.current = false;
      setStatus('ringing');
      void playRingTone();
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;
        const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm';
        const recorder = new MediaRecorder(stream, { mimeType: mime, audioBitsPerSecond: 16000 });
        recorderRef.current = recorder;
        let chunks: Blob[] = [];
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunks.push(e.data);
        };
        recorder.onstop = () => {
          if (!micMaySendRef.current) {
            chunks = [];
            return;
          }
          if (chunks.length > 0 && ws.readyState === WebSocket.OPEN) {
            const blob = new Blob(chunks, { type: mime });
            const reader = new FileReader();
            reader.onloadend = () => {
              const base64 = (reader.result as string).split(',')[1];
              if (base64) ws.send(JSON.stringify({ type: 'audio', data: base64 }));
            };
            reader.readAsDataURL(blob);
          }
          chunks = [];
        };
        recorder.start(MIC_SLICE_MS);
        if (typeof recorder.pause === 'function') {
          try {
            recorder.pause();
          } catch {
            /* ignore */
          }
        }

        // Mic-level monitor: advisor can interrupt AI playback (barge-in), like a real phone call.
        try {
          const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
          if (AC) {
            vadActiveRef.current = true;
            const actx = new AC();
            micVadCtxRef.current = actx;
            const src = actx.createMediaStreamSource(stream);
            const analyser = actx.createAnalyser();
            analyser.fftSize = 1024;
            analyser.smoothingTimeConstant = 0.45;
            const silent = actx.createGain();
            silent.gain.value = 0;
            src.connect(analyser);
            analyser.connect(silent);
            silent.connect(actx.destination);
            micAnalyserRef.current = analyser;
            const data = new Uint8Array(analyser.frequencyBinCount);
            const loop = () => {
              if (!vadActiveRef.current) return;
              vadRafRef.current = requestAnimationFrame(loop);
              const a = micAnalyserRef.current;
              if (!a || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
              const aiPlaying = htmlAudioPlayingRef.current || htmlAudioQueueRef.current.length > 0;
              if (!aiPlaying) {
                bargeSpeechStreakRef.current = 0;
                return;
              }
              a.getByteTimeDomainData(data);
              let sum = 0;
              for (let i = 0; i < data.length; i++) {
                const v = (data[i]! - 128) / 128;
                sum += v * v;
              }
              const rms = Math.sqrt(sum / data.length);
              if (rms > 0.052) {
                bargeSpeechStreakRef.current += 1;
                if (bargeSpeechStreakRef.current >= 7) {
                  bargeSpeechStreakRef.current = 0;
                  advisorBargeInRef.current();
                }
              } else {
                bargeSpeechStreakRef.current = Math.max(0, bargeSpeechStreakRef.current - 1);
              }
            };
            vadRafRef.current = requestAnimationFrame(loop);
          }
        } catch {
          /* VAD optional */
        }
      } catch {
        setErrorMsg('Microphone access denied');
        setStatus('error');
        intentionalCloseRef.current = true;
        ws.close();
      }
    };

    ws.onerror = () => {
      setErrorMsg('Connection error');
      setStatus('error');
    };
    ws.onclose = () => {
      if (!intentionalCloseRef.current) {
        setStatus('error');
        setErrorMsg((m) => m ?? 'Connection closed');
      }
    };

    return () => {
      intentionalCloseRef.current = true;
      stopRingTone();
      vadActiveRef.current = false;
      if (vadRafRef.current != null) {
        cancelAnimationFrame(vadRafRef.current);
        vadRafRef.current = null;
      }
      micAnalyserRef.current = null;
      void micVadCtxRef.current?.close();
      micVadCtxRef.current = null;
      if (releaseMicTimerRef.current) clearTimeout(releaseMicTimerRef.current);
      ws.close();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      recorderRef.current?.stop();
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [sessionId, joinStarted, decodeMp3Base64, playNextBuffer, blockMicWhileAiSpeaks, playRingTone, stopRingTone]);

  const handlePrejoinConnect = async () => {
    setErrorMsg(null);
    await ensureAudioCtx();
    setStatus('connecting');
    setJoinStarted(true);
  };

  const endCall = () => {
    intentionalCloseRef.current = true;
    stopRingTone();
    if (releaseMicTimerRef.current) clearTimeout(releaseMicTimerRef.current);
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'end' }));
      wsRef.current.close();
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    recorderRef.current?.stop();
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
    void audioCtxRef.current?.close();
    setStatus('ended');
    router.push('/');
  };

  const formatTime = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#0f1117] p-6">
      <div className="w-full max-w-sm animate-scale-in">
        <div className="rounded-3xl bg-gradient-to-b from-gray-800/80 to-gray-900/90 border border-white/10 p-8 text-center backdrop-blur-xl shadow-2xl">
          {status === 'prejoin' && sessionId !== 'demo' && (
            <>
              <div className="w-20 h-20 rounded-full bg-[#FFC107]/15 flex items-center justify-center mx-auto mb-5">
                <svg className="w-10 h-10 text-[#FFC107]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                  />
                </svg>
              </div>
              <h1 className="text-xl font-bold text-white mb-2">Ready to practice</h1>
              <p className="text-gray-400 text-sm mb-4 leading-relaxed">
                When you start the call, you'll hear the phone ring. The customer will pick up and speak first — greet them like a real advisor and the conversation flows naturally.
              </p>
              <div className="flex items-start gap-3 text-left mb-6 bg-white/5 rounded-xl p-3.5 border border-white/10">
                <span className="text-[#FFC107] mt-0.5 flex-shrink-0">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>
                </span>
                <p className="text-gray-400 text-xs leading-relaxed">
                  Use headphones for best results. You can interrupt the customer anytime — just start talking.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void handlePrejoinConnect()}
                className="w-full py-3.5 rounded-xl text-gray-900 font-bold bg-gradient-to-r from-[#FFC107] to-[#FFD54F] shadow-yellow hover:shadow-yellow-lg transition-all active:scale-[0.98]"
              >
                Start Call
              </button>
            </>
          )}

          {status === 'connecting' && (
            <>
              <div className="w-20 h-20 rounded-full bg-[#FFC107]/10 flex items-center justify-center mx-auto mb-6">
                <div className="w-12 h-12 border-2 border-[#FFC107]/30 border-t-[#FFC107] rounded-full loading-spinner" />
              </div>
              <p className="text-white font-medium text-lg">Connecting…</p>
              <p className="text-gray-500 text-sm mt-1">Preparing your practice call</p>
            </>
          )}

          {status === 'ringing' && (
            <>
              <div className="relative w-24 h-24 mx-auto mb-6">
                <div className="absolute inset-0 rounded-full bg-[#FFC107]/20" style={{ animation: 'pulse-ring 1s ease-out infinite' }} />
                <div className="absolute inset-3 rounded-full bg-[#FFC107]/15" style={{ animation: 'pulse-ring 1s ease-out infinite 0.25s' }} />
                <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-[#FFC107] to-[#FF8F00] flex items-center justify-center shadow-lg shadow-[#FFC107]/30">
                  <svg className="w-10 h-10 text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                </div>
              </div>
              <h1 className="text-xl font-bold text-white mb-1">Ringing…</h1>
              <p className="text-gray-400 text-sm">Customer is picking up the phone</p>
            </>
          )}

          {status === 'live' && (
            <>
              <div className="relative w-24 h-24 mx-auto mb-6">
                <div className="absolute inset-0 rounded-full bg-[#00C853]/20" style={{ animation: 'pulse-ring 1.5s ease-out infinite' }} />
                <div className="absolute inset-2 rounded-full bg-[#00C853]/30" style={{ animation: 'pulse-ring 1.5s ease-out infinite 0.3s' }} />
                <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                  <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                </div>
              </div>

              <h1 className="text-xl font-bold text-white mb-1">
                {sessionId === 'demo' ? 'Demo Call Active' : "You're Live"}
              </h1>
              <p className="text-gray-400 text-sm mb-2">
                {sessionId === 'demo'
                  ? 'This is a demo — connect backend for real AI conversations'
                  : 'Speak whenever you want — if you talk over the customer, they stop so you can go first. Headphones reduce echo.'}
              </p>

              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 mt-3 mb-6">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-white font-mono text-lg">{formatTime(elapsed)}</span>
              </div>

              {audioBlocked && (
                <button
                  type="button"
                  onClick={() => {
                    setAudioBlocked(false);
                    setErrorMsg(null);
                    void ensureAudioCtx().then(() => {
                      void playNextBuffer();
                      playNextHtmlAudioRef.current();
                    });
                  }}
                  className="w-full py-3 rounded-xl text-gray-900 font-semibold bg-gradient-to-r from-[#FFC107] to-[#FFD54F] shadow-yellow hover:shadow-yellow-lg transition-all active:scale-[0.98] mb-3"
                >
                  Enable Audio
                </button>
              )}
              <button
                type="button"
                onClick={endCall}
                className="w-full py-3.5 rounded-xl text-white font-semibold bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 shadow-lg shadow-red-500/30 hover:shadow-red-500/50 transition-all active:scale-[0.98]"
              >
                End Call
              </button>
            </>
          )}

          {status === 'ended' && (
            <>
              <div className="w-16 h-16 rounded-2xl bg-gray-700 flex items-center justify-center mx-auto mb-5">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-white mb-1">Call Ended</h2>
              <p className="text-gray-500 text-sm mb-6">Your call lasted {formatTime(elapsed)}</p>
              <Link href="/" className="inline-block w-full py-3 rounded-xl font-semibold text-gray-900 bg-gradient-to-r from-[#FFC107] to-[#FFD54F] shadow-yellow hover:shadow-yellow-lg transition-all">
                Back to Dashboard
              </Link>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto mb-5">
                <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.27 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <p className="text-red-300 font-medium mb-1">{errorMsg || 'Something went wrong'}</p>
              <p className="text-gray-500 text-sm mb-6">Please try again</p>
              <Link href="/" className="inline-block w-full py-3 rounded-xl font-semibold text-gray-900 bg-gradient-to-r from-[#FFC107] to-[#FFD54F] shadow-yellow transition-all">
                Back to Dashboard
              </Link>
            </>
          )}
        </div>

        {status === 'live' && (
          <p className="text-center text-gray-600 text-xs mt-4">
            J.J.&apos;s Motors AI Coach &middot; Practice Session
          </p>
        )}
      </div>
    </div>
  );
}
