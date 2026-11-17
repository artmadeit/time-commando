# Chrono Breach · Era I: Roma

Juego de acción 3D de viajes en el tiempo que se juega en el navegador. Está inspirado en los
*brawlers* cinematográficos de los 90 (cámara fija por zonas, combate cuerpo a cuerpo, armas de cada
época y una brecha temporal que te persigue), pero con gráficos modernos: iluminación PBR, sombras
en tiempo real, cielo de atardecer, bloom HDR, partículas y estelas de armas.

Todo es procedural: modelos, texturas, animaciones, música y efectos de sonido se generan por código.
No hay assets externos.

## Jugar

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # genera dist/ (para cualquier hosting estático)
node scripts/inline-build.mjs   # dist/chrono-breach.html: un único archivo autocontenido
```

Añade `?q=low` a la URL en equipos poco potentes.

## Controles

| Acción | Teclado / ratón | Mando |
|---|---|---|
| Mover | WASD / flechas | Stick izquierdo |
| Atacar (combo de 3) | J / clic izquierdo | A / RT |
| Patada (rompe guardias) | K / clic central | X |
| Bloquear | L / Shift / clic derecho | LB / RB |
| Esquivar (invulnerable) | Espacio | B |
| Cambiar arma | Q | Y |
| Pausa | Esc / P | Start |

En móvil aparecen un joystick y botones táctiles.

## El nivel

Empiezas a puño limpio. **Cada enemigo derrotado suelta su arma** y puedes quedártela; cambias entre
las que tengas con Q.

| Adversario | Arma que suelta | Cómo pelea |
|---|---|---|
| Legionario | Gladius | Escudo rectangular, bloquea a menudo (usa la patada) |
| Lancero | Pilum | Estocadas de largo alcance |
| Reciario | Tridente | Gladiador rápido, sin armadura, dobles estocadas |
| Bruto (gladiador pesado) | Maza | Lento, golpes que hacen temblar el suelo, aguanta golpes ligeros |
| Varro, Centurión de la Brecha | — | Jefe final: combos, carga y golpe de escudo |

1. **Afueras de Roma.** Ruinas al atardecer y la primera patrulla de legionarios.
2. **Vía del Mercado.** Calle con tiendas, toldos y puestos. Dos oleadas mixtas.
3. **El Anfiteatro.** El túnel se cierra a tu espalda y empieza el combate contra Varro ante miles de
   espectadores. A mitad de vida llama a refuerzos.

**Chips y manantiales.** El **flujo temporal** se agota con el tiempo. Los enemigos sueltan **chips
temporales**: recogerlos no da tiempo por sí solo, tienes que llevarlos a un **manantial temporal**
(hay tres en el nivel) y entrar en él para convertirlos en flujo. La **brecha** avanza por detrás:
si te alcanza te daña, y los chips o manantiales que deje atrás se pierden.

## Estructura

- `src/game.ts`: bucle, jugadora, IA enemiga, cámara, zonas y HUD
- `src/level.ts`: construcción del nivel y colisiones (OBB)
- `src/rig.ts`: esqueleto procedural, poses y armas
- `src/combat.ts`: definición de ataques por keyframes
- `src/fx.ts`: partículas, estelas y shaders de energía
- `src/textures.ts` y `src/materials.ts`: texturas procedurales en canvas
- `src/audio.ts`: efectos de sonido y música con WebAudio
- `src/input.ts`: teclado, ratón, mando y controles táctiles

Hecho con [Three.js](https://threejs.org), TypeScript y Vite.
