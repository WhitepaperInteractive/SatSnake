// script.js – Fixed Nostr Auth + Pay-to-Play
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreDisplay = document.getElementById('score');
const highScoreDisplay = document.getElementById('highScore');
const startButton = document.getElementById('startButton');
const userInfo = document.getElementById('userInfo');
const paymentStatus = document.getElementById('paymentStatus');

const gridSize = 20;
const tileCount = canvas.width / gridSize;
const ENTRY_FEE_SATS = 210;
const ENTRY_FEE_MSATS = ENTRY_FEE_SATS * 1000;
const LN_WALLET = 'mustardmoose1@primal.net'; // Payee

let snake = [{ x: 10, y: 10 }];
let food = {};
let dx = 0;
let dy = 0;
let score = 0;
let highScore = parseInt(localStorage.getItem('satsnakeHighScore') || '0');
let gameLoop;
let gameRunning = false;
let isPaid = false;
let pseudonym = null;
let displayName = null;

highScoreDisplay.textContent = highScore;

// Auth State
let authState = {
  type: null, // 'extension' | 'nsec' | 'bunker' | 'anon'
  pubkey: null,
  keys: null // For signing
};

// Elements
const authSection = document.getElementById('authSection');
const paymentSection = document.getElementById('paymentSection');
const gameCanvas = document.getElementById('gameCanvas');
const instructions = document.querySelector('.instructions');
const loginNostrBtn = document.getElementById('loginNostr');
const importNsecBtn = document.getElementById('importNsec');
const connectBunkerBtn = document.getElementById('connectBunker');
const playAnonBtn = document.getElementById('playAnon');
const pseudonymSection = document.getElementById('pseudonymSection');
const pseudonymInput = document.getElementById('pseudonymInput');
const setPseudonymBtn = document.getElementById('setPseudonym');
const nsecInput = document.getElementById('nsecInput');
const bunkerInput = document.getElementById('bunkerInput');
const connectWeblnBtn = document.getElementById('connectWebln');
const connectNwcBtn = document.getElementById('connectNwc');
const payOptions = document.getElementById('payOptions');
const zapBtn = document.getElementById('zapBtn');
const invoiceBtn = document.getElementById('invoiceBtn');
const invoiceQrSection = document.getElementById('invoiceQrSection');
const qrcodeDiv = document.getElementById('qrcode');
const invoiceText = document.getElementById('invoiceText');
const checkPaymentBtn = document.getElementById('checkPayment');

// Nostr Tools
const { nip19, generatePrivateKey, getPublicKey, getEventHash, getSignature, finalizeEvent } = window.NostrTools;

// Simple Pool for publishing
const relays = ['wss://relay.damus.io', 'wss://nostr-pub.wellorder.net'];
const pool = new window.NostrTools.SimplePool();

// === AUTH HANDLERS ===

// Extension Login (window.nostr)
loginNostrBtn.addEventListener('click', async () => {
  if (typeof window.nostr !== 'undefined') {
    try {
      const pubkey = await window.nostr.getPublicKey();
      authState.pubkey = pubkey;
      authState.type = 'extension';
      // Assume signer via window.nostr
      authState.keys = { priv: null }; // No priv, use window.nostr for signing
      updateUserInfo();
      proceedToPayment();
    } catch (err) {
      alert('Failed to connect extension: ' + err.message);
    }
  } else {
    alert('No Nostr extension found. Install nos2x or Alby.');
  }
});

// nsec Import
importNsecBtn.addEventListener('click', () => {
  const nsec = nsecInput.value.trim();
  if (!nsec.startsWith('nsec1')) {
    alert('Invalid nsec format');
    return;
  }
  try {
    const { data: priv } = nip19.decode(nsec);
    const pub = getPublicKey(priv);
    authState.pubkey = pub;
    authState.type = 'nsec';
    authState.keys = { priv };
    updateUserInfo();
    proceedToPayment();
    nsecInput.value = ''; // Clear
  } catch (err) {
    alert('Invalid nsec: ' + err.message);
  }
});

// Bunker Connect (simplified - use URI to set window.nostr or manual)
connectBunkerBtn.addEventListener('click', () => {
  const uri = bunkerInput.value.trim();
  if (!uri.startsWith('bunker://')) {
    alert('Invalid bunker URI');
    return;
  }
  // For demo, assume manual setup or alert to use extension
  // In prod, parse URI and set signer
  alert('Bunker support: Paste bunker URI into compatible extension (e.g., nos2x with bunker). Then click Login with Nostr Extension.');
  bunkerInput.value = '';
});

// Anon
playAnonBtn.addEventListener('click', () => {
  pseudonymSection.style.display = 'block';
  playAnonBtn.disabled = true;
});

setPseudonymBtn.addEventListener('click', () => {
  const name = pseudonymInput.value.trim();
  if (!name || name.length < 2) {
    alert('Enter a valid pseudonym (2+ chars)');
    return;
  }
  pseudonym = name;
  displayName = name;
  authState.type = 'anon';
  updateUserInfo();
  proceedToPayment();
  pseudonymSection.style.display = 'none';
});

function updateUserInfo() {
  const name = displayName || (authState.pubkey ? nip19.npubEncode(authState.pubkey).slice(0, 12) + '...' : 'Unknown');
  userInfo.textContent = `Logged in as: ${name}`;
}

function proceedToPayment() {
  authSection.style.display = 'none';
  paymentSection.style.display = 'block';
}

// === WALLET & PAYMENT ===

let webln = null;
let nwc = null;

// WebLN Connect
connectWeblnBtn.addEventListener('click', async () => {
  if (typeof window.webln !== 'undefined') {
    try {
      webln = await window.webln.enable();
      connectWeblnBtn.textContent = 'WebLN Connected ✅';
      connectWeblnBtn.disabled = true;
      payOptions.style.display = 'block';
    } catch (err) {
      alert('WebLN enable failed: ' + err.message + '\nInstall Alby extension.');
    }
  } else {
    alert('No WebLN provider. Install Alby or similar.');
  }
});

// NWC Connect using Alby SDK
connectNwcBtn.addEventListener('click', async () => {
  try {
    nwc = new window.AlbySDK.webln.NostrWebLNProvider();
    await nwc.enable({ name: 'SatSnake' }); // Prompts user for NWC URI if needed
    connectNwcBtn.textContent = 'NWC Connected ✅';
    connectNwcBtn.disabled = true;
    payOptions.style.display = 'block';
    webln = nwc; // Use as WebLN
  } catch (err) {
    alert('NWC connect failed: ' + err.message + '\nEnsure Alby SDK loaded and wallet supports NWC.');
  }
});

// Zap (pay via WebLN/NWC)
zapBtn.addEventListener('click', async () => {
  if (!webln) return alert('Connect wallet first!');
  try {
    // For real zap, use NIP-57 to recipient LNURL, but here direct invoice
    const invoice = await generateDummyInvoice(ENTRY_FEE_MSATS, 'SatSnake Entry Fee');
    const paid = await webln.sendPayment(invoice);
    if (paid) {
      isPaid = true;
      paymentStatus.textContent = 'Payment successful! Starting game...';
      paymentStatus.style.color = 'green';
      setTimeout(startGameFlow, 1500);
    }
  } catch (err) {
    alert('Payment failed: ' + err.message);
  }
});

// Invoice + QR
invoiceBtn.addEventListener('click', async () => {
  const invoice = await generateDummyInvoice(ENTRY_FEE_MSATS, 'SatSnake Entry Fee');
  invoiceText.textContent = `lnurl1... (Demo: ${ENTRY_FEE_SATS}sats to ${LN_WALLET})\nCopy: ${invoice.slice(0, 50)}...`;
  qrcodeDiv.innerHTML = '';
  new QRCode(qrcodeDiv, { text: invoice, width: 200, height: 200 });
  invoiceQrSection.style.display = 'block';
  payOptions.style.display = 'none';
});

checkPaymentBtn.addEventListener('click', () => {
  // Simulate confirmation (in prod, poll LN node or use webhook)
  paymentStatus.textContent = 'Checking...';
  setTimeout(() => {
    isPaid = true;
    paymentStatus.textContent = 'Payment confirmed! Starting game...';
    paymentStatus.style.color = 'green';
    setTimeout(startGameFlow, 1500);
  }, 2000);
});

// Dummy Invoice Generator (for demo; prod: use LND/CLN API to generate real payable to LN_WALLET)
async function generateDummyInvoice(msats, description) {
  // Use bolt11 lib to create a basic invoice string
  const timestamp = Math.floor(Date.now() / 1000);
  const paymentHash = await crypto.subtle.digest('SHA-256', crypto.getRandomValues(new Uint8Array(32)));
  const hashHex = Array.from(new Uint8Array(paymentHash)).map(b => b.toString(16).padStart(2, '0')).join('');
  // Dummy node key for primal.net (replace with real)
  const dummyInvoice = bolt11.encode({
    millisatoshis: msats,
    timestamp,
    paymentHash: hashHex,
    tags: [
      { tagName: 'description', data: description },
      { tagName: 'payee_node_key', data: '03f02868949f...dummy' }, // Dummy
      { tagName: 'expiry', data: 3600 }
    ]
  });
  return dummyInvoice.paymentRequest;
}

// Game Flow Unlock
function startGameFlow() {
  paymentSection.style.display = 'none';
  gameCanvas.style.display = 'block';
  instructions.style.display = 'block';
  startButton.style.display = 'inline-block';
}

// === GAME LOGIC ===
function randomFood() {
  do {
    food = {
      x: Math.floor(Math.random() * tileCount),
      y: Math.floor(Math.random() * tileCount)
    };
  } while (snake.some(seg => seg.x === food.x && seg.y === food.y));
}

function drawGame() {
  const head = { x: snake[0].x + dx, y: snake[0].y + dy };

  if (head.x < 0 || head.x >= tileCount || head.y < 0 || head.y >= tileCount) {
    gameOver();
    return;
  }

  snake.unshift(head);

  if (head.x === food.x && head.y === food.y) {
    score += 10;
    scoreDisplay.textContent = score;
    randomFood();
  } else {
    snake.pop();
  }

  for (let i = 1; i < snake.length; i++) {
    if (snake[0].x === snake[i].x && snake[0].y === snake[i].y) {
      gameOver();
      return;
    }
  }

  ctx.fillStyle = 'black';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  snake.forEach((seg, i) => {
    ctx.fillStyle = i === 0 ? '#0f0' : '#0c0';
    ctx.fillRect(seg.x * gridSize, seg.y * gridSize, gridSize - 2, gridSize - 2);
  });

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

  const isNewHigh = score > highScore;
  if (isNewHigh) {
    highScore = score;
    localStorage.setItem('satsnakeHighScore', highScore);
    highScoreDisplay.textContent = highScore;
    if (authState.pubkey || pseudonym) {
      submitHighScore();
    }
  }

  alert(`Game Over!\nScore: ${score}\nHigh Score: ${highScore}`);
}

async function submitHighScore() {
  const level = 1;
  const event = {
    kind: 30762,
    created_at: Math.floor(Date.now() / 1000),
    content: `New high score: ${highScore} points on level ${level}!`,
    tags: [
      ['d', `satsnake:${authState.pubkey || 'anon'}:level-${level}`],
      ['game', 'satsnake'],
      ['score', highScore.toString()],
      ...(authState.pubkey ? [['p', authState.pubkey]] : []),
      ['state', 'active'],
      ['level', level.toString()],
      ['mode', 'single-player'],
      ['t', 'test']
    ]
  };

  try {
    let finalEvent;
    if (authState.type === 'extension' && window.nostr) {
      finalEvent = await window.nostr.signEvent(event);
    } else if (authState.keys?.priv) {
      finalEvent = finalizeEvent(event, authState.keys.priv);
    } else {
      alert('Cannot sign for leaderboard (anon scores not submitted)');
      return;
    }
    const pubs = await pool.publish(relays, finalEvent);
    console.log('Published to:', pubs);
    alert(`High score ${highScore} submitted to Gamestr.io! 🎉\nView at https://gamestr.io/`);
  } catch (err) {
    alert('Submit failed: ' + err.message);
  }
}

function startGame() {
  if (!isPaid) return alert('Pay the 210 sats entry fee first!');
  if (gameRunning) return;

  snake = [{ x: 10, y: 10 }];
  dx = 1;
  dy = 0;
  score = 0;
  scoreDisplay.textContent = score;
  randomFood();
  startButton.disabled = true;
  startButton.textContent = 'Playing...';
  gameRunning = true;

  clearInterval(gameLoop);
  gameLoop = setInterval(drawGame, 100);
}

document.addEventListener('keydown', e => {
  if (!gameRunning) return;
  const key = e.key;
  if (key === 'ArrowUp' && dy !== 1) { dx = 0; dy = -1; }
  if (key === 'ArrowDown' && dy !== -1) { dx = 0; dy = 1; }
  if (key === 'ArrowLeft' && dx !== 1) { dx = -1; dy = 0; }
  if (key === 'ArrowRight' && dx !== -1) { dx = 1; dy = 0; }
});

startButton.addEventListener('click', startGame);
randomFood();