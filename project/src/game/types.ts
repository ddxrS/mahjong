export type Suit = 'bamboo' | 'dot' | 'character';
export type TileType = {
  suit: Suit;
  value: number; // 1-9
  id: string; // unique identifier for React keys
};

export type PlayerPosition = 0 | 1 | 2 | 3;

export type ActionType = 'draw' | 'discard' | 'pong' | 'kong' | 'hu' | 'pass' | 'exchange' | 'dingque' | 'nextRound';

export type PlayerState = {
  id: string;
  name: string;
  isBot: boolean;
  hand: TileType[];
  peng: TileType[][];
  gang: TileType[][]; // [0] is the gang tile
  discards: TileType[];
  score: number;
  selectedSuit?: Suit; // For Ding Que
  exchangeTiles?: TileType[]; // For Huan San Zhang
  ready: boolean;
  lastDrawId?: string; // ID of the last drawn tile (for highlighting)
  isOut: boolean; // Has the player won this round?
  isTing: boolean; // Is the player in Ting (ready to win) state?
};

export type RoundResult = {
  playerId: number;
  playerName: string;
  action: 'hu' | 'ting' | 'noTing' | 'paoPlayer';
  points: number;
  description: string;
};

export type GamePhase = 'lobby' | 'exchange' | 'dingque' | 'playing' | 'roundEnd' | 'ended';

export type GameState = {
  phase: GamePhase;
  players: PlayerState[];
  deck: TileType[];
  currentTurn: number; // 0-3
  lastDiscard?: TileType;
  lastDiscardBy?: number;
  dealer: number;
  round: number;
  winners: number[]; // Players who have won this round
  roundResults: RoundResult[]; // Results for this round
  waitingForAction: boolean;
  actionTimer: number;
  exchangeType?: number; // 0: Clockwise, 1: Counter-Clockwise, 2: Opposite
  firstWinner?: number; // First player to Hu this round (becomes next dealer)
};
