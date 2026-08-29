// Pure, clock-driven queue for transient on-screen toasts. Kept free of DOM and
// timers so it is deterministically testable: the UI advances it each frame with
// the current clock and reads back the one message (if any) that should show.
//
// Design goals (see the iPhone notification work):
//  - One visible message at a time; nothing silently clobbers another.
//  - Priority preemption: a warning/critical cannot be swallowed by routine info.
//  - A warning/critical on screen suppresses equal-or-lower noise entirely.
//  - Readable duration: longer text and higher stakes stay up longer.
import type { NoticeLevel, NoticeMessage } from '../game/types';

const PRIORITY: Record<NoticeLevel, number> = { info: 0, warning: 1, critical: 2 };

const BASE_DURATION: Record<NoticeLevel, number> = {
  info: 1600,
  warning: 2600,
  critical: 3200,
};
const LENGTH_BONUS = 18; // ms per character beyond ~10
const MAX_DURATION = 4400;
const QUEUE_CAP = 3;

export interface NoticeEntry extends NoticeMessage {
  id: number;
  duration: number;
}

export function noticeDuration(text: string, level: NoticeLevel): number {
  const bonus = Math.max(0, text.length - 10) * LENGTH_BONUS;
  return Math.min(MAX_DURATION, BASE_DURATION[level] + bonus);
}

export class NoticeQueue {
  private active: NoticeEntry | null = null;
  private activeUntil = 0;
  private queue: NoticeEntry[] = [];
  private nextId = 1;

  /** Test/debug helper: how many messages are waiting behind the current one. */
  pendingCount(): number {
    return this.queue.length;
  }

  /** Offer a message for display. May be ignored (suppressed/deduped), may
   *  queue behind the current notice, or may preempt it. */
  push(message: NoticeMessage, now: number): void {
    const { text, level } = message;
    if (this.active && now >= this.activeUntil) this.clearActive();

    // De-dup identical text against whatever is visible or already queued.
    if (this.active?.text === text) return;
    if (this.queue.some((e) => e.text === text)) return;

    const entry: NoticeEntry = {
      text,
      level,
      id: this.nextId++,
      duration: noticeDuration(text, level),
    };

    if (!this.active) {
      this.activate(entry, now);
      return;
    }
    // Higher priority preempts the current notice.
    if (PRIORITY[level] > PRIORITY[this.active.level]) {
      this.activate(entry, now);
      return;
    }
    // A non-info notice on screen suppresses equal-or-lower noise entirely.
    if (this.active.level !== 'info') return;
    // Info-vs-info keeps a bounded FIFO queue.
    if (this.queue.length >= QUEUE_CAP) return;
    this.queue.push(entry);
  }

  /** Let elapsed time retire the current notice and surface the next one. */
  advance(now: number): void {
    if (this.active && now >= this.activeUntil) {
      this.clearActive();
      if (this.queue.length > 0) this.activate(this.takeNext(), now);
    }
  }

  current(): NoticeEntry | null {
    return this.active;
  }

  reset(): void {
    this.active = null;
    this.queue = [];
    this.activeUntil = 0;
  }

  private takeNext(): NoticeEntry {
    let best = 0;
    for (let i = 1; i < this.queue.length; i++) {
      if (PRIORITY[this.queue[i].level] > PRIORITY[this.queue[best].level]) best = i;
    }
    return this.queue.splice(best, 1)[0];
  }

  private activate(entry: NoticeEntry, now: number): void {
    this.active = entry;
    this.activeUntil = now + entry.duration;
  }

  private clearActive(): void {
    this.active = null;
    this.activeUntil = 0;
  }
}