import { TileType, Suit } from './types';

export function decideDiscard(hand: TileType[], forbiddenSuit?: Suit): TileType {
  // 1. Discard forbidden suit
  const forbiddenTiles = hand.filter(t => t.suit === forbiddenSuit);
  if (forbiddenTiles.length > 0) {
    return forbiddenTiles[0];
  }

  // 2. Discard isolated tiles (simple heuristic: look for tiles with no neighbors)
  // Since no Chow, neighbors don't matter much, only pairs/triplets.
  // So discard single tiles that aren't pairs.
  
  const counts: Record<string, number> = {};
  hand.forEach(t => {
    const key = `${t.suit}-${t.value}`;
    counts[key] = (counts[key] || 0) + 1;
  });

  // Find singles
  const singles = hand.filter(t => counts[`${t.suit}-${t.value}`] === 1);
  if (singles.length > 0) {
    // Pick random single or lowest value?
    return singles[0];
  }

  // If no singles (all pairs/triplets), break a pair?
  return hand[0];
}

export function decideSuit(hand: TileType[]): Suit {
  // Count suits, pick the one with fewest tiles
  const counts = { bamboo: 0, dot: 0, character: 0 };
  hand.forEach(t => counts[t.suit]++);
  
  let minSuit: Suit = 'bamboo';
  let minCount = 100;
  
  (Object.keys(counts) as Suit[]).forEach(s => {
    if (counts[s] < minCount) {
      minCount = counts[s];
      minSuit = s;
    }
  });
  
  return minSuit;
}
