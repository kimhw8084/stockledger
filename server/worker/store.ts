import { DatabaseSync, backup } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { chmodSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { validateAppData } from "../../src/domain/appDataSchema";
import type { AppData } from "../../src/types";

export class WorkerStore {
  private db: DatabaseSync;
  constructor(path: string) {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(path);
    if (path !== ":memory:") chmodSync(path, 0o600);
    this.db.exec("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;");
    const version = this.db.prepare("PRAGMA user_version").get()?.user_version;
    if (version !== 0 && version !== 1) throw new Error("Unsupported worker database version.");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS workspace (id INTEGER PRIMARY KEY CHECK(id=1), revision INTEGER NOT NULL, payload TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS recovery (revision INTEGER PRIMARY KEY, payload TEXT NOT NULL, saved_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS jobs (id TEXT PRIMARY KEY, status TEXT NOT NULL, token TEXT NOT NULL, lease_until INTEGER NOT NULL, attempts INTEGER NOT NULL, error TEXT, completed_at TEXT);
      CREATE TABLE IF NOT EXISTS outbox (id TEXT PRIMARY KEY, job_id TEXT NOT NULL REFERENCES jobs(id), payload TEXT NOT NULL, created_at TEXT NOT NULL, delivered_at TEXT);
      PRAGMA user_version=1;
    `);
  }
  close() { this.db.close(); }
  load(): { revision: number; data: AppData } | null {
    const row = this.db.prepare("SELECT revision,payload FROM workspace WHERE id=1").get();
    return row ? { revision: Number(row.revision), data: validateAppData(JSON.parse(String(row.payload))) } : null;
  }
  private transaction<T>(run: () => T): T {
    this.db.exec("BEGIN IMMEDIATE");
    try { const result = run(); this.db.exec("COMMIT"); return result; }
    catch (error) { this.db.exec("ROLLBACK"); throw error; }
  }
  private writeInside(data: AppData, expectedRevision: number) {
    const current = this.load();
    if ((current?.revision ?? 0) !== expectedRevision) throw new Error("Workspace revision conflict; export and reconcile before retrying.");
    if (current) this.db.prepare("INSERT OR REPLACE INTO recovery VALUES (?,?,?)").run(current.revision, JSON.stringify(current.data), new Date().toISOString());
    this.db.prepare("INSERT INTO workspace VALUES(1,?,?) ON CONFLICT(id) DO UPDATE SET revision=excluded.revision,payload=excluded.payload").run(expectedRevision + 1, JSON.stringify(validateAppData(data)));
    this.db.exec("DELETE FROM recovery WHERE revision NOT IN (SELECT revision FROM recovery ORDER BY revision DESC LIMIT 5)");
  }
  import(data: AppData, expectedRevision: number) { this.transaction(() => this.writeInside(data, expectedRevision)); }
  claim(id: string, now = Date.now(), leaseMs = 15 * 60_000): string | null {
    return this.transaction(() => {
      const job = this.db.prepare("SELECT * FROM jobs WHERE id=?").get(id);
      if (job && (job.status === "completed" || Number(job.lease_until) > now || Number(job.attempts) >= 5)) return null;
      const token = randomUUID();
      this.db.prepare("INSERT INTO jobs(id,status,token,lease_until,attempts) VALUES(?,'running',?,?,1) ON CONFLICT(id) DO UPDATE SET status='running',token=excluded.token,lease_until=excluded.lease_until,attempts=jobs.attempts+1,error=NULL").run(id, token, now + leaseMs);
      return token;
    });
  }
  complete(id: string, token: string, data: AppData, expectedRevision: number, now = Date.now()) {
    this.transaction(() => {
      const job = this.db.prepare("SELECT * FROM jobs WHERE id=?").get(id);
      if (!job || job.token !== token || job.status !== "running" || Number(job.lease_until) < now) throw new Error("Worker lease expired or replaced.");
      this.writeInside(data, expectedRevision);
      const timestamp = new Date(now).toISOString();
      this.db.prepare("UPDATE jobs SET status='completed',completed_at=?,lease_until=0 WHERE id=?").run(timestamp,id);
      this.db.prepare("INSERT OR IGNORE INTO outbox(id,job_id,payload,created_at) VALUES(?,?,?,?)").run(`summary-${id}`, id, JSON.stringify({ type: "scan.completed", scanRunId: data.scanRuns[0]?.id, newAlerts: data.alerts.filter(alert => !alert.reviewed).length }), timestamp);
    });
  }
  fail(id: string, token: string, message: string, now = Date.now()) {
    this.db.prepare("UPDATE jobs SET status='failed',error=?,lease_until=? WHERE id=? AND token=? AND status='running'").run(message.slice(0,1000), now + 60_000, id, token);
  }
  pendingOutbox() { return this.db.prepare("SELECT id,payload FROM outbox WHERE delivered_at IS NULL ORDER BY created_at").all(); }
  acknowledge(id: string) { this.db.prepare("UPDATE outbox SET delivered_at=? WHERE id=?").run(new Date().toISOString(),id); }
  async backup(path: string) { mkdirSync(dirname(path), { recursive: true, mode: 0o700 }); await backup(this.db, path); chmodSync(path, 0o600); }
  integrityCheck() { return this.db.prepare("PRAGMA integrity_check").get()?.integrity_check === "ok"; }
}
