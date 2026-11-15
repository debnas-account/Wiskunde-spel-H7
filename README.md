# Schampschot

Een oefenspel voor wiskunde B (5 vwo), hoofdstuk 7.4: afstanden en raaklijnen bij cirkels.
Cirkels zijn schilden. Alleen een lijn die de cirkel precies raakt schakelt het schild uit, dus je rekent de raaklijn uit en vuurt.

## Spelen

Open `index.html` in een browser. Het werkt op telefoon, tablet en laptop, ook zonder internet (dan met standaardlettertypen). Voortgang wordt in de browser bewaard.

## Wat erin zit

| Missie | Onderwerp | In het boek |
| --- | --- | --- |
| M0 Scan | middelpunt en straal aflezen, kwadraat afsplitsen | voorkennis |
| M1 Afstand tot het schild | afstand van een punt tot een cirkel | theorie A |
| M2 Tussenruimte | afstand tussen twee cirkels en tussen lijn en cirkel | theorie A |
| M3 Schampschot | raaklijn in een gegeven raakpunt | theorie B |
| M4 Vaste koers | raaklijnen met een gegeven richtingscoëfficiënt | theorie C |
| M5 Dubbelschot | raaklijnen door een punt buiten de cirkel | theorie C |
| Reflextest | 60 seconden snelle herkenningsvragen | alles |
| Toets-sim | zes opgaven zonder tussenstappen | alles |

Elke missie duurt 3 tot 6 minuten. De eerste ronde splitst een opgave op in kleine stappen, latere rondes laten steeds meer tussenstappen weg. Alle opgaven worden willekeurig gegenereerd, dus een missie is elke keer anders.

## Ontwikkelen

```bash
node test/math.test.js
```

```bash
node build.mjs
```

De bron staat in `src/`: `math.js` (breuken, invoerparser, opgavengeneratoren), `game.js` (interface), `style.css` en `body.html`. `build.mjs` voegt alles samen tot `index.html`.
