// ============================================================
//  CONFIGURACIÓN DEL JUEGO  (todo lo ajustable está aquí)
// ============================================================
export const CONFIG = {
  cellSize: 4,        // tamaño de cada celda del mapa (unidades)
  wallHeight: 4,

  player: {
    speed: 6,
    radius: 0.4,
    eyeHeight: 1.7,
    mouseSensitivity: 0.0022,
    maxHealth: 100,
    medkitHealth: 25,
  },

  // Armas de fuego con munición y espada cuerpo a cuerpo.
  // size: tamaño (unidades) al que se escala el modelo automáticamente.
  // modelRotation corrige los ejes locales del GLB; rotation apunta el arma en cámara.
  weapons: [
    {
      name: 'PISTOLA',
      file: 'assets/models/pistola_9mm.glb',
      size: 0.45,
      position: [0.28, -0.28, -0.55],
      rotation: [0.08, -Math.PI / 2, 0],
      startAmmo: 12,
      pickupAmmo: 5,     // balas que da cada caja de esta arma
      cooldown: 0.3,     // segundos mínimos entre disparos
      range: 30,
      damage: 1,
      ammoUnit: 'balas',
      color: '#ffd23f',
    },
    {
      name: 'ESCOPETA',
      file: 'assets/models/escopeta_mr_meat.glb',
      size: 0.9,
      position: [0.3, -0.3, -0.7],
      rotation: [0.08, -Math.PI / 2, 0],
      startAmmo: 6,
      pickupAmmo: 4,
      cooldown: 0.9,
      range: 20,
      pellets: 7,
      centerPellets: 3,
      spread: 0.045,
      damage: 3,
      ammoUnit: 'cartuchos',
      color: '#ff7b2e',
    },
    {
      name: 'ESPADA',
      melee: true,
      startAmmo: 0,
      range: 2.1,
      cooldown: 0.65,
      damage: 2,
      knockback: 1.1,
      position: [0.34, -0.3, -0.58],
      rotation: [-0.12, -0.2, -0.18],
      color: '#cbd5dc',
    },
  ],

  enemy: {
    height: 1.8,
    yawOffset: 0,
    radius: 0.5,
    detectionRange: 18,
    zombie: {
      files: ['assets/models/zombie1.glb', 'assets/models/zombies.glb'],
      hp: 3, speed: 2.2, fastSpeed: 3.6,
      attackRange: 0.9, damage: 10, attackCooldown: 1.5,
    },
    demon1: {
      file: 'assets/models/demon1.glb',
      height: 2.1,
      hp: 3, speed: 2.1, attackRange: 8, damage: 6, attackCooldown: 1.9,
      projectileSpeed: 12, projectileColor: 0xb52cff,
    },
    demon2: {
      file: 'assets/models/demon2.glb',
      height: 2.1,
      hp: 3, speed: 1.9, attackRange: 10, damage: 4, attackCooldown: 2.2,
      projectileSpeed: 14, projectileColor: 0xff762e,
    },
    demon3: {
      file: 'assets/models/demon3.glb',
      height: 2.1,
      hp: 3, speed: 2.2, attackRange: 7, damage: 6, attackCooldown: 1.8,
      projectileSpeed: 11, projectileColor: 0xff4b14,
    },
    necro: {
      file: 'assets/models/necro.glb',
      hp: 3, speed: 1.8, attackRange: 9, damage: 5, attackCooldown: 2.1,
      projectileSpeed: 11, projectileColor: 0x7bdcff,
    },
  },
};
