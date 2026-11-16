import json, subprocess, wave, numpy as np, os, re
from faster_whisper import WhisperModel
lines = json.load(open('script.json')); os.makedirs('vo/final', exist_ok=True)
model = WhisperModel('small', device='cpu', compute_type='int8')
out = []
for l in lines:
    f = f"vo/final/{l['id']}.wav"
    subprocess.run(['python3', '-m', 'piper', '-m', 'voices/nl_NL-pim-medium.onnx', '-f', f, '--length-scale', '0.93', '--sentence-silence', '0.3'], input=l['tts'].encode(), check=True, capture_output=True)
    w = wave.open(f); dur = w.getnframes() / w.getframerate()
    pcm = np.frombuffer(subprocess.run(['ffmpeg', '-v', 'error', '-i', f, '-ac', '1', '-ar', '16000', '-f', 'f32le', '-'], capture_output=True, check=True).stdout, dtype=np.float32)
    segs, _ = model.transcribe(pcm, language='nl', beam_size=5, word_timestamps=True, initial_prompt='Schampschot is een spel.')
    words = [(round(w.start, 2), w.word.strip()) for s in segs for w in s.words]
    # ondertitels: per zin, tijd naar rato van het aantal tekens
    sents = re.findall(r'[^.?!:]+[.?!:]', l['cap']); tot = sum(len(s) for s in sents); t = 0; caps = []
    for s in sents: caps.append({'t': round(t, 2), 'text': s.strip()}); t += dur * len(s) / tot
    out.append({'id': l['id'], 'dur': round(dur, 2), 'words': words, 'caps': caps})
    print(l['id'], round(dur, 2), ' '.join(f'{w}@{t}' for t, w in words))
json.dump(out, open('vo.json', 'w'), ensure_ascii=False, indent=1)
print('totaal', round(sum(o['dur'] for o in out), 1))
