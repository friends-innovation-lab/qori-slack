/**
 * Coach Heartbeat Independence Tests — Coach M2 Debug
 *
 * Tests that heartbeat setInterval continues to fire even when
 * the provider call is blocked/pending. This is critical for
 * preventing false stale detection.
 *
 * Architecture note:
 * - setInterval schedules callbacks in the Node.js event loop
 * - Async operations (network I/O) yield to the event loop
 * - If provider.generateReview() is truly async (not blocking the loop),
 *   heartbeat callbacks should still fire during the wait
 *
 * This test verifies that behavior.
 */

import { COACH_HEARTBEAT_INTERVAL_MS } from '../../coaching/config';

describe('setInterval independence from async operations', () => {
  it('setInterval fires during pending async operation (proving event loop is not blocked)', async () => {
    const heartbeatCalls: number[] = [];
    const startTime = Date.now();

    // Set up heartbeat interval
    const heartbeatInterval = setInterval(() => {
      heartbeatCalls.push(Date.now() - startTime);
    }, 50); // 50ms interval for faster testing

    // Create a slow async operation (simulating provider call)
    const slowOperation = new Promise<void>((resolve) => {
      setTimeout(resolve, 200); // 200ms delay
    });

    // Wait for the slow operation
    await slowOperation;

    // Stop heartbeat
    clearInterval(heartbeatInterval);

    // Verify heartbeat fired multiple times during the slow operation
    // At 50ms interval over 200ms, we expect ~3-4 heartbeats
    expect(heartbeatCalls.length).toBeGreaterThanOrEqual(2);

    // Verify timing - first heartbeat should be around 50ms
    expect(heartbeatCalls[0]).toBeGreaterThanOrEqual(45);
    expect(heartbeatCalls[0]).toBeLessThan(75);

    // Verify subsequent heartbeats followed interval
    if (heartbeatCalls.length >= 2) {
      const delta = heartbeatCalls[1] - heartbeatCalls[0];
      expect(delta).toBeGreaterThanOrEqual(40);
      expect(delta).toBeLessThan(70);
    }
  });

  it('heartbeat continues firing during never-resolving promise (until cleared)', async () => {
    const heartbeatCalls: number[] = [];
    const startTime = Date.now();

    // Set up heartbeat interval
    const heartbeatInterval = setInterval(() => {
      heartbeatCalls.push(Date.now() - startTime);
    }, 25); // 25ms interval

    // Create a promise that we control
    let resolveControl: () => void;
    const controlledPromise = new Promise<void>((resolve) => {
      resolveControl = resolve;
    });

    // Race the controlled promise against a fixed timeout
    await Promise.race([
      controlledPromise,
      new Promise<void>((resolve) => {
        setTimeout(() => {
          resolveControl!(); // Resolve the controlled promise
          resolve();
        }, 150); // 150ms
      }),
    ]);

    clearInterval(heartbeatInterval);

    // Should have ~5-6 heartbeats in 150ms at 25ms intervals
    expect(heartbeatCalls.length).toBeGreaterThanOrEqual(4);
  });

  it('simulates real Coach execution pattern with heartbeat during provider call', async () => {
    // This test simulates the actual Coach execution pattern:
    // 1. Heartbeat interval starts
    // 2. Provider call begins (async, takes time)
    // 3. Heartbeat should continue firing during provider call
    // 4. Provider completes, heartbeat stops

    const heartbeatLog: Array<{ time: number; action: 'heartbeat' | 'provider_start' | 'provider_end' }> = [];
    const startTime = Date.now();

    const log = (action: 'heartbeat' | 'provider_start' | 'provider_end') => {
      heartbeatLog.push({ time: Date.now() - startTime, action });
    };

    // Start heartbeat (using smaller interval for testing)
    const heartbeatInterval = setInterval(() => {
      log('heartbeat');
    }, 30); // 30ms

    // Simulate provider call pattern
    log('provider_start');
    await new Promise<void>((resolve) => {
      setTimeout(() => {
        log('provider_end');
        resolve();
      }, 120); // 120ms provider call
    });

    clearInterval(heartbeatInterval);

    // Verify sequence
    const providerStart = heartbeatLog.find(e => e.action === 'provider_start');
    const providerEnd = heartbeatLog.find(e => e.action === 'provider_end');
    const heartbeats = heartbeatLog.filter(e => e.action === 'heartbeat');

    expect(providerStart).toBeDefined();
    expect(providerEnd).toBeDefined();

    // Should have heartbeats that fired DURING the provider call
    const heartbeatsDuringProvider = heartbeats.filter(
      h => h.time > providerStart!.time && h.time < providerEnd!.time
    );

    // At 30ms interval over ~120ms, expect 3-4 heartbeats during provider call
    expect(heartbeatsDuringProvider.length).toBeGreaterThanOrEqual(2);
  });

  it('async database call (simulated) does not block heartbeat', async () => {
    const heartbeatCalls: number[] = [];
    const startTime = Date.now();

    const heartbeatInterval = setInterval(() => {
      heartbeatCalls.push(Date.now() - startTime);
    }, 20); // 20ms

    // Simulate async DB calls (like updateHeartbeat would do)
    const asyncDbCall = (): Promise<boolean> => {
      return new Promise((resolve) => {
        // Simulate network latency
        setTimeout(() => resolve(true), 10);
      });
    };

    // Multiple async operations in sequence
    await asyncDbCall();
    await asyncDbCall();
    await asyncDbCall();
    await new Promise((resolve) => setTimeout(resolve, 80));

    clearInterval(heartbeatInterval);

    // Heartbeat should have fired throughout
    expect(heartbeatCalls.length).toBeGreaterThanOrEqual(4);
  });
});

describe('WARNING: event loop blocking WILL stop heartbeat', () => {
  it('DEMONSTRATES: synchronous CPU-bound work BLOCKS heartbeat', async () => {
    const heartbeatCalls: number[] = [];
    const startTime = Date.now();

    const heartbeatInterval = setInterval(() => {
      heartbeatCalls.push(Date.now() - startTime);
    }, 20); // 20ms

    // Wait a bit for one heartbeat
    await new Promise((resolve) => setTimeout(resolve, 30));

    // Block the event loop with synchronous work
    // WARNING: This blocks the event loop, preventing heartbeat callbacks
    const blockingStart = Date.now();
    while (Date.now() - blockingStart < 100) {
      // Busy loop - BLOCKS EVENT LOOP
      // This is what would happen if llm.invoke() did sync work
    }

    // Now let event loop catch up
    await new Promise((resolve) => setTimeout(resolve, 50));

    clearInterval(heartbeatInterval);

    // Count heartbeats before, during, after blocking period
    const heartbeatsBeforeBlock = heartbeatCalls.filter(t => t < 30);
    const heartbeatsDuringBlock = heartbeatCalls.filter(t => t >= 30 && t < 130);
    const heartbeatsAfterBlock = heartbeatCalls.filter(t => t >= 130);

    // Should have heartbeat before block
    expect(heartbeatsBeforeBlock.length).toBeGreaterThanOrEqual(1);

    // Should have very few (maybe 0-1 that fired right after block ended) during "block period"
    // because the loop was blocked
    expect(heartbeatsDuringBlock.length).toBeLessThanOrEqual(2);

    // Should resume heartbeats after block
    expect(heartbeatsAfterBlock.length).toBeGreaterThanOrEqual(1);
  });
});

describe('Coach heartbeat configuration', () => {
  it('heartbeat interval is configured (sanity check)', () => {
    expect(COACH_HEARTBEAT_INTERVAL_MS).toBeDefined();
    expect(typeof COACH_HEARTBEAT_INTERVAL_MS).toBe('number');
    expect(COACH_HEARTBEAT_INTERVAL_MS).toBeGreaterThan(0);
  });

  it('heartbeat interval is reasonable (5-60 seconds)', () => {
    expect(COACH_HEARTBEAT_INTERVAL_MS).toBeGreaterThanOrEqual(5000);
    expect(COACH_HEARTBEAT_INTERVAL_MS).toBeLessThanOrEqual(60000);
  });
});
