import Peer, { DataConnection } from 'peerjs';
import { ActionType, GameState, TileType } from '../game/types';

export type NetworkMessage =
  | { type: 'STATE_UPDATE'; state: GameState }
  | { type: 'ACTION'; action: ActionType; tile?: TileType; payload?: any }
  | { type: 'JOIN'; name: string }
  | { type: 'WELCOME'; playerId: string; state: GameState }
  | { type: 'ROOM_FULL' };

export class NetworkManager {
  peer: Peer;
  connections: DataConnection[] = [];
  isHost: boolean = false;
  myId: string = '';
  
  onStateUpdate?: (state: GameState) => void;
  onAction?: (playerId: string, action: ActionType, tile?: TileType, payload?: any) => void;
  onPlayerJoin?: (connection: DataConnection, name: string) => void;
  onError?: (error: string) => void;

  constructor() {
    this.peer = new Peer();
    this.peer.on('open', (id) => {
      this.myId = id;
      console.log('My Peer ID:', id);
    });

    this.peer.on('error', (err) => {
        console.error(err);
        if (this.onError) this.onError(err.message || 'Connection Error');
    });

    this.peer.on('connection', (conn) => {
      this.handleConnection(conn);
    });
  }

  handleConnection(conn: DataConnection) {
    conn.on('data', (data: any) => {
      const msg = data as NetworkMessage;
      if (msg.type === 'JOIN') {
        if (this.onPlayerJoin) this.onPlayerJoin(conn, msg.name);
      } else if (msg.type === 'ACTION') {
        if (this.onAction) this.onAction(conn.peer, msg.action, msg.tile, msg.payload);
      } else if (msg.type === 'STATE_UPDATE') {
        if (this.onStateUpdate) this.onStateUpdate(msg.state);
      } else if (msg.type === 'WELCOME') {
        if (this.onStateUpdate) this.onStateUpdate(msg.state);
      } else if (msg.type === 'ROOM_FULL') {
        if (this.onError) this.onError('房间已满');
        conn.close();
      }
    });
    
    conn.on('close', () => {
        this.connections = this.connections.filter(c => c.peer !== conn.peer);
    });

    this.connections.push(conn);
  }

  hostGame() {
    this.isHost = true;
  }

  joinGame(hostId: string, name: string) {
    this.isHost = false;
    const conn = this.peer.connect(hostId);
    conn.on('open', () => {
      conn.send({ type: 'JOIN', name });
      this.handleConnection(conn);
    });
  }

  broadcastState(state: GameState) {
    this.connections.forEach(conn => {
      if (conn.open) {
        conn.send({ type: 'STATE_UPDATE', state });
      }
    });
  }

  sendAction(action: ActionType, tile?: TileType, payload?: any) {
    // Send to host (first connection usually)
    if (this.connections[0] && this.connections[0].open) {
      this.connections[0].send({ type: 'ACTION', action, tile, payload });
    }
  }
}
