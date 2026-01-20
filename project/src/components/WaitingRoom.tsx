import React from 'react';
import { PlayerState } from '../game/types';
import { Copy, Users, Play } from 'lucide-react';

interface WaitingRoomProps {
  roomId: string;
  players: PlayerState[];
  expectedCount: number;
  onStart: () => void;
  isHost: boolean;
}

export const WaitingRoom: React.FC<WaitingRoomProps> = ({ roomId, players, expectedCount, onStart, isHost }) => {
  const humanCount = players.filter(p => !p.isBot).length;
  const copyToClipboard = () => {
    navigator.clipboard.writeText(roomId);
    alert('Room ID copied!');
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-stone-900 text-white p-4">
      <div className="bg-stone-800 p-8 rounded-xl shadow-2xl max-w-2xl w-full space-y-8 border border-stone-700">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold text-amber-500">{isHost ? '等待玩家' : '已加入房间'}</h1>
          <p className="text-stone-400">{isHost ? '请分享下方 ID 给好友加入房间' : '等待房主开始游戏...'}</p>
        </div>

        {isHost && (
          <div className="bg-black/40 p-6 rounded-lg flex flex-col items-center gap-4">
            <span className="text-stone-400 text-sm uppercase tracking-wider">房间 ID</span>
            <div className="flex items-center gap-4 w-full">
              <code className="flex-1 bg-black/60 p-4 rounded text-2xl font-mono text-center text-green-400 tracking-widest border border-stone-600">
                {roomId}
              </code>
              <button 
                onClick={copyToClipboard}
                className="p-4 bg-stone-700 hover:bg-stone-600 rounded text-stone-300 transition-colors"
                title="复制 ID"
              >
                <Copy size={24} />
              </button>
            </div>
          </div>
        )}

        <div className="space-y-4">
          <div className="flex items-center justify-between text-stone-300 border-b border-stone-700 pb-2">
            <div className="flex items-center gap-2">
              <Users size={20} />
              <span className="font-semibold">玩家列表 ({humanCount}{isHost ? `/${expectedCount}` : ''})</span>
            </div>
            {isHost && <span className="text-sm">剩余空位将由人机填补</span>}
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {players.map((p) => (
              <div key={p.id} className="bg-stone-700/50 p-4 rounded flex items-center gap-3 border border-stone-600">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg
                  ${p.id === players[0].id ? 'bg-amber-600 text-white' : 'bg-stone-600 text-stone-300'}
                `}>
                  {p.name[0].toUpperCase()}
                </div>
                <div className="flex flex-col">
                  <span className="font-bold text-lg">{p.name}</span>
                  <span className="text-xs text-stone-400">{p.id === players[0].id ? '房主' : '玩家'}</span>
                </div>
              </div>
            ))}
            {/* Placeholders */}
            {Array.from({ length: Math.max(0, expectedCount - humanCount) }).map((_, idx) => (
               <div key={`empty-${idx}`} className="bg-stone-800/30 p-4 rounded flex items-center gap-3 border border-stone-700/50 border-dashed opacity-50">
                  <div className="w-10 h-10 rounded-full bg-stone-800 flex items-center justify-center">?</div>
                  <span className="text-stone-500">等待加入...</span>
               </div>
            ))}
          </div>
        </div>

        {isHost && (
          <div className="pt-4">
            <button 
              onClick={onStart}
              className="w-full bg-amber-600 hover:bg-amber-500 text-white font-bold py-4 rounded-lg text-xl shadow-lg transition-all transform hover:scale-[1.02] flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Play fill="currentColor" />
              开始游戏 {humanCount < expectedCount ? `(补充 ${expectedCount - humanCount} 个电脑)` : ''}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
