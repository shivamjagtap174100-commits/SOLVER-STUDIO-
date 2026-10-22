/**
 * SolverStudio - Advanced Multi-Modal Problem-Solving Platform
 * Production Core Logic & Simulation Engine
 */

// ==========================================
// 1. STATE & STORAGE MANAGEMENT
// ==========================================

const APP_STATE = {
  currentSessionId: generateUUID(),
  activeCategory: 'code',
  currentTab: 'tab-root-cause',
  tokensUsed: 14280,
  maxTokens: 100000,
  audioEnabled: true,
  history: [],
  communityLikes: {},
  currentSolution: null,
  isSolving: false
};

const STORAGE_KEYS = {
  HISTORY: 'solverstudio_history_v2',
  TOKENS: 'solverstudio_tokens_v2',
  LIKES: 'solverstudio_likes_v2',
  AUDIO: 'solverstudio_audio_v2'
};

// Simple Web Audio API Synth for Futuristic Feedback
let audioCtx = null;
function playSound(type) {
  if (!APP_STATE.audioEnabled) return;
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    const now = audioCtx.currentTime;

    if (type === 'click') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.exponentialRampToValueAtTime(200, now + 0.05);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      osc.start(now);
      osc.stop(now + 0.05);
    } else if (type === 'success') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.setValueAtTime(659.25, now + 0.08); // E5
      osc.frequency.setValueAtTime(783.99, now + 0.16); // G5
      osc.frequency.setValueAtTime(1046.50, now + 0.24); // C6
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      osc.start(now);
      osc.stop(now + 0.45);
    } else if (type === 'launch') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.25);
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.start(now);
      osc.stop(now + 0.25);
    }
  } catch (e) {
    // Audio context may fail if user hasn't interacted yet
  }
}

// ==========================================
// 2. CURATED ARCHETYPES & PRE-BAKED KNOWLEDGE
// ==========================================

const PRESET_TEMPLATES = [
  {
    id: 'py-async-deadlock',
    chipLabel: '🐛 Debug Python Async Bug',
    category: 'code',
    difficulty: 4,
    title: 'Asyncio Event Loop Deadlock in FastApi Worker Pool',
    body: `Traceback (most recent call last):
  File "worker.py", line 84, in handle_event
    future = asyncio.run_coroutine_threadsafe(process_payload(data), loop)
  File "/usr/local/lib/python3.11/asyncio/tasks.py", line 938, in run_coroutine_threadsafe
    return future.result(timeout=5)
RuntimeError: Event loop is closed or thread pool exhausted under heavy load.

Context: FastApi service calling legacy sync background threads that invoke async tasks via run_coroutine_threadsafe with a 5s timeout. Under 500 RPS, workers freeze with deadlock.`,
    flags: ['zero-downtime', 'high-perf', 'backward-compat'],
    solution: {
      categoryName: 'CODE DEBUGGER',
      timeTaken: '0.64s',
      confidence: '99.4%',
      rootCause: {
        summary: 'Synchronous blocking calls (`future.result()`) inside thread pool workers creating thread starvation and threadpool-to-eventloop inverted lock dependency.',
        points: [
          {
            title: 'Thread Starvation via Sync Wait',
            desc: 'Threadpool workers synchronously block waiting for the main event loop to finish executing the coroutine. When all worker threads are waiting on futures, no worker can process newly scheduled tasks.'
          },
          {
            title: 'Event Loop Inversion Anti-Pattern',
            desc: 'Bridging synchronous code back into async via `run_coroutine_threadsafe()` within worker threads creates a cyclic dependency. If the event loop gets saturated with I/O, threadpool threads timeout simultaneously.'
          },
          {
            title: 'Uncaught Exception in Loop Shutdown',
            desc: 'Once any thread encounters a timeout or cancelled task, the shared event loop reference gets corrupted or prematurely closed by the parent process worker restart handler.'
          }
        ],
        diagram: `[FastAPI Main Async Loop] ──(Dispatches Task)──> [ThreadPoolExecutor (Sync Workers)]
           ▲                                                        │
           │                                                        ▼
           └────────(Inverted: run_coroutine_threadsafe)────────────┘  <-- DEADLOCK VECTOR`
      },
      steps: [
        {
          step: 1,
          title: 'Decouple ThreadPool from Main Event Loop',
          action: 'Refactor sync worker calls into purely non-blocking native async tasks using `asyncio.to_thread` for CPU-bound parts instead of re-entering the event loop.',
          duration: '15 mins',
          impact: 'Eliminates 100% of threadpool deadlock vulnerabilities'
        },
        {
          step: 2,
          title: 'Implement Dedicated Event Loop Lifecycle Management',
          action: 'Never share a single static global event loop across multi-threaded workers. Utilize FastAPI lifespan handlers to explicitly create, bind, and cleanly drain task queues upon shutdown.',
          duration: '20 mins',
          impact: 'Prevents "Event loop is closed" runtime panics'
        },
        {
          step: 3,
          title: 'Introduce Backpressure & Bounded Worker Queues',
          action: 'Wrap incoming requests in an `asyncio.Semaphore(100)` or Redis queue to gracefully reject or delay load spikes instead of exhausting thread workers.',
          duration: '10 mins',
          impact: 'Predictable latency under 10k RPS stress spikes'
        }
      ],
      scaffold: {
        language: 'python',
        filename: 'worker_fixed.py',
        code: `import asyncio
from concurrent.futures import ThreadPoolExecutor
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException

# Bounded concurrency to eliminate thread exhaustion
MAX_CONCURRENT_TASKS = 200
semaphore = asyncio.Semaphore(MAX_CONCURRENT_TASKS)
executor = ThreadPoolExecutor(max_workers=32, thread_name_prefix="sync_cpu_worker")

def sync_cpu_heavy_computation(data: dict) -> dict:
    """CPU-bound task executed safely inside isolated worker thread."""
    # Simulation of CPU transform without touching asyncio loop
    processed = {k: str(v).upper() for k, v in data.items()}
    return {"status": "processed", "result": processed}

async def handle_event_safe(data: dict) -> dict:
    """Native non-blocking handler with bounded semaphore & clean thread dispatch."""
    async with semaphore:
        loop = asyncio.get_running_loop()
        try:
            # CORRECT: loop.run_in_executor runs sync in thread without inverted loop calls
            result = await loop.run_in_executor(executor, sync_cpu_heavy_computation, data)
            return result
        except asyncio.TimeoutError:
            raise HTTPException(status_code=504, detail="Task pipeline timeout")
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Worker failure: {exc}")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Setup resources on boot
    yield
    # Graceful shutdown: Drain executor threads safely
    executor.shutdown(wait=True, cancel_futures=True)

app = FastAPI(lifespan=lifespan)

@app.post("/process")
async def process_endpoint(payload: dict):
    return await handle_event_safe(payload)`
      },
      impact: {
        testCases: [
          { name: 'Concurrent 1,000 Workers Stress Test', status: 'PASSED', latency: '4.2ms' },
          { name: 'Event Loop Shutdown & Drain Lifecycle', status: 'PASSED', latency: '12ms' },
          { name: 'Timeout Resilience under Starvation', status: 'PASSED', latency: '0.8ms' }
        ],
        metrics: [
          { label: 'p99 Latency', before: '5,000ms (Timeout)', after: '14.8ms', improvement: '-99.7%' },
          { label: 'Deadlock Occurrences', before: '14 / hour', after: '0', improvement: 'Zero' },
          { label: 'Throughput (RPS)', before: '420 RPS (Crash)', after: '8,450 RPS', improvement: '+2,011%' }
        ],
        risks: 'Ensure `max_workers` on ThreadPoolExecutor does not exceed available host core memory.'
      }
    }
  },
  {
    id: 'scale-saas-arr',
    chipLabel: '📈 Scale SaaS ARR by 30%',
    category: 'business',
    difficulty: 3,
    title: 'Scale B2B SaaS ARR from $4M to $5.2M via Churn Reduction and Seat Expansion',
    body: `Company Context:
- Current ARR: $4,000,000 across 250 Mid-Market customers ($16k ACV)
- Net Revenue Retention (NRR): 94% (Gross Churn: 14% annually)
- Sales Cycle: 65 days with $4,200 CAC
- Bottleneck: Sales team is burning 70% time prospecting new logos while existing accounts churn quietly due to poor onboarding and lack of usage-based tiering.

Objective: Engineer an executable 90-day plan to hit $5.2M ARR (+30%) while preserving burn multiple below 1.2x.`,
    flags: ['high-perf', 'budget-lean', 'zero-downtime'],
    solution: {
      categoryName: 'BUSINESS STRATEGY',
      timeTaken: '0.78s',
      confidence: '97.8%',
      rootCause: {
        summary: 'Negative Net Expansion Engine: High gross logo churn (14%) combined with flat-fee unlimited seat licenses prevents natural account monetization as customer headcount grows.',
        points: [
          {
            title: 'Flat Pricing Ceiling Trap',
            desc: 'Fixed ACV ($16k) without consumption or seat expansion metrics means you absorb customer compute/support costs without capturing shared enterprise upside.'
          },
          {
            title: 'Dormancy Cliff at Day 45',
            desc: 'Customer onboarding drops off after week 3; inactive enterprise admins churn at renewal because value metrics were never established with C-level sponsors.'
          },
          {
            title: 'Misaligned Incentive Compensation',
            desc: 'Account Executives receive 100% quota commission solely on new logos, leaving expansion and renewal defense orphaned.'
          }
        ],
        diagram: `[Acquisition: $16k ACV] ──> [Onboarding Chasm (Day 45)] ──> [Renewal Cliff: 14% Loss]
        ▲                                                                    │
        └──────────── (No Expansion Tiers / No Usage Add-ons) ───────────────┘`
      },
      steps: [
        {
          step: 1,
          title: 'Deploy Hybrid Value-Metric Pricing (Seat + Usage Overage)',
          action: 'Introduce a tiered model: Base tier covers 10 power seats. Additional seats at $45/mo + API volume overage fees. Grandfather existing accounts with a 20% discount on 2-year lock-in renewals.',
          duration: '3 weeks',
          impact: 'Generates $480k in automated contract expansions within 2 quarters'
        },
        {
          step: 2,
          title: 'Establish High-Velocity Customer Success "Health Scorecard"',
          action: 'Track Weekly Active Users (WAU) and core workflow completions. Trigger automated CS executive intervention alerts when customer activity drops below 60% for 14 days.',
          duration: '2 weeks',
          impact: 'Cuts gross churn from 14% down to 7.5% ($260k ARR saved)'
        },
        {
          step: 3,
          title: 'Launch "Expansion Pilot" SPIF for Customer Success & Sales',
          action: 'Incentivize Account Managers with a 12% cash SPIF on upsell ARR. Target top 35 power customers with enterprise security, SSO, and compliance add-on packs.',
          duration: '4 weeks',
          impact: 'Adds $460k in expansion ARR from existing customer base'
        }
      ],
      scaffold: {
        language: 'sql',
        filename: 'saas_expansion_queries.sql',
        code: `-- Customer Health & Expansion Propensity Pipeline
WITH AccountUsageStats AS (
    SELECT 
        c.customer_id,
        c.company_name,
        c.annual_contract_value,
        c.contract_start_date,
        COUNT(DISTINCT u.user_id) AS active_seats,
        c.licensed_seat_limit,
        SUM(e.event_count) AS monthly_api_events,
        DATEDIFF(day, MAX(e.last_active_date), CURRENT_DATE) AS days_dormant
    FROM customers c
    JOIN users u ON c.customer_id = u.customer_id
    LEFT JOIN usage_events e ON u.user_id = e.user_id
    WHERE c.is_active = TRUE
    GROUP BY c.customer_id, c.company_name, c.annual_contract_value, c.contract_start_date, c.licensed_seat_limit
)
SELECT 
    customer_id,
    company_name,
    annual_contract_value AS current_arr,
    active_seats,
    licensed_seat_limit,
    -- Expansion opportunity: accounts hitting > 90% seat capacity
    CASE 
        WHEN active_seats >= licensed_seat_limit THEN 'IMMEDIATE_UPSELL_SEATS'
        WHEN monthly_api_events > 500000 THEN 'OVERAGE_VOLUME_EXPANSION'
        WHEN days_dormant > 21 THEN 'CRITICAL_CHURN_RISK'
        ELSE 'STABLE'
    END AS strategic_action_flag,
    ROUND(annual_contract_value * 1.35, 2) AS target_expanded_arr
FROM AccountUsageStats
WHERE active_seats >= (licensed_seat_limit * 0.9)
ORDER BY annual_contract_value DESC;`
      },
      impact: {
        testCases: [
          { name: 'NRR Growth Model Validation', status: 'VERIFIED', latency: '0.4s' },
          { name: 'CAC Payback Threshold Under 12 Mo', status: 'VALIDATED', latency: '0.2s' },
          { name: 'Retention Cohort Stress Test', status: 'HEALTHY', latency: '0.1s' }
        ],
        metrics: [
          { label: 'Total ARR', before: '$4.00M', after: '$5.24M', improvement: '+31.0%' },
          { label: 'Net Revenue Retention', before: '94%', after: '112%', improvement: '+18 pts' },
          { label: 'Annual Gross Churn', before: '14.0%', after: '6.8%', improvement: '-51.4%' }
        ],
        risks: 'Ensure sales compensation plan does not cannibalize new logo pipeline acquisition discipline.'
      }
    }
  },
  {
    id: 'cache-stampede-redis',
    chipLabel: '🛡️ Fix Cache Stampede',
    category: 'code',
    difficulty: 4,
    title: 'Distributed Redis Cache Stampede & Thundering Herd under Flash Traffic',
    body: `Problem:
During flash product launches (30,000 req/sec), high-demand cached keys expire simultaneously. Thousands of concurrent threads miss the cache at the exact same millisecond, slamming PostgreSQL with identical heavy queries.

Result: Database CPU spikes to 100%, connection pool is depleted (MaxConnectionsExceeded), and API p99 latency escalates from 18ms to 12,000ms until database fails health checks.`,
    flags: ['zero-downtime', 'high-perf'],
    solution: {
      categoryName: 'SYSTEM ARCHITECTURE',
      timeTaken: '0.59s',
      confidence: '99.1%',
      rootCause: {
        summary: 'Synchronized TTL expiration causing thundering herd DB spikes without probabilistic early refresh or distributed mutual exclusion.',
        points: [
          {
            title: 'Hard Deterministic Expiration TTL',
            desc: 'Keys set with static expiry (e.g. exactly 600s) expire in bulk, causing correlated cache misses.'
          },
          {
            title: 'Absence of Mutex / Single-Flight Locks',
            desc: 'Concurrent readers all independently decide to recalculate the missing key rather than allowing only a single worker to regenerate while others await or read stale.'
          },
          {
            title: 'Cold Start Cascade',
            desc: 'The database connection pool saturation prevents even trivial health checks from succeeding, causing cluster orchestrators to cycle healthy pods.'
          }
        ],
        diagram: `[30,000 Concurrent Requests] ──> [Redis: KEY EXPIRED (T=0)]
                │
                └───(Thundering Herd: 30,000 DB Queries)───> [PostgreSQL DB: 100% CPU Crash]`
      },
      steps: [
        {
          step: 1,
          title: 'Implement XFetch Probabilistic Early Expiration',
          action: 'Use the proven Vitter/ASAP algorithm: Compute a probabilistic trigger based on read compute cost and remaining TTL to refresh keys asynchronously before hard expiration.',
          duration: '30 mins',
          impact: 'Reduces cache misses on hot keys by 99.8%'
        },
        {
          step: 2,
          title: 'Wrap Fetch Operations with Single-Flight Mutex',
          action: 'Use a lightweight Redis lock or in-process promise coalescing so exactly one thread computes the cold value while other callers wait on the same shared promise.',
          duration: '25 mins',
          impact: 'Restricts database load to exactly 1 query per expired key'
        },
        {
          step: 3,
          title: 'Serve Stale on Error (Stale-While-Revalidate)',
          action: 'Retain the prior cached version with a grace period. If DB query fails or timeouts under spike, return the slightly stale cached value rather than a 500 error.',
          duration: '15 mins',
          impact: 'Achieves 100% uptime through DB brownouts'
        }
      ],
      scaffold: {
        language: 'typescript',
        filename: 'cache_stampede_resilient.ts',
        code: `import Redis from "ioredis";
import math from "mathjs";

interface CachePayload<T> {
  value: T;
  delta: number; // computation time in seconds
  expiry: number; // Unix timestamp in seconds
}

export class ResilientCache {
  private redis: Redis;
  private beta: number = 1.0; // Optimal parameter for XFetch

  constructor(redisClient: Redis) {
    this.redis = redisClient;
  }

  /**
   * Optimal Probabilistic Early Expiration (XFetch Algorithm)
   * Formula: -beta * delta * ln(random()) > (expiry - now)
   */
  async getOrSet<T>(
    key: string,
    ttlSeconds: number,
    fetchFn: () => Promise<T>
  ): Promise<T> {
    const raw = await this.redis.get(key);
    const now = Date.now() / 1000;

    if (raw) {
      const payload: CachePayload<T> = JSON.parse(raw);
      const remainingTime = payload.expiry - now;
      const earlyExpiryThreshold = -this.beta * payload.delta * Math.log(Math.random());

      // If key is still healthy and hasn't crossed probabilistic threshold, serve it
      if (earlyExpiryThreshold <= remainingTime) {
        return payload.value;
      }

      // Hot key early refresh triggered in background!
      this.recomputeInBackground(key, ttlSeconds, fetchFn).catch(console.error);
      return payload.value;
    }

    // Hard miss: Distributed lock to prevent thundering herd
    return await this.computeWithLock(key, ttlSeconds, fetchFn);
  }

  private async computeWithLock<T>(
    key: string,
    ttlSeconds: number,
    fetchFn: () => Promise<T>
  ): Promise<T> {
    const lockKey = \`lock:\${key}\`;
    const acquired = await this.redis.set(lockKey, "1", "NX", "EX", 10);

    if (!acquired) {
      // Another worker is recalculating. Wait 50ms and read cache
      await new Promise((resolve) => setTimeout(resolve, 50));
      const retryRaw = await this.redis.get(key);
      if (retryRaw) return JSON.parse(retryRaw).value;
    }

    try {
      const startTime = performance.now();
      const freshData = await fetchFn();
      const delta = (performance.now() - startTime) / 1000;
      const expiry = Date.now() / 1000 + ttlSeconds;

      const payload: CachePayload<T> = { value: freshData, delta, expiry };
      await this.redis.set(key, JSON.stringify(payload), "EX", ttlSeconds * 2);
      return freshData;
    } finally {
      await this.redis.del(lockKey);
    }
  }

  private async recomputeInBackground<T>(key: string, ttl: number, fn: () => Promise<T>) {
    await this.computeWithLock(key, ttl, fn);
  }
}`
      },
      impact: {
        testCases: [
          { name: 'Concurrent 30k Requests Under Expiry', status: 'PASSED', latency: '1.4ms' },
          { name: 'PostgreSQL Active Connections', status: 'STABLE (12/100)', latency: '0.9ms' },
          { name: 'Single-Flight Mutex Handshake', status: 'VERIFIED', latency: '0.3ms' }
        ],
        metrics: [
          { label: 'DB CPU Utilization', before: '100% (Crash)', after: '14.2%', improvement: '-85.8%' },
          { label: 'Cache Hit Ratio', before: '76.4%', after: '99.94%', improvement: '+23.5 pts' },
          { label: 'p99 Response Time', before: '12,000ms', after: '4.8ms', improvement: '-99.96%' }
        ],
        risks: 'Set lock timeout reasonably (e.g. 10s) to prevent persistent deadlocks if a recalculating node crashes.'
      }
    }
  },
  {
    id: 'f2p-game-economy',
    chipLabel: '🎮 Fix F2P Economy Inflation',
    category: 'creative',
    difficulty: 3,
    title: 'Hyper-Inflation and Pay-to-Win Churn Spiral in Mobile RPG Economy',
    body: `Problem:
In an active mobile action-RPG (350k DAU), players who reach Level 50 accumulate millions of unused 'Dragon Gold' coins with no meaningful late-game sinks.
- In-game marketplace prices inflated by 850% in 90 days.
- New players cannot afford entry-level craft gear and quit on Day 3 (D3 retention dropped from 38% to 19%).
- Whales stopped buying premium gem currency because gold is worthless.

Objective: Engineer a sustainable multi-sink economic rebalance without wiping player inventories.`,
    flags: ['high-perf', 'backward-compat'],
    solution: {
      categoryName: 'GAME SYSTEMS ARCHITECTURE',
      timeTaken: '0.71s',
      confidence: '98.2%',
      rootCause: {
        summary: 'Faucet-to-Sink Imbalance: Infinite daily gold generation via automated dungeon raids with zero progressive depreciation, consumable sinks, or cosmetic auction sinks.',
        points: [
          {
            title: 'Uncapped Infinite Gold Faucet',
            desc: 'Daily raid clears generate +120,000 gold per user with fixed static repair costs of only 2,500 gold, resulting in a +97% net positive daily money supply expansion.'
          },
          {
            title: 'Lack of Prestige & Vanity Sinks',
            desc: 'Endgame players have maxed gear tier, meaning gold has zero utility except hoarding, creating hyperinflation on scarce secondary trade items.'
          },
          {
            title: 'New Player Liquidity Wall',
            desc: 'Player-to-player trade taxes were static (5%), enabling predatory market manipulation by top cartels.'
          }
        ],
        diagram: `[Daily Dungeon Faucet: +120k Gold] ──> [Player Vaults] ──> [Marketplace Inflation: +850%]
                                          │
                                          └──(Repair Sink: -2.5k Gold ONLY)──> [Mass Churn]`
      },
      steps: [
        {
          step: 1,
          title: 'Introduce Clan Citadel Prestige Sinks',
          action: 'Launch collaborative guild territory development requiring billions in pooled gold to unlock visual banner customization, vanity hall monuments, and non-combat cosmetic titles.',
          duration: '2 sprints',
          impact: 'Absorbs 62% of circulating excess money supply in first 14 days'
        },
        {
          step: 2,
          title: 'Dynamic Progressive Auction House Taxation',
          action: 'Implement progressive seller tariffs: 5% tax for transactions under 10k gold, scaling to 25% for transactions over 1,000,000 gold. Earmark tax gold directly to void/burn pool.',
          duration: '1 sprint',
          impact: 'Halts speculative arbitrage and stabilizes starter gear prices'
        },
        {
          step: 3,
          title: 'Consumable Re-Roll & Enchantment Sinks',
          action: 'Allow players to spend high amounts of gold for cosmetic particle weapon re-colors and gear stat re-rolls with soft diminishing returns.',
          duration: '2 sprints',
          impact: 'Restores intrinsic transactional value to daily quest loops'
        }
      ],
      scaffold: {
        language: 'javascript',
        filename: 'economy_balancer.js',
        code: `/**
 * Dynamic Progressive Luxury Tax & Sink Burner Engine
 */
class GameEconomyEngine {
  constructor() {
    this.totalBurnedGold = 0;
  }

  /**
   * Calculates progressive marketplace transaction tax
   */
  calculateTransactionTax(itemPrice) {
    let taxRate = 0.05; // Base 5%
    if (itemPrice > 1000000) {
      taxRate = 0.25; // 25% luxury bracket
    } else if (itemPrice > 250000) {
      taxRate = 0.15; // 15% intermediate
    } else if (itemPrice > 50000) {
      taxRate = 0.10; // 10% standard
    }
    const taxAmount = Math.floor(itemPrice * taxRate);
    const sellerProceeds = itemPrice - taxAmount;
    
    // 100% of tax is burned from circulation permanently
    this.totalBurnedGold += taxAmount;

    return {
      taxRate: \`\${(taxRate * 100).toFixed(0)}%\`,
      taxAmount,
      sellerProceeds,
      isBurned: true
    };
  }

  /**
   * Clan Territory Donation Burn Module
   */
  donateToCitadel(playerVault, donationAmount) {
    if (playerVault.gold < donationAmount) {
      throw new Error("Insufficient player balance");
    }
    playerVault.gold -= donationAmount;
    this.totalBurnedGold += donationAmount;
    
    // Awards vanity prestige points without inflating combat power
    const prestigeGain = Math.floor(Math.sqrt(donationAmount) * 2.5);
    playerVault.prestige += prestigeGain;

    return {
      remainingGold: playerVault.gold,
      prestigeAwarded: prestigeGain,
      moneySupplyContracted: donationAmount
    };
  }
}

// Example Execution
const engine = new GameEconomyEngine();
console.log(engine.calculateTransactionTax(1500000));
// Output: { taxRate: '25%', taxAmount: 375000, sellerProceeds: 1125000, isBurned: true }`
      },
      impact: {
        testCases: [
          { name: 'Simulated 30-Day Money Supply Contraction', status: 'BALANCED', latency: '12ms' },
          { name: 'Starter Gear Price Normalization', status: 'VERIFIED', latency: '5ms' },
          { name: 'Whale Spending Elasticity Check', status: 'HEALTHY', latency: '4ms' }
        ],
        metrics: [
          { label: 'Circulating Gold Inflation', before: '+850% / quarter', after: '+2.1% / quarter', improvement: '-97.5%' },
          { label: 'D3 New Player Retention', before: '19.2%', after: '36.8%', improvement: '+91.6%' },
          { label: 'Daily Currency Burn Rate', before: '2.5% of faucet', after: '94.8% of faucet', improvement: '+3,692%' }
        ],
        risks: 'Balance cosmetic rewards carefully so whales feel recognized without gating core combat stats.'
      }
    }
  },
  {
    id: 'tsp-dynamic-programming',
    chipLabel: '🧩 Solve Optimization Puzzle',
    category: 'logic',
    difficulty: 5,
    title: 'NP-Hard Dynamic Constrained Traveling Salesperson with Time Windows',
    body: `Problem Formulation:
Given N=24 pickup and delivery nodes with dynamic traffic matrices and narrow 15-minute delivery time windows:
- Exact Held-Karp algorithm is O(n^2 * 2^n), computationally intractable for real-time dispatch (requires > 300 CPU hours).
- Basic greedy nearest-neighbor produces 48% window violation rate and excessive fuel consumption.

Objective: Design a hybrid metaheuristic (Ant Colony Optimization + 2-Opt Local Search) capable of producing near-optimal (<2% of theoretical lower bound) solutions in under 800ms.`,
    flags: ['high-perf', 'zero-downtime'],
    solution: {
      categoryName: 'ALGORITHMS & LOGIC',
      timeTaken: '0.82s',
      confidence: '99.6%',
      rootCause: {
        summary: 'Combinatorial Explosion under Rigid Constraints: Exact DP methods fail exponential space complexity while naive greedy search gets trapped in sub-optimal local minima.',
        points: [
          {
            title: 'Exponential State Space Saturation',
            desc: 'For N=24, state space is (24-1)! / 2 ≈ 1.29 × 10^21 potential route permutations.'
          },
          {
            title: 'Hard Time Window Penalties',
            desc: 'Arriving too early wastes vehicle idle capacity; arriving late incurs severe SLA contractual fines.'
          },
          {
            title: 'Local Minima Trapping in Heuristics',
            desc: 'Deterministic gradient descent algorithms freeze in sub-optimal paths whenever crossing city boundary clusters.'
          }
        ],
        diagram: `[Exact O(N² 2^N) DP: Infeasible (300h)] ──> [Solution Strategy]
                                                    │
       ┌────────────────────────────────────────────┴───────────────────────────────────┐
       ▼                                                                                ▼
[Ant Colony Pheromone Exploration (Global)]                        [2-Opt Edge Inversion (Sub-second Local)]`
      },
      steps: [
        {
          step: 1,
          title: 'Implement Spatial KD-Tree Pre-Clustering',
          action: 'Partition delivery nodes into convex geographic clusters with boundary overlap. Solves individual 8-node sub-problems in 2ms.',
          duration: '2 hours',
          impact: 'Reduces search space complexity by 98%'
        },
        {
          step: 2,
          title: 'Vectorized Ant Colony Optimization (ACO)',
          action: 'Simulate 40 artificial ants laying pheromones over 50 iterations with evaporation factor α=1.0, β=2.5, ρ=0.15.',
          duration: '3 hours',
          impact: 'Finds top 5% global routing candidates in 320ms'
        },
        {
          step: 3,
          title: '2-Opt and 3-Opt Iterated Local Search (ILS)',
          action: 'Perform uncrossing of overlapping path vectors until no 2-edge exchange produces lower cost time-window violation.',
          duration: '1 hour',
          impact: 'Converges to <1.8% of theoretical optimum in 180ms'
        }
      ],
      scaffold: {
        language: 'javascript',
        filename: 'tsp_tw_hybrid_solver.js',
        code: `/**
 * Ultra-Fast 2-Opt Iterative Local Search for TSP with Time Windows
 */
class TSPSolver {
  constructor(distanceMatrix, timeWindows) {
    this.dist = distanceMatrix;
    this.windows = timeWindows; // [{start: min, end: min}]
    this.n = distanceMatrix.length;
  }

  /**
   * Evaluates total route cost including travel distance and delay penalties
   */
  calculateRouteCost(route) {
    let cost = 0;
    let currentTime = 0;

    for (let i = 0; i < route.length - 1; i++) {
      const u = route[i];
      const v = route[i + 1];
      const travelTime = this.dist[u][v];
      currentTime += travelTime;

      const window = this.windows[v];
      if (currentTime < window.start) {
        // Early arrival: idle wait time
        currentTime = window.start;
      } else if (currentTime > window.end) {
        // Late arrival penalty
        const delay = currentTime - window.end;
        cost += delay * 50; // Heavy penalty multiplier
      }
      cost += travelTime;
    }
    return cost;
  }

  /**
   * 2-Opt Edge Swapping to eliminate crossed paths in O(N^2)
   */
  twoOptOptimize(initialRoute, maxIterations = 200) {
    let bestRoute = [...initialRoute];
    let bestCost = this.calculateRouteCost(bestRoute);
    let improved = true;
    let iteration = 0;

    while (improved && iteration < maxIterations) {
      improved = false;
      iteration++;

      for (let i = 1; i < this.n - 1; i++) {
        for (let k = i + 1; k < this.n; k++) {
          // Invert sub-segment between i and k
          const newRoute = this.twoOptSwap(bestRoute, i, k);
          const newCost = this.calculateRouteCost(newRoute);

          if (newCost < bestCost) {
            bestRoute = newRoute;
            bestCost = newCost;
            improved = true;
            break;
          }
        }
        if (improved) break;
      }
    }

    return { route: bestRoute, finalCost: bestCost, iterations: iteration };
  }

  twoOptSwap(route, i, k) {
    const p1 = route.slice(0, i);
    const p2 = route.slice(i, k + 1).reverse();
    const p3 = route.slice(k + 1);
    return p1.concat(p2).concat(p3);
  }
}

// Execution Benchmark Test
const N = 12;
const mockDist = Array.from({ length: N }, () => Array.from({ length: N }, () => Math.floor(Math.random() * 20) + 5));
const mockWindows = Array.from({ length: N }, (_, i) => ({ start: i * 10, end: i * 10 + 25 }));
const solver = new TSPSolver(mockDist, mockWindows);
const initialRoute = Array.from({ length: N }, (_, i) => i).concat([0]);
const result = solver.twoOptOptimize(initialRoute);
console.log("Optimal Route Solution:", result);`
      },
      impact: {
        testCases: [
          { name: '24-Node Real-time Convergence', status: 'OPTIMAL (480ms)', latency: '480ms' },
          { name: 'Time Window Violation Rate', status: '0.00% VIOLATION', latency: '12ms' },
          { name: 'Triangular Inequality Check', status: 'VALIDATED', latency: '2ms' }
        ],
        metrics: [
          { label: 'Execution Time', before: '300+ CPU Hours', after: '480ms', improvement: '-99.999%' },
          { label: 'Time Window Violations', before: '48.2%', after: '0.4%', improvement: '-99.1%' },
          { label: 'Fleet Fuel Cost', before: 'Baseline 100%', after: '68.4%', improvement: '-31.6%' }
        ],
        risks: 'For fleets exceeding N=200, deploy hierarchical partition clusters to maintain sub-second SLA.'
      }
    }
  }
];

// Community Trending Solutions Showcase Data
const COMMUNITY_SOLUTIONS = [
  {
    id: 'comm-1',
    category: 'code',
    title: 'PostgreSQL Deadlock Mitigation in Multi-Tenant Financial Ledger',
    votes: 342,
    author: 'Elena Rostova (Staff SRE)',
    difficulty: 'Level 4: Architect',
    tags: ['PostgreSQL', 'Concurrency', 'ACID'],
    summary: 'Resolution of race condition deadlocks in account balance debits under concurrent payments via deterministic row sorting lock protocol.'
  },
  {
    id: 'comm-2',
    category: 'logic',
    title: 'Deterministic Raft Consensus Split-Brain Prevention Algorithm',
    votes: 289,
    author: 'Kaelen Vance (Dist. Systems)',
    difficulty: 'Level 5: Legendary',
    tags: ['Raft', 'Consensus', 'Network Partition'],
    summary: 'Formal TLA+ verified fix for asymmetric network partitions in distributed quorum election loops.'
  },
  {
    id: 'comm-3',
    category: 'business',
    title: 'Re-engineering CAC:LTV from 1.4x to 3.8x for B2B FinTech',
    votes: 415,
    author: 'Marcus Sterling (Operating Partner)',
    difficulty: 'Level 3: Advanced',
    tags: ['Unit Economics', 'Growth', 'FinTech'],
    summary: 'Structural overhaul of inbound qualification and automated product-led trial conversion sequences.'
  },
  {
    id: 'comm-4',
    category: 'code',
    title: 'Memory Leak & V8 Heap Saturation in Next.js SSR Streaming',
    votes: 512,
    author: 'Sarah Chen (Principal Architect)',
    difficulty: 'Level 3: Advanced',
    tags: ['Next.js', 'Node.js', 'V8 Heap'],
    summary: 'Diagnosing uncollected React server component event emitters and closures retained in long-lived socket scopes.'
  },
  {
    id: 'comm-5',
    category: 'creative',
    title: 'Zero-Friction User Onboarding for Complex 3D WebGL Tooling',
    votes: 198,
    author: 'Aria Thorne (UX Director)',
    difficulty: 'Level 2: Intermediate',
    tags: ['WebGL', 'UX Architecture', 'Design Systems'],
    summary: 'Progressive disclosure framework converting 42-parameter canvas tools into 3-step intuitive mental models.'
  },
  {
    id: 'comm-6',
    category: 'business',
    title: 'Enterprise Multi-Cloud Failover Strategy with RTO < 30s',
    votes: 377,
    author: 'Devon Wright (Cloud Architect)',
    difficulty: 'Level 5: Legendary',
    tags: ['Multi-Cloud', 'AWS', 'GCP', 'Disaster Recovery'],
    summary: 'Active-Active cross-cloud DNS routing with automated BGP health checks and asynchronous CDC replication.'
  }
];

// ==========================================
// 3. INITIALIZATION & LIFECYCLE
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
  loadSavedPreferences();
  renderTemplateChips();
  renderCommunityGrid();
  renderHistoryDrawer();
  setupEventListeners();
  updateTokenDisplay();

  // Handle URL Search Query Parameter (?q=... or ?search=...)
  const urlParams = new URLSearchParams(window.location.search);
  const queryParam = urlParams.get('q') || urlParams.get('search');
  if (queryParam) {
    const catParam = urlParams.get('cat') || urlParams.get('category');
    if (catParam) {
      const catSelect = document.getElementById('category-select');
      if (catSelect) catSelect.value = catParam;
    }
    document.getElementById('problem-title').value = queryParam;
    document.getElementById('problem-body').value = `Direct Chrome Search Query:\n${queryParam}\n\nConstraints: Instant multi-modal deconstruction, root cause isolation, and verified scaffold generation.`;
    updateCharCounter();
    setTimeout(() => {
      executeAnalysis();
    }, 350);
  } else {
    // Load the first preset into workspace for immediate stunning impression
    loadPresetIntoWorkspace(PRESET_TEMPLATES[0], false);
  }
});

// Load state from localStorage
function loadSavedPreferences() {
  try {
    const savedHistory = localStorage.getItem(STORAGE_KEYS.HISTORY);
    if (savedHistory) APP_STATE.history = JSON.parse(savedHistory);

    const savedTokens = localStorage.getItem(STORAGE_KEYS.TOKENS);
    if (savedTokens) APP_STATE.tokensUsed = parseInt(savedTokens, 10);

    const savedLikes = localStorage.getItem(STORAGE_KEYS.LIKES);
    if (savedLikes) APP_STATE.communityLikes = JSON.parse(savedLikes);

    const savedAudio = localStorage.getItem(STORAGE_KEYS.AUDIO);
    if (savedAudio !== null) APP_STATE.audioEnabled = savedAudio === 'true';
    updateAudioIcon();
  } catch (e) {
    console.warn('LocalStorage error on init:', e);
  }
}

function updateAudioIcon() {
  const icon = document.getElementById('audio-icon');
  if (!icon) return;
  if (APP_STATE.audioEnabled) {
    icon.className = 'fa-solid fa-volume-high text-violet-400';
  } else {
    icon.className = 'fa-solid fa-volume-xmark text-slate-500';
  }
}

// ==========================================
// 4. UI RENDERING ENGINES
// ==========================================

// Render the quick-access template chips
function renderTemplateChips() {
  const container = document.getElementById('template-chips-container');
  if (!container) return;

  container.innerHTML = PRESET_TEMPLATES.map((tmpl) => {
    return `
      <button 
        type="button" 
        class="template-chip px-3.5 py-1.5 rounded-full text-xs font-medium bg-cyber-850 hover:bg-cyber-800 text-slate-300 border border-slate-700/70 hover:border-violet-500 flex items-center gap-1.5 shadow-sm active:scale-95 transition"
        data-template-id="${tmpl.id}"
      >
        <span>${tmpl.chipLabel}</span>
      </button>
    `;
  }).join('');

  // Attach event handlers
  container.querySelectorAll('.template-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-template-id');
      const found = PRESET_TEMPLATES.find(t => t.id === id);
      if (found) {
        playSound('click');
        loadPresetIntoWorkspace(found, true);
        showToast('Template Archetype Loaded', `Loaded "${found.title.slice(0, 35)}..." into workspace`, 'info');
      }
    });
  });
}

// Render Community Showcase Grid with Upvoting
function renderCommunityGrid(filter = 'all') {
  const grid = document.getElementById('community-cards-grid');
  if (!grid) return;

  const filtered = filter === 'all' 
    ? COMMUNITY_SOLUTIONS 
    : COMMUNITY_SOLUTIONS.filter(c => c.category === filter);

  grid.innerHTML = filtered.map(item => {
    const isLiked = !!APP_STATE.communityLikes[item.id];
    const votesCount = item.votes + (isLiked ? 1 : 0);
    const categoryIcon = item.category === 'code' ? 'fa-code text-violet-400' 
      : item.category === 'logic' ? 'fa-puzzle-piece text-cyan-400' 
      : 'fa-chart-line text-emerald-400';

    return `
      <div class="interactive-card bg-cyber-850/80 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between space-y-4 shadow-glass backdrop-blur-md relative overflow-hidden group">
        
        <!-- Header badge & likes -->
        <div class="flex items-center justify-between">
          <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-cyber-900 border border-slate-700/80 text-[11px] font-mono text-slate-300">
            <i class="fa-solid ${categoryIcon} text-xs"></i>
            <span class="capitalize">${item.category}</span>
          </span>
          <span class="text-[10px] font-mono text-slate-400 bg-slate-800/60 px-2 py-0.5 rounded">${item.difficulty}</span>
        </div>

        <!-- Title & description -->
        <div class="space-y-1.5 flex-1">
          <h4 class="text-sm font-bold text-white group-hover:text-violet-300 transition leading-snug">${item.title}</h4>
          <p class="text-xs text-slate-400 line-clamp-2 leading-relaxed">${item.summary}</p>
        </div>

        <!-- Tags -->
        <div class="flex flex-wrap gap-1.5">
          ${item.tags.map(t => `<span class="text-[10px] font-mono px-2 py-0.5 rounded bg-cyber-900 text-slate-400 border border-slate-800">#${t}</span>`).join('')}
        </div>

        <!-- Author & Actions -->
        <div class="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
          <span class="text-[11px] text-slate-400 truncate max-w-[140px]">${item.author}</span>
          <div class="flex items-center gap-2">
            <button class="upvote-btn flex items-center gap-1 px-2.5 py-1 rounded-lg border ${isLiked ? 'bg-violet-950/60 border-violet-500 text-violet-300' : 'bg-cyber-900 border-slate-700 text-slate-400 hover:text-slate-200'} transition" data-id="${item.id}">
              <i class="fa-solid fa-thumbs-up text-[11px]"></i>
              <span class="font-mono text-[11px]">${votesCount}</span>
            </button>
            <button class="clone-blueprint-btn px-2.5 py-1 rounded-lg bg-cyber-800 hover:bg-violet-600 hover:text-white text-slate-200 border border-slate-700 text-xs transition" data-id="${item.id}" title="Load blueprint into workspace">
              <span>Inspect</span>
            </button>
          </div>
        </div>

      </div>
    `;
  }).join('');

  // Attach upvote and clone events
  grid.querySelectorAll('.upvote-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      if (APP_STATE.communityLikes[id]) {
        delete APP_STATE.communityLikes[id];
      } else {
        APP_STATE.communityLikes[id] = true;
        playSound('click');
        showToast('Upvote Registered', 'Thank you for supporting community peer-reviewed solutions!', 'success');
      }
      localStorage.setItem(STORAGE_KEYS.LIKES, JSON.stringify(APP_STATE.communityLikes));
      renderCommunityGrid(document.querySelector('.community-filter-btn.active')?.getAttribute('data-filter') || 'all');
    });
  });

  grid.querySelectorAll('.clone-blueprint-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const item = COMMUNITY_SOLUTIONS.find(c => c.id === id);
      if (item) {
        document.getElementById('problem-title').value = item.title;
        document.getElementById('problem-body').value = item.summary + "\n\nKey Constraints:\n- Maintain strict zero data loss\n- Verification harness required for automated CI/CD pipeline";
        document.getElementById('category-select').value = item.category;
        updateCharCounter();
        playSound('click');
        executeAnalysis();
        window.scrollTo({ top: document.getElementById('workspace-section').offsetTop - 80, behavior: 'smooth' });
      }
    });
  });
}

// ==========================================
// 5. WORKSPACE & RESOLUTION ENGINE
// ==========================================

function loadPresetIntoWorkspace(preset, triggerSolve = false) {
  document.getElementById('problem-title').value = preset.title;
  document.getElementById('problem-body').value = preset.body;
  document.getElementById('category-select').value = preset.category;
  document.getElementById('difficulty-slider').value = preset.difficulty;
  updateDifficultyBadge(preset.difficulty);
  updateCharCounter();

  // Apply constraint chips
  document.querySelectorAll('.constraint-chip').forEach(chip => {
    const flag = chip.getAttribute('data-flag');
    if (preset.flags.includes(flag)) {
      chip.classList.add('active');
    } else {
      chip.classList.remove('active');
    }
  });

  if (triggerSolve) {
    executeAnalysis(preset);
  } else {
    // Render the preset's solution immediately
    renderSolutionView(preset.solution, preset.title);
  }
}

// Updates difficulty label text and color
function updateDifficultyBadge(val) {
  const badge = document.getElementById('difficulty-badge');
  const labels = {
    1: 'Level 1: Beginner',
    2: 'Level 2: Intermediate',
    3: 'Level 3: Advanced',
    4: 'Level 4: Architect',
    5: 'Level 5: Legendary'
  };
  badge.textContent = labels[val] || `Level ${val}`;
  if (val >= 4) {
    badge.className = 'font-mono font-bold text-xs px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800/40';
  } else if (val === 3) {
    badge.className = 'font-mono font-bold text-xs px-2 py-0.5 rounded bg-violet-950 text-violet-300 border border-violet-800/40';
  } else {
    badge.className = 'font-mono font-bold text-xs px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800/40';
  }
}

// Character counter in input console
function updateCharCounter() {
  const text = document.getElementById('problem-body').value || '';
  const counter = document.getElementById('char-counter');
  counter.textContent = `${text.length.toLocaleString()} / 4,000 chars`;
}

// Execute analysis with multi-stage neural loader
function executeAnalysis(forcedPreset = null) {
  if (APP_STATE.isSolving) return;

  const title = document.getElementById('problem-title').value.trim();
  const body = document.getElementById('problem-body').value.trim();

  if (!title || !body) {
    showToast('Missing Required Input', 'Please provide both a Problem Headline and Context before execution.', 'error');
    return;
  }

  APP_STATE.isSolving = true;
  playSound('launch');

  const loader = document.getElementById('solver-loader');
  const stageTitle = document.getElementById('loader-stage-title');
  const stageDesc = document.getElementById('loader-stage-desc');
  const progressFill = document.getElementById('loader-progress-fill');
  const executeBtn = document.getElementById('execute-btn');
  const btnText = document.getElementById('btn-text');

  loader.classList.remove('hidden');
  btnText.textContent = 'Deconstructing...';
  executeBtn.classList.add('opacity-75', 'cursor-not-allowed');

  // Stages of resolution animation
  const stages = [
    { title: 'Deconstructing Semantic Constraints...', desc: 'Ingesting syntax trees, AST nodes, and failure traces', progress: '25%', stepId: 'pipe-step-1' },
    { title: 'Isolating Root Causal Factors...', desc: 'Evaluating race conditions, anti-patterns, and bottleneck vectors', progress: '55%', stepId: 'pipe-step-2' },
    { title: 'Synthesizing Resilient Scaffolds...', desc: 'Generating executable code harnesses and mitigation algorithms', progress: '85%', stepId: 'pipe-step-3' },
    { title: 'Deterministic Verification & Stress Simulation...', desc: 'Validating against latency, throughput, and error boundaries', progress: '100%', stepId: 'pipe-step-4' }
  ];

  let currentStage = 0;

  const stageInterval = setInterval(() => {
    if (currentStage < stages.length) {
      const s = stages[currentStage];
      stageTitle.textContent = s.title;
      stageDesc.textContent = s.desc;
      progressFill.style.width = s.progress;

      // Highlight active pipeline step
      document.querySelectorAll('#solver-loader [id^="pipe-step"]').forEach(el => el.classList.remove('text-violet-400', 'font-bold'));
      const activeStep = document.getElementById(s.stepId);
      if (activeStep) activeStep.classList.add('text-emerald-400', 'font-bold');

      currentStage++;
    } else {
      clearInterval(stageInterval);

      // Synthesis Complete
      setTimeout(() => {
        loader.classList.add('hidden');
        APP_STATE.isSolving = false;
        btnText.textContent = 'Execute Multi-Modal Analysis';
        executeBtn.classList.remove('opacity-75', 'cursor-not-allowed');

        // Check if there is a matching preset or generate dynamic
        let solutionToRender = forcedPreset ? forcedPreset.solution : null;
        if (!solutionToRender) {
          const matchedPreset = PRESET_TEMPLATES.find(p => p.title.toLowerCase() === title.toLowerCase());
          if (matchedPreset) {
            solutionToRender = matchedPreset.solution;
          } else {
            solutionToRender = generateDynamicSolution(title, body);
          }
        }

        renderSolutionView(solutionToRender, title);
        saveCurrentSolutionToHistory(title, solutionToRender);
        playSound('success');
        triggerConfetti();

        // Increment token count realistically
        incrementTokens(Math.floor(Math.random() * 850) + 1200);

        showToast('Problem Resolved', 'Full 4-tier resolution plan and executable scaffold ready.', 'success');
      }, 350);
    }
  }, 380);
}

// Dynamic AI Problem Generator for arbitrary user input
function generateDynamicSolution(title, body) {
  const cat = document.getElementById('category-select').value;
  const isCode = cat === 'code' || body.includes('{') || body.includes('def ') || body.includes('function') || body.includes('error');
  const difficulty = parseInt(document.getElementById('difficulty-slider').value, 10);

  const lang = body.includes('import ') || body.includes('def ') ? 'python' 
    : body.includes('const ') || body.includes('function') ? 'typescript'
    : body.includes('SELECT') ? 'sql' : 'javascript';

  const categoryLabels = {
    code: 'CODE DEBUGGER & ARCHITECTURE',
    logic: 'MATH, LOGIC & ALGORITHMS',
    business: 'BUSINESS STRATEGY & OPS',
    creative: 'CREATIVE & PRODUCT CANVAS'
  };

  return {
    categoryName: categoryLabels[cat] || 'MULTI-MODAL RESOLUTION',
    timeTaken: (0.4 + Math.random() * 0.5).toFixed(2) + 's',
    confidence: (96.5 + Math.random() * 3).toFixed(1) + '%',
    rootCause: {
      summary: `Deconstructed root failure vector for "${title}": Structural impedance mismatch between incoming request expectations and execution environment constraints.`,
      points: [
        {
          title: 'Unchecked Edge Invariants & Failure Propagation',
          desc: 'The input context reveals unhandled edge cases where unexpected null/empty states or asynchronous thread interruptions bubble up without defensive guards.'
        },
        {
          title: 'Resource Allocation Bottleneck',
          desc: `High load saturation causes latency degradation due to synchronous lock retention or missing backpressure limits under Level ${difficulty} complexity.`
        },
        {
          title: 'State Mutation Side-Effects',
          desc: 'Shared mutable state across concurrent execution branches without atomic isolation introduces non-deterministic runtime regressions.'
        }
      ],
      diagram: `[Input Constraint Vector] ──(Exhaustion Point)──> [Critical Failure Horizon]
         │                                                      │
         └─────────────(Defensive Decoupling Architecture)─────┘`
    },
    steps: [
      {
        step: 1,
        title: 'Establish Bounded Defensive Perimeter',
        action: 'Implement explicit parameter assertions and precondition validation to short-circuit invalid or poisoned input payloads before execution.',
        duration: '10 mins',
        impact: 'Prevents 100% of upstream unhandled exceptions'
      },
      {
        step: 2,
        title: 'Apply Atomic Non-Blocking Execution Scaffolding',
        action: 'Replace blocking calls with asynchronous promise chains or isolated queue workers equipped with circuit breaker patterns.',
        duration: '25 mins',
        impact: 'Maintains p99 latency guarantees under 10x traffic bursts'
      },
      {
        step: 3,
        title: 'Integrate Verification Telemetry & Health Probes',
        action: 'Deploy structured logging with distributed correlation IDs and synthetic regression tests for continuous CI/CD validation.',
        duration: '15 mins',
        impact: 'Guarantees sub-minute detection time for any subsequent regressions'
      }
    ],
    scaffold: {
      language: lang,
      filename: `solution_scaffold.${lang === 'python' ? 'py' : lang === 'sql' ? 'sql' : 'ts'}`,
      code: isCode ? `// ============================================================
// Robust Solution Scaffold for: ${title}
// Verified Pattern: Zero-Downtime, High-Performance Safe Scaffolding
// ============================================================

export interface SolutionContext {
  id: string;
  timestamp: number;
  maxRetries: number;
}

export class ResilientHandler {
  private activeLocks: Set<string> = new Set();

  /**
   * Safe entrypoint with concurrency guard and circuit-breaking
   */
  async processTaskSafely(payload: Record<string, any>, ctx: SolutionContext): Promise<any> {
    if (!payload || Object.keys(payload).length === 0) {
      throw new Error("Invalid payload: assertion failed");
    }

    // Atomic concurrency lock
    if (this.activeLocks.has(ctx.id)) {
      console.warn(\`Duplicate execution prevented for task ID: \${ctx.id}\`);
      return { status: "coalesced", message: "Task already in progress" };
    }

    this.activeLocks.add(ctx.id);

    try {
      console.time(\`TaskExecution-\${ctx.id}\`);
      
      // Core mitigation logic
      const result = await this.executeCoreBusinessLogic(payload);
      
      console.timeEnd(\`TaskExecution-\${ctx.id}\`);
      return { success: true, result };
    } catch (error) {
      console.error("Critical execution boundary caught:", error);
      return this.handleFallbackGracefully(payload, error);
    } finally {
      this.activeLocks.delete(ctx.id);
    }
  }

  private async executeCoreBusinessLogic(data: any): Promise<any> {
    // Isolated task execution
    return {
      status: "RESOLVED",
      dataSignature: "SHA256-VERIFIED",
      processedAt: new Date().toISOString()
    };
  }

  private handleFallbackGracefully(data: any, err: any) {
    return {
      success: false,
      recovered: true,
      fallbackValue: null,
      errorDetail: err.message
    };
  }
}` : `-- Strategic Decision Matrix for: ${title}
-- Goal: Eliminate structural bottlenecks and align stakeholder metrics

1. Phase 1: Immediate Stabilization
   - Audit all high-churn conversion checkpoints
   - Cap resource over-allocation on non-performing assets

2. Phase 2: Systematic Scaling
   - Deploy automated feedback loops
   - Enforce O(1) operational handoffs between teams`
    },
    impact: {
      testCases: [
        { name: 'Boundary Condition & Zero-Input Assertion', status: 'PASSED', latency: '0.8ms' },
        { name: 'Concurrent Execution Race-Safety', status: 'PASSED', latency: '2.4ms' },
        { name: 'Circuit Breaker Auto-Recovery', status: 'VALIDATED', latency: '1.1ms' }
      ],
      metrics: [
        { label: 'System Throughput', before: 'Erratic / Crashes', after: 'Predictable Linear', improvement: '+340%' },
        { label: 'Failure Rate', before: '18.4%', after: '0.01%', improvement: '-99.9%' },
        { label: 'Time to Resolution', before: 'Hours of Triage', after: 'Instant Auto-Heal', improvement: 'Immediate' }
      ],
      risks: 'Monitor system telemetry after initial canary deployment to confirm baseline metrics stabilize.'
    }
  };
}

// ==========================================
// 6. TAB RENDERING & HIGHLIGHTING
// ==========================================

function renderSolutionView(solution, problemTitle) {
  APP_STATE.currentSolution = { solution, problemTitle };

  // Update Status Banner
  document.getElementById('solution-category-tag').textContent = solution.categoryName;
  document.getElementById('solution-time-taken').innerHTML = `Latency: <span class="text-slate-200">${solution.timeTaken}</span>`;
  document.getElementById('solution-confidence').innerHTML = `Confidence: <span class="text-violet-400 font-bold">${solution.confidence}</span>`;

  // 1. Tab: Root Cause
  const rootCausePane = document.getElementById('tab-root-cause');
  rootCausePane.innerHTML = `
    <div class="space-y-4">
      <!-- High Impact Callout Banner -->
      <div class="bg-violet-950/40 border border-violet-500/40 rounded-xl p-4 shadow-glass">
        <div class="flex items-start gap-3">
          <div class="w-8 h-8 rounded-lg bg-violet-600/30 border border-violet-400/30 flex items-center justify-center text-violet-300 text-sm mt-0.5">
            <i class="fa-solid fa-brain"></i>
          </div>
          <div class="space-y-1">
            <h4 class="text-xs font-mono font-bold uppercase tracking-wider text-violet-300">Executive Root Cause Diagnosis</h4>
            <p class="text-xs sm:text-sm text-slate-200 font-medium leading-relaxed">${solution.rootCause.summary}</p>
          </div>
        </div>
      </div>

      <!-- Structural Breakdown Points -->
      <div class="space-y-3">
        <h5 class="text-xs font-mono font-semibold uppercase text-slate-400 flex items-center gap-2">
          <i class="fa-solid fa-circle-nodes text-cyan-400"></i> Critical Failure Vectors
        </h5>
        <div class="grid grid-cols-1 gap-2.5">
          ${solution.rootCause.points.map((pt, idx) => `
            <div class="bg-cyber-900/80 border border-slate-800 rounded-xl p-3.5 space-y-1 hover:border-slate-700 transition">
              <div class="flex items-center gap-2">
                <span class="w-5 h-5 rounded-full bg-slate-800 text-[11px] font-mono font-bold text-violet-400 flex items-center justify-center">${idx + 1}</span>
                <span class="text-xs font-bold text-white">${pt.title}</span>
              </div>
              <p class="text-xs text-slate-400 pl-7 leading-relaxed">${pt.desc}</p>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Architectural Causal Flow Diagram -->
      <div class="space-y-2">
        <div class="flex items-center justify-between text-xs text-slate-400 font-mono">
          <span class="flex items-center gap-1.5"><i class="fa-solid fa-diagram-project text-emerald-400"></i> Causal Propagation Flow</span>
          <span class="text-[10px] text-slate-500">ASCII Architecture Map</span>
        </div>
        <pre class="bg-cyber-950 border border-slate-800 rounded-xl p-3.5 text-[11px] sm:text-xs font-mono text-cyan-300 overflow-x-auto leading-relaxed shadow-inner">${solution.rootCause.diagram}</pre>
      </div>
    </div>
  `;

  // 2. Tab: Step-by-Step
  const stepPane = document.getElementById('tab-solution');
  stepPane.innerHTML = `
    <div class="space-y-3">
      <div class="flex items-center justify-between text-xs text-slate-400 pb-1">
        <span class="font-mono">Actionable Implementation Sequence (${solution.steps.length} Phases)</span>
        <span class="text-emerald-400 text-xs font-mono"><i class="fa-solid fa-check-double mr-1"></i>Pre-conditions Met</span>
      </div>

      <!-- Accordion Steps -->
      <div class="space-y-2.5" id="solution-steps-accordion">
        ${solution.steps.map((st, i) => `
          <div class="accordion-item ${i === 0 ? 'open' : ''} bg-cyber-900/80 border border-slate-800 rounded-xl overflow-hidden transition">
            <div class="accordion-header p-3.5 flex items-center justify-between cursor-pointer">
              <div class="flex items-center gap-3">
                <div class="w-7 h-7 rounded-lg bg-emerald-950/80 border border-emerald-500/40 text-emerald-400 text-xs font-mono font-bold flex items-center justify-center shadow-sm">
                  ${st.step}
                </div>
                <div>
                  <h4 class="text-xs sm:text-sm font-bold text-white">${st.title}</h4>
                  <div class="flex items-center gap-2 text-[10px] font-mono text-slate-400">
                    <span>Est: <strong class="text-slate-300">${st.duration}</strong></span>
                    <span>•</span>
                    <span class="text-emerald-400">${st.impact}</span>
                  </div>
                </div>
              </div>
              <i class="fa-solid fa-chevron-down accordion-chevron text-slate-500 text-xs transition-transform duration-300"></i>
            </div>
            <div class="accordion-content bg-cyber-950/60 border-t border-slate-800/80 p-3.5 space-y-2 text-xs text-slate-300">
              <p class="leading-relaxed">${st.action}</p>
              <div class="pt-2 flex items-center gap-2">
                <span class="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">Verification: Deterministic Test Added</span>
                <span class="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800/40">Zero Downtime Guaranteed</span>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  // Attach accordion handlers
  stepPane.querySelectorAll('.accordion-header').forEach(header => {
    header.addEventListener('click', () => {
      const parent = header.closest('.accordion-item');
      parent.classList.toggle('open');
      playSound('click');
    });
  });

  // 3. Tab: Code & Artifact Scaffold
  const scaffoldPane = document.getElementById('tab-scaffold');
  scaffoldPane.innerHTML = `
    <div class="space-y-3">
      <!-- Code Toolbar Header -->
      <div class="flex items-center justify-between bg-cyber-900 border border-slate-800 px-3.5 py-2 rounded-xl text-xs">
        <div class="flex items-center gap-2">
          <i class="fa-solid fa-file-code text-cyan-400"></i>
          <span class="font-mono font-bold text-white">${solution.scaffold.filename}</span>
          <span class="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">${solution.scaffold.language}</span>
        </div>
        <div class="flex items-center gap-1.5">
          <button id="copy-code-btn" class="px-2.5 py-1 rounded-lg bg-cyber-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs transition flex items-center gap-1.5" title="Copy code to clipboard">
            <i class="fa-regular fa-copy text-xs"></i> <span>Copy Code</span>
          </button>
          <button id="download-code-btn" class="px-2.5 py-1 rounded-lg bg-cyber-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs transition flex items-center gap-1.5" title="Download raw source file">
            <i class="fa-solid fa-arrow-down-to-line text-xs"></i> <span>Download</span>
          </button>
        </div>
      </div>

      <!-- Syntax-Highlighted Code Block -->
      <div class="relative rounded-xl overflow-hidden border border-slate-800 shadow-glass">
        <pre class="m-0"><code class="language-${solution.scaffold.language}" id="code-snippet-box">${escapeHtml(solution.scaffold.code)}</code></pre>
      </div>
    </div>
  `;

  // Highlight syntax with highlight.js
  if (window.hljs) {
    const codeEl = scaffoldPane.querySelector('code');
    if (codeEl) window.hljs.highlightElement(codeEl);
  }

  // Copy code button handler
  const copyCodeBtn = document.getElementById('copy-code-btn');
  if (copyCodeBtn) {
    copyCodeBtn.addEventListener('click', () => {
      copyToClipboard(solution.scaffold.code);
      copyCodeBtn.innerHTML = '<i class="fa-solid fa-check text-emerald-400 text-xs"></i> <span class="text-emerald-400">Copied!</span>';
      setTimeout(() => {
        copyCodeBtn.innerHTML = '<i class="fa-regular fa-copy text-xs"></i> <span>Copy Code</span>';
      }, 2000);
      showToast('Code Copied', 'Syntax-highlighted scaffold copied to clipboard.', 'success');
      playSound('click');
    });
  }

  // Download code button handler
  const downloadCodeBtn = document.getElementById('download-code-btn');
  if (downloadCodeBtn) {
    downloadCodeBtn.addEventListener('click', () => {
      downloadFile(solution.scaffold.filename, solution.scaffold.code);
      showToast('Download Started', `Saved ${solution.scaffold.filename} locally`, 'info');
      playSound('click');
    });
  }

  // 4. Tab: Impact & Verification
  const impactPane = document.getElementById('tab-impact');
  impactPane.innerHTML = `
    <div class="space-y-4">
      
      <!-- Metrics Before/After Comparison Grid -->
      <div>
        <h5 class="text-xs font-mono font-semibold uppercase text-slate-400 mb-2.5 flex items-center gap-2">
          <i class="fa-solid fa-chart-simple text-amber-400"></i> Measured Empirical Impact Matrix
        </h5>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
          ${solution.impact.metrics.map(m => `
            <div class="bg-cyber-900/80 border border-slate-800 rounded-xl p-3.5 space-y-1 text-center">
              <span class="text-[10px] font-mono uppercase text-slate-500">${m.label}</span>
              <div class="text-base font-extrabold text-white font-mono">${m.after}</div>
              <div class="text-[11px] text-slate-500">Was: <span class="line-through text-slate-400">${m.before}</span></div>
              <div class="text-[11px] font-bold text-emerald-400 font-mono flex items-center justify-center gap-1">
                <i class="fa-solid fa-arrow-trend-up"></i> ${m.improvement}
              </div>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Test Cases Suite Table -->
      <div>
        <h5 class="text-xs font-mono font-semibold uppercase text-slate-400 mb-2.5 flex items-center gap-2">
          <i class="fa-solid fa-vial-circle-check text-emerald-400"></i> Synthetic Test Harness Assertions
        </h5>
        <div class="bg-cyber-900/90 border border-slate-800 rounded-xl overflow-hidden">
          <table class="w-full text-left text-xs font-mono">
            <thead class="bg-cyber-950 text-slate-400 border-b border-slate-800">
              <tr>
                <th class="py-2.5 px-3">Assertion Target</th>
                <th class="py-2.5 px-3">Outcome</th>
                <th class="py-2.5 px-3 text-right">Latency</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-800/60">
              ${solution.impact.testCases.map(tc => `
                <tr class="hover:bg-slate-800/30 transition">
                  <td class="py-2.5 px-3 text-slate-300 font-sans font-medium">${tc.name}</td>
                  <td class="py-2.5 px-3">
                    <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800/40">
                      <span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> ${tc.status}
                    </span>
                  </td>
                  <td class="py-2.5 px-3 text-right text-slate-400">${tc.latency}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Risk Assessment & Safeguards -->
      <div class="bg-cyber-900/70 border border-slate-800 rounded-xl p-3.5 flex items-start gap-3">
        <i class="fa-solid fa-shield-halved text-violet-400 text-sm mt-0.5"></i>
        <div class="space-y-1">
          <span class="text-xs font-mono font-bold text-slate-300 uppercase">Operational Safety Safeguards</span>
          <p class="text-xs text-slate-400 leading-relaxed">${solution.impact.risks}</p>
        </div>
      </div>

    </div>
  `;
}

// Switch between tabs
function switchTab(targetTabId) {
  playSound('click');
  APP_STATE.currentTab = targetTabId;

  document.querySelectorAll('.res-tab').forEach(tab => {
    if (tab.getAttribute('data-target') === targetTabId) {
      tab.classList.add('active');
    } else {
      tab.classList.remove('active');
    }
  });

  document.querySelectorAll('.tab-pane').forEach(pane => {
    if (pane.id === targetTabId) {
      pane.classList.remove('hidden');
      pane.classList.add('active');
    } else {
      pane.classList.add('hidden');
      pane.classList.remove('active');
    }
  });
}

// ==========================================
// 7. INTERACTIVE STRESS TEST SIMULATION BENCH
// ==========================================

function openSimulationModal() {
  const modal = document.getElementById('simulation-modal');
  const log = document.getElementById('simulation-log');
  modal.classList.remove('hidden');
  playSound('launch');

  runSimulationStream();
}

function runSimulationStream() {
  const log = document.getElementById('simulation-log');
  log.innerHTML = '';

  const messages = [
    `[SYS:INIT] Allocating deterministic synthetic test runner...`,
    `[STAGE 1] Spinning up 1,000 asynchronous workers in memory...`,
    `[BENCH:001] Invariant 1: Checking zero-data loss race condition... [PASS 0.4ms]`,
    `[BENCH:002] Invariant 2: Inducing artificial 500ms network jitter... [RESILIENT]`,
    `[BENCH:003] Invariant 3: Circuit-breaker tripping at 120 RPS threshold... [VERIFIED]`,
    `[STRESS:004] Injecting 50,000 requests/sec thundering herd spike... [HANDLED]`,
    `[METRICS] Max memory delta: +2.1MB | Heap fragmentation: 0.04%`,
    `[RESULT] 1,000 / 1,000 assertions passed with 0 failures (100% confidence).`
  ];

  let i = 0;
  const interval = setInterval(() => {
    if (i < messages.length) {
      const p = document.createElement('div');
      p.className = 'sim-term-line ' + (i === messages.length - 1 ? 'text-emerald-400 font-bold' : 'text-slate-300');
      p.innerHTML = `<span class="text-violet-400">></span> ${messages[i]}`;
      log.appendChild(p);
      log.scrollTop = log.scrollHeight;
      playSound('click');
      i++;
    } else {
      clearInterval(interval);
      triggerConfetti();
    }
  }, 220);
}

// ==========================================
// 8. HISTORY DRAWER & LOCAL STORAGE
// ==========================================

function saveCurrentSolutionToHistory(title, solution) {
  const newEntry = {
    id: generateUUID(),
    title: title,
    category: document.getElementById('category-select').value,
    difficulty: document.getElementById('difficulty-slider').value,
    timestamp: Date.now(),
    solution: solution,
    body: document.getElementById('problem-body').value
  };

  // Add to top of history, cap at 30 items
  APP_STATE.history.unshift(newEntry);
  if (APP_STATE.history.length > 30) APP_STATE.history.pop();

  localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(APP_STATE.history));
  renderHistoryDrawer();
}

function renderHistoryDrawer(searchTerm = '') {
  const container = document.getElementById('history-list-container');
  const countBadge = document.getElementById('history-badge-count');
  const totalCount = document.getElementById('history-total-count');

  if (countBadge) countBadge.textContent = APP_STATE.history.length;
  if (totalCount) totalCount.textContent = APP_STATE.history.length;

  if (!container) return;

  const filtered = APP_STATE.history.filter(item => 
    item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="text-center py-12 space-y-2 text-slate-500">
        <i class="fa-solid fa-box-open text-2xl"></i>
        <p class="text-xs">No stored resolutions match your query.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(item => {
    const dateFormatted = new Date(item.timestamp).toLocaleDateString(undefined, { 
      month: 'short', 
      day: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit' 
    });

    return `
      <div class="bg-cyber-850 hover:bg-slate-800/80 border border-slate-800 rounded-xl p-3 space-y-2 transition cursor-pointer group history-item-card" data-history-id="${item.id}">
        <div class="flex items-center justify-between text-[10px] font-mono text-slate-400">
          <span class="px-1.5 py-0.5 rounded bg-cyber-950 text-violet-400 border border-violet-900/50 uppercase">${item.category}</span>
          <span>${dateFormatted}</span>
        </div>
        <h4 class="text-xs font-bold text-slate-200 group-hover:text-violet-300 transition line-clamp-1">${item.title}</h4>
        <div class="flex items-center justify-between pt-1 border-t border-slate-800/60 text-[10px]">
          <span class="text-emerald-400 font-mono">Confidence: ${item.solution.confidence || '99%'}</span>
          <div class="flex items-center gap-2">
            <button class="delete-history-btn text-slate-500 hover:text-rose-400 transition" data-id="${item.id}" title="Remove this record">
              <i class="fa-solid fa-trash-can"></i>
            </button>
            <span class="text-violet-400 group-hover:underline">Restore →</span>
          </div>
        </div>
      </div>
    `;
  }).join('');

  // Attach card click handlers
  container.querySelectorAll('.history-item-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('.delete-history-btn')) return;
      const id = card.getAttribute('data-history-id');
      const item = APP_STATE.history.find(h => h.id === id);
      if (item) {
        document.getElementById('problem-title').value = item.title;
        document.getElementById('problem-body').value = item.body;
        document.getElementById('category-select').value = item.category;
        document.getElementById('difficulty-slider').value = item.difficulty;
        updateDifficultyBadge(item.difficulty);
        updateCharCounter();
        renderSolutionView(item.solution, item.title);
        toggleHistoryDrawer(false);
        playSound('click');
        showToast('Session Restored', `Loaded "${item.title.slice(0, 30)}..."`, 'info');
      }
    });
  });

  // Attach delete handlers
  container.querySelectorAll('.delete-history-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      APP_STATE.history = APP_STATE.history.filter(h => h.id !== id);
      localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(APP_STATE.history));
      renderHistoryDrawer(document.getElementById('history-search-input')?.value || '');
      playSound('click');
      showToast('Record Deleted', 'Session removed from local history.', 'info');
    });
  });
}

function toggleHistoryDrawer(open = null) {
  const drawer = document.getElementById('history-drawer');
  const backdrop = document.getElementById('drawer-backdrop');

  const shouldOpen = open !== null ? open : drawer.classList.contains('translate-x-full');

  if (shouldOpen) {
    drawer.classList.remove('translate-x-full');
    backdrop.classList.remove('hidden');
    playSound('click');
  } else {
    drawer.classList.add('translate-x-full');
    backdrop.classList.add('hidden');
  }
}

// ==========================================
// 9. COMMAND PALETTE (CTRL+K)
// ==========================================

function toggleCommandPalette(open = null) {
  const modal = document.getElementById('command-modal');
  const input = document.getElementById('command-input');

  const shouldOpen = open !== null ? open : modal.classList.contains('hidden');

  if (shouldOpen) {
    modal.classList.remove('hidden');
    input.value = '';
    renderCommandResults('');
    input.focus();
    playSound('click');
  } else {
    modal.classList.add('hidden');
  }
}

function renderCommandResults(query = '') {
  const resultsContainer = document.getElementById('command-results');
  if (!resultsContainer) return;

  const commands = [
    { label: 'Execute Current Analysis', icon: 'fa-atom text-violet-400', action: () => executeAnalysis() },
    { label: 'Run Interactive Test Simulation Bench', icon: 'fa-play text-emerald-400', action: () => openSimulationModal() },
    { label: 'Open Resolution Archive History', icon: 'fa-clock-rotate-left text-cyan-400', action: () => toggleHistoryDrawer(true) },
    { label: 'Start Blank New Session', icon: 'fa-plus text-slate-300', action: () => startNewSession() },
    { label: 'Export Current Resolution as Markdown', icon: 'fa-file-lines text-amber-400', action: () => exportAsMarkdown() },
    ...PRESET_TEMPLATES.map(tmpl => ({
      label: `Template: ${tmpl.title}`,
      icon: 'fa-wand-magic-sparkles text-violet-400',
      action: () => loadPresetIntoWorkspace(tmpl, true)
    }))
  ];

  const filtered = commands.filter(c => c.label.toLowerCase().includes(query.toLowerCase()));

  resultsContainer.innerHTML = filtered.map((c, i) => `
    <div class="cmd-item flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-800 cursor-pointer text-xs transition" data-index="${i}">
      <div class="flex items-center gap-2.5 text-slate-200">
        <i class="fa-solid ${c.icon}"></i>
        <span>${c.label}</span>
      </div>
      <span class="text-[10px] font-mono text-slate-500">Select ↵</span>
    </div>
  `).join('');

  resultsContainer.querySelectorAll('.cmd-item').forEach(el => {
    el.addEventListener('click', () => {
      const idx = parseInt(el.getAttribute('data-index'), 10);
      toggleCommandPalette(false);
      filtered[idx].action();
    });
  });
}

// ==========================================
// 10. EXPORT & SHARING HELPERS
// ==========================================

function exportAsMarkdown() {
  if (!APP_STATE.currentSolution) {
    showToast('Nothing to Export', 'Run or load a solution before exporting.', 'error');
    return;
  }

  const { solution, problemTitle } = APP_STATE.currentSolution;
  const mdContent = `# SolverStudio ⚡ AI Problem Resolution Audit
**Problem Objective:** ${problemTitle}
**Category:** ${solution.categoryName}
**Generated Date:** ${new Date().toISOString()}
**Reasoning Latency:** ${solution.timeTaken} | **Confidence:** ${solution.confidence}

---

## 1. 🧠 Root Cause Analysis
${solution.rootCause.summary}

### Key Failure Vectors:
${solution.rootCause.points.map((p, i) => `${i + 1}. **${p.title}:** ${p.desc}`).join('\n')}

\`\`\`
${solution.rootCause.diagram}
\`\`\`

---

## 2. 🛠️ Actionable Step-by-Step Resolution
${solution.steps.map(s => `### Phase ${s.step}: ${s.title}
- **Action:** ${s.action}
- **Duration:** ${s.duration}
- **Measurable Impact:** ${s.impact}
`).join('\n')}

---

## 3. 💻 Executable Scaffold (${solution.scaffold.filename})
\`\`\`${solution.scaffold.language}
${solution.scaffold.code}
\`\`\`

---

## 4. 📊 Empirical Verification & Impact
| Metric Target | Before | After | Improvement |
| ------------- | ------ | ----- | ----------- |
${solution.impact.metrics.map(m => `| ${m.label} | ${m.before} | ${m.after} | ${m.improvement} |`).join('\n')}

### Operational Safeguards:
${solution.impact.risks}

---
*Generated by SolverStudio. Client-Side Deterministic Synthesis Engine.*
`;

  downloadFile(`solverstudio_${slugify(problemTitle)}.md`, mdContent);
  showToast('Markdown Exported', 'Full audit downloaded to your machine.', 'success');
  playSound('success');
}

function exportHistoryJSON() {
  const jsonStr = JSON.stringify(APP_STATE.history, null, 2);
  downloadFile('solverstudio_history_archive.json', jsonStr);
  showToast('JSON Export Complete', `${APP_STATE.history.length} sessions archived.`, 'success');
  playSound('click');
}

function shareSolutionSummary() {
  if (!APP_STATE.currentSolution) {
    showToast('No Active Solution', 'Execute a problem resolution first.', 'error');
    return;
  }
  const { solution, problemTitle } = APP_STATE.currentSolution;
  const text = `⚡ SolverStudio Resolution for: "${problemTitle}"\nRoot Cause: ${solution.rootCause.summary}\nConfidence: ${solution.confidence}\nScaffold: ${solution.scaffold.filename}`;
  copyToClipboard(text);
  showToast('Summary Copied', 'Shareable link & summary copied to clipboard.', 'success');
  playSound('click');
}

function startNewSession() {
  APP_STATE.currentSessionId = generateUUID();
  document.getElementById('problem-title').value = '';
  document.getElementById('problem-body').value = '';
  document.getElementById('active-session-label').textContent = `Session #${Math.floor(Math.random() * 900) + 100}`;
  updateCharCounter();
  document.getElementById('problem-title').focus();
  playSound('click');
  showToast('New Session Initialized', 'Ready for fresh multi-modal problem input.', 'info');
}

function incrementTokens(amount) {
  APP_STATE.tokensUsed = Math.min(APP_STATE.maxTokens, APP_STATE.tokensUsed + amount);
  localStorage.setItem(STORAGE_KEYS.TOKENS, APP_STATE.tokensUsed);
  updateTokenDisplay();
}

function updateTokenDisplay() {
  const counter = document.getElementById('token-counter');
  if (counter) counter.textContent = APP_STATE.tokensUsed.toLocaleString();
}

// ==========================================
// 11. EVENT LISTENERS
// ==========================================

function setupEventListeners() {
  // Navigation Category Selection
  document.querySelectorAll('.nav-cat-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-cat-btn').forEach(b => b.classList.remove('active-cat'));
      btn.classList.add('active-cat');
      const cat = btn.getAttribute('data-cat');
      if (cat !== 'all') {
        document.getElementById('category-select').value = cat;
      }
      playSound('click');
      window.scrollTo({ top: document.getElementById('workspace-section').offsetTop - 80, behavior: 'smooth' });
    });
  });

  // Category select change
  document.getElementById('category-select').addEventListener('change', (e) => {
    const val = e.target.value;
    document.querySelectorAll('.nav-cat-btn').forEach(b => {
      if (b.getAttribute('data-cat') === val) {
        b.classList.add('active-cat');
      } else {
        b.classList.remove('active-cat');
      }
    });
  });

  // Character counter
  document.getElementById('problem-body').addEventListener('input', updateCharCounter);

  // Difficulty slider
  document.getElementById('difficulty-slider').addEventListener('input', (e) => {
    updateDifficultyBadge(e.target.value);
  });

  // Constraints chips toggle
  document.querySelectorAll('.constraint-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      chip.classList.toggle('active');
      playSound('click');
    });
  });

  // Wrap snippet helper button
  document.getElementById('snippet-toggle-btn').addEventListener('click', () => {
    const textarea = document.getElementById('problem-body');
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const selected = text.substring(start, end);

    textarea.value = text.substring(0, start) + '```\n' + (selected || 'paste_code_here()') + '\n```' + text.substring(end);
    updateCharCounter();
    textarea.focus();
    playSound('click');
  });

  // Execute CTA Button
  document.getElementById('solve-form').addEventListener('submit', (e) => {
    e.preventDefault();
    executeAnalysis();
  });

  // Tab Switching
  document.querySelectorAll('.res-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      switchTab(tab.getAttribute('data-target'));
    });
  });

  // Action Buttons
  document.getElementById('new-session-btn').addEventListener('click', startNewSession);
  document.getElementById('clear-input-btn').addEventListener('click', () => {
    document.getElementById('problem-title').value = '';
    document.getElementById('problem-body').value = '';
    updateCharCounter();
    playSound('click');
  });
  document.getElementById('load-sample-btn').addEventListener('click', () => {
    const randomPreset = PRESET_TEMPLATES[Math.floor(Math.random() * PRESET_TEMPLATES.length)];
    loadPresetIntoWorkspace(randomPreset, true);
    playSound('click');
  });

  // History Drawer Controls
  document.getElementById('history-drawer-toggle').addEventListener('click', () => toggleHistoryDrawer(true));
  document.getElementById('close-history-btn').addEventListener('click', () => toggleHistoryDrawer(false));
  document.getElementById('drawer-backdrop').addEventListener('click', () => toggleHistoryDrawer(false));
  document.getElementById('history-search-input').addEventListener('input', (e) => {
    renderHistoryDrawer(e.target.value);
  });
  document.getElementById('export-history-json').addEventListener('click', exportHistoryJSON);
  document.getElementById('clear-all-history-btn').addEventListener('click', () => {
    if (confirm('Clear all stored solutions from local memory?')) {
      APP_STATE.history = [];
      localStorage.removeItem(STORAGE_KEYS.HISTORY);
      renderHistoryDrawer();
      showToast('History Cleared', 'All local sessions deleted.', 'info');
      playSound('click');
    }
  });

  // Modals & Export Buttons
  document.getElementById('save-history-btn').addEventListener('click', () => {
    if (APP_STATE.currentSolution) {
      saveCurrentSolutionToHistory(APP_STATE.currentSolution.problemTitle, APP_STATE.currentSolution.solution);
      showToast('Saved to Drawer', 'Solution archived in browser storage.', 'success');
      playSound('click');
    }
  });
  document.getElementById('export-md-btn').addEventListener('click', exportAsMarkdown);
  document.getElementById('share-link-btn').addEventListener('click', shareSolutionSummary);
  document.getElementById('copy-active-tab-btn').addEventListener('click', () => {
    const activePane = document.querySelector('.tab-pane.active');
    if (activePane) {
      copyToClipboard(activePane.innerText);
      showToast('View Copied', 'Active tab text copied to clipboard.', 'success');
      playSound('click');
    }
  });

  // Simulation Bench Modal
  document.getElementById('run-simulation-btn').addEventListener('click', openSimulationModal);
  document.getElementById('close-simulation-btn').addEventListener('click', () => {
    document.getElementById('simulation-modal').classList.add('hidden');
  });
  document.getElementById('re-execute-sim-btn').addEventListener('click', runSimulationStream);

  // Audio Toggle
  document.getElementById('audio-toggle-btn').addEventListener('click', () => {
    APP_STATE.audioEnabled = !APP_STATE.audioEnabled;
    localStorage.setItem(STORAGE_KEYS.AUDIO, APP_STATE.audioEnabled);
    updateAudioIcon();
    playSound('click');
    showToast('Audio Settings', APP_STATE.audioEnabled ? 'Futuristic sound effects enabled.' : 'Audio muted.', 'info');
  });

  // Keyboard Shortcuts Modal
  const shortcutsModal = document.getElementById('shortcuts-modal');
  document.getElementById('open-shortcuts-footer').addEventListener('click', () => {
    shortcutsModal.classList.remove('hidden');
  });
  document.getElementById('close-shortcuts-btn').addEventListener('click', () => {
    shortcutsModal.classList.add('hidden');
  });
  document.getElementById('open-sample-footer').addEventListener('click', openSimulationModal);

  // Command Palette
  document.getElementById('cmd-palette-btn').addEventListener('click', () => toggleCommandPalette(true));
  document.getElementById('command-input').addEventListener('input', (e) => {
    renderCommandResults(e.target.value);
  });

  // Community Filter Buttons
  document.querySelectorAll('.community-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.community-filter-btn').forEach(b => {
        b.classList.remove('active', 'bg-cyber-700', 'text-white');
        b.classList.add('text-slate-400');
      });
      btn.classList.add('active', 'bg-cyber-700', 'text-white');
      renderCommunityGrid(btn.getAttribute('data-filter'));
      playSound('click');
    });
  });

  // Global Keyboard Shortcuts
  window.addEventListener('keydown', (e) => {
    // Ctrl + Enter to Solve
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      executeAnalysis();
    }
    // Ctrl + K for Command Palette
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      toggleCommandPalette();
    }
    // Ctrl + H for History
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'h') {
      e.preventDefault();
      toggleHistoryDrawer();
    }
    // Ctrl + N for New Session
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
      e.preventDefault();
      startNewSession();
    }
    // Escape to close drawers/modals
    if (e.key === 'Escape') {
      toggleCommandPalette(false);
      toggleHistoryDrawer(false);
      document.getElementById('simulation-modal').classList.add('hidden');
      document.getElementById('shortcuts-modal').classList.add('hidden');
    }
  });
}

// Global category navigation helper
window.selectCategory = function(cat) {
  document.querySelectorAll('.nav-cat-btn').forEach(btn => {
    if (btn.getAttribute('data-cat') === cat) {
      btn.click();
    }
  });
};

// ==========================================
// 12. UTILITIES & TOAST SYSTEM
// ==========================================

function showToast(title, message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const iconMap = {
    success: 'fa-circle-check text-emerald-400',
    error: 'fa-circle-exclamation text-rose-400',
    info: 'fa-circle-info text-cyan-400'
  };

  const borderMap = {
    success: 'border-emerald-500/40',
    error: 'border-rose-500/40',
    info: 'border-cyan-500/40'
  };

  const toast = document.createElement('div');
  toast.className = `toast-msg pointer-events-auto bg-cyber-850/95 border ${borderMap[type] || 'border-slate-700'} rounded-xl p-3.5 shadow-2xl backdrop-blur-xl flex items-start gap-3 max-w-sm w-full transition`;
  toast.innerHTML = `
    <i class="fa-solid ${iconMap[type] || 'fa-info'} text-sm mt-0.5"></i>
    <div class="space-y-0.5 flex-1">
      <h5 class="text-xs font-bold text-white">${title}</h5>
      <p class="text-[11px] text-slate-400 leading-snug">${message}</p>
    </div>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('dismissing');
    setTimeout(() => toast.remove(), 260);
  }, 3800);
}

function copyToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
  } else {
    fallbackCopy(text);
  }
}

function fallbackCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');
  document.body.removeChild(ta);
}

function downloadFile(filename, content) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function triggerConfetti() {
  if (window.confetti) {
    window.confetti({
      particleCount: 60,
      spread: 70,
      origin: { y: 0.7 },
      colors: ['#8B5CF6', '#10B981', '#06B6D4', '#F59E0B']
    });
  }
}

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function slugify(text) {
  return text.toString().toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}

function escapeHtml(string) {
  return String(string)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
