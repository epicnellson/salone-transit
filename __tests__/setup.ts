import { vi } from "vitest";

process.env.SUPABASE_URL = "https://test.supabase.co";
process.env.SUPABASE_ANON_KEY = "test-anon-key";
process.env.MONIME_ACCESS_TOKEN = "test-monime-token";
process.env.MONIME_SPACE_ID = "test-space-id";
process.env.MONIME_WEBHOOK_SECRET = "test-webhook-secret";
process.env.AT_API_KEY = "test-at-api-key";
process.env.AT_USERNAME = "testuser";
process.env.AT_SANDBOX = "true";
process.env.SESSION_SECRET = "test-session-secret";
process.env.APP_URL = "http://localhost:3000";
process.env.CRON_SECRET = "test-cron-secret";

// ============================================================
// Mock Supabase
// ============================================================

type Table = keyof typeof mockSupabaseStore;
const TABLES: Record<string, Record<string, unknown>[]> = {};

// Foreign key mapping: table -> { column in this table -> referenced_table }
const FK_MAP: Record<string, Record<string, { table: string; localCol: string; refCol: string }>> = {
  bookings: {
    users: { table: "users", localCol: "user_id", refCol: "id" },
    routes: { table: "routes", localCol: "route_id", refCol: "id" },
    waves: { table: "waves", localCol: "wave_id", refCol: "id" },
  },
  payments: {
    bookings: { table: "bookings", localCol: "booking_id", refCol: "id" },
  },
  agents: {
    users: { table: "users", localCol: "user_id", refCol: "id" },
  },
  verifications: {},
  otp_codes: {},
  agent_sessions: {
    users: { table: "users", localCol: "user_id", refCol: "id" },
  },
  waves: {
    routes: { table: "routes", localCol: "route_id", refCol: "id" },
  },
  users: {},
  routes: {},
  sms_logs: {},
};

function resolveJoins(
  table: string,
  record: Record<string, unknown>,
  selectCols: string,
  depth = 0
): Record<string, unknown> {
  if (!selectCols || selectCols === "*" || depth > 3) return record;

  const fks = FK_MAP[table] || {};
  const result = { ...record };

  for (const colName of Object.keys(fks)) {
    if (selectCols.includes(colName)) {
      const fk = fks[colName];
      const refTable = TABLES[fk.table] || [];
      const localId = record[fk.localCol];
      const match = refTable.find((r) => r[fk.refCol] === localId) as Record<string, unknown> | undefined;
      if (match) {
        // Extract the sub-select from the select string for nested joins
        const nestedSelect = extractNestedSelect(selectCols, colName);
        result[colName] = resolveJoins(fk.table, match, nestedSelect, depth + 1);
      }
    }
  }

  return result;
}

function extractNestedSelect(selectCols: string, colName: string): string {
  // Parse patterns like "bookings!inner(*, routes!inner(origin, destination))"
  // Find the section after "colName" that contains nested parens
  const idx = selectCols.indexOf(colName);
  if (idx === -1) return "*";

  // Find the opening paren after the column name
  let start = selectCols.indexOf("(", idx + colName.length);
  if (start === -1) return "*";

  // Find matching close paren
  let depth = 1;
  let i = start + 1;
  while (i < selectCols.length && depth > 0) {
    if (selectCols[i] === "(") depth++;
    if (selectCols[i] === ")") depth--;
    i++;
  }
  return selectCols.substring(start + 1, i - 1);
}

export const mockSupabaseStore: Record<string, Record<string, unknown>[]> = {
  users: [],
  routes: [],
  waves: [],
  bookings: [],
  payments: [],
  agents: [],
  verifications: [],
  sms_logs: [],
  otp_codes: [],
  agent_sessions: [],
};

export function resetMockStore() {
  for (const key of Object.keys(mockSupabaseStore)) {
    mockSupabaseStore[key] = [];
  }
  for (const key of Object.keys(TABLES)) {
    TABLES[key] = [];
  }
}

function syncTables() {
  for (const key of Object.keys(mockSupabaseStore)) {
    TABLES[key] = mockSupabaseStore[key];
  }
}

let idCounter = 0;
function nextId() {
  return `mock-id-${++idCounter}`;
}

interface BuilderState {
  table: string;
  operation: "select" | "insert" | "update" | "delete";
  filters: Record<string, unknown>;
  selectCols: string;
  isSingle: boolean;
  isCount: boolean;
  isHead: boolean;
  insertData: unknown;
  updateData: unknown;
}

function createBuilder(state: BuilderState): Record<string, unknown> {
  const execute = (): { data: unknown; error: unknown; count: number | null } => {
    const table = TABLES[state.table] || [];

    // INSERT
    if (state.operation === "insert") {
      const records = Array.isArray(state.insertData) ? state.insertData : [state.insertData];
      const inserted = records.map((r: Record<string, unknown>) => {
        const rec = { id: r.id || nextId(), created_at: new Date().toISOString(), ...r };
        table.push(rec);
        return rec;
      });
      const result = inserted.length === 1 ? inserted[0] : inserted;
      return { data: state.isSingle ? inserted[0] : result, error: null, count: null };
    }

    // UPDATE
    if (state.operation === "update") {
      const updates = state.updateData as Record<string, unknown>;
      let updated: Record<string, unknown>[] = [];
      for (const rec of table) {
        if (matchesFilters(rec, state.filters)) {
          Object.assign(rec, updates);
          updated.push(rec);
        }
      }
      return { data: state.isSingle ? updated[0] || null : updated, error: null, count: null };
    }

    // DELETE
    if (state.operation === "delete") {
      const remaining: Record<string, unknown>[] = [];
      const deleted: Record<string, unknown>[] = [];
      for (const rec of table) {
        if (matchesFilters(rec, state.filters)) {
          deleted.push(rec);
        } else {
          remaining.push(rec);
        }
      }
      // Actually remove from TABLES
      const idx = table.length;
      TABLES[state.table] = remaining;
      syncTables();
      return { data: deleted, error: null, count: null };
    }

    // SELECT
    let results = table.filter((rec) => matchesFilters(rec, state.filters));
    results = results.map((r) => resolveJoins(state.table, r, state.selectCols));

    if (state.isHead) {
      return { data: null, error: null, count: results.length };
    }
    if (state.isCount) {
      return { data: results, error: null, count: results.length };
    }
    if (state.isSingle) {
      if (results.length === 0) {
        return { data: null, error: { message: "Not found", code: "PGRST116" }, count: null };
      }
      return { data: results[0], error: null, count: null };
    }
    return { data: results, error: null, count: results.length };
  };

  const b: Record<string, unknown> = {};

  b.select = (cols?: string, opts?: { count?: string; head?: boolean }) => {
    state.selectCols = cols || "*";
    if (opts?.count === "exact") state.isCount = true;
    if (opts?.head) state.isHead = true;
    return b;
  };

  b.insert = (data: unknown) => {
    state.operation = "insert";
    state.insertData = data;
    return b;
  };

  b.update = (data: unknown) => {
    state.operation = "update";
    state.updateData = data;
    return b;
  };

  b.delete = () => {
    state.operation = "delete";
    return b;
  };

  b.eq = (col: string, val: unknown) => {
    state.filters[col] = val;
    return b;
  };

  b.neq = (col: string, val: unknown) => {
    state.filters[`__neq__${col}`] = val;
    return b;
  };

  b.gt = (col: string, val: unknown) => {
    state.filters[`__gt__${col}`] = val;
    return b;
  };

  b.gte = (col: string, val: unknown) => {
    state.filters[`__gte__${col}`] = val;
    return b;
  };

  b.lte = (col: string, val: unknown) => {
    state.filters[`__lte__${col}`] = val;
    return b;
  };

  b.lt = (col: string, val: unknown) => {
    state.filters[`__lt__${col}`] = val;
    return b;
  };

  b.order = () => b;
  b.limit = () => b;
  b.range = () => b;

  b.single = () => {
    state.isSingle = true;
    return b;
  };

  // Make builder thenable so `await builder` works
  b.then = (resolve: (v: any) => any, reject?: (e: any) => any) => {
    const result = execute();
    return Promise.resolve(result).then(resolve, reject);
  };

  b.catch = (reject: (e: any) => any) => {
    return Promise.resolve(execute()).catch(reject);
  };

  return b;
}

function matchesFilters(record: Record<string, unknown>, filters: Record<string, unknown>): boolean {
  for (const [key, val] of Object.entries(filters)) {
    if (key.startsWith("__neq__")) {
      const col = key.slice(7);
      if (record[col] === val) return false;
    } else if (key.startsWith("__gt__")) {
      const col = key.slice(6);
      if ((record[col] as number) <= (val as number)) return false;
    } else if (key.startsWith("__gte__")) {
      const col = key.slice(7);
      if ((record[col] as number) < (val as number)) return false;
    } else if (key.startsWith("__lte__")) {
      const col = key.slice(7);
      if ((record[col] as number) > (val as number)) return false;
    } else if (key.startsWith("__lt__")) {
      const col = key.slice(6);
      if ((record[col] as number) >= (val as number)) return false;
    } else {
      if (record[key] !== val) return false;
    }
  }
  return true;
}

const supabaseMock = {
  from: (table: string) => {
    syncTables();
    const state: BuilderState = {
      table,
      operation: "select",
      filters: {},
      selectCols: "*",
      isSingle: false,
      isCount: false,
      isHead: false,
      insertData: null,
      updateData: null,
    };
    return createBuilder(state);
  },
};

vi.mock("@/lib/supabase", () => ({
  getSupabase: () => supabaseMock,
  supabase: supabaseMock,
}));

vi.mock("@/lib/supabase-admin", () => ({
  getSupabaseAdmin: () => supabaseMock,
  supabaseAdmin: supabaseMock,
}));

// ============================================================
// Mock Monime
// ============================================================

export const mockMonimeSessions: Record<string, { id: string; status: string; redirectUrl: string }> = {};

vi.mock("@/lib/monime", () => ({
  createCheckoutSession: vi.fn(async (opts: { reference?: string }) => {
    const id = `monime-sess-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const session = {
      id,
      status: "pending",
      redirectUrl: `https://checkout.monime.io/${id}`,
      orderNumber: null,
      reference: opts.reference || null,
    };
    mockMonimeSessions[id] = session;
    return session;
  }),
  getCheckoutSession: vi.fn(async (id: string) => {
    return mockMonimeSessions[id] || { id, status: "unknown", redirectUrl: "" };
  }),
  verifyWebhookSignature: vi.fn((rawBody: string, sig: string | null) => {
    if (!sig) return false;
    const crypto = require("crypto");
    const expected = "sha256=" + crypto.createHmac("sha256", "test-webhook-secret").update(rawBody).digest("hex");
    return sig === expected;
  }),
}));

// ============================================================
// Mock SMS
// ============================================================

export const mockSmsLog: Array<{ phone: string; message: string; purpose: string }> = [];

vi.mock("@/lib/sms", () => ({
  sendSms: vi.fn(async (phone: string, message: string, purpose: string) => {
    mockSmsLog.push({ phone, message, purpose });
    return true;
  }),
  normalizePhone: vi.fn((phone: string) => phone),
}));

// ============================================================
// Mock cookies (persistent store per test)
// ============================================================

let cookieStore: Record<string, string> = {};

export function setTestCookie(name: string, value: string) {
  cookieStore[name] = value;
}

export function clearTestCookies() {
  cookieStore = {};
}

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) => (cookieStore[name] !== undefined ? { value: cookieStore[name] } : undefined),
    set: (name: string, value: string) => {
      cookieStore[name] = value;
    },
    getAll: () =>
      Object.entries(cookieStore).map(([name, value]) => ({ name, value })),
  })),
}));

// ============================================================
// Mock auth
// ============================================================

vi.mock("@/lib/auth", async (importOriginal) => {
  const orig = await importOriginal<typeof import("@/lib/auth")>();
  return {
    ...orig,
    getAgentFromSession: vi.fn(async (signedToken: string) => {
      if (!signedToken || signedToken === "invalid") return null;
      return {
        userId: "agent-user-1",
        agentId: "agent-1",
        stationLocation: "Freetown Central",
        commissionRate: 5,
      };
    }),
    getAdminFromSession: vi.fn(async (signedToken: string) => {
      if (!signedToken || signedToken === "invalid") return null;
      return { userId: "admin-user-1", role: "admin" };
    }),
    signSessionToken: vi.fn((token: string) => `signed.${token}`),
    verifySessionToken: vi.fn((signed: string) => {
      if (!signed || signed === "invalid") return null;
      return signed.replace("signed.", "");
    }),
    generateSessionToken: vi.fn(() => `tok-${Date.now()}-${Math.random().toString(36).slice(2)}`),
  };
});
