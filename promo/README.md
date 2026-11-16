# Promovideo

`schampschot-promo.mp4` is een promo van 66 seconden (1920×1080, met Nederlandse voice-over en ondertitels).

De video is volledig lokaal gemaakt uit het echte spel:

1. `script.json` bevat de voice-overtekst per scène (`cap` is de ondertitel, `tts` de tekst voor de stem).
2. `gen_vo.py` spreekt de tekst in met Piper (stem `nl_NL-pim-medium`, dataset met CC0-licentie) en bepaalt per woord het tijdstip met faster-whisper. Zet de stembestanden in `voices/`.
3. `record.js` speelt het spel af in Chromium (Playwright) en bewaart elk beeld met tijdstempel in `frames/`.
4. `build.py` monteert beeld, voice-over en spelgeluidjes met ffmpeg tot de mp4.

```bash
python3 gen_vo.py
```

```bash
node record.js
```

```bash
python3 build.py
```

Benodigd: `pip install piper-tts faster-whisper numpy`, Playwright met Chromium en ffmpeg.

## Versie 2

`schampschot-promo-v2.mp4` is de snellere versie van 39 seconden: harde cuts, inzoomen op de actie, grote woorden in beeld, ondertitels die per woord oplichten en een zelf gesynthetiseerde beat. `schampschot-promo-v2-zonder-muziek.mp4` is dezelfde video zonder beat.

De voice-over komt van ElevenLabs (stem Liam, model `eleven_v3`). De opnames staan in `el/`, dus opnieuw monteren kost geen tegoed.

1. `script2.json` bevat de tekst per scène.
2. `gen_vo2.py <voice_id> <model> <naam> [seed]` spreekt het hele script in één take in en bewaart de tijd per teken. Dit vraagt een ElevenLabs-sleutel voor `api.elevenlabs.io` in de omgeving.
3. `vo2.json` kiest per zin de beste take en bevat de woordtijden waarop de montage is getimed.
4. `record2.js` neemt het spel op, `build2.py` monteert beide video's.

```bash
node record2.js
```

```bash
python3 build2.py
```
