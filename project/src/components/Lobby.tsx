import React, { useState } from 'react';

interface LobbyProps {
  myPeerId: string;
  onHost: (name: string, playerCount: number) => void;
  onJoin: (hostId: string, name: string) => void;
}

export const Lobby: React.FC<LobbyProps> = ({ myPeerId, onHost, onJoin }) => {
  const [name, setName] = useState('Player');
  const [hostId, setHostId] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  
  const [humanCount, setHumanCount] = useState(1);

  const handleJoin = () => {
      setIsConnecting(true);
      onJoin(hostId, name);
      // Timeout to reset if failure (though error handler in App will likely handle it)
      setTimeout(() => setIsConnecting(false), 5000); 
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-green-800 text-white p-4">
      <div className="bg-green-900 p-8 rounded-xl shadow-2xl max-w-md w-full space-y-6">
        <h1 className="text-4xl font-bold text-center text-amber-400">四川麻将</h1>
        
        <div className="space-y-2">
          <label className="text-sm font-medium">昵称</label>
          <input 
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full bg-green-800 border border-green-700 rounded p-2 focus:ring-2 focus:ring-amber-400 outline-none"
          />
        </div>

        <div className="p-4 bg-green-800/50 rounded-lg space-y-4">
          <h2 className="text-xl font-semibold text-amber-200">创建房间</h2>
          <div className="space-y-2">
            <label className="text-sm">玩家人数: {humanCount} (人机: {4 - humanCount})</label>
            <input 
              type="range" min="1" max="4" 
              value={humanCount}
              onChange={e => setHumanCount(Number(e.target.value))}
              className="w-full accent-amber-500"
            />
          </div>
          <button 
            onClick={() => onHost(name, humanCount)}
            disabled={!myPeerId}
            className="w-full bg-amber-500 hover:bg-amber-600 text-black font-bold py-2 rounded transition-colors disabled:opacity-50 disabled:cursor-wait"
          >
            {myPeerId ? '创建游戏' : '正在连接服务器...'}
          </button>
        </div>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-green-700"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-green-900 text-green-200">或</span>
          </div>
        </div>

        <div className="p-4 bg-green-800/50 rounded-lg space-y-4">
          <h2 className="text-xl font-semibold text-amber-200">加入房间</h2>
          <div className="space-y-2">
            <label className="text-sm">房间 ID (Host ID)</label>
            <input 
              value={hostId}
              onChange={e => setHostId(e.target.value)}
              placeholder="输入房间 ID"
              className="w-full bg-green-800 border border-green-700 rounded p-2 focus:ring-2 focus:ring-amber-400 outline-none"
            />
          </div>
          <button 
            onClick={handleJoin}
            disabled={!hostId || isConnecting}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded transition-colors disabled:opacity-50 disabled:cursor-wait"
          >
            {isConnecting ? '连接中...' : '加入游戏'}
          </button>
        </div>
        
        <div className="text-xs text-center text-green-400 mt-4">
          你的 ID: <span className="font-mono bg-black/20 px-1 rounded select-all">{myPeerId || '连接中...'}</span>
        </div>
      </div>
    </div>
  );
};
