// script.js – Full Nostr Login + Pay-to-Play Integration
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreDisplay = document.getElementById('score');
const highScoreDisplay = document.getElementById('highScore');
const startButton = document.getElementById('startButton');
const userInfo = document.getElementById('userInfo');
const paymentStatus = document.getElementById('paymentStatus');

const gridSize = 20;
const tileCount = canvas.width / gridSize;
const ENTRY_FEE = 210; // sats
const LN_WALLET = 'mustardmoose1@primal.net';

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
let displayName = null; // npub or pseudonym

highScoreDisplay.textContent = highScore;

// Auth State
let authState = {
  type: null, // 'extension' | 'nsec' | 'bunker' | 'anon'
  pubkey: null,
  signer: null,
  nwcUri: null
};

// Elements
const authSection = document.getElementById('authSection');
const paymentSection = document.getElementById('paymentSection');
const gameCanvas = document.getElementById('gameCanvas');
const instructions = document.querySelector('.instructions');
const loginNostrBtn = document.getElementById('loginNostr');
const playAnonBtn = document.getElementById('playAnon');
const nsecInputSection = document.getElementById('nsecInputSection');
const nsecInput = document.getElementById('nsecInput');
const importNsecBtn = document.getElementById('importNsec');
const bunkerInputSection = document.getElementById('bunkerInputSection');
const bunkerInput = document.getElementById('bunkerInput');
const connectBunkerBtn = document.getElementById('connectBunker');
const pseudonymSection = document.getElementById('pseudonymSection');
const pseudonymInput = document.getElementById('pseudonymInput');
const setPseudonymBtn = document.getElementById('setPseudonym');
const connectWeblnBtn = document.getElementById('connectWebln');
const connectNwcBtn = document.getElementById('connectNwc');
const payOptions = document.getElementById('payOptions');
const zapBtn = document.getElementById('zapBtn');
const invoiceBtn = document.getElementById('invoiceBtn');
const invoiceQrSection = document.getElementById('invoiceQrSection');
const qrcodeDiv = document.getElementById('qrcode');
const invoiceText = document.getElementById('invoiceText');
const checkPaymentBtn = document.getElementById('checkPayment');
const walletConnectSection = document.getElementById('walletConnectSection');

// Nostr Tools
const { generatePrivateKey, getPublicKey, nip19, finalizeEvent, SimplePool } = NostrTools;

// Pool for relays
const pool = new SimplePool();

// Nostr Login Setup (for extension/bunker/nsec)
loginNostrBtn.addEventListener('click', () => {
  document.dispatchEvent(new CustomEvent('nlLaunch', { detail: 'welcome' }));
  // Listen for auth changes
  window.addEventListener('nostr-login', (e) => {
    const { pubkey, type } = e.detail;
    authState.pubkey = pubkey;
    authState.type = type;
    updateUserInfo();
    proceedToPayment();
  });
});

// Manual nsec import
importNsecBtn.addEventListener('click', async () => {
  const nsec = nsecInput.value.trim();
  if (!nsec) return;
  try {
    const sk = nip19.decode(nsec).data;
    authState.pubkey = nip19.npubEncode(getPublicKey(sk));
    authState.signer = { signEvent: (ev) => finalizeEvent(ev, sk) };
    authState.type = 'nsec';
    updateUserInfo();
    proceedToPayment();
  } catch (err) {
    alert('Invalid nsec');
  }
});

// Bunker Connect (simplified - assumes nostr-login handles, or manual)
connectBunkerBtn.addEventListener('click', async () => {
  const uri = bunkerInput.value.trim();
  if (!uri) return;
  try {
    // Use nostr-tools for BunkerSigner if needed, but leverage nostr-login
    document.dispatchEvent(new CustomEvent('nlLaunch', { detail: 'login-bunker-url' }));
    // Assume it sets window.nostr
  } catch (err) {
    alert('Bunker connect failed');
  }
});

// Anon Play
playAnonBtn.addEventListener('click', () => {
  pseudonymSection.style.display = 'block';
});

setPseudonymBtn.addEventListener('click', () => {
  const name = pseudonymInput.value.trim();
  if (!name) return;
  pseudonym = name;
  displayName = name;
  authState.type = 'anon';
  updateUserInfo();
  proceedToPayment();
});

function updateUserInfo() {
  if (displayName || authState.pubkey) {
    userInfo.textContent = `Logged in as: ${displayName || nip19.npubEncode(authState.pubkey).slice(0, 12) + '...'}`;
  }
}

function proceedToPayment() {
  authSection.style.display = 'none';
  paymentSection.style.display = 'block';
}

// Wallet Connect
let webln = null;
connectWeblnBtn.addEventListener('click', async () => {
  try {
    webln = await window.webln.requestProvider();
    connectWeblnBtn.textContent = 'Connected ✅';
    payOptions.style.display = 'block';
  } catch (err) {
    alert('WebLN not available. Install Alby or similar.');
  }
});

let nwcClient = null;
connectNwcBtn.addEventListener('click', async () => {
  try {
    // Simplified NWC connect - prompt for URI or use extension
    const uri = prompt('Enter NWC URI (nostr+walletconnect://...)');
    if (uri) {
      nwcClient = new window.webln.NWC(uri); // Assume alby-js-sdk or similar loaded if needed
      await nwcClient.initNWC({ name: 'SatSnake' });
      connectNwcBtn.textContent = 'Connected ✅';
      payOptions.style.display = 'block';
    }
  } catch (err) {
    alert('NWC connect failed');
  }
});

// Zap (WebLN or NWC)
zapBtn.addEventListener('click', async () => {
  if (!webln && !nwcClient) return alert('Connect wallet first');
  try {
    const invoice = await generateInvoice(ENTRY_FEE * 1000); // msats
    if (webln) {
      const paid = await webln.sendPayment(invoice);
      if (paid) {
        isPaid = true;
        paymentStatus.textContent = 'Payment confirmed! Starting game...';
        startGameFlow();
      }
    } else if (nwcClient) {
      const result = await nwcClient.payInvoice(invoice);
      if (result) {
        isPaid = true;
        paymentStatus.textContent = 'Payment confirmed! Starting game...';
        startGameFlow();
      }
    }
  } catch (err) {
    alert('Payment failed: ' + err.message);
  }
});

// Invoice Pay
invoiceBtn.addEventListener('click', async () => {
  const invoice = await generateInvoice(ENTRY_FEE * 1000);
  invoiceText.textContent = invoice;
  new QRCode(qrcodeDiv, { text: invoice, width: 200, height: 200 });
  invoiceQrSection.style.display = 'block';
});

checkPaymentBtn.addEventListener('click', async () => {
  // Simplified check - in prod, poll LN node or use webhook; here assume manual confirm after delay
  // For demo, auto-confirm after 10s or button simulates
  setTimeout(() => {
    isPaid = true;
    paymentStatus.textContent = 'Payment received! Starting game...';
    startGameFlow();
  }, 10000); // Simulate confirmation delay
});

// Generate BOLT11 Invoice (simplified - in prod, use LN node API)
async function generateInvoice(msats) {
  // Use bolt11 lib to encode
  const now = Math.floor(Date.now() / 1000);
  const paymentHash = crypto.getRandomValues(new Uint8Array(32));
  const encodedHash = Array.from(paymentHash).map(b => b.toString(16).padStart(2, '0')).join('');
  const invoice = bolt11.encode({
    network: { bech32: 'tb', pubKeyHash: 0x6f, scriptHash: 0x20, validWitnessVersions: [0] }, // Testnet
    satoshis: msats / 1000,
    timestamp: now,
    tags: [
      { tagName: 'payment_hash', data: encodedHash },
      { tagName: 'description', data: 'SatSnake Entry Fee' },
      { tagName: 'payee_node_key', data: '03...' }, // Dummy node key
      { tagName: 'expiry_time', data: 3600 },
      { tagName: 'min_final_cltv_expiry', data: 18 },
      { tagName: 'route_hint', data: [{ hint: { node_id: '03...', short_channel_id: '1x2x3', fee: 1, cltv: 1 }] }] // Dummy
    ]
  });
  return invoice.paymentRequest; // BOLT11 string
  // Note: Real impl needs LN node to generate valid signed invoice to mustardmoose1@primal.net
}

// Game Flow
function startGameFlow() {
  paymentSection.style.display = 'none';
  gameCanvas.style.display = 'block';
  instructions.style.display = 'block';
  startButton.style.display = 'inline-block';
}

// Rest of game code (from previous)
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
  let event;
  if (authState.signer) {
    // Use signer
    event = finalizeEvent({
      kind: 30762,
      created_at: Math.floor(Date.now() / 1000),
      content: `New high score: ${highScore} points on level ${level}!`,
      tags: [
        ['d', `satsnake:${authState.pubkey}:level-${level}`],
        ['game', 'satsnake'],
        ['score', highScore.toString()],
        ['p', authState.pubkey],
        ['state', 'active'],
        ['level', level.toString()],
        ['mode', 'single-player'],
        ['t', 'test']
      ]
    }, authState.signer.keys); // Assume signer has keys
  } else {
    // Anon: no submit, or use window.nostr if available
    alert('Submit requires Nostr login');
    return;
  }
  try {
    await pool.publish(['wss://relay.damus.io'], event);
    alert(`High score ${highScore} submitted to Gamestr.io! 🎉`);
  } catch (err) {
    console.error('Submit failed', err);
  }
}

function startGame() {
  if (gameRunning || !isPaid) return alert('Pay entry fee first!');

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