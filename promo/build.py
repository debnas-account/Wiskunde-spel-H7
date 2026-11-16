"""Monteert de promo: frames met tijdstempels worden video, de voice-over en spelgeluidjes worden de audiotrack."""
import json, subprocess, wave, os
import numpy as np

T = json.load(open('timeline.json'))
LEAD = 0.4
SR = 48000
t0 = T['scenes'][0]['t']
end = T['scenes'][-1]['t'] + T['scenes'][-1]['dur']
total = end - t0

# --- beeld: elk frame blijft staan tot het volgende komt ---
fr = T['frames']
before = [i for i, f in enumerate(fr) if f['t'] <= t0]
fr = [f for f in fr[(before[-1] if before else 0):] if f['t'] < end]
fr[0]['t'] = t0
with open('list.txt', 'w') as f:
    for a, b in zip(fr, fr[1:] + [{'t': end}]):
        f.write(f"file 'frames/{a['f']}'\nduration {max(b['t'] - a['t'], 0.001):.4f}\n")
    f.write(f"file 'frames/{fr[-1]['f']}'\n")
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', 'list.txt',
                '-vf', 'fps=30,scale=1920:1080:flags=lanczos,format=yuv420p',
                '-c:v', 'libx264', '-preset', 'slow', '-crf', '19', 'video.mp4'], check=True)

# --- geluid ---
n_total = int((total + 0.5) * SR)
vo = np.zeros(n_total, dtype=np.float32)
for s in T['scenes']:
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', f"vo/final/{s['id']}.wav", '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'],
                         capture_output=True, check=True).stdout
    pcm = np.frombuffer(raw, dtype=np.float32)
    i = int((s['t'] - t0 + LEAD) * SR)
    n = min(len(pcm), n_total - i)
    vo[i:i + n] += pcm[:n]
vo *= 0.85 / max(1e-6, float(np.abs(vo).max()))


def tone(f, dur, kind='sine', f2=None):
    t = np.arange(int(dur * SR)) / SR
    freq = f * (f2 / f) ** (t / dur) if f2 else np.full_like(t, f)
    ph = 2 * np.pi * np.cumsum(freq) / SR
    w = {'sine': np.sin(ph), 'triangle': 2 / np.pi * np.arcsin(np.sin(ph)),
         'square': np.sign(np.sin(ph)) * 0.6, 'saw': 2 * ((ph / (2 * np.pi)) % 1) - 1}[kind]
    return (w * np.exp(-5.5 * t / dur)).astype(np.float32)


def join(parts):
    n = max(int(o * SR) + len(s) for o, s in parts)
    out = np.zeros(n, dtype=np.float32)
    for o, s in parts:
        out[int(o * SR):int(o * SR) + len(s)] += s
    return out


SFX = {
    'ok': join([(0, tone(660, .07, 'triangle')), (.07, tone(990, .11, 'triangle'))]),
    'bad': tone(170, .2, 'saw') * 0.8,
    'fire': tone(1500, .42, 'saw', 220) * 0.7,
    'hit': join([(0, tone(1300, .05, 'square')), (.05, tone(1900, .16, 'triangle'))]),
}
fx = np.zeros(n_total, dtype=np.float32)
for e in T['sfx']:
    sig = SFX[e['name']]
    i = int((e['t'] - t0) * SR)
    n = min(len(sig), n_total - i)
    if i >= 0 and n > 0:
        fx[i:i + n] += sig[:n] * 0.11
out = np.clip(vo + fx, -1, 1)[:int(total * SR)]
w = wave.open('audio.wav', 'wb')
w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
w.writeframes((out * 32767).astype(np.int16).tobytes())
w.close()

subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', 'video.mp4', '-i', 'audio.wav', '-c:v', 'copy',
                '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', '-ar', '48000', '-ac', '2', '-c:a', 'aac', '-b:a', '160k',
                '-t', f'{total:.3f}', '-movflags', '+faststart', 'schampschot-promo.mp4'], check=True)
print('klaar', round(total, 2), 's,', len(fr), 'frames,', round(os.path.getsize('schampschot-promo.mp4') / 1e6, 1), 'MB')
