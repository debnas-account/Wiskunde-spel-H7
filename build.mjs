// Bouwt het spel uit src/ tot één bestand.
//   index.html          zelfstandige pagina (open hem direct in de browser)
//   build/artifact.html  dezelfde inhoud zonder documentskelet, voor publicatie als Claude-artifact
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const read = f => readFileSync(new URL(`./src/${f}`, import.meta.url), 'utf8');
const head = `<title>Schampschot</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@600;700&family=IBM+Plex+Sans:wght@400;500;600&family=STIX+Two+Text:ital,wght@0,400;0,600;1,400&display=swap">
<style>
${read('style.css')}</style>`;
const body = `${read('body.html')}<script>
${read('math.js')}
${read('game.js')}</script>`;
mkdirSync(new URL('./build/', import.meta.url), { recursive: true });
writeFileSync(new URL('./build/artifact.html', import.meta.url), `${head}\n${body}\n`);
writeFileSync(new URL('./index.html', import.meta.url), `<!doctype html>
<html lang="nl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
${head}
</head>
<body>
${body}
</body>
</html>
`);
console.log('gebouwd: index.html en build/artifact.html');
