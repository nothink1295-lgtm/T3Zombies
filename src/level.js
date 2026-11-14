export const W = 32;
export const H = 21;

function randomFor(seed) {
  let value = seed;
  return () => {
    value = value * 16807 % 2147483647;
    return (value - 1) / 2147483646;
  };
}

function shuffled(items, random) {
  const result = items.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function buildMaze(seed) {
  const random = randomFor(seed);
  const grid = Array.from({ length: H }, () => Array(W).fill('#'));
  const start = [1, 1];
  const stack = [start];
  const visited = new Set(['1,1']);
  grid[start[1]][start[0]] = '.';

  while (stack.length) {
    const [c, r] = stack[stack.length - 1];
    const neighbors = [[c + 2, r], [c - 2, r], [c, r + 2], [c, r - 2]]
      .filter(([nc, nr]) => nc > 0 && nc < W - 1 && nr > 0 && nr < H - 1 && !visited.has(`${nc},${nr}`));
    if (!neighbors.length) {
      stack.pop();
      continue;
    }
    const [nc, nr] = neighbors[Math.floor(random() * neighbors.length)];
    visited.add(`${nc},${nr}`);
    grid[nr][nc] = '.';
    grid[(r + nr) / 2][(c + nc) / 2] = '.';
    stack.push([nc, nr]);
  }

  for (let r = 1; r < H - 1; r++) {
    for (let c = 1; c < W - 1; c++) {
      if (grid[r][c] !== '#' || (c % 2 === 0) === (r % 2 === 0)) continue;
      const joinsPath = c % 2 === 0
        ? grid[r][c - 1] === '.' && grid[r][c + 1] === '.'
        : grid[r - 1][c] === '.' && grid[r + 1][c] === '.';
      if (joinsPath && random() < 0.1) grid[r][c] = '.';
    }
  }
  return grid;
}

function createLevel(seed, number) {
  const random = randomFor(seed * 3);
  const grid = buildMaze(seed);
  const start = [1, 1];
  const exit = [W - 3, H - 2];
  const labCandidates = [];
  for (let r = 1; r < H - 1; r += 2) {
    for (let c = 1; c < W - 1; c += 2) {
      if (grid[r][c] !== '.' || (c === start[0] && r === start[1]) || (c === exit[0] && r === exit[1])) continue;
      if (Math.abs(c - start[0]) + Math.abs(r - start[1]) < 8) continue;
      if (Math.abs(c - exit[0]) + Math.abs(r - exit[1]) < 6) continue;
      const exits = [[1, 0], [-1, 0], [0, 1], [0, -1]]
        .filter(([dc, dr]) => grid[r + dr][c + dc] === '.');
      if (exits.length === 1) labCandidates.push([c, r]);
    }
  }
  const labCells = shuffled(labCandidates, random).slice(0, 3);
  const labKeys = new Set(labCells.map(([c, r]) => `${c},${r}`));
  const candidates = [];
  for (let r = 1; r < H - 1; r += 2) {
    for (let c = 1; c < W - 1; c += 2) {
      if (grid[r][c] !== '.' || (c === start[0] && r === start[1]) || (c === exit[0] && r === exit[1])) continue;
      if (Math.abs(c - start[0]) + Math.abs(r - start[1]) < 8) continue;
      if (Math.abs(c - exit[0]) + Math.abs(r - exit[1]) < 6) continue;
      if (labKeys.has(`${c},${r}`)) continue;
      candidates.push([c, r]);
    }
  }
  const available = shuffled(candidates, random);
  const specials = ['demon1', 'demon2', 'demon3', 'necro'];
  const zombieSpawns = available.slice(0, 26).map(([c, r], i) => [c, r, i % 6 === 0 ? 1 : 0, specials[i] || 'zombie']);
  const ammoSpawns = available.slice(26, 34).map(([c, r], i) => [c, r, i % 2]);
  const medkitSpawns = available.slice(34, 39);
  const bloodCells = available.slice(39, 49);
  const lavaCells = available.slice(49, 52);
  const trapCells = available.slice(52, 58);

  return { number, grid, start, exit, labCells, zombieSpawns, ammoSpawns, medkitSpawns, bloodCells, lavaCells, trapCells };
}

export const LEVELS = [createLevel(4817, 1), createLevel(9829, 2)];
