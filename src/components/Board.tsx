import React, { useState, useEffect } from 'react';
import { GameState, PlayerState, TileType, ActionType } from '../game/types';
import { Tile } from './Tile';
import { sortHand, canPong, canKong, checkHu, getSuitName } from '../game/logic';
import { RefreshCw, ArrowRight, ArrowLeft, ArrowUp, Trophy, AlertCircle } from 'lucide-react';

interface BoardProps {
  gameState: GameState;
  myPlayerId: string;
  onAction: (action: ActionType, tile?: TileType, payload?: any) => void;
}

export const Board: React.FC<BoardProps> = ({ gameState, myPlayerId, onAction }) => {
  const myIndex = gameState.players.findIndex(p => p.id === myPlayerId);
  const baseIndex = myIndex === -1 ? 0 : myIndex;
  
  const [selectedTiles, setSelectedTiles] = useState<TileType[]>([]);
  const [actionSent, setActionSent] = useState(false);

  useEffect(() => {
    setSelectedTiles([]);
    setActionSent(false);
  }, [gameState.phase, gameState.currentTurn, gameState.waitingForAction]);

  const handleActionClick = (action: ActionType, tile?: TileType, payload?: any) => {
      setActionSent(true);
      onAction(action, tile, payload);
  };

  const getRelativePosition = (index: number) => {
    return (index - baseIndex + 4) % 4; 
  };

  const handleTileClick = (tile: TileType, isMine: boolean) => {
    if (!isMine) return;

    if (gameState.phase === 'exchange') {
      const exists = selectedTiles.find(t => t.id === tile.id);
      if (exists) {
        setSelectedTiles(prev => prev.filter(t => t.id !== tile.id));
      } else if (selectedTiles.length < 3) {
        setSelectedTiles(prev => [...prev, tile]);
      }
      return;
    }

    if (gameState.phase === 'playing' && gameState.currentTurn === baseIndex && !gameState.waitingForAction) {
      const player = gameState.players[baseIndex];
      if (player.isOut) return;
      
      const hasForbidden = player.hand.some(t => t.suit === player.selectedSuit);
      
      if (hasForbidden) {
          if (tile.suit !== player.selectedSuit) {
              alert("必须先打缺门！");
              return;
          }
      }
      
      onAction('discard', tile);
    }
  };

  const renderHand = (player: PlayerState, position: number) => {
    const isMe = position === 0;
    const showFace = isMe || gameState.phase === 'roundEnd' || player.isOut;
    
    const handToRender = showFace ? sortHand(player.hand) : player.hand;

    const isVertical = position === 1 || position === 3;
    const tileClass = isVertical ? 'my-[-1.5vmin]' : 'mx-[-0.2vmin]';
    const meldContainerClass = isVertical ? 'flex-col gap-2 mb-2' : 'flex-row gap-2 mr-4';
    const handContainerClass = isVertical ? 'flex-col' : 'flex-row items-end';

    const size = isMe ? 'responsive' : 'responsive-sm';

    return (
      <div className={`flex ${isVertical ? 'flex-col items-center' : 'flex-row items-end'}`}>
        {/* Melds (Peng/Gang) */}
        <div className={`flex ${meldContainerClass}`}>
          {player.peng.map((meld, idx) => (
            <div key={`peng-${idx}`} className={`flex ${isVertical ? 'flex-col -space-y-[1vmin]' : 'flex-row -space-x-[0.5vmin]'}`}>
               {meld.map(t => <Tile key={t.id} tile={t} size="responsive-sm" disabled />)}
            </div>
          ))}
          {player.gang.map((meld, idx) => (
            <div key={`gang-${idx}`} className={`flex ${isVertical ? 'flex-col -space-y-[1vmin]' : 'flex-row -space-x-[0.5vmin]'}`}>
               {meld.map(t => <Tile key={t.id} tile={t} size="responsive-sm" disabled />)}
            </div>
          ))}
        </div>

        {/* Hand Tiles */}
        <div className={`flex ${handContainerClass}`}>
          {handToRender.map((tile) => (
            <div key={tile.id} className={`${tileClass} transition-transform`}>
              <Tile 
                tile={tile} 
                size={size} 
                hidden={!showFace}
                selected={isMe && !!selectedTiles.find(t => t.id === tile.id)}
                isNewDraw={showFace && player.lastDrawId === tile.id}
                onClick={() => handleTileClick(tile, isMe)}
                className={gameState.lastDiscard?.id === tile.id ? 'opacity-50' : ''}
              />
            </div>
          ))}
        </div>
        
        {/* Won indicator */}
        {player.isOut && (
          <div className="ml-2 flex items-center gap-1 bg-yellow-500 text-black px-2 py-1 rounded-full text-[2vmin] font-bold">
            <Trophy size={16} />
            胡牌
          </div>
        )}
      </div>
    );
  };

  const renderDiscards = (player: PlayerState) => {
    return (
      <div className="flex flex-wrap gap-1 justify-center content-start w-[30vmin]">
         {player.discards.map(tile => (
           <Tile 
             key={tile.id} 
             tile={tile} 
             size="responsive-sm" 
             disabled 
             isLastDiscard={gameState.lastDiscard?.id === tile.id}
           />
         ))}
      </div>
    );
  };

  const renderExchangeDirection = () => {
      const type = gameState.exchangeType ?? 0;
      let text = "";
      let Icon = RefreshCw;
      
      if (type === 0) { text = "顺时针换牌"; Icon = ArrowRight; }
      else if (type === 1) { text = "逆时针换牌"; Icon = ArrowLeft; }
      else { text = "对家换牌"; Icon = ArrowUp; }
      
      return (
          <div className="flex items-center gap-2 text-amber-300 font-bold text-[3vmin] bg-black/40 px-4 py-2 rounded-full whitespace-nowrap">
              <Icon size={24} />
              {text}
          </div>
      );
  };

  const renderRoundEndModal = () => {
    const results = gameState.roundResults;
    const winners = gameState.winners;
    
    return (
      <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-[100]">
        <div className="bg-gradient-to-br from-stone-800 to-stone-900 rounded-2xl p-8 max-w-[80vw] max-h-[80vh] overflow-auto border border-amber-500/30 shadow-2xl">
          <h2 className="text-[5vmin] font-black text-amber-400 text-center mb-6">
            第 {gameState.round} 回合结束
          </h2>
          
          {/* Winners Section */}
          {winners.length > 0 && (
            <div className="mb-6">
              <h3 className="text-[3vmin] text-yellow-400 mb-3 flex items-center gap-2">
                <Trophy className="text-yellow-500" />
                胡牌玩家
              </h3>
              <div className="flex flex-wrap gap-4">
                {winners.map(idx => (
                  <div key={idx} className="bg-yellow-500/20 border border-yellow-500/50 rounded-lg px-4 py-2">
                    <span className="text-yellow-300 font-bold text-[2.5vmin]">
                      {gameState.players[idx].name}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Results Table */}
          <div className="mb-6">
            <h3 className="text-[3vmin] text-white mb-3">得分详情</h3>
            <div className="space-y-2">
              {results.map((r, idx) => (
                <div key={idx} className={`flex justify-between items-center px-4 py-2 rounded-lg ${
                  r.points > 0 ? 'bg-green-900/40' : r.points < 0 ? 'bg-red-900/40' : 'bg-stone-700/40'
                }`}>
                  <span className="text-white text-[2.5vmin]">{r.playerName}</span>
                  <span className="text-white/70 text-[2vmin]">{r.description}</span>
                  <span className={`font-bold text-[2.5vmin] ${
                    r.points > 0 ? 'text-green-400' : r.points < 0 ? 'text-red-400' : 'text-white'
                  }`}>
                    {r.points > 0 ? '+' : ''}{r.points}
                  </span>
                </div>
              ))}
            </div>
          </div>
          
          {/* Player Scores */}
          <div className="mb-6">
            <h3 className="text-[3vmin] text-white mb-3">当前积分</h3>
            <div className="grid grid-cols-2 gap-4">
              {gameState.players.map((p, idx) => (
                <div key={idx} className="flex justify-between items-center bg-stone-700/50 px-4 py-3 rounded-lg">
                  <span className="text-white font-bold text-[2.5vmin]">{p.name}</span>
                  <span className={`font-bold text-[3vmin] ${
                    p.score >= 200 ? 'text-green-400' : p.score > 0 ? 'text-yellow-400' : 'text-red-400'
                  }`}>
                    💰 {p.score}
                  </span>
                </div>
              ))}
            </div>
          </div>
          
          {/* Next Round Button */}
          <button
            onClick={() => onAction('nextRound')}
            className="w-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white py-4 rounded-xl font-bold text-[3vmin] shadow-lg transform hover:scale-105 transition-all"
          >
            开始下一回合
          </button>
        </div>
      </div>
    );
  };

  const positions = [
    { name: 'bottom', styles: 'bottom-[2%] left-1/2 -translate-x-1/2' },
    { name: 'right', styles: 'right-[4%] top-1/2 -translate-y-1/2 flex-col-reverse' },
    { name: 'top', styles: 'top-[2%] left-1/2 -translate-x-1/2 flex-col-reverse' },
    { name: 'left', styles: 'left-[4%] top-1/2 -translate-y-1/2 flex-col' },
  ];
  
  const discardPositions = [
    { name: 'bottom', styles: 'bottom-[25%] left-1/2 -translate-x-1/2' },
    { name: 'right', styles: 'right-[20%] top-1/2 -translate-y-1/2' },
    { name: 'top', styles: 'top-[25%] left-1/2 -translate-x-1/2' },
    { name: 'left', styles: 'left-[20%] top-1/2 -translate-y-1/2' },
  ];

  const myPlayer = gameState.players[baseIndex];
  
  // Valid Actions Calculation
  let canPongBtn = false;
  let canKongBtn = false;
  let canHuBtn = false;
  
  if (myPlayer && !myPlayer.isOut && gameState.waitingForAction && gameState.currentTurn !== baseIndex && gameState.lastDiscard) {
      if (canPong(myPlayer.hand, gameState.lastDiscard)) canPongBtn = true;
      if (canKong(myPlayer.hand, gameState.lastDiscard)) canKongBtn = true;
      const fullHand = [...myPlayer.hand, gameState.lastDiscard];
      if (checkHu(fullHand, myPlayer.peng, myPlayer.gang, myPlayer.selectedSuit).canHu) canHuBtn = true;
  }

  let canSelfKongBtn = false;
  let canSelfHuBtn = false;
  
  if (myPlayer && !myPlayer.isOut && gameState.phase === 'playing' && gameState.currentTurn === baseIndex && !gameState.waitingForAction) {
      const counts: Record<string, number> = {};
      myPlayer.hand.forEach(t => counts[`${t.suit}-${t.value}`] = (counts[`${t.suit}-${t.value}`] || 0) + 1);
      const hasDarkKong = Object.values(counts).some(c => c === 4);
      const hasAddKong = myPlayer.peng.some(meld => {
         const first = meld[0];
         return myPlayer.hand.some(h => h.suit === first.suit && h.value === first.value);
      });
      if (hasDarkKong || hasAddKong) canSelfKongBtn = true;
      if (checkHu(myPlayer.hand, myPlayer.peng, myPlayer.gang, myPlayer.selectedSuit).canHu) canSelfHuBtn = true;
  }

  return (
    <div className="relative w-full h-full bg-green-900 overflow-hidden font-sans select-none" style={{ height: '100vh', width: '100vw' }}>
      
      {/* Round End Modal */}
      {gameState.phase === 'roundEnd' && renderRoundEndModal()}
      
      {/* Center Info */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center pointer-events-none z-0">
         <div className="bg-black/30 p-[2vmin] rounded-xl text-white text-center backdrop-blur-sm border border-white/10 shadow-2xl">
            <div className="text-[4vmin] font-black text-amber-400 mb-1">四川麻将</div>
            <div className="text-[2vmin] opacity-80">剩余牌数: {gameState.deck.length}</div>
            <div className="text-[2vmin] opacity-80">第 {gameState.round} 回合</div>
            
            {gameState.phase === 'exchange' && (
                <div className="mt-2">{renderExchangeDirection()}</div>
            )}
            
            {/* Show recent winners during play */}
            {gameState.phase === 'playing' && gameState.winners.length > 0 && (
                <div className="mt-2 text-[2vmin] text-yellow-400">
                    已胡: {gameState.winners.map(i => gameState.players[i].name).join(', ')}
                </div>
            )}
         </div>
      </div>

      {/* Players */}
      {gameState.players.map((player, index) => {
        const posIndex = getRelativePosition(index);
        const posStyle = positions[posIndex].styles;
        const discardStyle = discardPositions[posIndex].styles;
        const isCurrentTurn = gameState.currentTurn === index && !player.isOut;

        return (
          <React.Fragment key={player.id}>
            {/* Hand Area */}
            <div className={`absolute ${posStyle} flex flex-col items-center transition-all duration-500 max-w-[90vw] max-h-[90vh]`}>
              {/* Info Tag */}
              <div className={`
                 px-3 py-1 rounded-full text-white text-[2vmin] mb-2 flex items-center gap-2 shadow-lg z-10 whitespace-nowrap
                 ${isCurrentTurn ? 'bg-amber-600 ring-2 ring-amber-400 scale-110' : player.isOut ? 'bg-yellow-600/80' : 'bg-black/60'}
              `}>
                <span className="font-bold max-w-[15vmin] truncate">{player.name}</span>
                <span className="bg-white/20 px-1 rounded">💰 {player.score}</span>
                {gameState.dealer === index && <span className="bg-yellow-500 text-black px-1 rounded text-[1.5vmin] font-bold">庄</span>}
                {player.ready && gameState.phase !== 'playing' && <span className="text-green-400">✓</span>}
                {player.isOut && <span className="text-yellow-300 flex items-center gap-1"><Trophy size={12} />胡</span>}
                {player.selectedSuit && (
                    <span className={`px-1.5 py-0.5 rounded text-[1.5vmin] font-bold ${
                        player.selectedSuit === 'bamboo' ? 'bg-green-600' :
                        player.selectedSuit === 'dot' ? 'bg-blue-600' : 'bg-red-600'
                    }`}>
                        缺{getSuitName(player.selectedSuit)}
                    </span>
                )}
              </div>
              
              {renderHand(player, posIndex)}
            </div>

            {/* Discards */}
            <div className={`absolute ${discardStyle} opacity-90 z-0`}>
              {renderDiscards(player)}
            </div>
          </React.Fragment>
        );
      })}

      {/* Overlay: Exchange */}
      {gameState.phase === 'exchange' && (
        myIndex !== -1 && (
          gameState.players[myIndex].ready ? (
            <div className="absolute bottom-[20%] left-1/2 -translate-x-1/2 bg-black/60 px-6 py-2 rounded-full text-white animate-pulse backdrop-blur-md text-[2.5vmin] z-50">
              等待其他玩家...
            </div>
          ) : (
            <div className="absolute bottom-[20%] left-1/2 -translate-x-1/2 flex flex-col gap-4 items-center z-50">
               <div className="bg-black/70 text-white px-6 py-2 rounded-full backdrop-blur-md shadow-xl border border-white/10 text-[2.5vmin]">
                 {selectedTiles.length === 3 ? "请点击确认" : `请选择 3 张牌交换 (${selectedTiles.length}/3)`}
               </div>
               <button 
                 className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white px-8 py-3 rounded-full font-bold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 transition-all text-[3vmin]"
                 disabled={selectedTiles.length !== 3 || actionSent}
                 onClick={() => {
                     setActionSent(true);
                     onAction('exchange', undefined, { tiles: selectedTiles });
                 }}
               >
                 {actionSent ? '等待中...' : '确认换牌'}
               </button>
            </div>
          )
        )
      )}

      {/* Overlay: Ding Que */}
      {gameState.phase === 'dingque' && myIndex !== -1 && !gameState.players[myIndex].ready && (
        <div className="absolute bottom-[20%] left-1/2 -translate-x-1/2 flex flex-col gap-4 bg-black/80 p-6 rounded-2xl backdrop-blur-md shadow-2xl border border-white/10 z-50">
           <div className="text-white text-center w-full font-bold text-[3vmin]">请定缺 (选择一门不要的花色)</div>
           <div className="flex gap-6 justify-center">
           {!actionSent ? [
               { s: 'bamboo', label: '条', color: 'bg-green-600' }, 
               { s: 'dot', label: '筒', color: 'bg-blue-600' }, 
               { s: 'character', label: '万', color: 'bg-red-600' }
            ].map(opt => (
             <button
               key={opt.s}
               onClick={() => {
                   setActionSent(true);
                   onAction('dingque', undefined, { suit: opt.s });
               }}
               className={`${opt.color} hover:brightness-110 w-[12vmin] h-[12vmin] rounded-xl text-white font-black text-[4vmin] shadow-lg transform hover:scale-110 transition-all border-2 border-white/20`}
             >
               {opt.label}
             </button>
           )) : (
              <div className="text-white text-[3vmin] animate-pulse">等待其他玩家选择...</div>
           )}
           </div>
        </div>
      )}

      {/* Action Buttons */}
      {(canPongBtn || canKongBtn || canHuBtn) && (
        <div className="absolute bottom-[20%] left-1/2 -translate-x-1/2 flex gap-4 z-50">
           {actionSent ? (
              <div className="bg-black/60 text-white px-6 py-2 rounded-full backdrop-blur text-[3vmin] animate-pulse">
                  等待响应...
              </div>
           ) : (
               <>
                {canPongBtn && <button onClick={() => handleActionClick('pong')} className="bg-blue-600 text-white px-[4vmin] py-[2vmin] rounded-lg font-bold shadow-xl hover:bg-blue-500 text-[3vmin]">碰</button>}
                {canKongBtn && <button onClick={() => handleActionClick('kong')} className="bg-purple-600 text-white px-[4vmin] py-[2vmin] rounded-lg font-bold shadow-xl hover:bg-purple-500 text-[3vmin]">杠</button>}
                {canHuBtn && <button onClick={() => handleActionClick('hu')} className="bg-red-600 text-white px-[5vmin] py-[2vmin] rounded-lg font-bold shadow-xl hover:bg-red-500 text-[4vmin] animate-pulse">胡</button>}
                <button onClick={() => handleActionClick('pass')} className="bg-gray-600 text-white px-[4vmin] py-[2vmin] rounded-lg font-bold shadow-xl hover:bg-gray-500 text-[3vmin]">过</button>
               </>
           )}
        </div>
      )}
      
      {(canSelfKongBtn || canSelfHuBtn) && (
         <div className="absolute bottom-[20%] left-1/2 -translate-x-1/2 flex gap-4 z-50">
            {actionSent ? (
              <div className="bg-black/60 text-white px-6 py-2 rounded-full backdrop-blur text-[3vmin] animate-pulse">
                  等待响应...
              </div>
           ) : (
               <>
                {canSelfKongBtn && <button onClick={() => handleActionClick('kong')} className="bg-purple-600 text-white px-[4vmin] py-[2vmin] rounded-lg font-bold shadow-xl hover:bg-purple-500 text-[3vmin]">暗杠/加杠</button>}
                {canSelfHuBtn && <button onClick={() => handleActionClick('hu')} className="bg-red-600 text-white px-[5vmin] py-[2vmin] rounded-lg font-bold shadow-xl hover:bg-red-500 text-[4vmin] animate-pulse">自摸</button>}
               </>
           )}
         </div>
      )}

      {/* Spectator Warning */}
      {myIndex === -1 && (
        <div className="absolute top-4 right-4 bg-red-600 text-white px-4 py-2 rounded shadow-lg text-sm flex items-center gap-2">
           <AlertCircle size={16} />
           观战中
        </div>
      )}
    </div>
  );
};
