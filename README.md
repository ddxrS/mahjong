# Sichuan Mahjong (Online Multiplayer)

This is a web-based Sichuan Mahjong game supporting 1-4 players (local or online via P2P). Remaining slots are filled with bots.

## Features
- Rules: Sichuan Mahjong (No Bloody Battle).
- Online Multiplayer using PeerJS (WebRTC).
- Bots for filling empty seats.
- Responsive design.

## How to Play
1. **Host**: Enter your name, choose number of human players (1-4).
   - If 1: Game starts immediately with 3 bots.
   - If >1: You will enter a **Waiting Room**. Share the displayed "Room ID" with friends. When they join, they will appear in the list. Click "Start Game" when ready.
2. **Join**: Enter your name and the Host ID provided by the host.

## Development
```bash
npm install
npm run dev
```

## How to Deploy to GitHub Pages

To deploy this game so you can play with friends online:

1. **Create a GitHub Repository**:
   - Go to GitHub and create a new public repository (e.g., `mahjong-game`).

2. **Configure Vite**:
   - Open `vite.config.ts`.
   - Add `base: '/mahjong-game/',` (replace `mahjong-game` with your repo name).
   - Example:
     ```ts
     export default defineConfig({
       base: '/mahjong-game/', 
       plugins: [react(), tailwindcss(), viteSingleFile()],
       // ...
     });
     ```

3. **Build & Deploy**:
   - Run these commands in your terminal:
     ```bash
     npm run build
     ```
   - This creates a `dist` folder.
   - You can manually upload the contents of `dist` to your repo's `gh-pages` branch, or use a deploy script.

4. **Easy Deploy Script**:
   - Install `gh-pages` package: `npm install -D gh-pages`
   - Add this script to `package.json`:
     ```json
     "scripts": {
       "deploy": "gh-pages -d dist",
       ...
     }
     ```
   - Run: `npm run build && npm run deploy`

5. **Access**:
   - Your game will be at `https://<your-username>.github.io/<repo-name>/`.

## Multiplayer Notes
- This uses **PeerJS** which relies on a public broker server (PeerServer Cloud) by default.
- It usually works fine for small tests.
- If players are on different restrictive networks (e.g., corporate/school Wi-Fi), P2P connection might fail without a TURN server.
# mahjong
