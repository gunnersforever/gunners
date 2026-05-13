import React, { useCallback, useEffect, useRef, useState } from 'react';
import './App.css';

const WORLD = {
  width: 900,
  height: 480,
  groundY: 400,
  playerWidth: 36,
  playerHeight: 46,
  gravity: 1.1,
  jumpSpeed: 16.5,
};

const LEVELS = [
  {
    id: 1,
    name: 'Very Easy - Meadow Steps',
    speed: 3.0,
    length: 1800,
    platforms: [
      { x: 0, y: 400, w: 1900, h: 80 },
      { x: 200, y: 330, w: 150, h: 20 },
      { x: 420, y: 310, w: 150, h: 20 },
      { x: 680, y: 330, w: 160, h: 20 },
      { x: 960, y: 310, w: 160, h: 20 },
      { x: 1210, y: 330, w: 170, h: 20 },
      { x: 1340, y: 280, w: 120, h: 18 },
      { x: 1460, y: 315, w: 160, h: 20 },
      { x: 1560, y: 285, w: 120, h: 18 },
      { x: 1660, y: 335, w: 170, h: 20 },
      { x: 1760, y: 300, w: 120, h: 18 },
    ],
    coins: [
      { x: 240, y: 280 },
      { x: 460, y: 260 },
      { x: 720, y: 290 },
      { x: 1020, y: 270 },
      { x: 1260, y: 290 },
      { x: 1500, y: 270 },
      { x: 1720, y: 295 },
    ],
  },
  {
    id: 2,
    name: 'Easy - Bamboo Walk',
    speed: 3.4,
    length: 1600,
    platforms: [
      { x: 0, y: 400, w: 1700, h: 80 },
      { x: 180, y: 320, w: 140, h: 20 },
      { x: 420, y: 290, w: 130, h: 20 },
      { x: 670, y: 330, w: 150, h: 20 },
      { x: 930, y: 290, w: 140, h: 20 },
      { x: 1190, y: 320, w: 140, h: 20 },
      { x: 1450, y: 300, w: 150, h: 20 },
    ],
    coins: [
      { x: 210, y: 270 },
      { x: 450, y: 240 },
      { x: 700, y: 280 },
      { x: 980, y: 240 },
      { x: 1220, y: 270 },
      { x: 1480, y: 250 },
    ],
  },
  {
    id: 3,
    name: 'Mid Easy - Canopy Glide',
    speed: 3.8,
    length: 1750,
    platforms: [
      { x: 0, y: 400, w: 1850, h: 80 },
      { x: 230, y: 300, w: 120, h: 20 },
      { x: 470, y: 270, w: 120, h: 20 },
      { x: 720, y: 320, w: 130, h: 20 },
      { x: 990, y: 270, w: 130, h: 20 },
      { x: 1240, y: 310, w: 130, h: 20 },
      { x: 1500, y: 270, w: 130, h: 20 },
      { x: 1680, y: 320, w: 150, h: 20 },
    ],
    coins: [
      { x: 260, y: 250 },
      { x: 510, y: 230 },
      { x: 760, y: 280 },
      { x: 1040, y: 230 },
      { x: 1280, y: 260 },
      { x: 1540, y: 230 },
      { x: 1720, y: 280 },
    ],
  },
  {
    id: 4,
    name: 'Mid - Branch Sprint',
    speed: 4.2,
    length: 1900,
    platforms: [
      { x: 0, y: 400, w: 2000, h: 80 },
      { x: 220, y: 300, w: 110, h: 20 },
      { x: 460, y: 250, w: 110, h: 20 },
      { x: 700, y: 320, w: 120, h: 20 },
      { x: 970, y: 250, w: 120, h: 20 },
      { x: 1210, y: 300, w: 120, h: 20 },
      { x: 1460, y: 260, w: 110, h: 20 },
      { x: 1700, y: 320, w: 130, h: 20 },
      { x: 1860, y: 280, w: 120, h: 20 },
    ],
    coins: [
      { x: 250, y: 250 },
      { x: 500, y: 210 },
      { x: 760, y: 280 },
      { x: 1030, y: 210 },
      { x: 1260, y: 250 },
      { x: 1510, y: 220 },
      { x: 1730, y: 280 },
    ],
  },
  {
    id: 5,
    name: 'Mid Hard - Vines',
    speed: 4.6,
    length: 2100,
    platforms: [
      { x: 0, y: 400, w: 2200, h: 80 },
      { x: 210, y: 310, w: 100, h: 20 },
      { x: 430, y: 260, w: 100, h: 20 },
      { x: 670, y: 330, w: 110, h: 20 },
      { x: 940, y: 250, w: 110, h: 20 },
      { x: 1200, y: 310, w: 110, h: 20 },
      { x: 1470, y: 260, w: 110, h: 20 },
      { x: 1740, y: 330, w: 110, h: 20 },
      { x: 1980, y: 260, w: 120, h: 20 },
    ],
    coins: [
      { x: 240, y: 260 },
      { x: 470, y: 220 },
      { x: 720, y: 290 },
      { x: 980, y: 210 },
      { x: 1240, y: 270 },
      { x: 1520, y: 230 },
      { x: 1780, y: 290 },
      { x: 2020, y: 230 },
    ],
  },
  {
    id: 6,
    name: 'Hard - Razor Ridge',
    speed: 5.0,
    length: 2300,
    platforms: [
      { x: 0, y: 400, w: 2400, h: 80 },
      { x: 200, y: 300, w: 90, h: 20 },
      { x: 420, y: 240, w: 90, h: 20 },
      { x: 660, y: 320, w: 95, h: 20 },
      { x: 930, y: 240, w: 95, h: 20 },
      { x: 1180, y: 300, w: 95, h: 20 },
      { x: 1440, y: 250, w: 95, h: 20 },
      { x: 1700, y: 320, w: 95, h: 20 },
      { x: 1960, y: 250, w: 100, h: 20 },
      { x: 2200, y: 310, w: 110, h: 20 },
    ],
    coins: [
      { x: 230, y: 250 },
      { x: 460, y: 200 },
      { x: 710, y: 280 },
      { x: 980, y: 200 },
      { x: 1220, y: 250 },
      { x: 1490, y: 220 },
      { x: 1750, y: 280 },
      { x: 2000, y: 220 },
      { x: 2240, y: 260 },
    ],
  },
  {
    id: 7,
    name: 'Master - Storm Run',
    speed: 5.4,
    length: 2500,
    platforms: [
      { x: 0, y: 400, w: 2600, h: 80 },
      { x: 190, y: 300, w: 85, h: 20 },
      { x: 410, y: 230, w: 85, h: 20 },
      { x: 650, y: 320, w: 90, h: 20 },
      { x: 920, y: 230, w: 90, h: 20 },
      { x: 1180, y: 300, w: 90, h: 20 },
      { x: 1450, y: 240, w: 90, h: 20 },
      { x: 1710, y: 320, w: 90, h: 20 },
      { x: 1970, y: 240, w: 95, h: 20 },
      { x: 2220, y: 300, w: 95, h: 20 },
      { x: 2440, y: 250, w: 110, h: 20 },
    ],
    coins: [
      { x: 220, y: 250 },
      { x: 450, y: 200 },
      { x: 690, y: 280 },
      { x: 960, y: 200 },
      { x: 1220, y: 250 },
      { x: 1490, y: 210 },
      { x: 1760, y: 280 },
      { x: 2020, y: 210 },
      { x: 2270, y: 250 },
      { x: 2470, y: 220 },
    ],
  },
  {
    id: 8,
    name: 'Impossible - Void Leap',
    speed: 5.8,
    length: 2700,
    platforms: [
      { x: 0, y: 400, w: 2800, h: 80 },
      { x: 180, y: 300, w: 80, h: 20 },
      { x: 400, y: 220, w: 80, h: 20 },
      { x: 630, y: 320, w: 85, h: 20 },
      { x: 900, y: 220, w: 85, h: 20 },
      { x: 1170, y: 300, w: 85, h: 20 },
      { x: 1440, y: 220, w: 85, h: 20 },
      { x: 1700, y: 320, w: 85, h: 20 },
      { x: 1960, y: 220, w: 90, h: 20 },
      { x: 2210, y: 300, w: 90, h: 20 },
      { x: 2460, y: 220, w: 100, h: 20 },
      { x: 2660, y: 320, w: 120, h: 20 },
    ],
    coins: [
      { x: 210, y: 250 },
      { x: 440, y: 190 },
      { x: 670, y: 280 },
      { x: 940, y: 190 },
      { x: 1210, y: 250 },
      { x: 1480, y: 190 },
      { x: 1740, y: 280 },
      { x: 2000, y: 190 },
      { x: 2250, y: 250 },
      { x: 2500, y: 200 },
      { x: 2680, y: 280 },
    ],
  },
];

const CHARACTERS = [
  { id: 'cat', name: 'Cat', accent: '#ffb86b', suit: '#ff7b54' },
  { id: 'dog', name: 'Dog', accent: '#f6c99f', suit: '#7aa2ff' },
  { id: 'mouse', name: 'Mouse', accent: '#d1d5db', suit: '#7bdff2' },
  { id: 'fox', name: 'Fox', accent: '#ff9f80', suit: '#8b5cf6' },
  { id: 'bunny', name: 'Bunny', accent: '#ffd6e8', suit: '#34d399' },
  { id: 'panda', name: 'Panda', accent: '#f5f5f4', suit: '#f59e0b' },
];

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const getInitialPlayer = () => ({
  x: 120,
  y: WORLD.groundY - WORLD.playerHeight,
  vy: 0,
  onGround: true,
});

function App() {
  const [levelIndex, setLevelIndex] = useState(0);
  const [status, setStatus] = useState('title');
  const [player, setPlayer] = useState(getInitialPlayer());
  const [cameraX, setCameraX] = useState(0);
  const [coinsCollected, setCoinsCollected] = useState(0);
  const [unlocked, setUnlocked] = useState(1);
  const [selectedCharacter, setSelectedCharacter] = useState(CHARACTERS[0]);
  const [platformsReady, setPlatformsReady] = useState(false);
  const [platformsActive, setPlatformsActive] = useState(false);
  const [platformsFading, setPlatformsFading] = useState(false);

  const jumpRequestedRef = useRef(false);
  const lastTimeRef = useRef(0);
  const levelStartRef = useRef(0);
  const playerRef = useRef(getInitialPlayer());
  const cameraRef = useRef(0);
  const coyoteRef = useRef(0);
  const jumpBufferRef = useRef(0);
  const jumpsRemainingRef = useRef(2);
  const collectedRef = useRef(new Set());
  const portalTimeoutRef = useRef(null);
  const platformFadeRef = useRef(null);
  const platformTimerRef = useRef(null);

  const level = LEVELS[levelIndex];

  const finishX = level.length - 140;
  const startPlatform = { x: 80, y: WORLD.groundY - 60, w: 160, h: 16 };

  const resetLevel = useCallback(() => {
    const freshPlayer = getInitialPlayer();
    setPlayer(freshPlayer);
    setCameraX(0);
    setCoinsCollected(0);
    setPlatformsReady(false);
    setPlatformsActive(false);
    setPlatformsFading(false);
    playerRef.current = freshPlayer;
    cameraRef.current = 0;
    lastTimeRef.current = 0;
    levelStartRef.current = 0;
    coyoteRef.current = 0;
    jumpBufferRef.current = 0;
    jumpsRemainingRef.current = 2;
    collectedRef.current = new Set();
    jumpRequestedRef.current = false;
    if (portalTimeoutRef.current) {
      clearTimeout(portalTimeoutRef.current);
      portalTimeoutRef.current = null;
    }
    if (platformFadeRef.current) {
      clearTimeout(platformFadeRef.current);
      platformFadeRef.current = null;
    }
    if (platformTimerRef.current) {
      clearTimeout(platformTimerRef.current);
      platformTimerRef.current = null;
    }
  }, []);

  const startLevel = useCallback(() => {
    resetLevel();
    setStatus('playing');
  }, [resetLevel]);

  useEffect(() => {
    resetLevel();
  }, [levelIndex, resetLevel]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.repeat) return;
      if (event.code === 'Space' || event.code === 'ArrowUp' || event.code === 'KeyW') {
        event.preventDefault();
        jumpRequestedRef.current = true;
      }
      if (event.code === 'Enter' && status !== 'playing') {
        event.preventDefault();
        startLevel();
      }
      if (event.code === 'KeyR') {
        event.preventDefault();
        resetLevel();
        setStatus('playing');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [resetLevel, startLevel, status]);

  useEffect(() => {
    if (status !== 'playing') return undefined;

    const step = (time) => {
      const last = lastTimeRef.current || time;
      const delta = Math.min(40, time - last);
      lastTimeRef.current = time;
      const tick = delta / 16.67;

      let nextPlayer = { ...playerRef.current };
      let nextCamera = cameraRef.current;

      if (!levelStartRef.current) {
        levelStartRef.current = time;
      }

      const elapsed = time - levelStartRef.current;
      if (elapsed < 2000) {
        if (platformsReady) setPlatformsReady(false);
        if (platformsActive) setPlatformsActive(false);
        nextPlayer = { ...playerRef.current };
        nextPlayer.x = 120;
        nextPlayer.y = startPlatform.y - WORLD.playerHeight;
        nextPlayer.vy = 0;
        nextPlayer.onGround = true;
        jumpsRemainingRef.current = 2;
        playerRef.current = nextPlayer;
        cameraRef.current = 0;
        setPlayer(nextPlayer);
        setCameraX(0);
        requestAnimationFrame(step);
        return;
      }

      if (!platformsReady) {
        setPlatformsReady(true);
        setPlatformsActive(true);
        setPlatformsFading(false);
      }

      nextPlayer.x += level.speed * tick;
      nextPlayer.vy += WORLD.gravity * tick;
      nextPlayer.y += nextPlayer.vy * tick;

      if (jumpRequestedRef.current) {
        jumpBufferRef.current = 8;
        jumpRequestedRef.current = false;
      }

      if (nextPlayer.onGround) {
        coyoteRef.current = 10;
        jumpsRemainingRef.current = 2;
      } else {
        coyoteRef.current = Math.max(0, coyoteRef.current - tick);
      }

      if (jumpBufferRef.current > 0) {
        jumpBufferRef.current = Math.max(0, jumpBufferRef.current - tick);
      }

      const wasFalling = nextPlayer.vy >= 0;
      nextPlayer.onGround = false;

      const playerBottom = nextPlayer.y + WORLD.playerHeight;
      const activePlatforms = platformsReady && platformsActive ? level.platforms : [startPlatform];
      for (const platform of activePlatforms) {
        const platformTop = platform.y;
        const platformLeft = platform.x;
        const platformRight = platform.x + platform.w;
        const playerLeft = nextPlayer.x;
        const playerRight = nextPlayer.x + WORLD.playerWidth;

        if (playerRight > platformLeft && playerLeft < platformRight) {
          if (wasFalling && playerBottom >= platformTop && nextPlayer.y < platformTop) {
            nextPlayer.y = platformTop - WORLD.playerHeight;
            nextPlayer.vy = 0;
            nextPlayer.onGround = true;
          }
        }
      }

      if (jumpBufferRef.current > 0 && (coyoteRef.current > 0 || jumpsRemainingRef.current > 0)) {
        nextPlayer.vy = -WORLD.jumpSpeed;
        nextPlayer.onGround = false;
        jumpBufferRef.current = 0;
        coyoteRef.current = 0;
        jumpsRemainingRef.current = Math.max(0, jumpsRemainingRef.current - 1);
      }

      if (nextPlayer.y + WORLD.playerHeight >= WORLD.groundY + 18) {
        setStatus('game-over');
        return;
      }

      const portalLeft = finishX;
      const portalRight = finishX + 50;
      const portalTop = WORLD.groundY - 140;
      const portalBottom = WORLD.groundY + 10;
      const playerLeft = nextPlayer.x;
      const playerRight = nextPlayer.x + WORLD.playerWidth;
      const playerTop = nextPlayer.y;
      const playerBottomNow = nextPlayer.y + WORLD.playerHeight;

      const atPortal =
        playerRight > portalLeft &&
        playerLeft < portalRight &&
        playerBottomNow > portalTop &&
        playerTop < portalBottom;

      if (atPortal) {
        setUnlocked((prev) => Math.max(prev, levelIndex + 2));
        if (levelIndex < LEVELS.length - 1) {
          if (!portalTimeoutRef.current) {
            setStatus('portal');
            portalTimeoutRef.current = setTimeout(() => {
              portalTimeoutRef.current = null;
              setLevelIndex((prev) => Math.min(prev + 1, LEVELS.length - 1));
              setStatus('playing');
            }, 900);
          }
        } else {
          setStatus('level-complete');
        }
        return;
      }

      if (platformsReady && platformsActive) {
        level.coins.forEach((coin, index) => {
          if (collectedRef.current.has(index)) return;
          const coinLeft = coin.x - 12;
          const coinRight = coin.x + 12;
          const coinTop = coin.y - 12;
          const coinBottom = coin.y + 12;
          const playerLeft = nextPlayer.x;
          const playerRight = nextPlayer.x + WORLD.playerWidth;
          const playerTop = nextPlayer.y;
          const playerBottomNow = nextPlayer.y + WORLD.playerHeight;
          if (
            playerRight > coinLeft &&
            playerLeft < coinRight &&
            playerBottomNow > coinTop &&
            playerTop < coinBottom
          ) {
            collectedRef.current.add(index);
            setCoinsCollected((prev) => prev + 1);
          }
        });
      }

      nextCamera = clamp(nextPlayer.x - 200, 0, level.length - WORLD.width);

      playerRef.current = nextPlayer;
      cameraRef.current = nextCamera;
      setPlayer(nextPlayer);
      setCameraX(nextCamera);

      requestAnimationFrame(step);
    };

    const frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [level, levelIndex, platformsActive, platformsReady, status, finishX, startPlatform]);

  useEffect(() => {
    if (status !== 'playing' || !platformsReady) return undefined;
    if (platformFadeRef.current) clearTimeout(platformFadeRef.current);
    if (platformTimerRef.current) clearTimeout(platformTimerRef.current);

    platformFadeRef.current = setTimeout(() => {
      setPlatformsFading(true);
    }, 3000);

    platformTimerRef.current = setTimeout(() => {
      setPlatformsActive(false);
    }, 4500);

    return () => {
      if (platformFadeRef.current) {
        clearTimeout(platformFadeRef.current);
        platformFadeRef.current = null;
      }
      if (platformTimerRef.current) {
        clearTimeout(platformTimerRef.current);
        platformTimerRef.current = null;
      }
    };
  }, [platformsReady, status]);

  const progress = Math.min(100, Math.floor((player.x / level.length) * 100));
  const coinsTotal = level.coins.length;

  const statusMessage = {
    title: 'Tap Jump to start running!',
    playing: platformsReady
      ? platformsActive
        ? platformsFading
          ? 'Platforms are fading! Move fast!'
          : 'Hop across platforms and enter the portal!'
        : 'Platforms vanished! Watch out!'
      : 'Platforms are appearing...',
    portal: 'Woosh! Jumping to the next trail...',
    'level-complete': 'Nice! You cleared the level!',
    'game-over': 'Oops! Try again.',
  }[status];

  const handleJumpPress = () => {
    if (status !== 'playing') {
      startLevel();
    }
    jumpRequestedRef.current = true;
  };

  const handleJumpRelease = () => {
    jumpRequestedRef.current = false;
  };

  const worldToPercent = (value, total) => `${(value / total) * 100}%`;

  return (
    <div className="app parkour">
      <header className="hero">
        <div>
          <p className="kicker">Jungle Parkour</p>
          <h1>Leap the platforms, collect fireflies, reach the portal.</h1>
          <p className="subhead">Finish a level to unlock the next trail and portal.</p>
        </div>
        <div className="level-card">
          <div className="level-row">
            <span className="label">Level</span>
            <span className="value">{level.id}</span>
          </div>
          <div className="level-row">
            <span className="label">Trail</span>
            <span className="value">{level.name}</span>
          </div>
          <div className="level-row">
            <span className="label">Fireflies</span>
            <span className="value">{coinsCollected}/{coinsTotal}</span>
          </div>
        </div>
      </header>

      <main className="play-area">
        <div className="status-bar">
          <div className="status-pill">{statusMessage}</div>
          <div className="progress">
            <div className="progress-fill" style={{ width: `${progress}%` }} />
          </div>
        </div>

        <div className="game-shell">
          <div
            className="game-stage"
            onPointerDown={handleJumpPress}
            onPointerUp={handleJumpRelease}
            onPointerLeave={handleJumpRelease}
          >
            <div className="sky-layer" />
            <div className="hill-layer" />
            <div className="ground-layer" />
            <div className="lava-layer" />
            <div className="spike-layer" />

            {platformsReady && platformsActive ? (
              level.platforms.map((platform, index) => {
                const left = platform.x - cameraX;
                if (left > WORLD.width + 80 || left + platform.w < -80) return null;
                return (
                  <div
                    key={`platform-${index}`}
                    className={`platform ${platformsFading ? 'platform-fade' : ''}`}
                    style={{
                      left: worldToPercent(left, WORLD.width),
                      top: worldToPercent(platform.y, WORLD.height),
                      width: worldToPercent(platform.w, WORLD.width),
                      height: worldToPercent(platform.h, WORLD.height),
                    }}
                  />
                );
              })
            ) : (
              <div
                className="platform start-platform"
                style={{
                  left: worldToPercent(startPlatform.x - cameraX, WORLD.width),
                  top: worldToPercent(startPlatform.y, WORLD.height),
                  width: worldToPercent(startPlatform.w, WORLD.width),
                  height: worldToPercent(startPlatform.h, WORLD.height),
                }}
              />
            )}

            {platformsReady && platformsActive &&
              level.coins.map((coin, index) => {
                if (collectedRef.current.has(index)) return null;
                const left = coin.x - cameraX;
                if (left > WORLD.width + 60 || left + 24 < -60) return null;
                return (
                  <div
                    key={`coin-${index}`}
                    className="coin"
                    style={{
                      left: worldToPercent(left, WORLD.width),
                      top: worldToPercent(coin.y, WORLD.height),
                    }}
                  />
                );
              })}

            <div
              className="portal"
              style={{ left: worldToPercent(finishX - cameraX, WORLD.width) }}
            />

            <div
              className={`player ${selectedCharacter.id}`}
              style={{
                left: worldToPercent(player.x - cameraX, WORLD.width),
                top: worldToPercent(player.y, WORLD.height),
              }}
            />
          </div>
        </div>

        <div className="controls">
          <button
            className="primary"
            type="button"
            onPointerDown={handleJumpPress}
            onPointerUp={handleJumpRelease}
            onPointerLeave={handleJumpRelease}
          >
            Jump
          </button>
          {status !== 'playing' && (
            <button className="secondary" type="button" onClick={startLevel}>
              {status === 'level-complete' ? 'Play Again' : 'Start Level'}
            </button>
          )}
          {status === 'game-over' && (
            <button className="secondary" type="button" onClick={startLevel}>
              Try Again
            </button>
          )}
          {status === 'level-complete' && levelIndex < LEVELS.length - 1 && (
            <button className="primary" type="button" onClick={() => setLevelIndex(levelIndex + 1)}>
              Next Level
            </button>
          )}
        </div>

        <section className="character-panel">
          <div className="panel-title">Choose your runner</div>
          <div className="character-grid">
            {CHARACTERS.map((character) => (
              <button
                key={character.id}
                type="button"
                className={`character-card ${selectedCharacter.id === character.id ? 'active' : ''}`}
                onClick={() => setSelectedCharacter(character)}
                style={{ '--accent-color': character.accent, '--suit-color': character.suit }}
              >
                <span className="character-dot" />
                <span className="character-name">{character.name}</span>
              </button>
            ))}
          </div>
        </section>

        <div className="level-grid">
          {LEVELS.map((item, index) => {
            const locked = item.id > unlocked;
            return (
              <button
                key={item.id}
                type="button"
                className={`level-button ${locked ? 'locked' : ''}`}
                onClick={() => !locked && setLevelIndex(index)}
                disabled={locked}
              >
                <span className="level-title">Level {item.id}</span>
                <span className="level-name">{item.name}</span>
                <span className="level-state">{locked ? 'Locked' : 'Ready'}</span>
              </button>
            );
          })}
        </div>

        <div className="tips">
          <p><strong>Controls:</strong> Space / Up / W or tap Jump.</p>
          <p><strong>Tip:</strong> Aim for the glowing portal to reach the next level.</p>
        </div>
      </main>
    </div>
  );
}

export default App;
