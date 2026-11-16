"""Monteert promo V2: frames worden video; ElevenLabs-voice-over, spelgeluidjes en een zelfgemaakte beat worden de audio.
Gebruik: python3 build2.py            -> schampschot-promo-v2.mp4 (met muziek) en schampschot-promo-v2-zonder-muziek.mp4
"""
import json, subprocess, wave, os
import numpy as np

T = json.load(open('timeline2.json'))
VO = {v['id']: v for v in json.load(open('vo2.json'))}
SR = 48000
LEAD = T.get('lead', 0.05)
t0 = T['scenes'][0]['t']
end = T['scenes'][-1]['t'] + T['scenes'][-1]['dur']
total = end - t0
N = int(total * SR)

# ---------- beeld ----------
fr = T['frames']
before = [i for i, f in enumerate(fr) if f['t'] <= t0]
fr = [f for f in fr[(before[-1] if before else 0):] if f['t'] < end]
fr[0]['t'] = t0
with open('list2.txt', 'w') as f:
    for a, b in zip(fr, fr[1:] + [{'t': end}]):
        f.write(f"file 'frames2/{a['f']}'\nduration {max(b['t'] - a['t'], 0.001):.4f}\n")
    f.write(f"file 'frames2/{fr[-1]['f']}'\n")
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', 'list2.txt',
                '-vf', 'fps=30,scale=1920:1080:flags=lanczos,format=yuv420p',
                '-c:v', 'libx264', '-preset', 'slow', '-crf', '19', 'video2.mp4'], check=True)


# ---------- voice-over: per zin uit de take knippen en op het scènetijdstip zetten ----------
def load(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32)


takes = {}
vo = np.zeros(N + SR, dtype=np.float32)
PRE, POST = 0.03, 0.14
for s in T['scenes']:
    v = VO[s['id']]
    take = takes.setdefault(v['take'], load(f"el/take_{v['take']}.mp3"))
    a, b = max(0, int((v['start'] - PRE) * SR)), min(len(take), int((v['end'] + POST) * SR))
    seg = take[a:b].copy()
    fade = int(0.012 * SR)
    seg[:fade] *= np.linspace(0, 1, fade); seg[-fade:] *= np.linspace(1, 0, fade)
    i = int((s['t'] - t0 + LEAD - PRE) * SR)
    vo[i:i + len(seg)] += seg
vo = vo[:N]
vo *= 0.9 / max(1e-6, float(np.abs(vo).max()))


# ---------- geluidjes ----------
def tone(f, dur, kind='sine', f2=None, decay=5.5):
    t = np.arange(int(dur * SR)) / SR
    freq = f * (f2 / f) ** (t / dur) if f2 else np.full_like(t, f)
    ph = 2 * np.pi * np.cumsum(freq) / SR
    w = {'sine': np.sin(ph), 'triangle': 2 / np.pi * np.arcsin(np.sin(ph)),
         'square': np.sign(np.sin(ph)) * 0.6, 'saw': 2 * ((ph / (2 * np.pi)) % 1) - 1}[kind]
    return (w * np.exp(-decay * t / dur)).astype(np.float32)


def noise(dur, decay=6.0, seed=1):
    t = np.arange(int(dur * SR)) / SR
    return (np.random.default_rng(seed).uniform(-1, 1, len(t)) * np.exp(-decay * t / dur)).astype(np.float32)


def join(parts):
    n = max(int(o * SR) + len(s) for o, s in parts)
    out = np.zeros(n, dtype=np.float32)
    for o, s in parts:
        out[int(o * SR):int(o * SR) + len(s)] += s
    return out


def put(buf, sig, t, g=1.0):
    i = int(t * SR)
    if i < 0: sig, i = sig[-i:], 0
    n = min(len(sig), len(buf) - i)
    if n > 0: buf[i:i + n] += sig[:n] * g


penta = [523.25, 587.33, 659.25, 783.99, 880.0]
SFX = {
    'ok': (join([(0, tone(660, .06, 'triangle')), (.06, tone(990, .1, 'triangle'))]), 0.10),
    'tick': (tone(900, .03, 'square'), 0.035),
    'bad': (join([(0, tone(170, .22, 'saw')), (0, tone(85, .22, 'sine'))]), 0.11),
    'fire': (tone(1700, .45, 'saw', 180), 0.08),
    'hit': (join([(0, tone(1300, .05, 'square')), (.04, tone(1900, .2, 'triangle')), (0, tone(110, .25, 'sine', 45) * 1.6)]), 0.13),
    'slam': (join([(0, tone(120, .22, 'sine', 42) * 1.8), (0, noise(.07, 9) * 0.5)]), 0.16),
    'win': (join([(i * .07, tone(f, .16, 'triangle')) for i, f in enumerate([523, 659, 784, 1047])]), 0.10),
}
for i, f in enumerate(penta):
    SFX[f'rank{i}'] = (join([(0, tone(f, .14, 'triangle')), (0, tone(f / 2, .14, 'square') * 0.4)]), 0.10)
fx = np.zeros(N, dtype=np.float32)
for e in T['sfx']:
    sig, g = SFX[e['name']]
    put(fx, sig, e['t'] - t0, g)

# ---------- beat: 128 bpm, chiptune-achtig, zelf gesynthetiseerd ----------
BPM = 128
beat = 60 / BPM
hits = [e['t'] - t0 for e in T['sfx'] if e['name'] == 'hit']
drop = hits[0] if hits else 4 * beat          # de beat valt in op het eerste schot
final = max(e['t'] - t0 for e in T['sfx'] if e['name'] == 'fire')  # laatste klap op de eindkaart
music = np.zeros(N, dtype=np.float32)
roots = [110.0, 87.31, 130.81, 98.0]          # Am F C G
chords = [[220, 261.63, 329.63], [174.61, 220, 261.63], [261.63, 329.63, 392], [196, 246.94, 293.66]]
kick = tone(130, .2, 'sine', 42, decay=4) * 1.0
snare = noise(.13, 7, seed=3) * 0.55 + np.pad(tone(190, .1, 'triangle'), (0, int(.13 * SR) - int(.1 * SR))) * 0.4
hat = noise(.035, 8, seed=5) * 0.22
k = 0
t = drop - np.floor(drop / beat) * beat       # raster zo leggen dat er een tel precies op de drop valt
bar0 = int(round(drop / beat)) % 4
while t < final - 0.02:
    idx = int(round((t - drop) / beat))        # telnummer t.o.v. de drop (negatief = intro)
    bar = (idx // 4) % 4
    pos = idx % 4
    intro = idx < 0
    if not intro:
        put(music, kick, t, 0.55)
        if pos in (1, 3): put(music, snare, t, 0.30)
        put(music, hat, t + beat / 2, 1.0)
        put(music, hat, t + beat / 4, 0.5); put(music, hat, t + 3 * beat / 4, 0.5)
        for j in range(2):                      # bas in achtsten
            put(music, tone(roots[bar], beat / 2 * 0.9, 'square', decay=3) * 0.9, t + j * beat / 2, 0.16)
    for j in range(4):                          # arpeggio in zestienden
        f = chords[bar][(j + pos) % 3] * (2 if (j + pos) % 2 else 1)
        put(music, tone(f, beat / 4 * 0.9, 'square', decay=4), t + j * beat / 4, 0.05 if intro else 0.075)
    t += beat
put(music, join([(0, tone(110, 1.6, 'square', decay=5) * 0.5), (0, tone(220, 1.6, 'triangle', decay=5)), (0, tone(329.63, 1.6, 'triangle', decay=5))]), final, 0.16)
# zachte laagdoorlaat zodat de blokgolven niet scherp klinken
kernel = np.hanning(25); kernel /= kernel.sum()
music = np.convolve(music, kernel, mode='same').astype(np.float32)
# muziek zakt weg onder de stem
env = np.abs(vo)
win = int(0.12 * SR)
env = np.convolve(env, np.ones(win) / win, mode='same')
duck = 1.0 - 0.55 * np.clip(env / 0.08, 0, 1)
music *= duck.astype(np.float32)
music *= 0.5 / max(1e-6, float(np.abs(music).max()))


def render(name, with_music):
    out = np.clip(vo + fx + (music * 0.42 if with_music else 0), -1, 1)
    w = wave.open('audio2.wav', 'wb'); w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((out * 32767).astype(np.int16).tobytes()); w.close()
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', 'video2.mp4', '-i', 'audio2.wav', '-c:v', 'copy',
                    '-af', 'loudnorm=I=-15:TP=-1.5:LRA=11', '-ar', '48000', '-ac', '2', '-c:a', 'aac', '-b:a', '192k',
                    '-t', f'{total:.3f}', '-movflags', '+faststart', name], check=True)
    rms = lambda x: 20 * np.log10(max(1e-9, float(np.sqrt((x ** 2).mean()))))
    print(name, f'{total:.1f}s {os.path.getsize(name) / 1e6:.1f} MB | stem {rms(vo):.1f} dB, geluidjes {rms(fx):.1f} dB' + (f', muziek {rms(music * 0.42):.1f} dB' if with_music else ''))


render('schampschot-promo-v2.mp4', True)
render('schampschot-promo-v2-zonder-muziek.mp4', False)
