# Chrono Breach

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

## Eras y niveles

Hay 2 eras con 2 niveles cada una; desde el menú puedes elegir cualquier nivel. En cada nivel empiezas a
puño limpio: **cada enemigo derrotado suelta su arma** y puedes quedártela (Q para cambiar).

### Era I · Prehistoria

1. **El Valle de los Colmillos.** Pradera con campamento cavernícola, pinturas rupestres y un claro de
   menhires. Jefe: **Garra Gris**, un dientes de sable alfa que salta desde lejos y llama a su manada.
2. **Los Pozos de Brea.** Llanura volcánica al atardecer: la brea te frena, hay ríos de lava y un mamut
   atrapado. Jefe: el **Megaterio**, un perezoso gigante cuyos golpes hacen temblar el suelo.

| Adversario | Arma que suelta | Cómo pelea |
|---|---|---|
| Cavernícola | Garrote | Golpes verticales y barridos |
| Cazador | Lanza de sílex | Estocadas de largo alcance |
| Dientes de sable | — | Muy rápido, rodea a distancia y salta sobre ti |
| Perezoso gigante | — | Lento y resistente, zarpazos amplios y golpe al suelo |

### Era II · Roma

1. **Las Puertas de Roma.** Afueras en ruinas y la Vía del Mercado.
2. **El Anfiteatro.** Combate contra **Varro, Centurión de la Brecha**, ante miles de espectadores.

| Adversario | Arma que suelta | Cómo pelea |
|---|---|---|
| Legionario | Gladius | Escudo rectangular, bloquea a menudo (usa la patada) |
| Lancero | Pilum | Estocadas de largo alcance |
| Reciario | Tridente | Gladiador rápido, sin armadura, dobles estocadas |
| Bruto | Maza | Lento, golpes que hacen temblar el suelo |

**Chips y manantiales.** El **flujo temporal** se agota con el tiempo. Los enemigos sueltan **chips
temporales**: recogerlos no da tiempo por sí solo, tienes que llevarlos a un **manantial temporal** y
entrar en él para convertirlos en flujo. La **brecha** avanza por detrás: si te alcanza te daña.

## Estructura

- `src/game.ts`: bucle, jugadora, IA enemiga, cámara, zonas y HUD
- `src/levels.ts`: definición de eras, niveles, oleadas y cámaras
- `src/level.ts`: construcción de Roma y colisiones (OBB)
- `src/prehistory.ts`: construcción de los niveles prehistóricos
- `src/beast.ts`: esqueleto de cuadrúpedo (dientes de sable)
- `src/rig.ts`: esqueleto procedural, poses y armas
- `src/combat.ts`: definición de ataques por keyframes
- `src/fx.ts`: partículas, estelas y shaders de energía
- `src/textures.ts` y `src/materials.ts`: texturas procedurales en canvas
- `src/audio.ts`: efectos de sonido y música con WebAudio
- `src/input.ts`: teclado, ratón, mando y controles táctiles

Hecho con [Three.js](https://threejs.org), TypeScript y Vite.
