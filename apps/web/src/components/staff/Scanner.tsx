'use client';

import { Camera, CameraOff, Keyboard } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * One scanner for every input method on the staff PWA:
 *  - hardware scanners in keyboard-wedge mode (fast keystrokes ending in Enter)
 *  - the device camera (BarcodeDetector when available, ZXing otherwise)
 *  - manual typing
 */
export function Scanner({ onScan, placeholder = 'สแกนหรือพิมพ์ แล้วกด Enter' }: { onScan: (code: string) => void; placeholder?: string }) {
  const [camera, setCamera] = useState(false);
  const [manual, setManual] = useState('');
  const cb = useRef(onScan);
  useEffect(() => {
    cb.current = onScan;
  });
  const emitCode = useCallback((c: string) => cb.current(c), []);

  // keyboard-wedge capture (ignored while the user types in a field)
  useEffect(() => {
    let buf = '';
    let last = 0;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
      const now = performance.now();
      if (now - last > 80) buf = '';
      last = now;
      if (e.key === 'Enter') {
        if (buf.length >= 3) cb.current(buf);
        buf = '';
      } else if (e.key.length === 1) {
        buf += e.key;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="flex flex-col gap-2">
      {camera && <CameraView onCode={emitCode} />}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setCamera((v) => !v)}
          aria-label={camera ? 'ปิดกล้อง' : 'สแกนด้วยกล้อง'}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-line bg-card"
        >
          {camera ? <CameraOff size={20} aria-hidden /> : <Camera size={20} aria-hidden />}
        </button>
        <form
          className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-line bg-card px-3 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/30"
          onSubmit={(e) => {
            e.preventDefault();
            if (manual.trim()) cb.current(manual.trim());
            setManual('');
          }}
        >
          <Keyboard size={18} className="text-muted" aria-hidden />
          <label className="sr-only" htmlFor="manual-scan">
            พิมพ์รหัส
          </label>
          <input id="manual-scan" value={manual} onChange={(e) => setManual(e.target.value)} placeholder={placeholder} inputMode="text" autoComplete="off" className="min-w-0 flex-1 border-0 py-3 text-base outline-none focus-visible:outline-none" />
        </form>
      </div>
    </div>
  );
}

function CameraView({ onCode }: { onCode: (code: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let stop = () => {};
    let lastCode = '';
    let lastAt = 0;
    const emit = (code: string) => {
      const now = Date.now();
      if (code === lastCode && now - lastAt < 2500) return; // same label still in view
      lastCode = code;
      lastAt = now;
      onCode(code);
    };
    (async () => {
      try {
        type Detector = { detect: (v: HTMLVideoElement) => Promise<{ rawValue: string }[]> };
        const BD = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => Detector }).BarcodeDetector;
        if (BD) {
          const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
          const v = video.current!;
          v.srcObject = stream;
          await v.play();
          const det = new BD({ formats: ['code_128', 'code_39', 'ean_13', 'qr_code'] });
          let alive = true;
          const tick = async () => {
            if (!alive) return;
            try {
              const found = await det.detect(v);
              if (found[0]?.rawValue) emit(found[0].rawValue);
            } catch {
              /* frame not ready */
            }
            setTimeout(tick, 250);
          };
          void tick();
          stop = () => {
            alive = false;
            stream.getTracks().forEach((t) => t.stop());
          };
        } else {
          const { BrowserMultiFormatReader } = await import('@zxing/browser');
          const reader = new BrowserMultiFormatReader();
          const controls = await reader.decodeFromVideoDevice(undefined, video.current!, (res) => res && emit(res.getText()));
          stop = () => controls.stop();
        }
      } catch {
        setErr('เปิดกล้องไม่ได้ — ตรวจสิทธิ์กล้องหรือใช้เครื่องสแกน');
      }
    })();
    return () => stop();
  }, [onCode]);

  return (
    <div className="relative overflow-hidden rounded-xl bg-black">
      <video ref={video} className="h-48 w-full object-cover" muted playsInline />
      <div className="pointer-events-none absolute inset-x-8 top-1/2 h-0.5 -translate-y-1/2 bg-data" />
      {err && <p className="absolute inset-x-0 bottom-0 m-0 bg-danger-soft p-2 text-center text-sm text-danger">{err}</p>}
    </div>
  );
}

/** Short beep + vibration so the user doesn't have to look at the screen. */
export function feedback(ok: boolean) {
  try {
    navigator.vibrate?.(ok ? 60 : [80, 60, 80]);
    const ctx = new AudioContext();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = ok ? 1250 : 320;
    g.gain.value = 0.08;
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + (ok ? 0.08 : 0.25));
  } catch {
    /* audio blocked until first gesture */
  }
}
