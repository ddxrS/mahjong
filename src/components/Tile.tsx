import React from 'react';
import { TileType } from '../game/types';

interface TileProps {
  tile: TileType;
  onClick?: () => void;
  selected?: boolean;
  isLastDiscard?: boolean;
  isNewDraw?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'responsive' | 'responsive-sm' | 'responsive-lg';
  hidden?: boolean; // Face down
  disabled?: boolean;
  className?: string;
}

export const Tile: React.FC<TileProps> = ({ tile, onClick, selected, isLastDiscard, isNewDraw, size = 'md', hidden, disabled, className }) => {
  const sizeClasses = {
    sm: 'w-10 h-14',
    md: 'w-16 h-24',
    lg: 'w-24 h-36',
    responsive: 'w-[7vmin] h-[10vmin]',
    'responsive-sm': 'w-[5vmin] h-[7.5vmin]',
    'responsive-lg': 'w-[8vmin] h-[12vmin]',
  };

  const fontSizes = {
    sm: { value: 'text-2xl', suit: 'text-sm' },
    md: { value: 'text-4xl', suit: 'text-lg' },
    lg: { value: 'text-6xl', suit: 'text-2xl' },
    responsive: { value: 'text-[5vmin]', suit: 'text-[2.5vmin]' },
    'responsive-sm': { value: 'text-[3.5vmin]', suit: 'text-[1.8vmin]' },
    'responsive-lg': { value: 'text-[7vmin]', suit: 'text-[3vmin]' },
  };

  const baseSize = sizeClasses[size];
  const fonts = fontSizes[size];

  if (hidden) {
    return (
      <div 
        className={`${baseSize} bg-gradient-to-br from-indigo-700 to-indigo-900 rounded-lg shadow-md border-2 border-indigo-950 ${className || ''}`}
      />
    );
  }

  // Use simplified chars for visuals
  const suitChar = {
    bamboo: '条',
    dot: '筒',
    character: '万'
  }[tile.suit];

  const suitColor = {
    bamboo: 'text-green-600',
    dot: 'text-blue-600',
    character: 'text-red-600'
  }[tile.suit];

  const content = (
    <div className="flex flex-col items-center justify-center h-full leading-none pointer-events-none">
      <span className={`font-black ${fonts.value} ${suitColor}`}>
        {tile.value}
      </span>
      <span className={`font-bold ${fonts.suit} ${suitColor} opacity-80`}>
        {suitChar}
      </span>
    </div>
  );

  return (
    <div 
      onClick={!disabled ? onClick : undefined}
      className={`
        ${baseSize} 
        bg-gradient-to-b from-amber-50 to-amber-100 rounded-lg shadow-md border 
        ${isLastDiscard ? 'border-blue-500 ring-4 ring-blue-500/50 z-20 shadow-[0_0_15px_rgba(59,130,246,0.5)]' : 'border-amber-300'}
        ${isNewDraw ? 'ml-[2vmin] ring-2 ring-yellow-400' : ''}
        flex items-center justify-center cursor-pointer select-none
        transition-all transform relative
        ${selected ? '-translate-y-4 ring-4 ring-blue-400 z-10 scale-105' : (!disabled && !isLastDiscard ? 'hover:-translate-y-1 hover:shadow-lg' : '')}
        ${disabled ? 'cursor-default' : ''}
        ${className || ''}
      `}
    >
      {content}
      {isLastDiscard && (
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full animate-ping" />
      )}
      {isNewDraw && (
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 bg-yellow-500 text-black text-[1vmin] px-1 rounded font-bold">
            新
          </div>
      )}
    </div>
  );
};
