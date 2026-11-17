// Genera dist/chrono-breach.html: una sola página autocontenida (JS y CSS en línea)
// para publicarla en cualquier hosting estático o como artifact.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';

const assets = readdirSync('dist/assets');
const js = readFileSync('dist/assets/' + assets.find((f) => f.endsWith('.js')), 'utf8');
const css = readFileSync('dist/assets/' + assets.find((f) => f.endsWith('.css')), 'utf8');
let html = readFileSync('dist/index.html', 'utf8');
const body = html.slice(html.indexOf('<body>') + 6, html.indexOf('</body>'));
const fonts = html.match(/<link href="https:\/\/fonts[^>]+>/)[0];
const page = `<title>Chrono Breach</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
${fonts}
<style>${css}</style>
${body.replace(/<script[^>]*src="[^"]*"[^>]*><\/script>/g, '').trim()}
<script type="module">${js}</script>
`;
writeFileSync('dist/chrono-breach.html', page);
console.log('dist/chrono-breach.html', (page.length / 1024).toFixed(0) + ' KB');
