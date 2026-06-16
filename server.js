import express from "express";
import pg from "pg";
import jwt from "jsonwebtoken";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { pbkdf2Sync, randomBytes, randomUUID } from "crypto";
import fs from "fs";
import { spawn } from "child_process";
import { rm, mkdir } from "fs/promises";
import { tmpdir } from "os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;

// ── Database ──
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS state (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at INTEGER DEFAULT EXTRACT(EPOCH FROM NOW())::INTEGER
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS state_log (
      id BIGSERIAL PRIMARY KEY,
      key TEXT NOT NULL,
      updated_at INTEGER DEFAULT EXTRACT(EPOCH FROM NOW())::INTEGER
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id TEXT PRIMARY KEY,
      user_id BIGINT NOT NULL,
      expires_at INTEGER NOT NULL
    )
  `);
  // Migrate pre-existing deployments: user ids are Date.now() timestamps (13 digits),
  // which overflow the old INTEGER column (max ~2.1bn) and fail every new user's login.
  await pool.query("ALTER TABLE refresh_tokens ALTER COLUMN user_id TYPE BIGINT");
  await pool.query("DELETE FROM refresh_tokens WHERE expires_at < EXTRACT(EPOCH FROM NOW())::INTEGER");
}

// ── Password helpers ──
// New format: "pbkdf2:<salt>:<hash>"
// Legacy format (btoa): anything that doesn't start with "pbkdf2:"
const LEGACY_PREFIX = "_hashed_salt_2024";

function hashPassword(plain) {
  const salt = randomBytes(16).toString("hex");
  const hash = pbkdf2Sync(plain, salt, 100000, 32, "sha256").toString("hex");
  return `pbkdf2:${salt}:${hash}`;
}

function verifyPassword(plain, stored) {
  if (stored.startsWith("pbkdf2:")) {
    const [, salt, hash] = stored.split(":");
    const attempt = pbkdf2Sync(plain, salt, 100000, 32, "sha256").toString("hex");
    // Constant-time compare
    const a = Buffer.from(attempt, "hex");
    const b = Buffer.from(hash, "hex");
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
    return diff === 0;
  }
  // Legacy: btoa(plain + "_hashed_salt_2024")
  const legacy = Buffer.from(plain + LEGACY_PREFIX).toString("base64");
  return legacy === stored;
}

// ── Access control map ──
// "public"  — accessible without login (board mode only, GET only)
// "all"     — any authenticated user
// "manager" — manager, admin, owner
// "admin"   — admin, owner only
// Note: dk_client_orders and dk_products used to be "public" for board mode,
// but generic /api/state/:key returns the full JSON blob — which leaked
// financial fields (costPrice, sellPrice), tech cards, internal notes, etc.
// Board mode now reads via dedicated /api/board/* endpoints that return
// sanitized DTOs. Public read is no longer allowed on these keys.
// Worker writes are routed through /api/actions/* (task-complete, task-start,
// output-record, attendance-mark, notifications/read, log). Those helpers call
// writeState() directly, which bypasses KEY_ACCESS — so tightening the write
// levels below does NOT break worker flows, only generic /api/state writes.
const KEY_ACCESS = {
  dk_client_orders:   { read: "manager", write: "manager" },
  dk_products:        { read: "all",     write: "manager" },
  dk_tasks:           { read: "all",    write: "manager" },
  dk_task_emps:       { read: "all",    write: "manager" },
  dk_marks:           { read: "all",    write: "manager" },
  dk_notifications:   { read: "all",    write: "manager" },
  dk_prod_outputs:    { read: "all",    write: "manager" },
  dk_batches:         { read: "all",    write: "manager" },
  dk_emp_hist:        { read: "all",    write: "manager" },
  dk_prod_plans:      { read: "manager",write: "manager" },
  dk_defects:         { read: "manager",write: "manager" },
  dk_raw_mats:        { read: "manager",write: "manager" },
  dk_raw_movements:   { read: "manager",write: "manager" },
  dk_recipes:         { read: "manager",write: "manager" },
  dk_deliveries:      { read: "manager",write: "manager" },
  dk_suppliers:       { read: "manager",write: "manager" },
  dk_clients:         { read: "manager",write: "manager" },
  dk_sales:           { read: "manager",write: "manager" },
  dk_inv_move:        { read: "manager",write: "manager" },
  dk_debts:           { read: "manager",write: "manager" },
  dk_payroll:         { read: "manager",write: "manager" },
  dk_base_salaries:   { read: "manager", write: "manager" },
  dk_users:           { read: "all",    write: "admin"   },
  dk_logs:            { read: "admin",  write: "admin"   },
  dk_bonus_rules:     { read: "manager",write: "admin"   },
  dk_cameras:         { read: "manager",write: "manager" },
  dk_nav_layout:      { read: "all",    write: "admin"   },
};

// Role hierarchy: which level satisfies which requirement
function roleLevel(roleId) {
  // 1=admin, 2=manager, 3=worker, 4=owner
  if (roleId === 1 || roleId === 4) return "admin";
  if (roleId === 2) return "manager";
  return "worker"; // roleId === 3
}

function satisfies(userRoleId, required) {
  if (required === "public") return true;
  if (!userRoleId) return false;
  const level = roleLevel(userRoleId);
  if (required === "all") return true;
  if (required === "manager") return level === "manager" || level === "admin";
  if (required === "admin") return level === "admin";
  return false;
}

function requireManagerLike(req, res, next) {
  const lvl = roleLevel(req.user.roleId);
  if (lvl === "admin" || lvl === "manager") return next();
  return res.status(403).json({ error: "Недостаточно прав" });
}

function toHHMM(iso) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function sanitizeUsers(users = []) {
  return users.map(u => {
    const { password: _p, ...rest } = u;
    return rest;
  });
}

// ── App ──
const app = express();
app.use(express.json({ limit: "10mb" }));

// ── JWT config ──
const ACCESS_SECRET  = process.env.JWT_ACCESS_SECRET  || "dikanish-access-secret-change-in-prod";
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "dikanish-refresh-secret-change-in-prod";
const ACCESS_COOKIE_OPTS  = { httpOnly: true, sameSite: "lax", maxAge: 15 * 60 * 1000 };            // 15 min
const REFRESH_COOKIE_OPTS = { httpOnly: true, sameSite: "lax", maxAge: 30 * 24 * 60 * 60 * 1000 };  // 30 days

// Cookie helper — no extra package needed
function getCookie(req, name) {
  const header = req.headers.cookie || "";
  for (const pair of header.split(";")) {
    const [k, ...rest] = pair.trim().split("=");
    if (k === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

// JWT middleware — parses access_token cookie and sets req.user if valid
app.use((req, _res, next) => {
  const token = getCookie(req, "access_token");
  if (token) {
    try {
      const payload = jwt.verify(token, ACCESS_SECRET);
      req.user = { userId: payload.userId, roleId: payload.roleId };
    } catch {}
  }
  next();
});

// Serve built React app
const distDir = join(__dirname, "dist");
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
}

// ── Board mode: check via query param ──
// Board requests carry ?board=1 — server grants them read-only access to orders only.
function isBoardRequest(req) {
  return req.query.board === "1";
}

// ── Auth middleware ──
function requireAuth(req, res, next) {
  if (req.user) return next();
  res.status(401).json({ error: "Не авторизован" });
}

function checkKeyAccess(req, res, next) {
  const key = req.params.key;
  const access = KEY_ACCESS[key];

  // Unknown key: only admin can access
  const required = access
    ? (req.method === "GET" ? access.read : access.write)
    : "admin";

  // Board mode: only GET on dk_client_orders (public)
  if (isBoardRequest(req)) {
    if (req.method === "GET" && required === "public") return next();
    return res.status(403).json({ error: "Доступ запрещён" });
  }

  // Normal authenticated access
  if (!req.user) {
    return res.status(401).json({ error: "Не авторизован" });
  }

  if (!satisfies(req.user.roleId, required)) {
    return res.status(403).json({ error: "Недостаточно прав" });
  }

  // Extra: dk_users GET — strip password field before sending
  req._stripPasswords = (key === "dk_users" && req.method === "GET" && roleLevel(req.user.roleId) !== "admin");

  next();
}

// ── AUTH ENDPOINTS ──

// POST /api/auth/login
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Укажите email и пароль" });

    const users = await readState("dk_users");
    if (!users) return res.status(401).json({ error: "Пользователи не найдены" });

    const user = users.find(u => u.email === email);
    if (!user) return res.status(401).json({ error: "Неверный email или пароль" });
    if (user.status === "blocked") return res.status(403).json({ error: "Аккаунт заблокирован" });
    if (!verifyPassword(password, user.password)) return res.status(401).json({ error: "Неверный email или пароль" });

    // Lazy migration: if legacy password, upgrade to pbkdf2 on successful login
    if (!user.password.startsWith("pbkdf2:")) {
      const newHash = hashPassword(password);
      const updated = users.map(u => u.id === user.id ? { ...u, password: newHash } : u);
      await pool.query(
        "UPDATE state SET value = $1, updated_at = EXTRACT(EPOCH FROM NOW())::INTEGER WHERE key = 'dk_users'",
        [JSON.stringify(updated)]
      );
    }

    // Issue access token (15 min) and refresh token (30 days)
    const accessToken = jwt.sign({ userId: user.id, roleId: user.roleId }, ACCESS_SECRET, { expiresIn: "15m" });
    const jti = randomUUID();
    const refreshExpiresAt = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
    const refreshToken = jwt.sign({ userId: user.id, roleId: user.roleId, jti }, REFRESH_SECRET, { expiresIn: "30d" });
    await pool.query(
      "INSERT INTO refresh_tokens (id, user_id, expires_at) VALUES ($1, $2, $3)",
      [jti, user.id, refreshExpiresAt]
    );

    res.cookie("access_token",  accessToken,  ACCESS_COOKIE_OPTS);
    res.cookie("refresh_token", refreshToken, REFRESH_COOKIE_OPTS);

    // Return safe user object (no password)
    const { password: _pw, ...safeUser } = user;
    res.json(safeUser);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/auth/logout
app.post("/api/auth/logout", async (req, res) => {
  const token = getCookie(req, "refresh_token");
  if (token) {
    try {
      const payload = jwt.verify(token, REFRESH_SECRET);
      await pool.query("DELETE FROM refresh_tokens WHERE id = $1", [payload.jti]);
    } catch {}
  }
  res.clearCookie("access_token");
  res.clearCookie("refresh_token");
  res.json({ ok: true });
});

// GET /api/auth/me — returns current user; silently refreshes access token if needed
app.get("/api/auth/me", async (req, res) => {
  try {
    const users = await readState("dk_users") || [];

    // Fast path: valid access token already parsed by middleware
    if (req.user) {
      const user = users.find(u => u.id === req.user.userId);
      if (!user) return res.status(401).json({ error: "Пользователь не найден" });
      if (user.status === "blocked") return res.status(403).json({ error: "Аккаунт заблокирован" });
      // If role was changed by admin, issue a fresh access token
      if (user.roleId !== req.user.roleId) {
        const newAccess = jwt.sign({ userId: user.id, roleId: user.roleId }, ACCESS_SECRET, { expiresIn: "15m" });
        res.cookie("access_token", newAccess, ACCESS_COOKIE_OPTS);
      }
      const { password: _pw, ...safeUser } = user;
      return res.json(safeUser);
    }

    // Slow path: access token missing/expired — try the refresh token
    const refreshRaw = getCookie(req, "refresh_token");
    if (refreshRaw) {
      const payload = jwt.verify(refreshRaw, REFRESH_SECRET); // throws if invalid/expired
      const stored = (await pool.query("SELECT * FROM refresh_tokens WHERE id = $1", [payload.jti])).rows[0];
      if (!stored) return res.status(401).json({ error: "Сессия истекла" });
      const user = users.find(u => u.id === payload.userId);
      if (!user) return res.status(401).json({ error: "Пользователь не найден" });
      if (user.status === "blocked") return res.status(403).json({ error: "Аккаунт заблокирован" });
      // Issue new access token
      const newAccess = jwt.sign({ userId: user.id, roleId: user.roleId }, ACCESS_SECRET, { expiresIn: "15m" });
      res.cookie("access_token", newAccess, ACCESS_COOKIE_OPTS);
      const { password: _pw, ...safeUser } = user;
      return res.json(safeUser);
    }

    res.status(401).json({ error: "Не авторизован" });
  } catch (e) {
    res.status(401).json({ error: "Сессия истекла" });
  }
});

// POST /api/auth/refresh — issue new access token using refresh token cookie
app.post("/api/auth/refresh", async (req, res) => {
  const token = getCookie(req, "refresh_token");
  if (!token) return res.status(401).json({ error: "Нет refresh токена" });
  try {
    const payload = jwt.verify(token, REFRESH_SECRET);
    const stored = (await pool.query("SELECT * FROM refresh_tokens WHERE id = $1", [payload.jti])).rows[0];
    if (!stored) return res.status(401).json({ error: "Refresh токен отозван" });
    const users = await readState("dk_users") || [];
    const user = users.find(u => u.id === payload.userId);
    if (!user || user.status === "blocked") {
      await pool.query("DELETE FROM refresh_tokens WHERE id = $1", [payload.jti]);
      return res.status(401).json({ error: "Пользователь недоступен" });
    }
    const newAccess = jwt.sign({ userId: user.id, roleId: user.roleId }, ACCESS_SECRET, { expiresIn: "15m" });
    res.cookie("access_token", newAccess, ACCESS_COOKIE_OPTS);
    res.json({ ok: true });
  } catch {
    res.status(401).json({ error: "Refresh токен истёк" });
  }
});

// POST /api/auth/change-password — admin only
app.post("/api/auth/change-password", requireAuth, async (req, res) => {
  if (roleLevel(req.user.roleId) !== "admin") {
    return res.status(403).json({ error: "Только для администратора" });
  }
  try {
    const { userId, newPassword } = req.body;
    if (!userId || !newPassword || newPassword.length < 4) {
      return res.status(400).json({ error: "Укажите userId и пароль (мин. 4 символа)" });
    }
    const users = await readState("dk_users");
    if (!users) return res.status(404).json({ error: "Пользователи не найдены" });
    const idx = users.findIndex(u => u.id === userId);
    if (idx === -1) return res.status(404).json({ error: "Пользователь не найден" });
    users[idx].password = hashPassword(newPassword);
    await pool.query(
      "UPDATE state SET value = $1, updated_at = EXTRACT(EPOCH FROM NOW())::INTEGER WHERE key = 'dk_users'",
      [JSON.stringify(users)]
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── DB helpers ──
async function readState(key, client = pool) {
  const result = await client.query("SELECT value FROM state WHERE key = $1", [key]);
  return result.rows[0] ? JSON.parse(result.rows[0].value) : null;
}

async function writeState(key, value, client = pool) {
  await client.query(
    `INSERT INTO state (key, value, updated_at)
     VALUES ($1, $2, EXTRACT(EPOCH FROM NOW())::INTEGER)
     ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXTRACT(EPOCH FROM NOW())::INTEGER`,
    [key, JSON.stringify(value)]
  );
  await client.query("INSERT INTO state_log (key) VALUES ($1)", [key]);
}

async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

// ── Server-side applyOutput (mirrors frontend applyOutput logic) ──
// Mutates state object in-place and returns it.
function serverApplyOutput(state, out) {
  const { productId, employeeId, quantity, date, id } = out;
  const ds = date.slice(0, 10);

  // 1. Update product stock
  state.dk_products = (state.dk_products || []).map(p =>
    p.id === productId ? { ...p, stock: p.stock + quantity, updatedAt: new Date().toISOString() } : p
  );
  const newBalance = (state.dk_products.find(p => p.id === productId)?.stock) || 0;

  // 2. Inventory movement
  state.dk_inv_move = [...(state.dk_inv_move || []), {
    id: id + 0.1, productId, type: "output", quantity, balance: newBalance,
    refId: `output-${id}`, createdAt: date,
  }];

  // 3. Raw material deduction
  const recipe = (state.dk_recipes || []).find(r => r.productId === productId);
  if (recipe?.items?.length) {
    state.dk_raw_mats = (state.dk_raw_mats || []).map(rm => {
      const item = recipe.items.find(i => i.rawId === rm.id);
      if (!item) return rm;
      return { ...rm, stock: Math.max(0, +(rm.stock - item.qty * quantity).toFixed(4)), updatedAt: new Date().toISOString() };
    });
    state.dk_raw_movements = [...(state.dk_raw_movements || []), ...recipe.items.map(item => ({
      id: Date.now() + Math.random(), rawId: item.rawId, type: "расход",
      quantity: +(item.qty * quantity).toFixed(4),
      refId: `output-${id}`, note: `Выпуск: ${quantity} ед. #${productId}`, createdAt: date,
    }))];
  }

  // 4. Employee history (upsert by employeeId+date)
  const empHist = state.dk_emp_hist || [];
  const ex = empHist.find(h => h.employeeId === employeeId && h.date === ds);
  state.dk_emp_hist = ex
    ? empHist.map(h => h.id === ex.id ? { ...h, producedQty: h.producedQty + quantity } : h)
    : [...empHist, { id: Date.now() + Math.random(), employeeId, date: ds, attendance: "present", tasksCompleted: 0, producedQty: quantity, comment: "" }];

  // 5. Production plans progress
  state.dk_prod_plans = (state.dk_prod_plans || []).map(pl => {
    if (pl.productId === productId && pl.productionDate === ds && pl.status !== "отменён") {
      const nc = Math.min(pl.plannedQty, pl.completedQty + quantity);
      return { ...pl, completedQty: nc, status: nc >= pl.plannedQty ? "выполнен" : "в процессе" };
    }
    return pl;
  });

  return state;
}

const idEq = (a, b) => Number(a) === Number(b);
const taskHasUser = (task, userId) => (task.userIds || []).some(uid => idEq(uid, userId));
const findTaskById = (tasks, taskId) => tasks.find(t => idEq(t.id, taskId));

// ── ACTION ENDPOINTS ──
// These allow workers to trigger complex multi-key updates atomically on the server,
// bypassing the per-key write restrictions that exist in /api/state/:key.

// POST /api/actions/task-complete
// Any authenticated user assigned to the task can complete it.
// Workers: must be in task.userIds. Manager/admin: any task.
app.post("/api/actions/task-complete", requireAuth, async (req, res) => {
  const { taskId, quantities } = req.body || {};
  const tid = Number(taskId);
  // quantities: { [userId: string]: number }
  if (!Number.isFinite(tid) || !quantities || typeof quantities !== "object") {
    return res.status(400).json({ error: "Укажите taskId и quantities" });
  }

  try {
    const result = await withTransaction(async (client) => {
      const tasks = await readState("dk_tasks", client) || [];
      const taskEmps = await readState("dk_task_emps", client) || [];
      const prodOutputs = await readState("dk_prod_outputs", client) || [];
      const batches = await readState("dk_batches", client) || [];

      // Validate task
      const task = findTaskById(tasks, tid);
      if (!task) throw { status: 404, message: "Задание не найдено" };
      if (task.status === "завершено" || task.status === "просрочено") {
        throw { status: 409, message: "Задание уже завершено" };
      }
      const existingOutputs = prodOutputs.filter(o => idEq(o.taskId, tid));
      const existingTotal = existingOutputs.reduce((s, o) => s + (+o.quantity || 0), 0);
      if (existingTotal >= task.quantity - 0.001) {
        throw { status: 409, message: "Выпуск для этого задания уже создан" };
      }

      // Worker authorization: must be assigned to this task
      const isWorkerRole = roleLevel(req.user.roleId) === "worker";
      const uid = Number(req.user.userId);
      if (isWorkerRole && !taskHasUser(task, uid)) {
        throw { status: 403, message: "Вы не назначены на это задание" };
      }

      // Validate quantities: all UIDs must be on the task, sum must match
      const qEntries = Object.entries(quantities)
        .map(([uid, qty]) => [+uid, +qty])
        .filter(([, qty]) => qty > 0);
      const totalQty = qEntries.reduce((s, [, q]) => s + q, 0);
      const remainingQty = task.quantity - existingTotal;
      if (Math.abs(totalQty - remainingQty) > 0.001 && Math.abs(totalQty - task.quantity) > 0.001) {
        throw { status: 400, message: `Сумма ${totalQty} должна равняться ${remainingQty > 0 ? remainingQty : task.quantity}` };
      }
      for (const [uid] of qEntries) {
        if (!taskHasUser(task, uid)) {
          throw { status: 400, message: `Пользователь ${uid} не назначен на задание` };
        }
      }

      const now = new Date().toISOString();
      const isLate = new Date(now) > new Date(task.deadline);
      const newStatus = isLate ? "просрочено" : "завершено";

      // Update task and taskEmployee statuses
      const updatedTasks = tasks.map(t =>
        idEq(t.id, tid) ? { ...t, status: newStatus, completedAt: now } : t
      );
      const updatedTaskEmps = taskEmps.map(te => {
        if (!idEq(te.taskId, tid)) return te;
        const qty = quantities[String(te.employeeId)];
        return { ...te, producedQty: qty != null ? +qty : te.producedQty, status: newStatus };
      });

      // Create one batch for the whole task (skip if partial outputs already created one)
      const hasBatch = batches.some(b => idEq(b.taskId, tid));
      const sharedBatchId = tid + 0.5;
      const expiresAt = new Date(new Date(now).getTime() + 7 * 24 * 3600 * 1000).toISOString();
      const newBatch = !hasBatch ? {
        id: sharedBatchId, productId: task.productId, quantity: task.quantity,
        producedAt: now, expiresAt, createdBy: uid,
        status: "активна", note: task.note || "", taskId: tid,
      } : null;

      // Create one productionOutput per worker + apply derived state
      const newOutputs = [];
      let firstWorker = true;
      let state = {
        dk_products:       await readState("dk_products", client)       || [],
        dk_inv_move:       await readState("dk_inv_move", client)       || [],
        dk_raw_mats:       await readState("dk_raw_mats", client)       || [],
        dk_raw_movements:  await readState("dk_raw_movements", client)  || [],
        dk_emp_hist:       await readState("dk_emp_hist", client)       || [],
        dk_prod_plans:     await readState("dk_prod_plans", client)     || [],
        dk_recipes:        await readState("dk_recipes", client)        || [],
      };

      for (const [uid, qty] of qEntries) {
        const outId = Date.now() + Math.random();
        const out = {
          id: outId, productId: task.productId, employeeId: uid, quantity: qty,
          date: now, taskId: tid, source: "task",
          batchId: firstWorker && !hasBatch ? sharedBatchId : null,
          comment: task.note || "", createdAt: now, createdBy: uid,
        };
        newOutputs.push(out);
        state = serverApplyOutput(state, out);
        firstWorker = false;
      }

      // Notifications and log
      const users = await readState("dk_users", client) || [];
      const product = state.dk_products.find(p => p.id === task.productId) || {};
      const actor = users.find(u => u.id === req.user.userId);
      const actorName = actor?.name?.split(" ").slice(0, 2).join(" ") || "Работник";
      const workerNames = qEntries.map(([uid]) =>
        users.find(u => u.id === uid)?.name?.split(" ").slice(0, 2).join(" ") || "?"
      ).join(", ");

      const notifications = await readState("dk_notifications", client) || [];
      const logs = await readState("dk_logs", client) || [];
      const newNotif = {
        id: Date.now() + Math.random(),
        title: `Задание ${isLate ? "просрочено" : "выполнено"}: ${product.name || ""}`,
        type: isLate ? "ошибка" : "информация",
        content: `${workerNames} ${isLate ? "просрочили" : "завершили"}: ${product.name || ""} x${task.quantity}`,
        createdBy: req.user.userId, createdAt: now,
        readBy: [req.user.userId], targetAll: true, targetUsers: [],
      };
      const newLog = {
        id: Date.now(), userId: req.user.userId, userName: actorName,
        message: `Завершено: ${product.name || ""} x${task.quantity}${isLate ? " (просрочено)" : ""}`,
        date: now,
      };

      const finalOutputs = [...prodOutputs, ...newOutputs];
      const finalBatches = newBatch ? [...batches, newBatch] : batches;
      const finalNotifs = [...notifications, newNotif];
      const finalLogs = [...logs, newLog];

      // Write all atomically
      await writeState("dk_tasks",         updatedTasks,          client);
      await writeState("dk_task_emps",     updatedTaskEmps,       client);
      await writeState("dk_prod_outputs",  finalOutputs,          client);
      if (newBatch) await writeState("dk_batches", finalBatches, client);
      await writeState("dk_products",      state.dk_products,     client);
      await writeState("dk_inv_move",      state.dk_inv_move,     client);
      await writeState("dk_raw_mats",      state.dk_raw_mats,     client);
      await writeState("dk_raw_movements", state.dk_raw_movements,client);
      await writeState("dk_emp_hist",      state.dk_emp_hist,     client);
      await writeState("dk_prod_plans",    state.dk_prod_plans,   client);
      await writeState("dk_notifications", finalNotifs,           client);
      await writeState("dk_logs",          finalLogs,             client);

      return {
        dk_tasks:         updatedTasks,
        dk_task_emps:     updatedTaskEmps,
        dk_prod_outputs:  finalOutputs,
        dk_batches:       finalBatches,
        dk_products:      state.dk_products,
        dk_raw_mats:      state.dk_raw_mats,
        dk_emp_hist:      state.dk_emp_hist,
        dk_prod_plans:    state.dk_prod_plans,
        dk_inv_move:      state.dk_inv_move,
        dk_raw_movements: state.dk_raw_movements,
        dk_notifications: finalNotifs,
        dk_logs:          finalLogs,
      };
    });

    res.json({ ok: true, state: result });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: e.message });
    console.error("[task-complete]", e);
    res.status(500).json({ error: e.message });
  }
});

// POST /api/actions/task-complete-self
// Worker submits only their own partial quantity for a shared task.
app.post("/api/actions/task-complete-self", requireAuth, async (req, res) => {
  const { taskId, quantity } = req.body || {};
  const tid = Number(taskId);
  const qty = +quantity;
  const uid = Number(req.user.userId);
  if (!Number.isFinite(tid) || !qty || qty <= 0) {
    return res.status(400).json({ error: "Укажите taskId и quantity > 0" });
  }

  try {
    const result = await withTransaction(async (client) => {
      const tasks = await readState("dk_tasks", client) || [];
      const taskEmps = await readState("dk_task_emps", client) || [];
      const prodOutputs = await readState("dk_prod_outputs", client) || [];
      const batches = await readState("dk_batches", client) || [];

      const task = findTaskById(tasks, tid);
      if (!task) throw { status: 404, message: "Задание не найдено" };
      if (task.status === "назначено") throw { status: 409, message: "Сначала начните задание" };
      if (!taskHasUser(task, uid)) {
        throw { status: 403, message: "Вы не назначены на это задание" };
      }

      const myEmp = taskEmps.find(te => idEq(te.taskId, tid) && idEq(te.employeeId, uid));
      if (!myEmp) throw { status: 404, message: "Запись исполнителя не найдена" };
      if (myEmp.status === "завершено" || myEmp.status === "просрочено" || (+myEmp.producedQty || 0) > 0) {
        throw { status: 409, message: "Вы уже сдали свою часть" };
      }

      const existingTotal = prodOutputs
        .filter(o => idEq(o.taskId, tid))
        .reduce((s, o) => s + (+o.quantity || 0), 0);
      if (existingTotal + qty > task.quantity + 0.001) {
        throw { status: 400, message: `Превышает план задания (${task.quantity})` };
      }

      const now = new Date().toISOString();
      const isLate = new Date(now) > new Date(task.deadline);
      const empStatus = isLate ? "просрочено" : "завершено";

      let state = {
        dk_products:       await readState("dk_products", client)       || [],
        dk_inv_move:       await readState("dk_inv_move", client)       || [],
        dk_raw_mats:       await readState("dk_raw_mats", client)       || [],
        dk_raw_movements:  await readState("dk_raw_movements", client)  || [],
        dk_emp_hist:       await readState("dk_emp_hist", client)       || [],
        dk_prod_plans:     await readState("dk_prod_plans", client)     || [],
        dk_recipes:        await readState("dk_recipes", client)        || [],
      };

      const outId = Date.now() + Math.random();
      const hasBatch = batches.some(b => idEq(b.taskId, tid));
      const batchId = hasBatch ? null : tid + 0.5;
      const out = {
        id: outId, productId: task.productId, employeeId: uid, quantity: qty,
        date: now, taskId: tid, source: "task",
        batchId, comment: task.note || "", createdAt: now, createdBy: uid,
      };
      state = serverApplyOutput(state, out);

      const newBatch = !hasBatch ? [{
        id: tid + 0.5, productId: task.productId, quantity: task.quantity,
        producedAt: now, expiresAt: new Date(new Date(now).getTime() + 7 * 24 * 3600 * 1000).toISOString(),
        createdBy: uid, status: "активна", note: task.note || "", taskId: tid,
      }] : [];

      const updatedTaskEmps = taskEmps.map(te =>
        idEq(te.taskId, tid) && idEq(te.employeeId, uid)
          ? { ...te, producedQty: qty, status: empStatus, completedAt: now }
          : te,
      );

      const allDone = (task.userIds || []).every(wid => {
        const te = updatedTaskEmps.find(x => idEq(x.taskId, tid) && idEq(x.employeeId, wid));
        return te && (+te.producedQty || 0) > 0;
      });
      const newTotal = existingTotal + qty;
      const taskDone = allDone && newTotal >= task.quantity - 0.001;
      const taskStatus = taskDone ? (isLate ? "просрочено" : "завершено") : "в работе";

      const updatedTasks = tasks.map(t =>
        idEq(t.id, tid)
          ? { ...t, status: taskStatus, completedAt: taskDone ? now : t.completedAt }
          : t,
      );

      const users = await readState("dk_users", client) || [];
      const product = state.dk_products.find(p => idEq(p.id, task.productId)) || {};
      const actor = users.find(u => idEq(u.id, uid));
      const actorName = actor?.name?.split(" ").slice(0, 2).join(" ") || "Работник";

      const notifications = await readState("dk_notifications", client) || [];
      const logs = await readState("dk_logs", client) || [];
      const newNotif = {
        id: Date.now() + Math.random(),
        title: taskDone
          ? `Задание ${isLate ? "просрочено" : "выполнено"}: ${product.name || ""}`
          : `Сдана часть: ${product.name || ""}`,
        type: isLate ? "ошибка" : "информация",
        content: `${actorName} сдал(а) ${qty} ${product.unit || "ед."}${taskDone ? "" : " — задание ещё в работе"}`,
        createdBy: req.user.userId, createdAt: now,
        readBy: [req.user.userId], targetAll: true, targetUsers: [],
      };
      const newLog = {
        id: Date.now(), userId: req.user.userId, userName: actorName,
        message: `Сдано: ${product.name || ""} x${qty}${taskDone ? (isLate ? " (просрочено)" : "") : " (часть)"}`,
        date: now,
      };

      const finalOutputs = [...prodOutputs, out];
      const finalBatches = newBatch.length ? [...batches, ...newBatch] : batches;
      const finalNotifs = [...notifications, newNotif];
      const finalLogs = [...logs, newLog];

      await writeState("dk_tasks",         updatedTasks,          client);
      await writeState("dk_task_emps",     updatedTaskEmps,       client);
      await writeState("dk_prod_outputs",  finalOutputs,          client);
      if (newBatch.length) await writeState("dk_batches", finalBatches, client);
      await writeState("dk_products",      state.dk_products,     client);
      await writeState("dk_inv_move",      state.dk_inv_move,     client);
      await writeState("dk_raw_mats",      state.dk_raw_mats,     client);
      await writeState("dk_raw_movements", state.dk_raw_movements,client);
      await writeState("dk_emp_hist",      state.dk_emp_hist,     client);
      await writeState("dk_prod_plans",    state.dk_prod_plans,   client);
      await writeState("dk_notifications", finalNotifs,           client);
      await writeState("dk_logs",          finalLogs,             client);

      return {
        dk_tasks: updatedTasks,
        dk_task_emps: updatedTaskEmps,
        dk_prod_outputs: finalOutputs,
        dk_batches: finalBatches,
        dk_products: state.dk_products,
        dk_raw_mats: state.dk_raw_mats,
        dk_emp_hist: state.dk_emp_hist,
        dk_prod_plans: state.dk_prod_plans,
        dk_inv_move: state.dk_inv_move,
        dk_raw_movements: state.dk_raw_movements,
        dk_notifications: finalNotifs,
        dk_logs: finalLogs,
      };
    });

    res.json({ ok: true, state: result });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: e.message });
    console.error("[task-complete-self]", e);
    res.status(500).json({ error: e.message });
  }
});

// POST /api/actions/output-record
// Record a manual production output.
// Workers: can only record for themselves (employeeId enforced server-side).
app.post("/api/actions/output-record", requireAuth, async (req, res) => {
  const { productId, employeeId, quantity, date, comment } = req.body;
  if (!productId || !employeeId || !quantity || +quantity <= 0) {
    return res.status(400).json({ error: "Укажите productId, employeeId, quantity > 0" });
  }

  // Worker can only record for themselves
  const isWorkerRole = roleLevel(req.user.roleId) === "worker";
  if (isWorkerRole && +employeeId !== req.user.userId) {
    return res.status(403).json({ error: "Вы можете записывать выпуск только за себя" });
  }

  try {
    const result = await withTransaction(async (client) => {
      const now = new Date().toISOString();
      const id = Date.now() + Math.random();
      const batchId = id + 0.5;
      const outDate = date ? new Date(date).toISOString() : now;
      const expiresAt = new Date(new Date(outDate).getTime() + 7 * 24 * 3600 * 1000).toISOString();

      const out = {
        id, productId: +productId, employeeId: +employeeId, quantity: +quantity,
        date: outDate, comment: comment || "", source: "manual",
        taskId: null, batchId, createdAt: now, createdBy: req.user.userId,
      };
      const newBatch = {
        id: batchId, productId: +productId, quantity: +quantity,
        producedAt: outDate, expiresAt, createdBy: req.user.userId,
        status: "активна", note: comment || "", taskId: null,
      };

      let state = {
        dk_products:       await readState("dk_products", client)       || [],
        dk_inv_move:       await readState("dk_inv_move", client)       || [],
        dk_raw_mats:       await readState("dk_raw_mats", client)       || [],
        dk_raw_movements:  await readState("dk_raw_movements", client)  || [],
        dk_emp_hist:       await readState("dk_emp_hist", client)       || [],
        dk_prod_plans:     await readState("dk_prod_plans", client)     || [],
        dk_recipes:        await readState("dk_recipes", client)        || [],
      };
      state = serverApplyOutput(state, out);

      const prodOutputs    = await readState("dk_prod_outputs", client)   || [];
      const batches        = await readState("dk_batches", client)        || [];
      const users          = await readState("dk_users", client)          || [];
      const notifications  = await readState("dk_notifications", client)  || [];
      const logs           = await readState("dk_logs", client)           || [];

      const product  = state.dk_products.find(p => p.id === +productId) || {};
      const actor    = users.find(u => u.id === req.user.userId);
      const actorName = actor?.name?.split(" ").slice(0, 2).join(" ") || "Работник";

      const newNotif = {
        id: Date.now() + Math.random(),
        title: `Выпуск: ${product.name || ""} x${quantity}`,
        type: "информация",
        content: `${actorName} зафиксировал выпуск ${product.name || ""} — ${quantity} ${product.unit || ""}`,
        createdBy: req.user.userId, createdAt: now,
        readBy: [req.user.userId], targetAll: true, targetUsers: [],
      };
      const newLog = {
        id: Date.now(), userId: req.user.userId, userName: actorName,
        message: `Выпуск: ${product.name || ""} x${quantity} → ${actorName}`, date: now,
      };

      const finalOutputs = [...prodOutputs, out];
      const finalBatches = [...batches, newBatch];
      const finalNotifs  = [...notifications, newNotif];
      const finalLogs    = [...logs, newLog];

      await writeState("dk_prod_outputs",  finalOutputs,          client);
      await writeState("dk_batches",       finalBatches,          client);
      await writeState("dk_products",      state.dk_products,     client);
      await writeState("dk_inv_move",      state.dk_inv_move,     client);
      await writeState("dk_raw_mats",      state.dk_raw_mats,     client);
      await writeState("dk_raw_movements", state.dk_raw_movements,client);
      await writeState("dk_emp_hist",      state.dk_emp_hist,     client);
      await writeState("dk_prod_plans",    state.dk_prod_plans,   client);
      await writeState("dk_notifications", finalNotifs,           client);
      await writeState("dk_logs",          finalLogs,             client);

      return {
        dk_prod_outputs:  finalOutputs,
        dk_batches:       finalBatches,
        dk_products:      state.dk_products,
        dk_raw_mats:      state.dk_raw_mats,
        dk_emp_hist:      state.dk_emp_hist,
        dk_prod_plans:    state.dk_prod_plans,
        dk_notifications: finalNotifs,
        dk_logs:          finalLogs,
      };
    });

    res.json({ ok: true, state: result });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: e.message });
    console.error("[output-record]", e);
    res.status(500).json({ error: e.message });
  }
});

// POST /api/actions/notifications/read
// Any authenticated user can mark a notification as read for themselves.
// This is the safe path for workers — they no longer need write access
// to dk_notifications to toggle their own readBy entry.
app.post("/api/actions/notifications/read", requireAuth, async (req, res) => {
  const { notificationId } = req.body || {};
  if (notificationId == null) {
    return res.status(400).json({ error: "Укажите notificationId" });
  }
  try {
    const result = await withTransaction(async (client) => {
      const list = await readState("dk_notifications", client) || [];
      const uid = req.user.userId;
      let changed = false;
      const updated = list.map(n => {
        if (n.id !== notificationId) return n;
        const readBy = Array.isArray(n.readBy) ? n.readBy : [];
        if (readBy.includes(uid)) return n;
        changed = true;
        return { ...n, readBy: [...readBy, uid] };
      });
      if (changed) await writeState("dk_notifications", updated, client);
      return updated;
    });
    res.json({ ok: true, dk_notifications: result });
  } catch (e) {
    console.error("[notifications/read]", e);
    res.status(500).json({ error: e.message });
  }
});

// POST /api/actions/notifications/read-all
// Mark every notification targeting this user as read.
app.post("/api/actions/notifications/read-all", requireAuth, async (req, res) => {
  try {
    const result = await withTransaction(async (client) => {
      const list = await readState("dk_notifications", client) || [];
      const uid = req.user.userId;
      let changed = false;
      const updated = list.map(n => {
        const targets = n.targetAll || (Array.isArray(n.targetUsers) && n.targetUsers.includes(uid));
        if (!targets) return n;
        const readBy = Array.isArray(n.readBy) ? n.readBy : [];
        if (readBy.includes(uid)) return n;
        changed = true;
        return { ...n, readBy: [...readBy, uid] };
      });
      if (changed) await writeState("dk_notifications", updated, client);
      return updated;
    });
    res.json({ ok: true, dk_notifications: result });
  } catch (e) {
    console.error("[notifications/read-all]", e);
    res.status(500).json({ error: e.message });
  }
});

// POST /api/actions/log
// Append-only audit log. Any authenticated user can write their own entry.
// The userId/userName are enforced server-side from the session — client
// cannot forge identity. Fire-and-forget from the client side.
app.post("/api/actions/log", requireAuth, async (req, res) => {
  const { message } = req.body || {};
  if (!message || typeof message !== "string") {
    return res.status(400).json({ error: "Укажите message" });
  }
  try {
    await withTransaction(async (client) => {
      const logs = await readState("dk_logs", client) || [];
      const users = await readState("dk_users", client) || [];
      const actor = users.find(u => u.id === req.user.userId);
      const actorName = actor?.name?.split(" ").slice(0, 2).join(" ") || "Пользователь";
      const entry = {
        id: Date.now() + Math.random(),
        userId: req.user.userId,
        userName: actorName,
        message: message.slice(0, 500),
        date: new Date().toISOString(),
      };
      await writeState("dk_logs", [...logs, entry], client);
    });
    res.json({ ok: true });
  } catch (e) {
    console.error("[actions/log]", e);
    res.status(500).json({ error: e.message });
  }
});

// POST /api/actions/task-start
// Worker or manager starts a task. Worker must be assigned to the task.
// Updates task.status → "в работе" and sets startedAt.
app.post("/api/actions/task-start", requireAuth, async (req, res) => {
  const { taskId } = req.body || {};
  const tid = Number(taskId);
  const uid = Number(req.user.userId);
  if (!Number.isFinite(tid)) return res.status(400).json({ error: "Укажите taskId" });
  try {
    const result = await withTransaction(async (client) => {
      const tasks = await readState("dk_tasks", client) || [];
      const taskEmps = await readState("dk_task_emps", client) || [];
      const task = findTaskById(tasks, tid);
      if (!task) throw { status: 404, message: "Задание не найдено" };
      if (task.status === "завершено" || task.status === "просрочено") {
        throw { status: 409, message: "Задание уже закрыто" };
      }

      const isWorkerRole = roleLevel(req.user.roleId) === "worker";
      if (isWorkerRole && !taskHasUser(task, uid)) {
        throw { status: 403, message: "Вы не назначены на это задание" };
      }

      const now = new Date().toISOString();
      const updatedTasks = tasks.map(t =>
        idEq(t.id, tid)
          ? { ...t, status: "в работе", startedAt: t.startedAt || now }
          : t
      );
      const updatedTaskEmps = taskEmps.map(te =>
        idEq(te.taskId, tid) && te.status !== "завершено"
          ? { ...te, status: "в работе", startedAt: te.startedAt || now }
          : te
      );

      const users = await readState("dk_users", client) || [];
      const logs = await readState("dk_logs", client) || [];
      const actor = users.find(u => u.id === req.user.userId);
      const actorName = actor?.name?.split(" ").slice(0, 2).join(" ") || "Работник";
      const products = await readState("dk_products", client) || [];
      const product = products.find(p => p.id === task.productId) || {};
      const newLog = {
        id: Date.now() + Math.random(),
        userId: req.user.userId,
        userName: actorName,
        message: `Начато: ${product.name || ""} x${task.quantity}`,
        date: now,
      };

      await writeState("dk_tasks",    updatedTasks,          client);
      await writeState("dk_task_emps",updatedTaskEmps,       client);
      await writeState("dk_logs",     [...logs, newLog],     client);

      return {
        dk_tasks: updatedTasks,
        dk_task_emps: updatedTaskEmps,
        dk_logs: [...logs, newLog],
      };
    });
    res.json({ ok: true, state: result });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: e.message });
    console.error("[task-start]", e);
    res.status(500).json({ error: e.message });
  }
});

// POST /api/actions/attendance-mark
// Worker marks their own attendance. Manager/admin can mark anyone.
// Mirrors the existing dk_marks schema (append-only events with type/time).
const ATTENDANCE_TYPES = ["приход", "уход", "опоздание", "отсутствие"];
app.post("/api/actions/attendance-mark", requireAuth, async (req, res) => {
  const { employeeId, type, time, reason, comment } = req.body || {};
  const eid = +employeeId;
  if (!eid || !type) {
    return res.status(400).json({ error: "Укажите employeeId и type" });
  }
  if (!ATTENDANCE_TYPES.includes(type)) {
    return res.status(400).json({ error: "Недопустимый тип отметки" });
  }
  const isWorkerRole = roleLevel(req.user.roleId) === "worker";
  if (isWorkerRole && eid !== req.user.userId) {
    return res.status(403).json({ error: "Вы можете отметить только себя" });
  }
  try {
    const result = await withTransaction(async (client) => {
      const marks = await readState("dk_marks", client) || [];
      const now = new Date().toISOString();
      const when = time ? new Date(time).toISOString() : now;
      const entry = {
        id: Date.now() + Math.random(),
        employeeId: eid,
        type,
        time: when,
        reason: reason || "",
        comment: comment || "",
        createdBy: req.user.userId,
        createdAt: now,
      };
      const updated = [...marks, entry];

      const users = await readState("dk_users", client) || [];
      const logs = await readState("dk_logs", client) || [];
      const empHist = await readState("dk_emp_hist", client) || [];
      const day = when.slice(0, 10);
      const existingIdx = empHist.findIndex(h => h.employeeId === eid && h.date === day);
      const existing = existingIdx >= 0 ? empHist[existingIdx] : null;
      const base = existing || {
        id: Date.now() + Math.random(),
        employeeId: eid,
        date: day,
        attendance: "present",
        tasksCompleted: 0,
        producedQty: 0,
        comment: "",
        workStart: "",
        workEnd: "",
      };

      let histEntry = { ...base };
      if (type === "приход") {
        histEntry = { ...base, attendance: "present", workStart: toHHMM(when) };
      } else if (type === "опоздание") {
        histEntry = {
          ...base,
          attendance: "late",
          workStart: toHHMM(when),
          comment: comment || reason || base.comment || "",
        };
      } else if (type === "отсутствие") {
        histEntry = {
          ...base,
          attendance: "absent",
          comment: comment || reason || base.comment || "",
        };
      } else if (type === "уход") {
        histEntry = {
          ...base,
          workEnd: toHHMM(when),
          attendance: (base.attendance === "present" || base.attendance === "late")
            ? base.attendance
            : (base.attendance || "present"),
        };
      }

      const updatedHist = existingIdx >= 0
        ? empHist.map((h, i) => (i === existingIdx ? histEntry : h))
        : [...empHist, histEntry];

      const actor = users.find(u => u.id === req.user.userId);
      const actorName = actor?.name?.split(" ").slice(0, 2).join(" ") || "Работник";
      const target = users.find(u => u.id === eid);
      const targetName = target?.name?.split(" ")[0] || `#${eid}`;
      const newLog = {
        id: Date.now() + Math.random(),
        userId: req.user.userId,
        userName: actorName,
        message: `${type}: ${targetName}`,
        date: now,
      };

      await writeState("dk_marks", updated, client);
      await writeState("dk_emp_hist", updatedHist, client);
      await writeState("dk_logs", [...logs, newLog], client);

      return { dk_marks: updated, dk_emp_hist: updatedHist, dk_logs: [...logs, newLog] };
    });
    res.json({ ok: true, state: result });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: e.message });
    console.error("[attendance-mark]", e);
    res.status(500).json({ error: e.message });
  }
});

// POST /api/actions/payroll-settings
// Manager/admin/owner updates employee pay settings without generic dk_users write.
const PAY_TYPES_ALLOWED = ["сдельная", "фиксированная", "смешанная"];
app.post("/api/actions/payroll-settings", requireAuth, requireManagerLike, async (req, res) => {
  const { employeeId, payType, baseSalary, pieceRate, fixedDayRate } = req.body || {};
  const eid = +employeeId;
  if (!eid) return res.status(400).json({ error: "Укажите employeeId" });
  if (!PAY_TYPES_ALLOWED.includes(payType)) {
    return res.status(400).json({ error: "Недопустимый тип оплаты" });
  }

  const base = +baseSalary || 0;
  const piece = +pieceRate || 0;
  const fixedDay = +fixedDayRate || 0;
  if (base < 0 || piece < 0 || fixedDay < 0) {
    return res.status(400).json({ error: "Суммы не могут быть отрицательными" });
  }

  try {
    const result = await withTransaction(async (client) => {
      const users = await readState("dk_users", client) || [];
      const idx = users.findIndex(u => u.id === eid);
      if (idx < 0) throw { status: 404, message: "Сотрудник не найден" };

      const now = new Date().toISOString();
      const target = users[idx];
      const updatedUsers = users.map(u =>
        u.id === eid
          ? {
              ...u,
              payType,
              pieceRate: piece,
              fixedDayRate: fixedDay,
              updatedAt: now,
            }
          : u,
      );

      const baseSalaries = await readState("dk_base_salaries", client) || {};
      const nextSalaries = { ...baseSalaries };
      if (base > 0) nextSalaries[eid] = base;
      else delete nextSalaries[eid];

      const logs = await readState("dk_logs", client) || [];
      const actor = users.find(u => u.id === req.user.userId);
      const actorName = actor?.name?.split(" ").slice(0, 2).join(" ") || "Менеджер";
      const newLog = {
        id: Date.now() + Math.random(),
        userId: req.user.userId,
        userName: actorName,
        message: `Настройки оплаты: ${target.name?.split(" ")[0] || eid} → ${payType}`,
        date: now,
      };

      await writeState("dk_users", updatedUsers, client);
      await writeState("dk_base_salaries", nextSalaries, client);
      await writeState("dk_logs", [...logs, newLog], client);

      return {
        dk_users: sanitizeUsers(updatedUsers),
        dk_base_salaries: nextSalaries,
        dk_logs: [...logs, newLog],
      };
    });

    res.json({ ok: true, state: result });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: e.message });
    console.error("[payroll-settings]", e);
    res.status(500).json({ error: e.message });
  }
});

// ── ORDER PACKING / DELIVERY (sanitized worker access) ──

async function getActor(req, client = pool) {
  const users = await readState("dk_users", client) || [];
  return users.find(u => u.id === req.user.userId);
}

function normalizeOrderItems(order, products) {
  return (order.items || []).map(it => {
    const p = products.find(x => x.id === it.productId);
    return {
      productId: it.productId,
      productName: it.productName || p?.name || "?",
      unit: it.unit || p?.unit || "",
      qty: it.qty,
      packedQty: it.packedQty ?? 0,
      packedBy: it.packedBy ?? null,
      packedAt: it.packedAt ?? null,
    };
  });
}

function computePackingStatus(items) {
  if (!items?.length) return "не начата";
  if (items.every(it => (it.packedQty ?? 0) >= it.qty)) return "готов к доставке";
  if (items.some(it => (it.packedQty ?? 0) > 0)) return "фасуется";
  return "не начата";
}

function toPackingOrderDTO(order, client, products) {
  const items = normalizeOrderItems(order, products);
  return {
    orderId: order.id,
    storeName: client?.name || "?",
    addressSnapshot: order.addressSnapshot || client?.address || "",
    priority: order.priority || "нормальный",
    status: order.status,
    packingStatus: order.packingStatus || computePackingStatus(items),
    items: items.map(it => ({
      productId: it.productId,
      productName: it.productName,
      unit: it.unit,
      qty: it.qty,
      packedQty: it.packedQty ?? 0,
    })),
    note: typeof order.note === "string" ? order.note.slice(0, 200) : "",
    createdAt: order.orderDate,
    statusChangedAt: order.statusChangedAt,
  };
}

function toDeliveryOrderDTO(order, client, products) {
  const items = normalizeOrderItems(order, products);
  return {
    orderId: order.id,
    storeName: client?.name || "?",
    address: order.addressSnapshot || client?.address || "",
    contact: client?.contact || "",
    phone: client?.phone || client?.whatsapp || "",
    priority: order.priority || "нормальный",
    items: items.map(it => ({
      productId: it.productId,
      productName: it.productName,
      unit: it.unit,
      qty: it.qty,
      packedQty: it.packedQty ?? 0,
    })),
    deliveryStatus: order.deliveryStatus || "ожидает",
    courierId: order.courierId ?? null,
    note: typeof order.note === "string" ? order.note.slice(0, 200) : "",
    readyForDeliveryAt: order.readyForDeliveryAt || null,
    packingStatus: order.packingStatus || computePackingStatus(items),
    status: order.status,
  };
}

function deductOrderStock(state, order) {
  if (order.stockDeductedAt) return state;
  const now = new Date().toISOString();
  for (const it of order.items || []) {
    const p = (state.dk_products || []).find(x => x.id === it.productId);
    if (!p || p.stock < it.qty) {
      throw { status: 400, message: `Недостаточно на складе: ${p?.name || "?"}` };
    }
  }
  state.dk_products = (state.dk_products || []).map(p => {
    const it = (order.items || []).find(i => i.productId === p.id);
    if (!it) return p;
    return { ...p, stock: p.stock - it.qty, updatedAt: now };
  });
  const moves = (order.items || []).map(it => {
    const p = state.dk_products.find(x => x.id === it.productId);
    return {
      id: Date.now() + Math.random(),
      productId: it.productId,
      type: "order_shipment",
      quantity: -it.qty,
      balance: p?.stock || 0,
      refId: `order-${order.id}`,
      createdAt: now,
    };
  });
  state.dk_inv_move = [...(state.dk_inv_move || []), ...moves];
  return state;
}

function applyPackingToOrder(order, products, body, userId) {
  const now = new Date().toISOString();
  let items = normalizeOrderItems(order, products);
  const { productId, itemIndex, packedQty, packedQtyDelta } = body;

  items = items.map((it, idx) => {
    const match = productId != null ? it.productId === +productId : idx === +itemIndex;
    if (!match) return it;
    let next = it.packedQty ?? 0;
    if (packedQty != null) next = +packedQty;
    else if (packedQtyDelta != null) next = Math.max(0, next + +packedQtyDelta);
    next = Math.min(it.qty, Math.max(0, next));
    return { ...it, packedQty: next, packedBy: userId, packedAt: now };
  });

  const packingStatus = computePackingStatus(items);
  const allReady = packingStatus === "готов к доставке";
  return {
    ...order,
    items,
    packingStatus,
    status: allReady ? "готов" : (packingStatus === "фасуется" ? "сборка" : order.status),
    readyForDeliveryAt: allReady ? (order.readyForDeliveryAt || now) : order.readyForDeliveryAt,
    statusChangedAt: now,
  };
}

// GET /api/actions/packing/queue
app.get("/api/actions/packing/queue", requireAuth, async (req, res) => {
  try {
    const actor = await getActor(req);
    const lvl = roleLevel(req.user.roleId);
    const isPacker = lvl === "worker" && actor?.jobTitle === "фасовщица";
    if (lvl === "worker" && !isPacker) {
      return res.status(403).json({ error: "Доступ только для фасовщиц и менеджеров" });
    }
    const orders = await readState("dk_client_orders") || [];
    const clients = await readState("dk_clients") || [];
    const products = (await readState("dk_products") || []).filter(p => !p.deleted);
    const queue = orders
      .filter(o => !o.deleted && !["отгружен", "отменён"].includes(o.status))
      .filter(o => (o.packingStatus || computePackingStatus(normalizeOrderItems(o, products))) !== "готов к доставке" || o.status !== "готов")
      .map(o => toPackingOrderDTO(o, clients.find(c => c.id === o.clientId), products));
    res.json({ ok: true, queue });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/actions/packing/item
app.post("/api/actions/packing/item", requireAuth, async (req, res) => {
  const { orderId, productId, itemIndex, packedQty, packedQtyDelta } = req.body || {};
  if (orderId == null) return res.status(400).json({ error: "Укажите orderId" });
  try {
    const result = await withTransaction(async (client) => {
      const actor = await getActor(req, client);
      const lvl = roleLevel(req.user.roleId);
      const isPacker = lvl === "worker" && actor?.jobTitle === "фасовщица";
      if (lvl === "worker" && !isPacker) throw { status: 403, message: "Доступ только для фасовщиц" };

      const orders = await readState("dk_client_orders", client) || [];
      const products = await readState("dk_products", client) || [];
      const clients = await readState("dk_clients", client) || [];
      const idx = orders.findIndex(o => o.id === +orderId);
      if (idx === -1) throw { status: 404, message: "Заказ не найден" };

      const updated = applyPackingToOrder(orders[idx], products, { productId, itemIndex, packedQty, packedQtyDelta }, req.user.userId);
      const newOrders = orders.map((o, i) => i === idx ? updated : o);

      const notifications = await readState("dk_notifications", client) || [];
      const logs = await readState("dk_logs", client) || [];
      const actorName = actor?.name?.split(" ").slice(0, 2).join(" ") || "Фасовщица";
      const now = new Date().toISOString();
      let newNotifs = notifications;
      let newLogs = logs;

      if (updated.packingStatus === "готов к доставке" && orders[idx].packingStatus !== "готов к доставке") {
        const store = clients.find(c => c.id === updated.clientId);
        newNotifs = [...notifications, {
          id: Date.now() + Math.random(),
          title: `Заказ готов к доставке: ${store?.name || "#" + updated.id}`,
          type: "информация",
          category: "order",
          severity: "info",
          content: `Заказ #${updated.id} полностью расфасован`,
          createdBy: req.user.userId,
          createdAt: now,
          readBy: [req.user.userId],
          targetAll: true,
          targetUsers: [],
          action: { label: "Доставка", page: "delivery", entityId: updated.id },
        }];
      }

      newLogs = [...logs, {
        id: Date.now() + Math.random(),
        userId: req.user.userId,
        userName: actorName,
        message: `Фасовка заказа #${updated.id}: ${updated.packingStatus}`,
        date: now,
      }];

      await writeState("dk_client_orders", newOrders, client);
      await writeState("dk_notifications", newNotifs, client);
      await writeState("dk_logs", newLogs, client);

      const queue = newOrders
        .filter(o => !o.deleted && !["отгружен", "отменён"].includes(o.status))
        .map(o => toPackingOrderDTO(o, clients.find(c => c.id === o.clientId), products.filter(p => !p.deleted)));

      return { queue, dk_client_orders: newOrders, dk_notifications: newNotifs, dk_logs: newLogs };
    });
    res.json({ ok: true, ...result });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: e.message });
    console.error("[packing/item]", e);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/actions/delivery/queue
app.get("/api/actions/delivery/queue", requireAuth, async (req, res) => {
  try {
    const actor = await getActor(req);
    const lvl = roleLevel(req.user.roleId);
    const isCourier = lvl === "worker" && actor?.jobTitle === "курьер";
    if (lvl === "worker" && !isCourier) {
      return res.status(403).json({ error: "Доступ только для курьеров" });
    }
    const orders = await readState("dk_client_orders") || [];
    const clients = await readState("dk_clients") || [];
    const products = (await readState("dk_products") || []).filter(p => !p.deleted);
    const uid = req.user.userId;

    const queue = orders
      .filter(o => !o.deleted && o.status !== "отменён")
      .filter(o => {
        const ps = o.packingStatus || computePackingStatus(normalizeOrderItems(o, products));
        const ready = ps === "готов к доставке" || o.status === "готов";
        const mine = o.courierId === uid && o.deliveryStatus === "в доставке";
        const waiting = ready && (o.deliveryStatus || "ожидает") === "ожидает";
        const inDelivery = o.deliveryStatus === "в доставке";
        const packing = !ready && !inDelivery && !["отгружен"].includes(o.status);
        if (lvl !== "worker") return waiting || inDelivery || packing;
        if (isCourier) return mine || waiting || packing;
        return waiting || inDelivery;
      })
      .map(o => toDeliveryOrderDTO(o, clients.find(c => c.id === o.clientId), products));

    res.json({ ok: true, queue });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/actions/delivery/take
app.post("/api/actions/delivery/take", requireAuth, async (req, res) => {
  const { orderId } = req.body || {};
  if (orderId == null) return res.status(400).json({ error: "Укажите orderId" });
  try {
    const result = await withTransaction(async (client) => {
      const actor = await getActor(req, client);
      const lvl = roleLevel(req.user.roleId);
      const isCourier = lvl === "worker" && actor?.jobTitle === "курьер";
      if (lvl === "worker" && !isCourier) throw { status: 403, message: "Доступ только для курьеров" };

      let state = {
        dk_client_orders: await readState("dk_client_orders", client) || [],
        dk_products: await readState("dk_products", client) || [],
        dk_inv_move: await readState("dk_inv_move", client) || [],
      };
      const clients = await readState("dk_clients", client) || [];
      const idx = state.dk_client_orders.findIndex(o => o.id === +orderId);
      if (idx === -1) throw { status: 404, message: "Заказ не найден" };

      const order = state.dk_client_orders[idx];
      const items = normalizeOrderItems(order, state.dk_products);
      const ps = order.packingStatus || computePackingStatus(items);
      if (ps !== "готов к доставке" && order.status !== "готов") {
        throw { status: 409, message: "Заказ ещё не готов к доставке" };
      }
      if (order.courierId && order.courierId !== req.user.userId && order.deliveryStatus === "в доставке") {
        throw { status: 409, message: "Заказ уже взял другой курьер" };
      }

      const now = new Date().toISOString();
      state = deductOrderStock(state, order);
      const updated = {
        ...order,
        items,
        status: "отгружен",
        deliveryStatus: "в доставке",
        courierId: req.user.userId,
        deliveryStartedAt: now,
        shippedAt: order.shippedAt || now,
        shippedBy: order.shippedBy || req.user.userId,
        stockDeductedAt: order.stockDeductedAt || now,
        history: [...(order.history || []), { from: order.status, to: "отгружен", userId: req.user.userId, userName: actor?.name || "Курьер", at: now }],
      };
      state.dk_client_orders = state.dk_client_orders.map((o, i) => i === idx ? updated : o);

      const notifications = await readState("dk_notifications", client) || [];
      const logs = await readState("dk_logs", client) || [];
      const store = clients.find(c => c.id === updated.clientId);
      const actorName = actor?.name?.split(" ").slice(0, 2).join(" ") || "Курьер";
      const newNotifs = [...notifications, {
        id: Date.now() + Math.random(),
        title: `Заказ в доставке: ${store?.name || "#" + updated.id}`,
        type: "информация",
        category: "order",
        content: `${actorName} взял заказ #${updated.id}`,
        createdBy: req.user.userId,
        createdAt: now,
        readBy: [req.user.userId],
        targetAll: true,
        targetUsers: [],
        action: { label: "Доставка", page: "delivery", entityId: updated.id },
      }];
      const newLogs = [...logs, {
        id: Date.now() + Math.random(),
        userId: req.user.userId,
        userName: actorName,
        message: `В доставке: заказ #${updated.id} → ${store?.name || "?"}`,
        date: now,
      }];

      await writeState("dk_client_orders", state.dk_client_orders, client);
      await writeState("dk_products", state.dk_products, client);
      await writeState("dk_inv_move", state.dk_inv_move, client);
      await writeState("dk_notifications", newNotifs, client);
      await writeState("dk_logs", newLogs, client);

      const queue = state.dk_client_orders
        .filter(o => !o.deleted && o.status !== "отменён")
        .map(o => toDeliveryOrderDTO(o, clients.find(c => c.id === o.clientId), state.dk_products.filter(p => !p.deleted)));

      return {
        queue,
        dk_client_orders: state.dk_client_orders,
        dk_products: state.dk_products,
        dk_inv_move: state.dk_inv_move,
        dk_notifications: newNotifs,
        dk_logs: newLogs,
      };
    });
    res.json({ ok: true, ...result });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: e.message });
    console.error("[delivery/take]", e);
    res.status(500).json({ error: e.message });
  }
});

// POST /api/actions/delivery/delivered
app.post("/api/actions/delivery/delivered", requireAuth, async (req, res) => {
  const { orderId, deliveryComment } = req.body || {};
  if (orderId == null) return res.status(400).json({ error: "Укажите orderId" });
  try {
    const result = await withTransaction(async (client) => {
      const actor = await getActor(req, client);
      const lvl = roleLevel(req.user.roleId);
      const isCourier = lvl === "worker" && actor?.jobTitle === "курьер";
      if (lvl === "worker" && !isCourier) throw { status: 403, message: "Доступ только для курьеров" };

      const orders = await readState("dk_client_orders", client) || [];
      const clients = await readState("dk_clients", client) || [];
      const products = await readState("dk_products", client) || [];
      const idx = orders.findIndex(o => o.id === +orderId);
      if (idx === -1) throw { status: 404, message: "Заказ не найден" };

      const order = orders[idx];
      if (lvl === "worker" && order.courierId !== req.user.userId) {
        throw { status: 403, message: "Это не ваш заказ" };
      }
      if (order.deliveryStatus !== "в доставке") {
        throw { status: 409, message: "Заказ не в доставке" };
      }

      const now = new Date().toISOString();
      const updated = {
        ...order,
        deliveryStatus: "доставлен",
        deliveredAt: now,
        deliveryComment: deliveryComment || order.deliveryComment || "",
        history: [...(order.history || []), { from: "в доставке", to: "доставлен", userId: req.user.userId, userName: actor?.name || "Курьер", at: now }],
      };
      const newOrders = orders.map((o, i) => i === idx ? updated : o);

      const notifications = await readState("dk_notifications", client) || [];
      const logs = await readState("dk_logs", client) || [];
      const store = clients.find(c => c.id === updated.clientId);
      const actorName = actor?.name?.split(" ").slice(0, 2).join(" ") || "Курьер";
      const newNotifs = [...notifications, {
        id: Date.now() + Math.random(),
        title: `Заказ доставлен: ${store?.name || "#" + updated.id}`,
        type: "информация",
        category: "order",
        content: `${actorName} доставил заказ #${updated.id}`,
        createdBy: req.user.userId,
        createdAt: now,
        readBy: [req.user.userId],
        targetAll: true,
        targetUsers: [],
        action: { label: "Заказы", page: "clients", entityId: updated.id },
      }];
      const newLogs = [...logs, {
        id: Date.now() + Math.random(),
        userId: req.user.userId,
        userName: actorName,
        message: `Доставлено: заказ #${updated.id}`,
        date: now,
      }];

      await writeState("dk_client_orders", newOrders, client);
      await writeState("dk_notifications", newNotifs, client);
      await writeState("dk_logs", newLogs, client);

      const queue = newOrders
        .filter(o => !o.deleted && o.status !== "отменён")
        .map(o => toDeliveryOrderDTO(o, clients.find(c => c.id === o.clientId), products.filter(p => !p.deleted)));

      return { queue, dk_client_orders: newOrders, dk_notifications: newNotifs, dk_logs: newLogs };
    });
    res.json({ ok: true, ...result });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: e.message });
    console.error("[delivery/delivered]", e);
    res.status(500).json({ error: e.message });
  }
});

// ── BOARD ENDPOINTS (public, sanitized DTOs) ──
// These are the ONLY public read paths. Board mode (/?board=1) uses them
// instead of /api/state/:key?board=1 so we can whitelist fields and keep
// costPrice/sellPrice/techCard/history/address snapshots on the server.

function toBoardOrderDTO(o, clientName = "") {
  return {
    id: o.id,
    status: o.status,
    priority: o.priority,
    orderDate: o.orderDate,
    statusChangedAt: o.statusChangedAt,
    clientId: o.clientId,
    clientName: clientName || o.clientName || o.storeName || "",
    packingStatus: o.packingStatus || "не начата",
    deliveryStatus: o.deliveryStatus || "ожидает",
    items: Array.isArray(o.items)
      ? o.items.map(it => ({ productId: it.productId, qty: it.qty }))
      : [],
    note: typeof o.note === "string" ? o.note.slice(0, 200) : "",
    total: typeof o.total === "number" ? o.total : 0,
  };
}

function toBoardProductDTO(p) {
  return {
    id: p.id,
    name: p.name,
    category: p.category,
    unit: p.unit,
  };
}

app.get("/api/board/orders", async (_req, res) => {
  try {
    const orders = await readState("dk_client_orders") || [];
    const clients = await readState("dk_clients") || [];
    const clientMap = Object.fromEntries(clients.map(c => [c.id, c.name]));
    const active = orders
      .filter(o => !["отгружен", "отменён"].includes(o.status))
      .map(o => toBoardOrderDTO(o, clientMap[o.clientId] || ""));
    res.json(active);
  } catch (e) {
    res.status(500).json([]);
  }
});

app.get("/api/board/products", async (_req, res) => {
  try {
    const products = await readState("dk_products") || [];
    const visible = products
      .filter(p => !p.deleted)
      .map(toBoardProductDTO);
    res.json(visible);
  } catch (e) {
    res.status(500).json([]);
  }
});

// ── STATE ENDPOINTS (protected) ──

app.get("/api/state/:key", checkKeyAccess, async (req, res) => {
  try {
    const qr = await pool.query("SELECT value FROM state WHERE key = $1", [req.params.key]);
    if (!qr.rows[0]) return res.status(404).json(null);

    let data = JSON.parse(qr.rows[0].value);

    // Strip password from dk_users for non-admin readers
    if (req._stripPasswords && Array.isArray(data)) {
      data = data.map(u => { const { password: _p, ...rest } = u; return rest; });
    }

    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/state/:key", checkKeyAccess, async (req, res) => {
  try {
    await writeState(req.params.key, req.body);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── UPDATES POLLING (requires auth or board mode) ──
app.get("/api/updates", async (req, res) => {
  if (!req.user && !isBoardRequest(req)) {
    return res.status(401).json([]);
  }
  try {
    const sinceRaw = parseInt(req.query.since) || 0;
    const since = sinceRaw > 1e10 ? Math.floor(sinceRaw / 1000) : sinceRaw;
    const qr = await pool.query(
      "SELECT key, MAX(updated_at) as ts FROM state WHERE updated_at > $1 GROUP BY key",
      [since]
    );
    const rows = qr.rows;

    const roleId = req.user?.roleId;
    const filtered = rows.filter(row => {
      const access = KEY_ACCESS[row.key];
      if (!access) return roleLevel(roleId) === "admin";
      const required = access.read;
      if (isBoardRequest(req)) return required === "public";
      return satisfies(roleId, required);
    });

    res.json(filtered);
  } catch (e) {
    res.status(500).json([]);
  }
});

// ── ADMIN USER ENDPOINTS ──
// Only admin (roleId 1) or owner (roleId 4) can access.

function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: "Не авторизован" });
  if (roleLevel(req.user.roleId) !== "admin") return res.status(403).json({ error: "Только для администратора" });
  next();
}

// Sanitize user for client — strip password
function sanitizeUser(u) {
  const { password: _pw, ...safe } = u;
  return safe;
}

// POST /api/admin/users — create user
app.post("/api/admin/users", requireAdmin, async (req, res) => {
  try {
    const { firstName, lastName, email, password, roleId, jobTitle, payType, dailyNorm, pieceRate, fixedDayRate, comment, birthDate, phone, experienceYears, experienceMonths, noExperience } = req.body;
    if (!email || !password || password.length < 4) return res.status(400).json({ error: "email и пароль (мин. 4 символа) обязательны" });
    if (!firstName && !lastName && !req.body.name) return res.status(400).json({ error: "Имя обязательно" });

    const result = await withTransaction(async (client) => {
      const users = await readState("dk_users", client) || [];
      if (users.some(u => u.email === email)) throw { status: 409, message: "Email уже занят" };

      const expYears = noExperience ? 0 : (+experienceYears || 0);
      const expMonths = noExperience ? 0 : (+experienceMonths || 0);
      const now = new Date().toISOString();
      const newUser = {
        id: Date.now(),
        firstName: firstName || "",
        lastName: lastName || "",
        name: req.body.name || `${firstName || ""} ${lastName || ""}`.trim(),
        birthDate: birthDate || "",
        phone: phone || "",
        email,
        emailVerified: true,
        roleId: +roleId || 3,
        status: "active",
        jobTitle: jobTitle || "другое",
        noExperience: !!noExperience,
        experienceYears: expYears,
        experienceMonths: expMonths,
        experienceMonthsTotal: expYears * 12 + expMonths,
        payType: payType || "фиксированная",
        dailyNorm: +dailyNorm || 0,
        pieceRate: +pieceRate || 0,
        fixedDayRate: +fixedDayRate || 0,
        comment: comment || "",
        password: hashPassword(password),
        createdAt: now,
        updatedAt: now,
      };
      const updated = [...users, newUser];
      await writeState("dk_users", updated, client);

      const logs = await readState("dk_logs", client) || [];
      const actor = users.find(u => u.id === req.user.userId);
      const actorName = actor?.name?.split(" ").slice(0, 2).join(" ") || "Админ";
      await writeState("dk_logs", [...logs, { id: Date.now() + Math.random(), userId: req.user.userId, userName: actorName, message: `Создан пользователь: ${newUser.name} (${newUser.email})`, date: now }], client);

      return sanitizeUser(newUser);
    });
    res.json({ ok: true, user: result });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: e.message });
    console.error("[admin/users POST]", e);
    res.status(500).json({ error: e.message });
  }
});

// PATCH /api/admin/users/:id — update user fields (not password)
app.patch("/api/admin/users/:id", requireAdmin, async (req, res) => {
  try {
    const userId = +req.params.id;
    const result = await withTransaction(async (client) => {
      const users = await readState("dk_users", client) || [];
      const idx = users.findIndex(u => u.id === userId);
      if (idx === -1) throw { status: 404, message: "Пользователь не найден" };

      const { password: _pw, ...allowed } = req.body; // never allow password update here
      const expYears = allowed.noExperience ? 0 : (allowed.experienceYears !== undefined ? +allowed.experienceYears : users[idx].experienceYears);
      const expMonths = allowed.noExperience ? 0 : (allowed.experienceMonths !== undefined ? +allowed.experienceMonths : users[idx].experienceMonths);

      const updated = { ...users[idx], ...allowed, experienceYears: expYears, experienceMonths: expMonths, experienceMonthsTotal: expYears * 12 + expMonths, updatedAt: new Date().toISOString() };
      if (updated.firstName || updated.lastName) {
        updated.name = `${updated.firstName || ""} ${updated.lastName || ""}`.trim();
      }
      const newUsers = users.map((u, i) => i === idx ? updated : u);
      await writeState("dk_users", newUsers, client);
      return sanitizeUser(updated);
    });
    res.json({ ok: true, user: result });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: e.message });
    res.status(500).json({ error: e.message });
  }
});

// POST /api/admin/users/:id/password — change password
app.post("/api/admin/users/:id/password", requireAdmin, async (req, res) => {
  try {
    const userId = +req.params.id;
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 4) return res.status(400).json({ error: "Пароль мин. 4 символа" });
    await withTransaction(async (client) => {
      const users = await readState("dk_users", client) || [];
      const idx = users.findIndex(u => u.id === userId);
      if (idx === -1) throw { status: 404, message: "Пользователь не найден" };
      users[idx] = { ...users[idx], password: hashPassword(newPassword), updatedAt: new Date().toISOString() };
      await writeState("dk_users", users, client);
    });
    res.json({ ok: true });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: e.message });
    res.status(500).json({ error: e.message });
  }
});

// POST /api/admin/users/:id/block — toggle block status
app.post("/api/admin/users/:id/block", requireAdmin, async (req, res) => {
  try {
    const userId = +req.params.id;
    const { blocked, reason } = req.body;
    const result = await withTransaction(async (client) => {
      const users = await readState("dk_users", client) || [];
      const idx = users.findIndex(u => u.id === userId);
      if (idx === -1) throw { status: 404, message: "Пользователь не найден" };
      if (users[idx].id === req.user.userId) throw { status: 400, message: "Нельзя заблокировать себя" };
      users[idx] = { ...users[idx], status: blocked ? "blocked" : "active", blockReason: blocked ? (reason || "") : "", updatedAt: new Date().toISOString() };
      await writeState("dk_users", users, client);
      return sanitizeUser(users[idx]);
    });
    res.json({ ok: true, user: result });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: e.message });
    res.status(500).json({ error: e.message });
  }
});

// ── BOOTSTRAP / SEED ──
// Runs once at server start to ensure a fresh PostgreSQL DB has working demo accounts.
// Safe to run repeatedly — only writes keys that don't exist yet.
async function bootstrapState() {
  console.log("[bootstrap] Checking state...");

  // ── Demo users ──
  const usersRow = (await pool.query("SELECT value FROM state WHERE key = 'dk_users'")).rows[0];
  if (!usersRow) {
    const now = (suffix) => `2024-01-${suffix}T08:00:00.000Z`;
    const demoUsers = [
      { id:1,  firstName:"Акбар",   lastName:"Директоров", name:"Акбар Директоров",   birthDate:"1975-06-15", phone:"+7 900 111 0001", email:"director@factory.ru", emailVerified:true, roleId:1, status:"active", jobTitle:"менеджер цеха", noExperience:false, experienceYears:10, experienceMonths:0,  experienceMonthsTotal:120, payType:"фиксированная", dailyNorm:0,  pieceRate:0,  fixedDayRate:5000, comment:"Директор завода",         createdAt:now("01"), updatedAt:now("01"), password:hashPassword("director123") },
      { id:2,  firstName:"Малика",  lastName:"Менеджерова",name:"Малика Менеджерова",  birthDate:"1985-03-20", phone:"+7 900 222 0002", email:"manager@factory.ru",  emailVerified:true, roleId:2, status:"active", jobTitle:"менеджер цеха", noExperience:false, experienceYears:5,  experienceMonths:3,  experienceMonthsTotal:63,  payType:"фиксированная", dailyNorm:0,  pieceRate:0,  fixedDayRate:3000, comment:"Менеджер производства",    createdAt:now("01"), updatedAt:now("01"), password:hashPassword("manager123") },
      { id:3,  firstName:"Ибрагим", lastName:"Завода",     name:"Ибрагим Завода",      birthDate:"1970-01-10", phone:"+7 900 333 0003", email:"owner@factory.ru",    emailVerified:true, roleId:4, status:"active", jobTitle:"другое",        noExperience:false, experienceYears:20, experienceMonths:0,  experienceMonthsTotal:240, payType:"фиксированная", dailyNorm:0,  pieceRate:0,  fixedDayRate:0,    comment:"Владелец предприятия",    createdAt:now("01"), updatedAt:now("01"), password:hashPassword("owner123") },
      { id:4,  firstName:"Зарина",  lastName:"Курбанова",  name:"Зарина Курбанова",    birthDate:"1998-04-15", phone:"+7 900 444 0004", email:"lep1@factory.ru",     emailVerified:true, roleId:3, status:"active", jobTitle:"лепщица",       noExperience:false, experienceYears:2,  experienceMonths:4,  experienceMonthsTotal:28,  payType:"сдельная",      dailyNorm:50, pieceRate:15, fixedDayRate:0,    comment:"Опытная лепщица",         createdAt:now("15"), updatedAt:now("15"), password:hashPassword("worker123") },
      { id:5,  firstName:"Сабина",  lastName:"Алиева",     name:"Сабина Алиева",       birthDate:"2000-07-22", phone:"+7 900 555 0005", email:"lep2@factory.ru",     emailVerified:true, roleId:3, status:"active", jobTitle:"лепщица",       noExperience:false, experienceYears:1,  experienceMonths:8,  experienceMonthsTotal:20,  payType:"сдельная",      dailyNorm:50, pieceRate:15, fixedDayRate:0,    comment:"",                        createdAt:now("16"), updatedAt:now("16"), password:hashPassword("worker123") },
      { id:6,  firstName:"Лейла",   lastName:"Магомедова", name:"Лейла Магомедова",    birthDate:"1995-11-10", phone:"+7 900 666 0006", email:"lep3@factory.ru",     emailVerified:true, roleId:3, status:"active", jobTitle:"лепщица",       noExperience:false, experienceYears:3,  experienceMonths:0,  experienceMonthsTotal:36,  payType:"сдельная",      dailyNorm:50, pieceRate:15, fixedDayRate:0,    comment:"",                        createdAt:now("17"), updatedAt:now("17"), password:hashPassword("worker123") },
      { id:7,  firstName:"Айгуль",  lastName:"Рашидова",   name:"Айгуль Рашидова",     birthDate:"1999-09-05", phone:"+7 900 777 0007", email:"packer@factory.ru",   emailVerified:true, roleId:3, status:"active", jobTitle:"фасовщица",     noExperience:false, experienceYears:1,  experienceMonths:2,  experienceMonthsTotal:14,  payType:"сдельная",      dailyNorm:80, pieceRate:8,  fixedDayRate:0,    comment:"",                        createdAt:now("18"), updatedAt:now("18"), password:hashPassword("worker123") },
      { id:8,  firstName:"Рустам",  lastName:"Каримов",    name:"Рустам Каримов",      birthDate:"1988-12-25", phone:"+7 900 888 0008", email:"courier@factory.ru",  emailVerified:true, roleId:3, status:"active", jobTitle:"курьер",        noExperience:false, experienceYears:4,  experienceMonths:6,  experienceMonthsTotal:54,  payType:"фиксированная", dailyNorm:0,  pieceRate:0,  fixedDayRate:1500, comment:"Курьер доставки",         createdAt:now("19"), updatedAt:now("19"), password:hashPassword("worker123") },
      { id:9,  firstName:"Тимур",   lastName:"Исмаилов",   name:"Тимур Исмаилов",      birthDate:"1990-08-18", phone:"+7 900 999 0009", email:"tech@factory.ru",     emailVerified:true, roleId:3, status:"active", jobTitle:"технарь",       noExperience:false, experienceYears:6,  experienceMonths:0,  experienceMonthsTotal:72,  payType:"фиксированная", dailyNorm:0,  pieceRate:0,  fixedDayRate:2000, comment:"Технарь",                 createdAt:now("20"), updatedAt:now("20"), password:hashPassword("worker123") },
      { id:10, firstName:"Назира",  lastName:"Юсупова",    name:"Назира Юсупова",      birthDate:"1993-02-28", phone:"+7 900 100 0010", email:"cleaner@factory.ru",  emailVerified:true, roleId:3, status:"active", jobTitle:"техничка",      noExperience:false, experienceYears:2,  experienceMonths:0,  experienceMonthsTotal:24,  payType:"фиксированная", dailyNorm:0,  pieceRate:0,  fixedDayRate:1200, comment:"Уборщица",                createdAt:now("21"), updatedAt:now("21"), password:hashPassword("worker123") },
    ];
    await writeState("dk_users", demoUsers);
    console.log(`[bootstrap] Seeded dk_users with ${demoUsers.length} demo accounts`);
  } else {
    // Migrate any __pending__ passwords that might be left from old frontend-created users
    const users = JSON.parse(usersRow.value);
    let changed = false;
    const migrated = users.map(u => {
      if (!u.password || u.password === "__pending__") {
        changed = true;
        return { ...u, password: hashPassword("changeme123") };
      }
      return u;
    });
    if (changed) {
      await writeState("dk_users", migrated);
      console.log("[bootstrap] Migrated __pending__ passwords");
    }
  }

  // ── Initial product catalogue ──
  const seedIfMissing = async (key, val) => {
    const check = await pool.query("SELECT 1 FROM state WHERE key = $1", [key]);
    if (check.rows.length === 0) {
      await writeState(key, val);
    }
  };

  await seedIfMissing("dk_products", [
    { id:1, name:"Пельмени Домашние",   category:"Пельмени", description:"Классические с говядиной и бараниной", costPrice:280, sellPrice:450, stock:150, unit:"кг", status:"готов",           createdAt:"2024-01-20T10:00:00", updatedAt:"2024-06-01T12:00:00", deleted:false, techCard:["Подготовить тесто пельменное (замес 20 мин)","Подготовить фарш: говядина + баранина + лук + специи","Раскатать тесто, нарезать кружки","Лепка пельменей (ручная или автомат)","Заморозка при -18°C (2 часа)","Упаковка и маркировка"] },
    { id:2, name:"Котлеты По-киевски",  category:"Котлеты",  description:"Куриные котлеты с маслом",            costPrice:320, sellPrice:520, stock:80,  unit:"шт", status:"в производстве",  createdAt:"2024-02-15T09:00:00", updatedAt:"2024-06-02T14:00:00", deleted:false, techCard:["Отбить куриное филе","Завернуть сливочное масло в филе","Панировка: мука → яйцо → сухари","Обжарка 3 мин с каждой стороны","Доготовка в духовке 15 мин при 180°C","Охлаждение и упаковка"] },
    { id:3, name:"Вареники с картошкой",category:"Вареники", description:"С картофелем и жареным луком",         costPrice:200, sellPrice:350, stock:200, unit:"кг", status:"готов",           createdAt:"2024-03-01T11:00:00", updatedAt:"2024-06-03T10:00:00", deleted:false, techCard:["Приготовить тесто","Сварить и размять картофель","Обжарить лук, добавить в начинку","Раскатать тесто, вырезать кружки","Лепка вареников","Заморозка и упаковка"] },
    { id:4, name:"Блинчики с мясом",    category:"Блинчики", description:"Тонкие блинчики с мясной начинкой",   costPrice:250, sellPrice:400, stock:60,  unit:"шт", status:"готов",           createdAt:"2024-03-15T08:00:00", updatedAt:"2024-06-04T09:00:00", deleted:false, techCard:["Приготовить блинное тесто","Выпечка блинов на сковороде","Приготовить мясную начинку","Завернуть начинку в блины","Обжарка блинчиков","Охлаждение и упаковка"] },
    { id:5, name:"Манты Узбекские",     category:"Манты",    description:"Традиционные с бараниной",             costPrice:350, sellPrice:550, stock:40,  unit:"шт", status:"в производстве",  createdAt:"2024-04-01T10:00:00", updatedAt:"2024-06-05T11:00:00", deleted:false, techCard:["Подготовить тесто (тонкое раскатывание)","Нарезать баранину и лук кубиками","Добавить специи и курдючный жир","Лепка мантов (классическая форма)","Варка на пару 45 мин","Охлаждение и упаковка"] },
  ]);

  await seedIfMissing("dk_raw_mats", [
    { id:1,  name:"Говядина",        category:"Мясо",    unit:"кг", stock:500, minStock:100, costPerUnit:650,  updatedAt:"2024-06-01T10:00:00" },
    { id:2,  name:"Телятина",        category:"Мясо",    unit:"кг", stock:400, minStock:80,  costPerUnit:550,  updatedAt:"2024-06-01T10:00:00" },
    { id:3,  name:"Курица (филе)",   category:"Мясо",    unit:"кг", stock:300, minStock:60,  costPerUnit:380,  updatedAt:"2024-06-01T10:00:00" },
    { id:4,  name:"Баранина",        category:"Мясо",    unit:"кг", stock:150, minStock:50,  costPerUnit:800,  updatedAt:"2024-06-01T10:00:00" },
    { id:5,  name:"Тесто пельменное",category:"Тесто",   unit:"кг", stock:600, minStock:150, costPerUnit:120,  updatedAt:"2024-06-01T10:00:00" },
    { id:6,  name:"Тесто блинное",   category:"Тесто",   unit:"кг", stock:200, minStock:50,  costPerUnit:90,   updatedAt:"2024-06-01T10:00:00" },
    { id:7,  name:"Картофель",       category:"Овощи",   unit:"кг", stock:800, minStock:200, costPerUnit:45,   updatedAt:"2024-06-01T10:00:00" },
    { id:8,  name:"Лук репчатый",    category:"Овощи",   unit:"кг", stock:300, minStock:80,  costPerUnit:35,   updatedAt:"2024-06-01T10:00:00" },
    { id:9,  name:"Масло сливочное", category:"Масло",   unit:"кг", stock:100, minStock:30,  costPerUnit:900,  updatedAt:"2024-06-01T10:00:00" },
    { id:10, name:"Специи (микс)",   category:"Специи",  unit:"кг", stock:50,  minStock:10,  costPerUnit:1200, updatedAt:"2024-06-01T10:00:00" },
    { id:11, name:"Соль",            category:"Специи",  unit:"кг", stock:100, minStock:20,  costPerUnit:30,   updatedAt:"2024-06-01T10:00:00" },
  ]);

  await seedIfMissing("dk_recipes", [
    { id:1, productId:1, items:[{rawId:1,qty:0.3,unit:"кг"},{rawId:2,qty:0.3,unit:"кг"},{rawId:5,qty:0.4,unit:"кг"},{rawId:8,qty:0.05,unit:"кг"},{rawId:10,qty:0.01,unit:"кг"},{rawId:11,qty:0.02,unit:"кг"}], createdAt:"2024-01-20T10:00:00", updatedAt:"2024-01-20T10:00:00" },
    { id:2, productId:2, items:[{rawId:3,qty:0.15,unit:"кг"},{rawId:9,qty:0.03,unit:"кг"},{rawId:10,qty:0.005,unit:"кг"},{rawId:11,qty:0.01,unit:"кг"}], createdAt:"2024-02-15T09:00:00", updatedAt:"2024-02-15T09:00:00" },
    { id:3, productId:3, items:[{rawId:5,qty:0.4,unit:"кг"},{rawId:7,qty:0.5,unit:"кг"},{rawId:8,qty:0.08,unit:"кг"},{rawId:9,qty:0.02,unit:"кг"},{rawId:11,qty:0.01,unit:"кг"}], createdAt:"2024-03-01T11:00:00", updatedAt:"2024-03-01T11:00:00" },
    { id:4, productId:4, items:[{rawId:1,qty:0.1,unit:"кг"},{rawId:2,qty:0.1,unit:"кг"},{rawId:6,qty:0.2,unit:"кг"},{rawId:8,qty:0.03,unit:"кг"},{rawId:10,qty:0.005,unit:"кг"}], createdAt:"2024-03-15T08:00:00", updatedAt:"2024-03-15T08:00:00" },
    { id:5, productId:5, items:[{rawId:4,qty:0.25,unit:"кг"},{rawId:5,qty:0.35,unit:"кг"},{rawId:8,qty:0.1,unit:"кг"},{rawId:10,qty:0.015,unit:"кг"},{rawId:11,qty:0.02,unit:"кг"}], createdAt:"2024-04-01T10:00:00", updatedAt:"2024-04-01T10:00:00" },
  ]);

  await seedIfMissing("dk_bonus_rules", [
    { id:1, fromQty:0,   bonusPercent:0,  label:"Стандарт"      },
    { id:2, fromQty:100, bonusPercent:5,  label:"Хорошо"        },
    { id:3, fromQty:250, bonusPercent:10, label:"Отлично"       },
    { id:4, fromQty:500, bonusPercent:15, label:"Топ результат" },
    { id:5, fromQty:800, bonusPercent:20, label:"Рекорд"        },
  ]);

  const ALL_CAMERAS = [
    { id:5, name:"Говорит Москва",   zone:"Улица",  type:"iframe", url:"https://video.govoritmoskva.ru/rufm/embed.html?autoplay=true",                                         enabled:true, description:"Веб-камера студии Говорит Москва",    refreshSec:5, createdAt:"2024-01-01T00:00:00" },
    { id:6, name:"Грозный Сити",     zone:"Улица",  type:"hls",    url:"https://camera.vt.ru:8888/cam1/index.m3u8",                                                             enabled:true, description:"HLS-камера Вайнах Телеком — Грозный", refreshSec:5, createdAt:"2024-01-01T00:00:00" },
    { id:7, name:"Мансур (медведь)", zone:"Улица",  type:"iframe", url:"https://vkvideo.ru/video_ext.php?oid=-135955999&id=456239536&hd=1&autoplay=1",                          enabled:true, description:"Трансляция медведя Мансур — ВКонтакте", refreshSec:5, createdAt:"2024-01-01T00:00:00" },
    { id:8, name:"Плаза СПА",        zone:"Улица",  type:"iframe", url:"https://open.ivideon.com/embed/v3/?server=100-PMOSoaWrNLw3bnCEKwk7RX&camera=0&width=&height=&lang=ru", enabled:true, description:"Камера Плаза СПА — ivideon",           refreshSec:5, createdAt:"2024-01-01T00:00:00" },
  ];
  await seedIfMissing("dk_cameras", ALL_CAMERAS);
  // Migration: replace camera list with exactly ALL_CAMERAS (removes old demo/deleted entries)
  const existingCameras = await readState("dk_cameras");
  if (existingCameras) {
    const seedMap = new Map(ALL_CAMERAS.map(c => [c.id, c]));
    const allowedIds = new Set(ALL_CAMERAS.map(c => c.id));
    // Keep only cameras that are in the seed; update url/type/description if changed
    const kept = existingCameras
      .filter(c => allowedIds.has(c.id))
      .map(c => {
        const seed = seedMap.get(c.id);
        if (c.url !== seed.url || c.type !== seed.type) {
          return { ...c, url: seed.url, type: seed.type, description: seed.description };
        }
        return c;
      });
    const keptIds = new Set(kept.map(c => c.id));
    const missing = ALL_CAMERAS.filter(c => !keptIds.has(c.id));
    const final = [...kept, ...missing];
    if (JSON.stringify(final) !== JSON.stringify(existingCameras)) {
      await writeState("dk_cameras", final);
      console.log(`[bootstrap] Cameras synced: ${final.length} active`);
    }
  }

  // All remaining keys: empty arrays (or objects) if missing
  const emptyArrayKeys = [
    "dk_tasks","dk_task_emps","dk_emp_hist","dk_prod_plans","dk_clients",
    "dk_client_orders","dk_sales","dk_inv_move","dk_suppliers","dk_deliveries",
    "dk_raw_movements","dk_notifications","dk_marks","dk_prod_outputs",
    "dk_debts","dk_batches","dk_defects","dk_payroll","dk_trash",
    "dk_email_codes","dk_logs",
  ];
  for (const key of emptyArrayKeys) await seedIfMissing(key, []);
  await seedIfMissing("dk_base_salaries", {});

  console.log("[bootstrap] Done");
}

const HOST = process.env.HOST || "127.0.0.1";

// ── RTSP → HLS via FFmpeg ──
const ffmpegProcs = new Map(); // cameraId → ChildProcess

// Resolve ffmpeg binary — check PATH first, then known WinGet install location
function findFfmpeg() {
  const candidates = [
    "ffmpeg",
    // WinGet default install for Gyan.FFmpeg
    join(process.env.LOCALAPPDATA || "", "Microsoft", "WinGet", "Packages",
      "Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe",
      "ffmpeg-8.1.1-full_build", "bin", "ffmpeg.exe"),
    // Common manual install
    "C:\\ffmpeg\\bin\\ffmpeg.exe",
    "/usr/bin/ffmpeg",
    "/usr/local/bin/ffmpeg",
  ];
  for (const c of candidates) {
    if (c === "ffmpeg") { try { require; } catch {} return c; } // always try bare name first
    if (fs.existsSync(c)) return c;
  }
  return "ffmpeg"; // fallback, will fail with clear error
}
const FFMPEG_BIN = findFfmpeg();
console.log(`[cameras] ffmpeg → ${FFMPEG_BIN}`);

function hlsDir(id) {
  return join(tmpdir(), "dikanish-hls", String(id));
}

function requireManager(req, res, next) {
  if (!req.user) return res.status(401).json({ error: "Не авторизован" });
  if (!satisfies(req.user.roleId, "manager")) return res.status(403).json({ error: "Недостаточно прав" });
  next();
}

app.post("/api/cameras/:id/start", requireManager, async (req, res) => {
  const { id } = req.params;
  const { rtspUrl } = req.body;
  if (!rtspUrl) return res.status(400).json({ error: "Укажите rtspUrl" });

  if (ffmpegProcs.has(id)) return res.json({ ok: true, already: true });

  const dir = hlsDir(id);
  try {
    await mkdir(dir, { recursive: true });
  } catch {}

  const isRtsp = rtspUrl.startsWith("rtsp://") || rtspUrl.startsWith("rtsps://");
  const inputArgs = isRtsp
    ? ["-rtsp_transport", "tcp", "-i", rtspUrl]
    : ["-i", rtspUrl]; // works for http/https HLS, MJPEG, MP4

  const proc = spawn(FFMPEG_BIN, [
    ...inputArgs,
    "-c:v", "copy",
    "-an",
    "-f", "hls",
    "-hls_time", "2",
    "-hls_list_size", "3",
    "-hls_flags", "delete_segments",
    join(dir, "index.m3u8"),
  ], { stdio: "ignore" });

  let startError = null;
  proc.on("error", (e) => {
    startError = e.message;
    console.error(`[ffmpeg cam ${id}]`, e.message);
    ffmpegProcs.delete(id);
  });
  proc.on("exit", (code) => {
    ffmpegProcs.delete(id);
    if (code !== 0) console.log(`[ffmpeg cam ${id}] exited with code ${code}`);
  });

  // Give FFmpeg 400ms to fail fast (e.g. binary not found)
  await new Promise(r => setTimeout(r, 400));
  if (startError) return res.status(500).json({ error: `FFmpeg: ${startError}` });

  ffmpegProcs.set(id, proc);
  res.json({ ok: true });
});

app.post("/api/cameras/:id/stop", requireManager, async (req, res) => {
  const { id } = req.params;
  const proc = ffmpegProcs.get(id);
  if (proc) {
    proc.kill("SIGKILL");
    ffmpegProcs.delete(id);
  }
  try { await rm(hlsDir(id), { recursive: true, force: true }); } catch {}
  res.json({ ok: true });
});

app.get("/api/cameras/:id/hls/:file", requireManager, (req, res) => {
  const filePath = join(hlsDir(req.params.id), req.params.file);
  if (!fs.existsSync(filePath)) return res.status(404).end();
  const ext = req.params.file.split(".").pop();
  res.setHeader("Content-Type", ext === "m3u8" ? "application/vnd.apple.mpegurl" : "video/MP2T");
  res.setHeader("Cache-Control", "no-cache");
  res.sendFile(filePath);
});

// ── HLS proxy (bypasses CORS on external streams) ──
app.get("/api/cameras/hls-proxy", requireManager, async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).end();
  try {
    const upstream = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!upstream.ok) return res.status(upstream.status).end();

    const ct = upstream.headers.get("content-type") || "";
    const isPlaylist = url.includes(".m3u8") || ct.includes("mpegurl");

    if (isPlaylist) {
      const base = url.substring(0, url.lastIndexOf("/") + 1);
      const text = await upstream.text();
      // Rewrite every non-comment line (segment URLs and sub-playlist URLs)
      const rewritten = text.split("\n").map(line => {
        const t = line.trim();
        if (!t || t.startsWith("#")) return line;
        const abs = t.startsWith("http") ? t : base + t;
        return `/api/cameras/hls-proxy?url=${encodeURIComponent(abs)}`;
      }).join("\n");
      res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
      res.setHeader("Cache-Control", "no-cache");
      return res.send(rewritten);
    }

    // Binary segment — stream directly
    res.setHeader("Content-Type", ct || "video/MP2T");
    res.setHeader("Cache-Control", "no-cache");
    const buf = await upstream.arrayBuffer();
    res.send(Buffer.from(buf));
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

// ── Health / ping (must be before SPA fallback) ──
app.get("/api/health", (_req, res) => res.json({ ok: true, service: "dikanish-api", time: Date.now() }));
app.get("/api/ping",   (_req, res) => res.json({ ok: true, time: Date.now() }));

// ── SPA fallback ──
app.get("*", (_req, res) => {
  if (fs.existsSync(join(distDir, "index.html"))) {
    res.sendFile(join(distDir, "index.html"));
  } else {
    res.status(503).send("App not built yet. Run: npm run build");
  }
});

// ── Startup ──
(async () => {
  try {
    await initDb();
    await bootstrapState();
    app.listen(PORT, HOST, () => {
      console.log(`Dikanish API running at http://${HOST}:${PORT}`);
    });
  } catch (e) {
    console.error("[startup] Fatal error:", e);
    process.exit(1);
  }
})();
