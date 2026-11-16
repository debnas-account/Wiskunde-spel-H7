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
