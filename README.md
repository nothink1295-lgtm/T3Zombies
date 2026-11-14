# T3zombies — shooter 3D (Three.js)

Videojuego 3D de disparos para el curso **Computación Gráfica y Visual (UPN) — T3**.
Atraviesa una instalación infestada de zombis, administra tu munición y llega a la zona de extracción.

## Cómo ejecutarlo (VS Code)

1. Abre la carpeta del proyecto en VS Code (`Archivo > Abrir carpeta`).
2. Instala la extensión **Live Server** (se recomienda automáticamente).
3. Clic derecho en `index.html` > **Open with Live Server** (o botón *Go Live*).
4. Se abre `http://127.0.0.1:5500`. Haz clic en **COMENZAR**.

Alternativa sin extensión: `python -m http.server 5500` en la carpeta y abrir `http://localhost:5500`.
> Hace falta un servidor local (no abrir `index.html` con doble clic) porque se cargan archivos GLB y módulos ES.
> Requiere conexión a internet la primera vez (Three.js se carga desde jsDelivr).

## Modelos y texturas

Los modelos de zombi (`zombie1.glb` y `zombies.glb`), demonios, Necro, pistola (`pistola_9mm.glb`) y escopeta (`escopeta_mr_meat.glb`) están en `assets/models/`. Los muros metálicos usan una textura procedural generada por el juego. Cada zombi usa un modelo individual, alternando entre los dos modelos. La espada se genera en el juego con brillo rojo neón. La vista del jugador es en primera persona y no carga un modelo de personaje. Las rutas y estadísticas se ajustan en `src/config.js`. Si falta un modelo de arma, se muestra un marcador.

## Controles

| Control | Acción |
|---|---|
| W / S / A / D | Avanzar / retroceder / izquierda / derecha |
| Mouse | Orientar la cámara |
| Clic izquierdo | Disparar |
| 1 / 2 / 3 | Seleccionar pistola / escopeta / espada |
| Clic izquierdo con espada | Ataque cuerpo a cuerpo con empuje |
| Mantener clic derecho con espada | Bloquear ataques frontales |
| Esc | Pausa |

## Mecánicas y dónde están en el código

| Requerimiento | Implementación (`src/main.js`) |
|---|---|
| Pistola y escopeta GLB seleccionables con 1/2; espada adicional en 3 | `loadWeapons`, `selectWeapon`, `shoot` |
| Pistola: 1 de daño (3 impactos al zombi común de 3 HP); escopeta: 3 de daño por zombi alcanzado (1 disparo), con 7 rayos de perdigones | `CONFIG.weapons`, `spawnEnemy`, `shoot`, `hitZombie` |
| Espada neón cuerpo a cuerpo de dos golpes, con empuje y colisión de paredes | `makeSword`, `shoot`, `hitZombie`, `moveWithCollision` |
| RF02 Munición por arma de fuego, bloqueo en 0, solo cajas | `ammo[]`, `shoot`, `updatePickups` |
| Dos laberintos con entrada y salida entre niveles | `src/level.js`, `enterLevel`, `win()` |
| Dos modelos de zombi individuales y cuatro tipos de infectados especiales | `loadCharacterModels`, `spawnEnemy` |
| Los infectados permanecen inactivos fuera del rango configurable y persiguen al jugador por los pasillos cuando se activan | `CONFIG.enemy.detectionRange`, `buildEnemyDistanceField`, `updateZombies` |
| RF09: un zombi causa Game Over al entrar en contacto con el jugador; el juego se detiene y permite reiniciar | `updateZombies`, `gameOver`, `resetGame` |
| Mantener clic derecho con espada bloquea ataques frontales | `isAttackBlocked`, controles de ratón |
| Demon 1: proyectil de veneno morado; Demon 2: dos cohetes; Demon 3: fuego | `fireProjectile`, `updateZombies` |
| Necro: proyectil de hielo y levanta hasta tres zombis | `summonZombies` |
| Vida y paquetes de curación; sin armadura | `damagePlayer`, `updatePickups`, HUD |
| Paquetes de vida y munición aumentada por caja | `updatePickups`, `src/level.js` |
| Charcos de lava letales y trampas de presión que restan 30 de vida cada 2,5 s mientras se pisan | `addHazard`, `updateHazards`, `src/level.js` |
| Manchas de sangre irregulares casi a ras del suelo | `poolGeometry`, `buildLevelWorld` |
| Bajas: cuerpos se hunden bajo el suelo | `hitZombie`, `updateZombies` |
| Muros metálicos y zonas de sangre | `wallTex`, material metálico, `bloodTex` |
| Iluminación roja y blanca en paredes, sin linterna del jugador | `WALL_LIGHTS` |
| RF11 Dificultad | Dos laberintos, 22 infectados por nivel (algunos rápidos), munición limitada y obstáculos |

Parámetros ajustables (munición, alcance/empuje de espada, alturas y velocidades): `src/config.js`.

## Fuentes de recursos externos

Las autorías, páginas de origen y licencias de los modelos GLB se obtuvieron de sus metadatos:

- Pistola 9 mm — Eduardo.Salas, [Sketchfab](https://sketchfab.com/3d-models/pistola-9mm-ce79e3dbdb4542aaaaef0afff7bb0914), CC BY 4.0.
- Escopeta — mth01, [Sketchfab](https://sketchfab.com/3d-models/escopeta-mr-meat-82fd9e2421b3438ba3d15a1e88c3c877), CC BY 4.0.
- Zombie Soldier — Peter_D, [Sketchfab](https://sketchfab.com/3d-models/zombie-soldier-176e930e63d144cc8f615b8dd3a8c74f), CC BY 4.0.
- Animated Injured Zombie Crawling Loop — LasquetiSpice, [Sketchfab](https://sketchfab.com/3d-models/animated-injured-zombie-crawling-loop-92e32f2303fa4a339590c243fd6c505a), CC BY 4.0.
- DOOM Cacodemon — Renafox, [Sketchfab](https://sketchfab.com/3d-models/doom-cacodemon-4902b58e85ae42dea7a341148cd3831b), CC BY-NC 4.0 (uso no comercial).
- DOOM Eternal Revenant — DJ_Nugget, [Sketchfab](https://sketchfab.com/3d-models/doom-eternal-revenant-dab547c6d03d435d8c85ab8f771184a6), CC BY 4.0.
- DOOM Eternal Mancubus — DJ_Nugget, [Sketchfab](https://sketchfab.com/3d-models/doom-eternal-mancubus-413aac043f2143f3afb93bcdab92d8aa), CC BY 4.0.
- Voidbound Necromancer — ItsKrish7, [Sketchfab](https://sketchfab.com/3d-models/voidbound-necromancer-6c506ca03faf4c4aa4cba1e18f3bbce7), CC BY 4.0.
- Textura metálica procedural: generada en `src/main.js`, sin recurso externo.
- Three.js (MIT): https://threejs.org

## Repositorio y video de entrega

- Repositorio: [T3Zombies en GitHub](https://github.com/nothink1295-lgtm/T3Zombies).
- Para subir la rama `main` desde esta carpeta, inicia sesión en GitHub y ejecuta `git push -u origin main`.
- Video demostrativo de máximo 3 minutos: pendiente de grabar y subir.
- Opcional: activar *GitHub Pages* (Settings > Pages > rama `main`) para el enlace jugable.
