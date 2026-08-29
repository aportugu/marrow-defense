import { describe, expect, it } from 'vitest';
import { NoticeQueue, noticeDuration } from './NoticeQueue';

function drain(q: NoticeQueue, from: number, to: number, step = 500): void {
  for (let t = from; t <= to; t += step) q.advance(t);
}

describe('NoticeQueue', () => {
  it('shows the first message immediately', () => {
    const q = new NoticeQueue();
    q.push({ text: 'Wave 1 cleared', level: 'info' }, 0);
    expect(q.current()).toMatchObject({ text: 'Wave 1 cleared', level: 'info' });
  });

  it('queues a routine info behind the current one instead of clobbering it', () => {
    const q = new NoticeQueue();
    q.push({ text: 'TOCI activated', level: 'info' }, 0);
    q.push({ text: 'G-CSF is ready', level: 'info' }, 10);
    expect(q.current()?.text).toBe('TOCI activated');
    // After the first notice's lifetime, the queued one surfaces.
    q.advance(1700);
    expect(q.current()?.text).toBe('G-CSF is ready');
  });

  it('lets a critical preempt a routine info immediately', () => {
    const q = new NoticeQueue();
    q.push({ text: 'G-CSF is ready', level: 'info' }, 0);
    q.push({ text: 'PLASMA-CELL SURGE — PORTAL VEIN', level: 'critical' }, 10);
    expect(q.current()?.text).toBe('PLASMA-CELL SURGE — PORTAL VEIN');
    expect(q.current()?.level).toBe('critical');
  });

  it('suppresses equal-or-lower noise while a warning is on screen', () => {
    const q = new NoticeQueue();
    q.push({ text: 'CRS danger', level: 'warning' }, 0);
    q.push({ text: 'TOCI is ready', level: 'info' }, 5);
    drain(q, 5, 100);
    // The suppressed info never resurfaces.
    drain(q, 3000, 9000);
    expect(q.current()).toBeNull();
  });

  it('de-dups identical text', () => {
    const q = new NoticeQueue();
    q.push({ text: 'Too close to the marrow stream', level: 'warning' }, 0);
    q.push({ text: 'Too close to the marrow stream', level: 'warning' }, 5);
    drain(q, 5, 100);
    expect(q.pendingCount()).toBe(0);
  });

  it('surfaces the highest priority pending entry first', () => {
    const q = new NoticeQueue();
    q.push({ text: 'first', level: 'info' }, 0);
    q.push({ text: 'low', level: 'info' }, 5);
    q.push({ text: 'high', level: 'critical' }, 6);
    // The critical preempts the running info at once.
    expect(q.current()?.text).toBe('high');
  });

  it('scales duration by level and by text length', () => {
    expect(noticeDuration('short', 'info')).toBeLessThan(noticeDuration('short', 'critical'));
    expect(noticeDuration('short', 'warning')).toBeLessThan(noticeDuration('long '.repeat(30), 'warning'));
    expect(noticeDuration('x'.repeat(400), 'critical')).toBeLessThanOrEqual(4400);
  });

  it('does not let a stale message block a fresh push', () => {
    const q = new NoticeQueue();
    q.push({ text: 'old info', level: 'info' }, 0);
    // Far past the info's lifetime: the new message takes the slot at once.
    q.push({ text: 'new critical', level: 'critical' }, 10000);
    expect(q.current()?.text).toBe('new critical');
  });

  it('reset clears everything', () => {
    const q = new NoticeQueue();
    q.push({ text: 'a', level: 'warning' }, 0);
    q.push({ text: 'b', level: 'info' }, 5);
    q.reset();
    expect(q.current()).toBeNull();
    expect(q.pendingCount()).toBe(0);
  });
});