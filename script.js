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
  do {
    food = {
      x: Math.floor(Math.random() * tileCount),
      y: Math.floor(Math.random() * tileCount)
    };
  } while (snake.some(segment => segment.x === food.x && segment.y === food.y));
}

function drawGame() {
  const head = {x: snake[0].x + dx, y: snake[0].y + dy};

  // Check wall collision BEFORE moving
  if (head.x < 0 || head.x >= tileCount || head.y < 0 || head.y >= tileCount) {
    gameOver();
    return;
  }

  // Move: add new head
  snake.unshift(head);

  // Check food
  if (head.x === food.x && head.y === food.y) {
    score += 10;
    scoreDisplay.textContent = score;
    randomFood();
  } else {
    snake.pop();
  }

  // Check self-collision AFTER move (tail handled correctly)
  for (let i = 1; i < snake.length; i++) {
    if (snake[0].x === snake[i].x && snake[0].y === snake[i].y) {
      gameOver();
      return;
    }
  }

  // Clear canvas
  ctx.fillStyle = 'black';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw snake
  snake.forEach((segment, index) => {
    ctx.fillStyle = index === 0 ? '#0f0' : '#0c0';
    ctx.fillRect(segment.x * gridSize, segment.y * gridSize, gridSize - 2, gridSize - 2);
    
    // Eyes on head - facing direction of travel
    if (index === 0) {
      ctx.fillStyle = 'black';
      const eyeSize = 4;
      
      const tileX = segment.x * gridSize;
      const tileY = segment.y * gridSize;
      
      let ex1, ey1, ex2, ey2;
      
      if (dx === 1) { // right
        ex1 = tileX + gridSize - 6;
        ey1 = tileY + 6;
        ex2 = ex1;
        ey2 = tileY + 14;
      } else if (dx === -1) { // left
        ex1 = tileX + 2;
        ey1 = tileY + 6;
        ex2 = ex1;
        ey2 = tileY + 14;
      } else if (dy === 1) { // down
        ex1 = tileX + 6;
        ey1 = tileY + gridSize - 6;
        ex2 = tileX + 14;
        ey2 = ey1;
      } else if (dy === -1) { // up
        ex1 = tileX + 6;
        ey1 = tileY + 2;
        ex2 = tileX + 14;
        ey2 = ey1;
      }
      
      ctx.fillRect(ex1, ey1, eyeSize, eyeSize);
      ctx.fillRect(ex2, ey2, eyeSize, eyeSize);
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
  dx = 1;  // Start moving right
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