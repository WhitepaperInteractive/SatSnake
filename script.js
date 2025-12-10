const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreDisplay = document.getElementById('score');
const startButton = document.getElementById('startButton');

const gridSize = 20;
const tileCount = canvas.width / gridSize;

let snake = [
  {x: 10, y: 10}
];
let food = {};
let dx = 0;
let dy = 0;
let score = 0;
let gameLoop;
let gameRunning = false;

function randomFood() {
  food = {
    x: Math.floor(Math.random() * tileCount),
    y: Math.floor(Math.random() * tileCount)
  };
  
  // Make sure food doesn't spawn on snake
  for (let segment of snake) {
    if (segment.x === food.x && segment.y === food.y) {
      return randomFood();
    }
  }
}

function drawGame() {
  // Move snake
  const head = {x: snake[0].x + dx, y: snake[0].y + dy};

  // Check wall collision
  if (head.x < 0 || head.x >= tileCount || head.y < 0 || head.y >= tileCount) {
    gameOver();
    return;
  }

  // Check self collision
  for (let segment of snake) {
    if (head.x === segment.x && head.y === segment.y) {
      gameOver();
      return;
    }
  }

  snake.unshift(head);

  // Check if ate food
  if (head.x === food.x && head.y === food.y) {
    score += 10;
    scoreDisplay.textContent = score;
    randomFood();
  } else {
    snake.pop();
  }

  // Clear canvas
  ctx.fillStyle = 'black';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw snake
  snake.forEach((segment, index) => {
    ctx.fillStyle = index === 0 ? '#0f0' : '#0c0';
    ctx.fillRect(segment.x * gridSize, segment.y * gridSize, gridSize - 2, gridSize - 2);
    
    // Eyes on head
    if (index === 0) {
      ctx.fillStyle = 'black';
      const eyeSize = 4;
      const offset = 5;
      if (dx === 1) { // right
        ctx.fillRect(segment.x * gridSize + offset, segment.y * gridSize + 4, eyeSize, eyeSize);
        ctx.fillRect(segment.x * gridSize + offset, segment.y * gridSize + 12, eyeSize, eyeSize);
      } else if (dx === -1) { // left
        ctx.fillRect(segment.x * gridSize + offset, segment.y * gridSize + 4, eyeSize, eyeSize);
        ctx.fillRect(segment.x * gridSize + offset, segment.y * gridSize + 12, eyeSize, eyeSize);
      } else if (dy === 1) { // down
        ctx.fillRect(segment.x * gridSize + 4, segment.y * gridSize + offset, eyeSize, eyeSize);
        ctx.fillRect(segment.x * gridSize + 12, segment.y * gridSize + offset, eyeSize, eyeSize);
      } else if (dy === -1) { // up
        ctx.fillRect(segment.x * gridSize + 4, segment.y * gridSize + offset, eyeSize, eyeSize);
        ctx.fillRect(segment.x * gridSize + 12, segment.y * gridSize + offset, eyeSize, eyeSize);
      }
    }
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
  alert(`Game Over! Your score: ${score}`);
}

function startGame() {
  if (gameRunning) return;
  
  snake = [{x: 10, y: 10}];
  dx = 0;
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

document.addEventListener('keydown', e => {
  if (!gameRunning) return;
  
  const key = e.key;
  
  if (key === 'ArrowUp' && dy !== 1) {
    dx = 0; dy = -1;
  }
  if (key === 'ArrowDown' && dy !== -1) {
    dx = 0; dy = 1;
  }
  if (key === 'ArrowLeft' && dx !== 1) {
    dx = -1; dy = 0;
  }
  if (key === 'ArrowRight' && dx !== -1) {
    dx = 1; dy = 0;
  }
});

startButton.addEventListener('click', startGame);

// Start with food ready
randomFood();
