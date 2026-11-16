"""Spreekt het hele script in één take in via ElevenLabs en knipt de tijdlijn per regel met de tekentijdstempels."""
import json, base64, sys, subprocess, urllib.request, urllib.error
import numpy as np
VOICE, MODEL, TAG = sys.argv[1], sys.argv[2], sys.argv[3]
lines = json.load(open('script2.json'))
text = ' '.join(l['text'] for l in lines)
body = {'text': text, 'model_id': MODEL, 'seed': int(sys.argv[4]) if len(sys.argv) > 4 else 7,
        'voice_settings': {'stability': 0.5, 'similarity_boost': 0.75, 'style': 0.4, 'use_speaker_boost': True, 'speed': 1.15}}
if MODEL != 'eleven_multilingual_v2': body['language_code'] = 'nl'
req = urllib.request.Request(f'https://api.elevenlabs.io/v1/text-to-speech/{VOICE}/with-timestamps?output_format=mp3_44100_128', data=json.dumps(body).encode(), headers={'Content-Type': 'application/json'})
try: r = json.load(urllib.request.urlopen(req, timeout=180))
except urllib.error.HTTPError as e: sys.exit(f'FOUT {e.code} {e.read()[:400].decode("utf8", "replace")}')
open(f'el/take_{TAG}.mp3', 'wb').write(base64.b64decode(r['audio_base64']))
al = r['alignment']; ch, st, en = al['characters'], al['character_start_times_seconds'], al['character_end_times_seconds']
assert ''.join(ch) == text, 'uitlijning wijkt af van de tekst'
out, pos = [], 0
for l in lines:
    a, b = pos, pos + len(l['text']); pos = b + 1
    words, i = [], a
    while i < b:
        if ch[i] == ' ': i += 1; continue
        j = i
        while j < b and ch[j] != ' ': j += 1
        words.append({'w': ''.join(ch[i:j]), 't': round(st[i], 3), 'e': round(en[j - 1], 3)}); i = j
    out.append({'id': l['id'], 'text': l['text'], 'start': round(st[a], 3), 'end': round(en[b - 1], 3), 'words': words})
json.dump({'tag': TAG, 'chars': len(text), 'lines': out}, open(f'el/vo_{TAG}.json', 'w'), ensure_ascii=False, indent=1)
dur = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f'el/take_{TAG}.mp3'], capture_output=True, text=True).stdout)
print(TAG, f'{len(text)} tekens, {dur:.1f}s')
for o, nx in zip(out, out[1:] + [None]):
    print(f"  {o['id']} {o['start']:5.2f}-{o['end']:5.2f}  pauze erna {((nx['start'] - o['end']) if nx else 0):.2f}s")
