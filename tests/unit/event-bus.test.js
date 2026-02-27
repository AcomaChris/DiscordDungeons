import { describe, it, expect, beforeEach } from 'vitest';
import { EventBus } from '../../client/src/core/EventBus.js';

describe('EventBus', () => {
  let bus;

  beforeEach(() => {
    bus = new EventBus();
  });

  it('calls subscribers when an event is emitted', () => {
    const calls = [];
    bus.on('test', (data) => calls.push(data));
    bus.emit('test', 'hello');
    expect(calls).toEqual(['hello']);
  });

  it('supports multiple subscribers', () => {
    const calls = [];
    bus.on('test', () => calls.push('a'));
    bus.on('test', () => calls.push('b'));
    bus.emit('test');
    expect(calls).toEqual(['a', 'b']);
  });

  it('does nothing when emitting an event with no subscribers', () => {
    expect(() => bus.emit('nonexistent')).not.toThrow();
  });

  it('removes a specific subscriber with off()', () => {
    const calls = [];
    const handler = () => calls.push('removed');
    bus.on('test', handler);
    bus.off('test', handler);
    bus.emit('test');
    expect(calls).toEqual([]);
  });

  it('passes multiple arguments to subscribers', () => {
    const calls = [];
    bus.on('test', (a, b) => calls.push([a, b]));
    bus.emit('test', 1, 2);
    expect(calls).toEqual([[1, 2]]);
  });

  it('clears all listeners on reset()', () => {
    const calls = [];
    bus.on('a', () => calls.push('a'));
    bus.on('b', () => calls.push('b'));
    bus.reset();
    bus.emit('a');
    bus.emit('b');
    expect(calls).toEqual([]);
  });
});
