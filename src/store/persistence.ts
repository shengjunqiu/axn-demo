/**
 * 演示持久化（T-019 / AC-025）：仅写入本 Demo 命名空间（anneng-demo:v1:*），
 * 刷新后恢复草稿、会话与待补状态；中断任务降级为可重试失败态。
 * 不写入任何真实系统；清空时只清理本命名空间（AC-026）。
 */
const NAMESPACE = 'anneng-demo:v1';
const SCHEMA_VERSION = 1;

interface PersistEnvelope {
  __schema: number;
  data: unknown;
}

export function loadPersist<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(`${NAMESPACE}:${key}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistEnvelope;
    if (parsed.__schema !== SCHEMA_VERSION) return null;
    return parsed.data as T;
  } catch (error) {
    console.warn(`[anneng-demo] 持久化读取失败（${key}），按空状态处理。`, error);
    return null;
  }
}

export function savePersist(key: string, data: unknown): void {
  try {
    window.localStorage.setItem(`${NAMESPACE}:${key}`, JSON.stringify({ __schema: SCHEMA_VERSION, data }));
  } catch (error) {
    // 配额或隐私模式：演示环境降级为不持久化，不阻断主线。
    console.warn(`[anneng-demo] 持久化写入失败（${key}），本次刷新前状态仅保留在内存。`, error);
  }
}

export function clearPersist(key: string): void {
  try {
    window.localStorage.removeItem(`${NAMESPACE}:${key}`);
  } catch (error) {
    console.warn(`[anneng-demo] 持久化清理失败（${key}）。`, error);
  }
}

export function clearNamespace(): void {
  try {
    const stale: string[] = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith(`${NAMESPACE}:`)) stale.push(k);
    }
    stale.forEach((k) => window.localStorage.removeItem(k));
  } catch (error) {
    console.warn('[anneng-demo] 命名空间清理失败。', error);
  }
}
