import { useEffect, useRef, useState } from 'react';
import { Lobby } from './components/Lobby';
import { Board } from './components/Board';
import { WaitingRoom } from './components/WaitingRoom';
import { NetworkManager } from './network/peer';
import { ActionType, GameState, PlayerState, TileType, Suit, RoundResult } from './game/types';
import { generateDeck, sortHand, canPong, canKong, checkHu, calculateHuPoints, calculateRoundEndResults } from './game/logic';
import { decideDiscard, decideSuit } from './game/bot';

function createPlayer(id: string, name: string, isBot: boolean): PlayerState {
  return {
    id,
    name,
    isBot,
    hand: [],
    peng: [],
    gang: [],
    discards: [],
    score: 200,
    ready: false,
    isOut: false,
    isTing: false,
  };
}

const INITIAL_STATE: GameState = {
  phase: 'lobby',
  players: [],
  deck: [],
  currentTurn: 0,
  dealer: 0,
  round: 1,
  winners: [],
  roundResults: [],
  waitingForAction: false,
  actionTimer: 0,
};

function App() {
  const [view, setView] = useState<'lobby' | 'waiting' | 'game'>('lobby');
  const [gameState, setGameState] = useState<GameState>(INITIAL_STATE);
  const [myId, setMyId] = useState('');
  
  const networkRef = useRef<NetworkManager>(null);
  const stateRef = useRef<GameState>(INITIAL_STATE);
  const expectedHumansRef = useRef(1);
  const timeoutRef = useRef<NodeJS.Timeout>(null);

  // Initialize Network
  useEffect(() => {
    const net = new NetworkManager();
    networkRef.current = net;
    
    const interval = setInterval(() => {
      if (net.myId) {
        setMyId(net.myId);
        clearInterval(interval);
      }
    }, 500);

    net.onStateUpdate = (newState) => {
      setGameState(newState);
      if (newState.phase === 'lobby') {
         setView('waiting');
      } else {
        setView('game');
      }
    };

    net.onError = (err) => {
        alert(err);
        setView('lobby');
    };

    net.onAction = (playerId, action, tile, payload) => {
      if (net.isHost) {
        handleHostAction(playerId, action, tile, payload);
      }
    };

    net.onPlayerJoin = (conn, name) => {
      if (!net.isHost) return;

      const currentPlayers = stateRef.current.players;

      if (stateRef.current.phase !== 'lobby') {
        conn.send({ type: 'ROOM_FULL' });
        setTimeout(() => conn.close(), 100);
        return;
      }

      const existingHumans = currentPlayers.filter((p) => !p.isBot).length;
      
      if (existingHumans >= expectedHumansRef.current) {
        conn.send({ type: 'ROOM_FULL' });
        setTimeout(() => conn.close(), 100);
        return;
      }

      const newPlayer = createPlayer(conn.peer, name, false);
      const newPlayers = [...currentPlayers, newPlayer];
      updateHostState({ players: newPlayers });

      conn.send({ type: 'WELCOME', playerId: conn.peer, state: stateRef.current });
    };

    return () => {
       if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []); 

  const updateHostState = (updates: Partial<GameState>) => {
    const newState = { ...stateRef.current, ...updates };
    stateRef.current = newState;
    setGameState(newState);
    networkRef.current?.broadcastState(newState);
  };

  // Count active players (not yet won)
  const getActivePlayers = (state: GameState): number[] => {
    return state.players
      .map((p, i) => ({ p, i }))
      .filter(({ p }) => !p.isOut)
      .map(({ i }) => i);
  };

  // End round when deck is empty or only one player left
  const endRound = (reason: 'deckEmpty' | 'oneLeft') => {
    const state = stateRef.current;
    let results: RoundResult[] = [...state.roundResults];
    
    if (reason === 'deckEmpty') {
      // Calculate Ting penalties
      const tingResults = calculateRoundEndResults(state.players, state.winners);
      results = [...results, ...tingResults];
    }
    
    // Apply score changes
    const newPlayers = state.players.map((p, i) => {
      const playerResults = results.filter(r => r.playerId === i);
      const totalChange = playerResults.reduce((sum, r) => sum + r.points, 0);
      return {
        ...p,
        score: p.score + totalChange
      };
    });
    
    updateHostState({
      phase: 'roundEnd',
      players: newPlayers,
      roundResults: results,
      waitingForAction: false
    });
    
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  };

  const handleHostAction = (playerId: string, action: ActionType, actionTile?: TileType, payload?: any) => {
    const state = stateRef.current;
    const playerIndex = state.players.findIndex(p => p.id === playerId);
    if (playerIndex === -1) return;

    const player = state.players[playerIndex];

    // Handle next round request
    if (action === 'nextRound' && state.phase === 'roundEnd') {
      startNewRound();
      return;
    }

    if (state.phase === 'exchange' && action === 'exchange') {
      const tiles = payload.tiles as TileType[];
      if (!tiles || tiles.length !== 3) {
        console.warn("Invalid exchange tiles", tiles);
        return;
      }
      
      const newPlayers = [...state.players];
      newPlayers[playerIndex] = { ...player, exchangeTiles: tiles, ready: true };
      
      updateHostState({ players: newPlayers });
      
      if (newPlayers.every(p => p.ready)) {
        performExchange(newPlayers);
      }
      return;
    }

    if (state.phase === 'dingque' && action === 'dingque') {
      const suit = payload.suit as Suit;
      const newPlayers = [...state.players];
      newPlayers[playerIndex] = { ...player, selectedSuit: suit, ready: true };
      updateHostState({ players: newPlayers });

      if (newPlayers.every(p => p.ready)) {
        startPlayingPhase(newPlayers);
      }
      return;
    }

    if (state.phase === 'playing') {
      // Skip if player is already out
      if (player.isOut) return;

      if (state.waitingForAction) {
        if (action === 'pass') {
             return; 
        }

        if (action === 'pong') {
           if (state.lastDiscard && canPong(player.hand, state.lastDiscard)) {
             performPong(playerIndex);
           }
        }
        else if (action === 'kong') {
           if (state.lastDiscard && canKong(player.hand, state.lastDiscard)) {
             performKong(playerIndex, state.lastDiscard); 
           }
        }
        else if (action === 'hu') {
           const fullHand = [...player.hand, state.lastDiscard!];
           const res = checkHu(fullHand, player.peng, player.gang, player.selectedSuit);
           if (res.canHu) {
             performHu(playerIndex, state.lastDiscard!, res.fan || 0);
           }
        }
      } else {
        if (playerIndex !== state.currentTurn) return;

        if (action === 'discard' && actionTile) {
           performDiscard(playerIndex, actionTile);
        }
        else if (action === 'hu') {
           const res = checkHu(player.hand, player.peng, player.gang, player.selectedSuit);
           if (res.canHu) {
             performHu(playerIndex, undefined, res.fan || 0);
           }
        }
        else if (action === 'kong') { 
             performSelfKong(playerIndex);
        }
      }
    }
  };

  const performDiscard = (playerIndex: number, tile: TileType) => {
    const state = stateRef.current;
    const player = state.players[playerIndex];
    
    const newHand = player.hand.filter(t => t.id !== tile.id);
    const newDiscards = [...player.discards, tile];
    const newPlayer = { ...player, hand: sortHand(newHand), discards: newDiscards, lastDrawId: undefined };
    
    const newPlayers = [...state.players];
    newPlayers[playerIndex] = newPlayer;

    updateHostState({
      players: newPlayers,
      lastDiscard: tile,
      lastDiscardBy: playerIndex,
      waitingForAction: true, 
    });

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    
    timeoutRef.current = setTimeout(() => {
        checkBotClaimsAndProceed();
    }, 8000); 
  };

  const checkBotClaimsAndProceed = () => {
    const state = stateRef.current;
    if (!state.waitingForAction) return;
    if (!state.lastDiscard) return;

    const discarder = state.lastDiscardBy!;
    const activePlayers = getActivePlayers(state);
    
    // Check all active players for Hu (bot only auto-claim)
    let anyHu = false;
    for (let i = 1; i < 4; i++) {
        const idx = (discarder + i) % 4;
        const p = state.players[idx];
        if (p.isOut) continue;
        if (!p.isBot) continue;

        const fullHand = [...p.hand, state.lastDiscard];
        const res = checkHu(fullHand, p.peng, p.gang, p.selectedSuit);
        
        if (res.canHu) {
            performHu(idx, state.lastDiscard, res.fan || 0);
            anyHu = true;
        }
    }

    if (anyHu) return;

    // Check bots for Pong/Kong
    for (let i = 1; i < 4; i++) {
        const idx = (discarder + i) % 4;
        const p = state.players[idx];
        if (p.isOut) continue;
        if (!p.isBot) continue;

        if (canKong(p.hand, state.lastDiscard)) {
            performKong(idx, state.lastDiscard);
            return;
        }
        if (canPong(p.hand, state.lastDiscard)) {
            performPong(idx);
            return;
        }
    }

    // Find next active player
    let nextTurn = (discarder + 1) % 4;
    while (state.players[nextTurn].isOut && nextTurn !== discarder) {
        nextTurn = (nextTurn + 1) % 4;
    }
    
    // Check if only one player left
    if (activePlayers.length <= 1) {
        endRound('oneLeft');
        return;
    }
    
    drawTile(nextTurn);
  };

  const drawTile = (playerIndex: number, fromTail = false) => {
    const state = stateRef.current;
    
    // Skip players who are out
    if (state.players[playerIndex].isOut) {
        const activePlayers = getActivePlayers(state);
        if (activePlayers.length <= 1) {
            endRound('oneLeft');
            return;
        }
        // Find next active player
        let next = (playerIndex + 1) % 4;
        while (state.players[next].isOut) {
            next = (next + 1) % 4;
        }
        drawTile(next, fromTail);
        return;
    }
    
    if (state.deck.length === 0) {
      endRound('deckEmpty'); 
      return;
    }

    const newDeck = [...state.deck];
    const tile = fromTail ? newDeck.shift()! : newDeck.pop()!;
    
    const newPlayers = [...state.players];
    const player = newPlayers[playerIndex];
    player.hand = [...player.hand, tile];
    player.lastDrawId = tile.id;
    
    updateHostState({
      deck: newDeck,
      players: newPlayers,
      currentTurn: playerIndex,
      lastDiscard: undefined,
      lastDiscardBy: undefined,
      waitingForAction: false
    });
  };

  const performPong = (claimerIndex: number) => {
    const state = stateRef.current;
    const tile = state.lastDiscard!;
    const newPlayers = [...state.players];

    if (state.lastDiscardBy !== undefined) {
       const discarder = newPlayers[state.lastDiscardBy];
       newPlayers[state.lastDiscardBy] = {
           ...discarder,
           discards: discarder.discards.filter(t => t.id !== tile.id)
       };
    }

    const player = newPlayers[claimerIndex];
    const matching = player.hand.filter(t => t.suit === tile.suit && t.value === tile.value).slice(0, 2);
    const remaining = player.hand.filter(t => !matching.some(m => m.id === t.id));
    const meld = [tile, ...matching]; 
    
    newPlayers[claimerIndex] = {
      ...player,
      hand: remaining,
      peng: [...player.peng, meld]
    };

    updateHostState({
      players: newPlayers,
      currentTurn: claimerIndex,
      lastDiscard: undefined,
      waitingForAction: false
    });
    
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  };

  const performKong = (claimerIndex: number, tile: TileType) => {
    const state = stateRef.current;
    const newPlayers = [...state.players];

    if (state.lastDiscardBy !== undefined) {
        const discarder = newPlayers[state.lastDiscardBy];
        newPlayers[state.lastDiscardBy] = {
            ...discarder,
            discards: discarder.discards.filter(t => t.id !== tile.id)
        };
     }

    const player = newPlayers[claimerIndex];
    const matching = player.hand.filter(t => t.suit === tile.suit && t.value === tile.value).slice(0, 3);
    const remaining = player.hand.filter(t => !matching.some(m => m.id === t.id));
    const meld = [tile, ...matching];

    newPlayers[claimerIndex] = {
      ...player,
      hand: remaining,
      gang: [...player.gang, meld]
    };

    stateRef.current = { ...state, players: newPlayers, lastDiscard: undefined, currentTurn: claimerIndex, waitingForAction: false };
    
    drawTile(claimerIndex, true);
    
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  };
  
  const performSelfKong = (claimerIndex: number) => {
    const state = stateRef.current;
    const newPlayers = [...state.players];
    const player = newPlayers[claimerIndex];
    
    const counts: Record<string, TileType[]> = {};
    player.hand.forEach(t => {
        const key = `${t.suit}-${t.value}`;
        if (!counts[key]) counts[key] = [];
        counts[key].push(t);
    });
    
    let anGangKey = Object.keys(counts).find(k => counts[k].length === 4);
    
    if (anGangKey) {
        const tiles = counts[anGangKey];
        const remaining = player.hand.filter(t => !tiles.some(m => m.id === t.id));
        
        newPlayers[claimerIndex] = {
            ...player,
            hand: remaining,
            gang: [...player.gang, tiles]
        };
    } else {
        let jiaGangTile: TileType | undefined;
        let pengIndex = -1;
        
        for (let i = 0; i < player.peng.length; i++) {
            const first = player.peng[i][0];
            const match = player.hand.find(t => t.suit === first.suit && t.value === first.value);
            if (match) {
                jiaGangTile = match;
                pengIndex = i;
                break;
            }
        }
        
        if (jiaGangTile && pengIndex !== -1) {
            const remaining = player.hand.filter(t => t.id !== jiaGangTile!.id);
            const newPeng = [...player.peng];
            const targetPeng = newPeng.splice(pengIndex, 1)[0];
            const newGang = [...player.gang, [...targetPeng, jiaGangTile]];
            
            newPlayers[claimerIndex] = {
                ...player,
                hand: remaining,
                peng: newPeng,
                gang: newGang
            };
        } else {
            return;
        }
    }
    
    stateRef.current = { ...state, players: newPlayers, currentTurn: claimerIndex, waitingForAction: false };
    drawTile(claimerIndex, true);
  };

  const performHu = (winnerIndex: number, winningTile: TileType | undefined, fan: number) => {
    const state = stateRef.current;
    const newPlayers = [...state.players];
    const isSelfDraw = !winningTile;
    
    // Calculate points
    const points = calculateHuPoints(fan, isSelfDraw);
    
    // Create result entry
    const result: RoundResult = {
      playerId: winnerIndex,
      playerName: state.players[winnerIndex].name,
      action: 'hu',
      points: 0,
      description: isSelfDraw ? `自摸 ${fan}番` : `点炮胡 ${fan}番`
    };
    
    if (winningTile && state.lastDiscardBy !== undefined) {
      // Remove from discarder's discards
      const discarder = newPlayers[state.lastDiscardBy];
      newPlayers[state.lastDiscardBy] = {
          ...discarder,
          discards: discarder.discards.filter(t => t.id !== winningTile.id),
          score: discarder.score - points
      };
      
      newPlayers[winnerIndex].hand.push(winningTile);
      newPlayers[winnerIndex].lastDrawId = winningTile.id;
      newPlayers[winnerIndex].score += points;
      
      result.points = points;
      result.description += ` (+${points}分)`;
      
      // Add pao player result
      const paoResult: RoundResult = {
        playerId: state.lastDiscardBy,
        playerName: state.players[state.lastDiscardBy].name,
        action: 'paoPlayer',
        points: -points,
        description: `点炮 (-${points}分)`
      };
      state.roundResults.push(paoResult);
    } else {
      // Self draw - everyone else pays
      const payerCount = newPlayers.filter((_, i) => i !== winnerIndex && !newPlayers[i].isOut).length;
      const perPlayer = points;
      
      for (let i = 0; i < 4; i++) {
        if (i === winnerIndex || newPlayers[i].isOut) continue;
        newPlayers[i].score -= perPlayer;
      }
      newPlayers[winnerIndex].score += perPlayer * payerCount;
      result.points = perPlayer * payerCount;
      result.description += ` (+${perPlayer * payerCount}分)`;
    }
    
    // Mark player as out
    newPlayers[winnerIndex].isOut = true;
    
    const newWinners = [...state.winners, winnerIndex];
    const newResults = [...state.roundResults, result];
    
    // Check how many players are still active
    const activePlayers = newPlayers.filter(p => !p.isOut);
    
    // Set first winner as next dealer
    const firstWinner = state.firstWinner ?? winnerIndex;
    
    if (activePlayers.length <= 1) {
      // Round is over
      updateHostState({
        players: newPlayers,
        winners: newWinners,
        roundResults: newResults,
        firstWinner,
        phase: 'roundEnd',
        waitingForAction: false
      });
      
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    } else {
      // Continue playing
      updateHostState({
        players: newPlayers,
        winners: newWinners,
        roundResults: newResults,
        firstWinner,
        waitingForAction: false,
        lastDiscard: undefined
      });
      
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      
      // Find next active player to continue
      let nextTurn = (state.currentTurn + 1) % 4;
      while (newPlayers[nextTurn].isOut) {
        nextTurn = (nextTurn + 1) % 4;
      }
      
      // If it was a discard Hu, we need to continue from next player
      if (winningTile && state.lastDiscardBy !== undefined) {
        nextTurn = (state.lastDiscardBy + 1) % 4;
        while (newPlayers[nextTurn].isOut) {
          nextTurn = (nextTurn + 1) % 4;
        }
      }
      
      setTimeout(() => {
        drawTile(nextTurn);
      }, 1000);
    }
  };

  const performExchange = (players: PlayerState[]) => {
    const newPlayers = [...players];
    const exchanges = newPlayers.map(p => p.exchangeTiles!);
    const type = stateRef.current.exchangeType ?? 0;
    
    for (let i = 0; i < 4; i++) {
      const p = newPlayers[i];
      const sent = exchanges[i];
      
      let receivedIndex = 0;
      if (type === 0) {
         receivedIndex = (i + 3) % 4; 
      } else if (type === 1) {
         receivedIndex = (i + 1) % 4;
      } else {
         receivedIndex = (i + 2) % 4;
      }

      const received = exchanges[receivedIndex]; 
      
      const handWithoutSent = p.hand.filter(h => !sent.find(s => s.id === h.id));
      p.hand = sortHand([...handWithoutSent, ...received]);
      p.ready = false;
      p.exchangeTiles = undefined;
    }
    
    updateHostState({
      players: newPlayers,
      phase: 'dingque'
    });
  };

  const startPlayingPhase = (players: PlayerState[]) => {
    const newPlayers = players.map(p => ({ ...p, ready: false }));
    updateHostState({
      players: newPlayers,
      phase: 'playing',
      currentTurn: stateRef.current.dealer
    });
    drawTile(stateRef.current.dealer);
  };

  const startNewRound = () => {
    const state = stateRef.current;
    const deck = generateDeck();
    
    // Determine new dealer (first winner of last round, or keep same if no winners)
    const newDealer = state.firstWinner ?? state.dealer;
    
    let newPlayers = state.players.map((p) => ({
      ...p,
      hand: sortHand(deck.splice(0, 13)),
      peng: [],
      gang: [],
      discards: [],
      ready: false,
      exchangeTiles: undefined,
      selectedSuit: undefined,
      isOut: false,
      isTing: false,
      lastDrawId: undefined
    }));
    
    const exchangeType = Math.floor(Math.random() * 3);

    updateHostState({
       phase: 'exchange',
       players: newPlayers,
       deck,
       currentTurn: newDealer,
       dealer: newDealer,
       round: state.round + 1,
       winners: [],
       roundResults: [],
       firstWinner: undefined,
       exchangeType,
       lastDiscard: undefined,
       lastDiscardBy: undefined,
       waitingForAction: false
    });
  };

  // Bot Logic
  useEffect(() => {
    const interval = setInterval(() => {
      const state = stateRef.current;
      if (!networkRef.current?.isHost) return;

      if (state.phase === 'playing') {
          const turnPlayer = state.players[state.currentTurn];
          if (turnPlayer && turnPlayer.isBot && !turnPlayer.isOut && !state.waitingForAction) {
            // Check if bot can self-Hu
            const huRes = checkHu(turnPlayer.hand, turnPlayer.peng, turnPlayer.gang, turnPlayer.selectedSuit);
            if (huRes.canHu) {
              performHu(state.currentTurn, undefined, huRes.fan || 0);
              return;
            }
            
            // Check for self kong
            const counts: Record<string, TileType[]> = {};
            turnPlayer.hand.forEach(t => {
                const key = `${t.suit}-${t.value}`;
                if (!counts[key]) counts[key] = [];
                counts[key].push(t);
            });
            
            const hasDarkKong = Object.values(counts).some(c => c.length === 4);
            if (hasDarkKong) {
              performSelfKong(state.currentTurn);
              return;
            }
            
            // Discard
            const discard = decideDiscard(turnPlayer.hand, turnPlayer.selectedSuit);
            performDiscard(state.currentTurn, discard);
          }
      }
      else if (state.phase === 'dingque') {
         state.players.forEach((p) => {
           if (p.isBot && !p.ready) {
             const suit = decideSuit(p.hand);
             handleHostAction(p.id, 'dingque', undefined, { suit });
           }
         });
      }
      else if (state.phase === 'exchange') {
          state.players.forEach((p) => {
           if (p.isBot && !p.ready) {
             const suit = decideSuit(p.hand); 
             let candidates = p.hand.filter(t => t.suit === suit);
             if (candidates.length < 3) {
               const others = p.hand.filter(t => t.suit !== suit);
               candidates = [...candidates, ...others];
             }
             const exchange = candidates.slice(0, 3);
             handleHostAction(p.id, 'exchange', undefined, { tiles: exchange });
           }
         });
      }

    }, 1000); 
    return () => clearInterval(interval);
  }, []);

  const startActualGame = () => {
    const deck = generateDeck();
    let currentPlayers = [...stateRef.current.players];
    
    currentPlayers = currentPlayers.map(p => ({
      ...p,
      hand: sortHand(deck.splice(0, 13)),
      isOut: false,
      isTing: false
    }));

    const botsNeeded = 4 - currentPlayers.length;
    for (let i = 0; i < botsNeeded; i++) {
       const bot = createPlayer(`bot-${Date.now()}-${i}`, `电脑 ${i+1}`, true);
       bot.hand = sortHand(deck.splice(0, 13));
       currentPlayers.push(bot);
    }
    
    const exchangeType = Math.floor(Math.random() * 3);
    currentPlayers = currentPlayers.map(p => ({ ...p, ready: false, exchangeTiles: undefined, selectedSuit: undefined }));

    updateHostState({
       phase: 'exchange',
       players: currentPlayers,
       deck,
       currentTurn: 0,
       dealer: 0,
       round: 1,
       winners: [],
       roundResults: [],
       firstWinner: undefined,
       exchangeType
    });
    setView('game');
  };

  const handleHost = (name: string, count: number) => {
    if (!networkRef.current) return;
    expectedHumansRef.current = count;
    networkRef.current.hostGame();

    const me = createPlayer(myId, name, false);

    updateHostState({ players: [me] });

    if (count === 1) {
      startActualGame();
    } else {
      setView('waiting');
    }
  };

  return (
    <div className="min-h-screen bg-stone-900">
      {view === 'lobby' && (
        <Lobby 
          myPeerId={myId} 
          onHost={(name, count) => {
            expectedHumansRef.current = count;
            handleHost(name, count);
          }}
          onJoin={(hostId, name) => {
             networkRef.current?.joinGame(hostId, name);
          }}
        />
      )}
      {view === 'waiting' && (
        <WaitingRoom 
           roomId={myId} 
           players={gameState.players}
           expectedCount={expectedHumansRef.current}
           onStart={startActualGame}
           isHost={!!networkRef.current?.isHost}
        />
      )}
      {view === 'game' && (
        <Board 
          gameState={gameState} 
          myPlayerId={myId}
          onAction={(action, tile, payload) => {
            if (networkRef.current?.isHost) {
              handleHostAction(myId, action, tile, payload);
            } else {
              networkRef.current?.sendAction(action, tile, payload);
            }
          }}
        />
      )}
    </div>
  );
}

export default App;
