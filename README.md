# 🎮 Room Rush — Multiplayer Trivia Game

**Room Rush** is a multiplayer trivia gaming application built with JavaScript, Node.js, Express.js, Socket.IO, and Electron. It features a browser-based game interface and a Windows desktop application packaged using Electron Builder.

The project explores real-time multiplayer application development, game-room management, client-server communication, and desktop application packaging.

## 🚀 Project Overview

Room Rush allows two players to create or join a trivia room using a room code, view the waiting room, and play a timed trivia match. The server enforces room codes, player limits, host permissions, and answer validity.

The application runs locally through a Node.js server and can also be packaged as a Windows desktop application.

### Key Highlights

- 🎮 Multiplayer trivia game concept
- 🔑 Room codes for identifying game rooms
- 👥 Two-player rooms and waiting-room interface
- ⚡ Real-time communication using Socket.IO
- 🔄 Reconnection grace period with score and answer state preserved
- 🛡️ Server-side validation for room codes, player membership, capacity, and answers
- 🌐 Browser-based game interface
- 🖥️ Windows desktop application powered by Electron
- 📦 Windows installer generated using Electron Builder and NSIS
- 🎨 Dark, gaming-inspired user interface

## 🛠️ Technology Stack

| Technology | Purpose |
|---|---|
| JavaScript | Application logic |
| Node.js | JavaScript runtime and server execution |
| Express.js | HTTP server and static file delivery |
| Socket.IO | Real-time client-server communication |
| HTML5 | Game interface structure |
| CSS3 | Styling and responsive presentation |
| Electron.js | Windows desktop application |
| Electron Builder | Application packaging and distribution |
| NSIS | Windows installer generation |
| npm | Dependency management and project scripts |

## 🏗️ Application Architecture

```text
Room Rush
│
├── Frontend
│   ├── HTML
│   ├── CSS
│   └── JavaScript
│
├── Backend
│   ├── Node.js
│   ├── Express.js
│   └── Socket.IO
│
├── Desktop Application
│   └── Electron
│
└── Build and Distribution
    ├── Electron Builder
    ├── NSIS
    └── Windows Installer (.exe)
```

### How It Works

1. The Node.js server starts and serves the game interface.
2. Players access the game through a browser or the desktop application.
3. The game interface displays room information and player details.
4. Socket.IO provides the real-time communication layer for multiplayer features.
5. Electron wraps the web application in a desktop window.
6. Electron Builder packages the application into a Windows installer.

## ✨ Features

### 1. Game Room Interface

Players can access a game-room interface that displays a room code and up to two player seats.

### 2. Room Codes

A room code provides a convenient way to identify a game room and share joining information with other players.

### 3. Multiplayer Waiting Room

The waiting room displays the host, player count, player names, and the waiting status before a game begins. The server only permits two connected players in a room.

### 4. Trivia Gameplay

Room Rush is designed around quiz-based multiplayer gameplay. The complete question, scoring, and results flow should be tested to verify that all game mechanics work correctly.

### 5. Windows Desktop Application

The application can be packaged and installed on Windows using Electron and Electron Builder.

### 6. Browser-Based Development

The web interface can be accessed locally during development, making it easier to test interface changes and server behavior.

### 7. Room validation and disconnect recovery

The server accepts only four-character room codes from the generated code alphabet, checks room state and capacity before joining, and verifies host identity and player membership for game actions. Each player receives a random session token. If a socket drops, that player can reconnect to their seat for 30 seconds with their score and submitted answer preserved. A disconnected host's role transfers to the other connected player. Unanswered rounds continue when all remaining connected players have answered, and abandoned rooms are cleaned up.

## 💻 Installation

### Option 1: Install the Windows Application

Download or locate the generated Windows installer:

`Room Rush Setup 1.0.0.exe`

Run the installer and follow the on-screen instructions.

After installation, launch **Room Rush** from the Windows Start menu or desktop shortcut, if available.

### Option 2: Run from Source

#### Prerequisites

- Node.js
- npm
- Git (for cloning the repository)

#### Step 1: Clone the repository

```bash
git clone https://github.com/sankeraswin579-crypto/room-rush_app.git
```

#### Step 2: Navigate to the project

```bash
cd room-rush
```

#### Step 3: Install dependencies

```bash
npm install
```

#### Step 4: Start the server

```bash
npm start
```

#### Step 5: Open the application

Visit:

`http://localhost:3000`

Keep the server terminal open while using the locally hosted game.

## 🖥️ Run the Desktop Application in Development

To launch the Electron desktop application from the source project:

```bash
npm run desktop
```

This command uses the Electron entry point configured in the project.

## 📦 Build the Windows Installer

To generate the Windows installer:

```bash
npm run build:win
```

The build uses Electron Builder with the NSIS installer target.

The expected installer location is:

```text
release/
└── Room Rush Setup 1.0.0.exe
```

The packaged, unpacked application is expected under:

```text
release/
└── win-unpacked/
    └── Room Rush.exe
```

The exact output files should be verified after each build.

## 📁 Project Structure

```text
room-rush/
│
├── electron/
│   └── main.js
│
├── public/
│   ├── index.html
│   ├── app.js
│   ├── style.css
│   └── data/
│       └── game-modes.json
│
├── server.js
├── package.json
├── package-lock.json
├── README.md
├── .gitignore
└── release/
```

The `release/` directory is generated during packaging and may be excluded from Git version control.

## 🔧 Troubleshooting

### Port 3000 is already in use

If the server reports `EADDRINUSE`, another process may already be using port 3000.

Check the port in Windows PowerShell:

```powershell
netstat -ano | findstr :3000
```

Identify the process before stopping it, then restart the application.

### Windows installer build fails

Check that dependencies are installed:

```powershell
npm install
```

Then retry:

```powershell
npm run build:win
```

If an error persists, review the complete Electron Builder output.

### Dependency security warnings

Run:

```powershell
npm audit
```

Review the reported vulnerabilities and update affected dependencies carefully. Avoid forced dependency upgrades without reviewing their potential breaking changes.

## 🌐 Online Multiplayer

The current development workflow uses a local Node.js server. Rooms support two players.

For players on different computers to join over the internet, the backend must be deployed to a publicly accessible host that supports persistent Node.js processes and Socket.IO connections.

The desktop application must then be configured to connect to that public server.

Online multiplayer deployment and cross-network gameplay should be treated as separate milestones from building the Windows installer.

## 🔒 Security and Reliability

Before a public release:

- Review and remediate dependency vulnerabilities.
- Keep room code and player action validation on the server.
- Test multiple simultaneous players.
- Test reconnects, host handoff, disconnect timeouts, and server restarts.
- Test the complete quiz and scoring flow.
- Configure secure production hosting.
- Consider code signing for Windows distribution.

## 🗺️ Future Improvements

- Complete end-to-end multiplayer gameplay testing
- Public online multiplayer server
- Persistent room management and reconnection across server restarts
- Expanded trivia categories and game modes
- Leaderboards and match history
- Improved error handling
- Application icon and branding
- Dependency security updates
- Automated tests and continuous integration
- Signed Windows releases

## 🎯 Learning Outcomes

This project provides practical experience with:

- JavaScript application development
- Node.js backend execution
- Express.js server setup
- Real-time communication concepts using Socket.IO
- Client-server architecture
- Electron desktop application development
- Windows application packaging
- npm dependency management
- Troubleshooting local server and build errors

## 👨‍💻 Author

**Aswin Sankar P S**

GitHub: [@sankeraswin579-crypto](https://github.com/sankeraswin579-crypto)

Project Repository: [Room Rush](https://github.com/sankeraswin579-crypto/room-rush_app)

## 📄 License

See the project's `LICENSE` file for licensing terms.

---

**Room Rush — Build your squad. Test your knowledge. Rush to victory!**
