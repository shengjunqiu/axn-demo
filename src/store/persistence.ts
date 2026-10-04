/**
 * 模拟持久化（T-019 / AC-025）：仅写入本模拟命名空间（anneng-demo:v1:*），
 * 刷新后恢复草稿、会话与待补状态；中断任务降级为可重试失败态。
 * 不写入任何真实系统；清空时只清理本命名空间（AC-026）。
 *
 * 写入策略（性能）：store 的任何 set 都会触发订阅器，但只有「被持久化的切片」的引用
 * 发生变化时才需要序列化与落盘。因此：
 *  1. 切片引用全等 → 整次写入（含 JSON.stringify）直接跳过。侧栏折叠、导航高亮等
 *     纯 UI 状态不改变任何被持久化切片，代价为零。
 *  2. 引用确实变化（如编辑器连续击键）→ 合并到 WRITE_DEBOUNCE_MS 窗口内，停顿后
 *     只写一次，避免每次按键都序列化整个 store 并同步写盘。
 * 页面隐藏/卸载前强制冲刷，保证刷新不丢最后一个合并窗口。
 */
const NAMESPACE = 'anneng-demo:v1';
const SCHEMA_VERSION = 2; // v2：种子事件标题去除“区域 A/B”前缀，旧持久化数据失效重建

/** 连续变化（击键、流式事件）合并到一个窗口内只落盘一次。 */
const WRITE_DEBOUNCE_MS = 250;

interface PersistEnvelope {
  __schema: number;
  data: unknown;
}

interface PersistSlot {
  /** 上次排队时被持久化切片的引用；与本次全等则整次写入跳过。 */
  refs: readonly unknown[] | null;
  /** 待写入的 payload（zustand 状态快照不可变，无需克隆）。 */
  pending: unknown;
  hasPending: boolean;
  timer: ReturnType<typeof setTimeout> | null;
}

const slots = new Map<string, PersistSlot>();
const storageKey = (key: string) => `${NAMESPACE}:${key}`;

function slotOf(key: string): PersistSlot {
  let slot = slots.get(key);
  if (!slot) {
    slot = { refs: null, pending: null, hasPending: false, timer: null };
    slots.set(key, slot);
  }
  return slot;
}

export function loadPersist<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(storageKey(key));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistEnvelope;
    if (parsed.__schema !== SCHEMA_VERSION) return null;
    return parsed.data as T;
  } catch (error) {
    console.error(`[anneng-demo] 持久化读取失败（${key}），按空状态处理。`, error);
    return null;
  }
}

function writeNow(key: string): void {
  const slot = slotOf(key);
  if (slot.timer !== null) {
    clearTimeout(slot.timer);
    slot.timer = null;
  }
  if (!slot.hasPending) return;
  const data = slot.pending;
  slot.pending = null;
  slot.hasPending = false;
  try {
    window.localStorage.setItem(storageKey(key), JSON.stringify({ __schema: SCHEMA_VERSION, data }));
  } catch (error) {
    // 配额或隐私模式：模拟环境降级为不持久化，不阻断主线。
    console.error(`[anneng-demo] 持久化写入失败（${key}），本次刷新前状态仅保留在内存。`, error);
  }
}

/** 立即写出待写入内容；不传 key 则冲刷全部。页面隐藏/卸载前调用。 */
export function flushPersist(key?: string): void {
  if (key !== undefined) {
    writeNow(key);
    return;
  }
  for (const k of [...slots.keys()]) writeNow(k);
}

/**
 * 排队持久化一次状态变化。
 * @param data 本次要落盘的 payload；其自身属性值即被持久化切片的引用，
 *             用于判断是否真的需要写盘（属性插入顺序必须稳定，否则退化为每次写入）。
 */
export function schedulePersist<T extends { [K in keyof T]: unknown }>(key: string, data: T): void {
  const slot = slotOf(key);
  const refs = Object.values(data) as readonly unknown[];
  const unchanged = slot.refs !== null && slot.refs.length === refs.length && refs.every((ref, i) => ref === slot.refs?.[i]);
  if (unchanged) return;
  slot.refs = refs;
  slot.pending = data;
  slot.hasPending = true;
  if (slot.timer !== null) clearTimeout(slot.timer);
  slot.timer = setTimeout(() => writeNow(key), WRITE_DEBOUNCE_MS);
}

export function clearPersist(key: string): void {
  const slot = slotOf(key);
  if (slot.timer !== null) {
    clearTimeout(slot.timer);
    slot.timer = null;
  }
  // 丢弃在途写入并清空引用基线：紧随其后的 set 必须重新落盘，避免清空被旧快照覆盖。
  slot.pending = null;
  slot.hasPending = false;
  slot.refs = null;
  try {
    window.localStorage.removeItem(storageKey(key));
  } catch (error) {
    console.error(`[anneng-demo] 持久化清理失败（${key}）。`, error);
  }
}

/** 页面隐藏/卸载前冲刷待写入，避免丢掉最后一个合并窗口（硬刷新即依赖此路径）。 */
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => flushPersist());
  window.addEventListener('beforeunload', () => flushPersist());
}
