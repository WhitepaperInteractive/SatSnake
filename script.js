// script.js – FINAL FIXED VERSION (copy-paste this entire file)
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreDisplay = document.getElementById('score');
const startButton = document.getElementById('startButton');

const gridSize = 20;
const tileCount = canvas.width / gridSize;

let snake = [{ x: 10, y: 10 }];
let food = {};
let dx = 0;
let dy = 0;
let score = 0;
let gameLoop;
let gameRunning = false;

function randomFood() {
  do {
    food = {
      x: Math.floor(Math.random() * tileCount),
      y: Math.floor(Math.random() * tileCount)
    };
  } while (snake.some(seg => seg.x === food.x && seg.y === food.y));
}

function drawGame() {
  // 1. Calculate new head position
  const head = { x: snake[0].x + dx, y: snake[0].y + dy };

  // 2. Wall collision
  if (head.x < 0 || head.x >= tileCount || head.y < 0 || head.y >= tileCount) {
    gameOver();
    return;
  }

  // 3. Add new head
  snake.unshift(head);

  // 4. Did we eat food?
  if (head.x === food.x && head.y === food.y) {
    score += 10;
    scoreDisplay.textContent = score;
    randomFood();
    // We grow → do NOT remove tail
  } else {
    // Normal movement → remove tail
    snake.pop();
  }

  // 5. Self-collision (now safe: tail has already moved if not growing)
  for (let i = 1; i < snake.length; i++) {
    if (snake[0].x === snake[i].x && snake[0].y === snake[i].y) {
      gameOver();
      return;
    }
  }

  // 6. Draw everything
  ctx.fillStyle = 'black';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw snake
  snake.forEach((seg, i) => {
    ctx.fillStyle = i === 0 ? '#0f0' : '#0c0';
    ctx.fillRect(seg.x * gridSize, seg.y * gridSize, gridSize - 2, gridSize - 2);
  });

  // Draw food
  ctx.fillStyle = 'red';
  ctx.beginPath();
  ctx.arc(
    food.x * gridSize + gridSize / 2,
    food.y * gridSize + gridSize / 2,
    gridSize / 2 - 2,
    0,
    Math.PI * 2
  );
  ctx.fill();
}

function gameOver() {
  clearInterval(gameLoop);
  gameRunning = false;
  startButton.textContent = 'Play Again';
  startButton.disabled = false;
  alert(`Game Over! Final score: ${score}`);
}

function startGame() {
  if (gameRunning) return;

  snake = [{ x: 10, y: 10 }];
  dx = 1;   // start moving right
  dy = 0;
  score = 0;
  scoreDisplay.textContent = score;
  randomFood();

  startButton.disabled = true;
  startButton.textContent = 'Running...';
  gameRunning = true;

  clearInterval(gameLoop);
  gameLoop = setInterval(drawGame, 100);
}

// Controls
document.addEventListener('keydown', e => {
  if (!gameRunning) return;

  if (e.key === 'ArrowUp' && dy !== 1)    { dx = 0; dy = -1; }
  if (e.key === 'ArrowDown' && dy !== -1)  { dx = 0; dy = 1; }
  if (e.key === 'ArrowLeft' && dx !== 1)   { dx = -1; dy = 0; }
  if (e.key === 'ArrowRight' && dx !== -1) { dx = 1; dy = 0; }
});

startButton.addEventListener('click', startGame);

// Initial food
randomFood();