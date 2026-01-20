import { TileType, Suit, PlayerState, RoundResult } from './types';

export const SUITS: Suit[] = ['bamboo', 'dot', 'character'];

export function generateDeck(): TileType[] {
  const deck: TileType[] = [];
  SUITS.forEach(suit => {
    for (let val = 1; val <= 9; val++) {
      for (let i = 0; i < 4; i++) {
        deck.push({
          suit,
          value: val,
          id: `${suit}-${val}-${i}`
        });
      }
    }
  });
  return shuffle(deck);
}

function shuffle(array: TileType[]): TileType[] {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

export function sortHand(hand: TileType[]): TileType[] {
  return [...hand].sort((a, b) => {
    if (a.suit !== b.suit) return SUITS.indexOf(a.suit) - SUITS.indexOf(b.suit);
    return a.value - b.value;
  });
}

// Check if player has the suit they promised to lack
export function hasForbiddenSuit(hand: TileType[], forbiddenSuit?: Suit): boolean {
  if (!forbiddenSuit) return false;
  return hand.some(t => t.suit === forbiddenSuit);
}

// Basic check: Can Pong?
export function canPong(hand: TileType[], tile: TileType): boolean {
  const count = hand.filter(t => t.suit === tile.suit && t.value === tile.value).length;
  return count >= 2;
}

// Basic check: Can Kong? (from discard)
export function canKong(hand: TileType[], tile: TileType): boolean {
  const count = hand.filter(t => t.suit === tile.suit && t.value === tile.value).length;
  return count === 3;
}

// Check if hand is ready to Hu
export function checkHu(hand: TileType[], pengs: TileType[][], gangs: TileType[][], forbiddenSuit?: Suit): { canHu: boolean, type?: string, fan?: number } {
  // 1. Check forbidden suit
  if (hasForbiddenSuit(hand, forbiddenSuit)) {
    return { canHu: false };
  }

  // 2. Check 7 Pairs (Qi Dui) - must be 14 tiles in hand (no peng/gang exposed)
  if (pengs.length === 0 && gangs.length === 0 && hand.length === 14) {
    if (checkSevenPairs(hand)) {
      const isQingYiSe = isFullFlush(hand);
      return { canHu: true, type: '七对', fan: isQingYiSe ? 4 : 2 };
    }
  }

  // 3. Standard Hu (4 sets + 1 pair)
  if (checkStandardHu(hand)) {
    let fan = 0;
    const allTiles = [...hand, ...pengs.flat(), ...gangs.flat()];
    const isQingYiSe = isFullFlush(allTiles);
    
    // 对对胡 (All triplets) - always true in no-chow mahjong
    fan += 1;
    
    // 杠 - each kong adds 1 fan
    fan += gangs.length;
    
    // 金钩钓 - single tile waiting with all others as melds
    if (hand.length === 2) {
      fan += 1;
    }
    
    // 清一色
    if (isQingYiSe) fan += 2;
    
    return { canHu: true, type: '平胡', fan };
  }

  return { canHu: false };
}

function checkSevenPairs(hand: TileType[]): boolean {
  const sorted = sortHand(hand);
  for (let i = 0; i < 14; i += 2) {
    if (sorted[i].value !== sorted[i+1]?.value || sorted[i].suit !== sorted[i+1]?.suit) {
      return false;
    }
  }
  return true;
}

function checkStandardHu(hand: TileType[]): boolean {
  // Recursive backtracking to find if hand can be decomposed into AAA sets and one DD pair.
  const counts: Record<string, number> = {};
  hand.forEach(t => {
    const key = `${t.suit}-${t.value}`;
    counts[key] = (counts[key] || 0) + 1;
  });

  const keys = Object.keys(counts);
  
  // Find pair
  for (const pairKey of keys) {
    if (counts[pairKey] >= 2) {
      counts[pairKey] -= 2;
      if (canFormSets(counts)) return true;
      counts[pairKey] += 2;
    }
  }
  
  return false;
}

function canFormSets(counts: Record<string, number>): boolean {
  for (const key of Object.keys(counts)) {
    if (counts[key] > 0) {
      if (counts[key] >= 3) {
        counts[key] -= 3;
        const res = canFormSets(counts);
        counts[key] += 3;
        return res;
      } else {
        return false;
      }
    }
  }
  return true;
}

function isFullFlush(allTiles: TileType[]): boolean {
  if (allTiles.length === 0) return false;
  const firstSuit = allTiles[0].suit;
  return allTiles.every(t => t.suit === firstSuit);
}

// Check if player is Ting (listening/ready to win)
export function checkTing(hand: TileType[], pengs: TileType[][], gangs: TileType[][], forbiddenSuit?: Suit): { isTing: boolean, waitingFor: TileType[] } {
  const waitingFor: TileType[] = [];
  
  // Check if we already have forbidden suit
  if (hasForbiddenSuit(hand, forbiddenSuit)) {
    return { isTing: false, waitingFor: [] };
  }
  
  // Try adding each possible tile and see if we can Hu
  for (const suit of SUITS) {
    if (suit === forbiddenSuit) continue;
    
    for (let value = 1; value <= 9; value++) {
      const testTile: TileType = { suit, value, id: 'test' };
      const testHand = [...hand, testTile];
      const result = checkHu(testHand, pengs, gangs, forbiddenSuit);
      
      if (result.canHu) {
        waitingFor.push(testTile);
      }
    }
  }
  
  return { isTing: waitingFor.length > 0, waitingFor };
}

// Calculate points for a Hu
export function calculateHuPoints(fan: number, isSelfDraw: boolean): number {
  let base = Math.pow(2, fan);
  if (isSelfDraw) {
    base *= 2; // 自摸加倍
  }
  return base;
}

// Calculate round end results (when deck is empty)
export function calculateRoundEndResults(
  players: PlayerState[],
  winners: number[]
): RoundResult[] {
  const results: RoundResult[] = [];
  
  // Calculate Ting status for non-winners
  const tingStatus: { index: number; isTing: boolean }[] = [];
  
  for (let i = 0; i < 4; i++) {
    if (winners.includes(i)) continue;
    
    const p = players[i];
    const { isTing } = checkTing(p.hand, p.peng, p.gang, p.selectedSuit);
    tingStatus.push({ index: i, isTing });
  }
  
  const tingPlayers = tingStatus.filter(t => t.isTing);
  const noTingPlayers = tingStatus.filter(t => !t.isTing);
  
  // 查叫：没听的玩家需要给听的玩家赔付
  // Base points for ting/no-ting: 8 points per player
  const tingPoints = 8;
  
  for (const noTing of noTingPlayers) {
    const totalPay = tingPlayers.length * tingPoints;
    
    results.push({
      playerId: noTing.index,
      playerName: players[noTing.index].name,
      action: 'noTing',
      points: -totalPay,
      description: `未叫，赔付 ${tingPlayers.length} 家各 ${tingPoints} 分`
    });
    
    // Each ting player receives
    for (const ting of tingPlayers) {
      const existing = results.find(r => r.playerId === ting.index && r.action === 'ting');
      if (existing) {
        existing.points += tingPoints;
      } else {
        results.push({
          playerId: ting.index,
          playerName: players[ting.index].name,
          action: 'ting',
          points: tingPoints,
          description: `听牌`
        });
      }
    }
  }
  
  return results;
}

// Get suit display name
export function getSuitName(suit: Suit): string {
  switch (suit) {
    case 'bamboo': return '条';
    case 'dot': return '筒';
    case 'character': return '万';
  }
}
