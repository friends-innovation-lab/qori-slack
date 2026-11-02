/**
 * Controlled Execution Context Tests — DISC-WEB-1D-2 M4/M5b
 *
 * Tests the AsyncLocalStorage-based context for controlled Discovery execution.
 * Verifies context isolation, immutability, lifecycle tracking, and proper cleanup.
 *
 * M5b additions:
 * - Lifecycle tracking (active vs expired)
 * - Detached async descendant detection
 * - requireValidControlledContext() fail-closed helper
 * - Both sessionId and discoveryRunId required
 */

import {
  getControlledContext,
  isInControlledContext,
  getControlledSessionId,
  getControlledRunId,
  isLifecycleActive,
  getActiveLifecycleCount,
  hasValidControlledContext,
  requireValidControlledContext,
  runInControlledContext,
  runInControlledContextSync,
  InvalidContextParameterError,
  NestedControlledContextError,
  ExpiredControlledContextError,
  NoControlledContextError,
  AsyncCallbackInSyncContextError,
  _resetLifecycleState,
  type ControlledExecutionContext,
} from '../../context/controlledExecutionContext';

describe('DISC-WEB-1D-2 M4/M5b: Controlled Execution Context', () => {
  // Reset lifecycle state before each test to ensure isolation
  beforeEach(() => {
    _resetLifecycleState();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Normal execution (no context)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('normal execution (no context)', () => {
    it('returns undefined from getControlledContext()', () => {
      expect(getControlledContext()).toBeUndefined();
    });

    it('returns false from isInControlledContext()', () => {
      expect(isInControlledContext()).toBe(false);
    });

    it('returns undefined from getControlledSessionId()', () => {
      expect(getControlledSessionId()).toBeUndefined();
    });

    it('returns undefined from getControlledRunId()', () => {
      expect(getControlledRunId()).toBeUndefined();
    });

    it('returns false from hasValidControlledContext()', () => {
      expect(hasValidControlledContext()).toBe(false);
    });

    it('throws NoControlledContextError from requireValidControlledContext()', () => {
      expect(() => requireValidControlledContext()).toThrow(NoControlledContextError);
    });

    it('has zero active lifecycles', () => {
      expect(getActiveLifecycleCount()).toBe(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Context available inside callbacks
  // ═══════════════════════════════════════════════════════════════════════════

  describe('context available inside callbacks', () => {
    it('provides context inside async callback', async () => {
      let capturedContext: ControlledExecutionContext | undefined;

      await runInControlledContext(
        { sessionId: 42, discoveryRunId: 100, purpose: 'test-async' },
        async () => {
          capturedContext = getControlledContext();
        },
      );

      expect(capturedContext).toBeDefined();
      expect(capturedContext?.sessionId).toBe(42);
      expect(capturedContext?.discoveryRunId).toBe(100);
      expect(capturedContext?.isControlled).toBe(true);
      expect(capturedContext?.purpose).toBe('test-async');
    });

    it('provides context inside sync callback', () => {
      let capturedContext: ControlledExecutionContext | undefined;

      runInControlledContextSync(
        { sessionId: 99, discoveryRunId: 200, purpose: 'test-sync' },
        () => {
          capturedContext = getControlledContext();
        },
      );

      expect(capturedContext).toBeDefined();
      expect(capturedContext?.sessionId).toBe(99);
      expect(capturedContext?.discoveryRunId).toBe(200);
      expect(capturedContext?.isControlled).toBe(true);
    });

    it('isInControlledContext() returns true inside callback', async () => {
      let wasInContext = false;

      await runInControlledContext({ sessionId: 1, discoveryRunId: 1 }, async () => {
        wasInContext = isInControlledContext();
      });

      expect(wasInContext).toBe(true);
    });

    it('getControlledSessionId() returns session ID inside callback', async () => {
      let capturedId: number | undefined;

      await runInControlledContext({ sessionId: 123, discoveryRunId: 456 }, async () => {
        capturedId = getControlledSessionId();
      });

      expect(capturedId).toBe(123);
    });

    it('getControlledRunId() returns run ID inside callback', async () => {
      let capturedId: number | undefined;

      await runInControlledContext({ sessionId: 123, discoveryRunId: 456 }, async () => {
        capturedId = getControlledRunId();
      });

      expect(capturedId).toBe(456);
    });

    it('includes createdAt timestamp', async () => {
      let capturedContext: ControlledExecutionContext | undefined;
      const beforeTime = new Date().toISOString();

      await runInControlledContext({ sessionId: 1, discoveryRunId: 1 }, async () => {
        capturedContext = getControlledContext();
      });

      const afterTime = new Date().toISOString();
      expect(capturedContext?.createdAt).toBeDefined();
      expect(capturedContext!.createdAt >= beforeTime).toBe(true);
      expect(capturedContext!.createdAt <= afterTime).toBe(true);
    });

    it('includes unique lifecycleId', async () => {
      const lifecycleIds: number[] = [];

      await runInControlledContext({ sessionId: 1, discoveryRunId: 1 }, async () => {
        lifecycleIds.push(getControlledContext()!.lifecycleId);
      });

      await runInControlledContext({ sessionId: 2, discoveryRunId: 2 }, async () => {
        lifecycleIds.push(getControlledContext()!.lifecycleId);
      });

      expect(lifecycleIds[0]).not.toBe(lifecycleIds[1]);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Lifecycle tracking
  // ═══════════════════════════════════════════════════════════════════════════

  describe('lifecycle tracking', () => {
    it('lifecycle is active during callback', async () => {
      let wasActive = false;
      let lifecycleId: number | undefined;

      await runInControlledContext({ sessionId: 1, discoveryRunId: 1 }, async () => {
        lifecycleId = getControlledContext()!.lifecycleId;
        wasActive = isLifecycleActive(lifecycleId);
      });

      expect(wasActive).toBe(true);
    });

    it('lifecycle is inactive after callback completes', async () => {
      let lifecycleId: number | undefined;

      await runInControlledContext({ sessionId: 1, discoveryRunId: 1 }, async () => {
        lifecycleId = getControlledContext()!.lifecycleId;
      });

      expect(isLifecycleActive(lifecycleId!)).toBe(false);
    });

    it('lifecycle is inactive after callback throws', async () => {
      let lifecycleId: number | undefined;

      try {
        await runInControlledContext({ sessionId: 1, discoveryRunId: 1 }, async () => {
          lifecycleId = getControlledContext()!.lifecycleId;
          throw new Error('Test error');
        });
      } catch {
        // Expected
      }

      expect(isLifecycleActive(lifecycleId!)).toBe(false);
    });

    it('lifecycle is inactive after sync callback throws', () => {
      let lifecycleId: number | undefined;

      try {
        runInControlledContextSync({ sessionId: 1, discoveryRunId: 1 }, () => {
          lifecycleId = getControlledContext()!.lifecycleId;
          throw new Error('Test error');
        });
      } catch {
        // Expected
      }

      expect(isLifecycleActive(lifecycleId!)).toBe(false);
    });

    it('active lifecycle count is 1 during execution', async () => {
      let countDuring: number | undefined;

      await runInControlledContext({ sessionId: 1, discoveryRunId: 1 }, async () => {
        countDuring = getActiveLifecycleCount();
      });

      expect(countDuring).toBe(1);
      expect(getActiveLifecycleCount()).toBe(0);
    });

    it('no lifecycle leaks after successful completion', async () => {
      for (let i = 0; i < 10; i++) {
        await runInControlledContext({ sessionId: i + 1, discoveryRunId: i + 1 }, async () => {
          await Promise.resolve();
        });
      }

      expect(getActiveLifecycleCount()).toBe(0);
    });

    it('no lifecycle leaks after errors', async () => {
      for (let i = 0; i < 10; i++) {
        try {
          await runInControlledContext({ sessionId: i + 1, discoveryRunId: i + 1 }, async () => {
            if (i % 2 === 0) throw new Error('Test');
          });
        } catch {
          // Expected
        }
      }

      expect(getActiveLifecycleCount()).toBe(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // requireValidControlledContext() behavior
  // ═══════════════════════════════════════════════════════════════════════════

  describe('requireValidControlledContext()', () => {
    it('returns context when lifecycle is active', async () => {
      let validatedContext: ControlledExecutionContext | undefined;

      await runInControlledContext(
        { sessionId: 42, discoveryRunId: 100 },
        async () => {
          validatedContext = requireValidControlledContext();
        },
      );

      expect(validatedContext).toBeDefined();
      expect(validatedContext?.sessionId).toBe(42);
      expect(validatedContext?.discoveryRunId).toBe(100);
    });

    it('throws NoControlledContextError when no context', () => {
      expect(() => requireValidControlledContext()).toThrow(NoControlledContextError);
      expect(() => requireValidControlledContext()).toThrow(
        'No controlled execution context active',
      );
    });

    it('hasValidControlledContext() returns true during active lifecycle', async () => {
      let wasValid = false;

      await runInControlledContext({ sessionId: 1, discoveryRunId: 1 }, async () => {
        wasValid = hasValidControlledContext();
      });

      expect(wasValid).toBe(true);
    });

    it('hasValidControlledContext() returns false after lifecycle ends', async () => {
      await runInControlledContext({ sessionId: 1, discoveryRunId: 1 }, async () => {});

      expect(hasValidControlledContext()).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Detached async descendants
  // ═══════════════════════════════════════════════════════════════════════════

  describe('detached async descendants', () => {
    it('detached setTimeout callback sees context but fails validation', async () => {
      let detachedContext: ControlledExecutionContext | undefined;
      let detachedError: Error | undefined;
      let detachedResolved = false;

      const detachedPromise = new Promise<void>((resolve) => {
        runInControlledContext({ sessionId: 42, discoveryRunId: 100 }, async () => {
          // Schedule detached callback
          setTimeout(() => {
            detachedContext = getControlledContext();
            try {
              requireValidControlledContext();
            } catch (e) {
              detachedError = e as Error;
            }
            detachedResolved = true;
            resolve();
          }, 10);
          // Parent callback returns before setTimeout fires
        });
      });

      // Wait for detached callback
      await detachedPromise;

      expect(detachedResolved).toBe(true);
      // Context is still visible (AsyncLocalStorage propagates)
      expect(detachedContext).toBeDefined();
      expect(detachedContext?.sessionId).toBe(42);
      // But lifecycle validation fails
      expect(detachedError).toBeInstanceOf(ExpiredControlledContextError);
      expect(detachedError?.message).toContain('has expired');
      expect(detachedError?.message).toContain('session=42');
      expect(detachedError?.message).toContain('run=100');
    });

    it('detached setImmediate callback fails validation', async () => {
      let detachedError: Error | undefined;

      await new Promise<void>((resolve) => {
        runInControlledContext({ sessionId: 1, discoveryRunId: 1 }, async () => {
          setImmediate(() => {
            try {
              requireValidControlledContext();
            } catch (e) {
              detachedError = e as Error;
            }
            resolve();
          });
        });
      });

      expect(detachedError).toBeInstanceOf(ExpiredControlledContextError);
    });

    it('hasValidControlledContext() returns false for detached descendants', async () => {
      let detachedValid: boolean | undefined;

      await new Promise<void>((resolve) => {
        runInControlledContext({ sessionId: 1, discoveryRunId: 1 }, async () => {
          setTimeout(() => {
            detachedValid = hasValidControlledContext();
            resolve();
          }, 10);
        });
      });

      expect(detachedValid).toBe(false);
    });

    it('awaited operations within callback remain valid', async () => {
      let afterAwaitValid = false;

      await runInControlledContext({ sessionId: 1, discoveryRunId: 1 }, async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        // This is NOT detached — it's awaited within the callback
        afterAwaitValid = hasValidControlledContext();
      });

      expect(afterAwaitValid).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Context preserved across awaited promises
  // ═══════════════════════════════════════════════════════════════════════════

  describe('context preserved across awaited promises', () => {
    it('context survives single await', async () => {
      let contextBeforeAwait: ControlledExecutionContext | undefined;
      let contextAfterAwait: ControlledExecutionContext | undefined;

      await runInControlledContext({ sessionId: 77, discoveryRunId: 77 }, async () => {
        contextBeforeAwait = getControlledContext();
        await Promise.resolve();
        contextAfterAwait = getControlledContext();
      });

      expect(contextBeforeAwait?.sessionId).toBe(77);
      expect(contextAfterAwait?.sessionId).toBe(77);
      expect(contextBeforeAwait?.lifecycleId).toBe(contextAfterAwait?.lifecycleId);
    });

    it('context survives multiple sequential awaits', async () => {
      const capturedIds: number[] = [];

      await runInControlledContext({ sessionId: 88, discoveryRunId: 88 }, async () => {
        capturedIds.push(getControlledSessionId()!);
        await Promise.resolve();
        capturedIds.push(getControlledSessionId()!);
        await new Promise((resolve) => setTimeout(resolve, 10));
        capturedIds.push(getControlledSessionId()!);
        await Promise.resolve();
        capturedIds.push(getControlledSessionId()!);
      });

      expect(capturedIds).toEqual([88, 88, 88, 88]);
    });

    it('context survives Promise.all', async () => {
      const capturedIds: number[] = [];

      await runInControlledContext({ sessionId: 55, discoveryRunId: 55 }, async () => {
        await Promise.all([
          (async () => {
            capturedIds.push(getControlledSessionId()!);
          })(),
          (async () => {
            await Promise.resolve();
            capturedIds.push(getControlledSessionId()!);
          })(),
          (async () => {
            capturedIds.push(getControlledSessionId()!);
          })(),
        ]);
      });

      expect(capturedIds).toEqual([55, 55, 55]);
    });

    it('context survives nested async functions', async () => {
      let innerContext: ControlledExecutionContext | undefined;

      const innerAsync = async () => {
        await Promise.resolve();
        return getControlledContext();
      };

      const middleAsync = async () => {
        await Promise.resolve();
        return await innerAsync();
      };

      await runInControlledContext({ sessionId: 33, discoveryRunId: 33 }, async () => {
        innerContext = await middleAsync();
      });

      expect(innerContext?.sessionId).toBe(33);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Context isolated across concurrent sessions
  // ═══════════════════════════════════════════════════════════════════════════

  describe('context isolated across concurrent sessions', () => {
    it('concurrent controlled executions see their own context', async () => {
      const capturedIds: Map<number, number[]> = new Map();

      const runSession = async (sessionId: number) => {
        const ids: number[] = [];
        await runInControlledContext({ sessionId, discoveryRunId: sessionId }, async () => {
          ids.push(getControlledSessionId()!);
          await new Promise((resolve) => setTimeout(resolve, Math.random() * 20));
          ids.push(getControlledSessionId()!);
          await Promise.resolve();
          ids.push(getControlledSessionId()!);
        });
        capturedIds.set(sessionId, ids);
      };

      // Run 5 concurrent sessions
      await Promise.all([
        runSession(100),
        runSession(200),
        runSession(300),
        runSession(400),
        runSession(500),
      ]);

      // Each session should only see its own ID
      expect(capturedIds.get(100)).toEqual([100, 100, 100]);
      expect(capturedIds.get(200)).toEqual([200, 200, 200]);
      expect(capturedIds.get(300)).toEqual([300, 300, 300]);
      expect(capturedIds.get(400)).toEqual([400, 400, 400]);
      expect(capturedIds.get(500)).toEqual([500, 500, 500]);
    });

    it('controlled and uncontrolled execution do not interfere', async () => {
      let controlledSawContext = false;
      let uncontrolledSawContext = false;

      const controlledRun = runInControlledContext(
        { sessionId: 999, discoveryRunId: 999 },
        async () => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          controlledSawContext = isInControlledContext();
        },
      );

      const uncontrolledRun = (async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        uncontrolledSawContext = isInControlledContext();
      })();

      await Promise.all([controlledRun, uncontrolledRun]);

      expect(controlledSawContext).toBe(true);
      expect(uncontrolledSawContext).toBe(false);
    });

    it('one lifecycle ending does not affect another', async () => {
      const lifecycles: { id: number; activeAfterOtherEnds: boolean }[] = [];

      // Start first context
      const first = runInControlledContext({ sessionId: 1, discoveryRunId: 1 }, async () => {
        const myId = getControlledContext()!.lifecycleId;
        // Wait for second to start and end
        await new Promise((resolve) => setTimeout(resolve, 50));
        // Check we're still active
        lifecycles.push({ id: myId, activeAfterOtherEnds: isLifecycleActive(myId) });
      });

      // Start second context that ends quickly
      await new Promise((resolve) => setTimeout(resolve, 10));
      const second = runInControlledContext({ sessionId: 2, discoveryRunId: 2 }, async () => {
        const myId = getControlledContext()!.lifecycleId;
        lifecycles.push({ id: myId, activeAfterOtherEnds: true }); // Will end before first
      });

      await Promise.all([first, second]);

      // First lifecycle should still have been active after second ended
      expect(lifecycles.find((l) => l.id === lifecycles[0].id)?.activeAfterOtherEnds).toBe(true);
    });

    it('concurrent active lifecycle count reflects all active contexts', async () => {
      let maxConcurrent = 0;

      const tasks = Array.from({ length: 5 }, (_, i) =>
        runInControlledContext({ sessionId: i + 1, discoveryRunId: i + 1 }, async () => {
          const current = getActiveLifecycleCount();
          maxConcurrent = Math.max(maxConcurrent, current);
          await new Promise((resolve) => setTimeout(resolve, 20));
        }),
      );

      await Promise.all(tasks);

      expect(maxConcurrent).toBe(5);
      expect(getActiveLifecycleCount()).toBe(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Context does not leak after callback completion
  // ═══════════════════════════════════════════════════════════════════════════

  describe('context cleanup after callback', () => {
    it('context is undefined after async callback completes', async () => {
      await runInControlledContext({ sessionId: 42, discoveryRunId: 42 }, async () => {
        expect(isInControlledContext()).toBe(true);
      });

      expect(isInControlledContext()).toBe(false);
      expect(getControlledContext()).toBeUndefined();
    });

    it('context is undefined after sync callback completes', () => {
      runInControlledContextSync({ sessionId: 42, discoveryRunId: 42 }, () => {
        expect(isInControlledContext()).toBe(true);
      });

      expect(isInControlledContext()).toBe(false);
      expect(getControlledContext()).toBeUndefined();
    });

    it('context cleanup happens even with successful return value', async () => {
      const result = await runInControlledContext({ sessionId: 1, discoveryRunId: 1 }, async () => {
        return 'success';
      });

      expect(result).toBe('success');
      expect(isInControlledContext()).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Nested context behavior
  // ═══════════════════════════════════════════════════════════════════════════

  describe('nested context behavior', () => {
    it('rejects nested runInControlledContext', async () => {
      await expect(
        runInControlledContext({ sessionId: 1, discoveryRunId: 1 }, async () => {
          await runInControlledContext({ sessionId: 2, discoveryRunId: 2 }, async () => {
            // Should not reach here
          });
        }),
      ).rejects.toThrow(NestedControlledContextError);
    });

    it('rejects nested runInControlledContextSync', () => {
      expect(() =>
        runInControlledContextSync({ sessionId: 1, discoveryRunId: 1 }, () => {
          runInControlledContextSync({ sessionId: 2, discoveryRunId: 2 }, () => {
            // Should not reach here
          });
        }),
      ).toThrow(NestedControlledContextError);
    });

    it('nested error includes both session IDs', async () => {
      try {
        await runInControlledContext({ sessionId: 111, discoveryRunId: 111 }, async () => {
          await runInControlledContext({ sessionId: 222, discoveryRunId: 222 }, async () => {});
        });
        fail('Expected NestedControlledContextError');
      } catch (err) {
        expect(err).toBeInstanceOf(NestedControlledContextError);
        expect((err as Error).message).toContain('111');
        expect((err as Error).message).toContain('222');
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Errors do not leave context active
  // ═══════════════════════════════════════════════════════════════════════════

  describe('error handling', () => {
    it('context is cleaned up when async callback throws', async () => {
      try {
        await runInControlledContext({ sessionId: 42, discoveryRunId: 42 }, async () => {
          throw new Error('Test error');
        });
      } catch {
        // Expected
      }

      expect(isInControlledContext()).toBe(false);
      expect(getControlledContext()).toBeUndefined();
      expect(getActiveLifecycleCount()).toBe(0);
    });

    it('context is cleaned up when sync callback throws', () => {
      try {
        runInControlledContextSync({ sessionId: 42, discoveryRunId: 42 }, () => {
          throw new Error('Test error');
        });
      } catch {
        // Expected
      }

      expect(isInControlledContext()).toBe(false);
      expect(getControlledContext()).toBeUndefined();
      expect(getActiveLifecycleCount()).toBe(0);
    });

    it('error is propagated from async callback', async () => {
      await expect(
        runInControlledContext({ sessionId: 1, discoveryRunId: 1 }, async () => {
          throw new Error('Custom async error');
        }),
      ).rejects.toThrow('Custom async error');
    });

    it('error is propagated from sync callback', () => {
      expect(() =>
        runInControlledContextSync({ sessionId: 1, discoveryRunId: 1 }, () => {
          throw new Error('Custom sync error');
        }),
      ).toThrow('Custom sync error');
    });

    it('context cleanup after async rejection in Promise.all', async () => {
      try {
        await runInControlledContext({ sessionId: 99, discoveryRunId: 99 }, async () => {
          await Promise.all([
            Promise.resolve(),
            Promise.reject(new Error('One failed')),
            Promise.resolve(),
          ]);
        });
      } catch {
        // Expected
      }

      expect(isInControlledContext()).toBe(false);
      expect(getActiveLifecycleCount()).toBe(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Invalid identifier rejection (M5b: both required)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('invalid identifier rejection', () => {
    describe('sessionId validation', () => {
      it('rejects zero sessionId', async () => {
        await expect(
          runInControlledContext({ sessionId: 0, discoveryRunId: 1 }, async () => {}),
        ).rejects.toThrow(InvalidContextParameterError);
        await expect(
          runInControlledContext({ sessionId: 0, discoveryRunId: 1 }, async () => {}),
        ).rejects.toThrow('must be positive');
      });

      it('rejects negative sessionId', async () => {
        await expect(
          runInControlledContext({ sessionId: -1, discoveryRunId: 1 }, async () => {}),
        ).rejects.toThrow(InvalidContextParameterError);
      });

      it('rejects non-integer sessionId', async () => {
        await expect(
          runInControlledContext({ sessionId: 1.5, discoveryRunId: 1 }, async () => {}),
        ).rejects.toThrow(InvalidContextParameterError);
        await expect(
          runInControlledContext({ sessionId: 1.5, discoveryRunId: 1 }, async () => {}),
        ).rejects.toThrow('must be an integer');
      });

      it('rejects NaN sessionId', async () => {
        await expect(
          runInControlledContext({ sessionId: NaN, discoveryRunId: 1 }, async () => {}),
        ).rejects.toThrow(InvalidContextParameterError);
        await expect(
          runInControlledContext({ sessionId: NaN, discoveryRunId: 1 }, async () => {}),
        ).rejects.toThrow('must be finite');
      });

      it('rejects Infinity sessionId', async () => {
        await expect(
          runInControlledContext({ sessionId: Infinity, discoveryRunId: 1 }, async () => {}),
        ).rejects.toThrow(InvalidContextParameterError);
      });

      it('rejects unsafe integer sessionId', async () => {
        await expect(
          runInControlledContext(
            { sessionId: Number.MAX_SAFE_INTEGER + 1, discoveryRunId: 1 },
            async () => {},
          ),
        ).rejects.toThrow(InvalidContextParameterError);
        await expect(
          runInControlledContext(
            { sessionId: Number.MAX_SAFE_INTEGER + 1, discoveryRunId: 1 },
            async () => {},
          ),
        ).rejects.toThrow('must be a safe integer');
      });
    });

    describe('discoveryRunId validation (required since M5b)', () => {
      it('rejects zero discoveryRunId', async () => {
        await expect(
          runInControlledContext({ sessionId: 1, discoveryRunId: 0 }, async () => {}),
        ).rejects.toThrow(InvalidContextParameterError);
        await expect(
          runInControlledContext({ sessionId: 1, discoveryRunId: 0 }, async () => {}),
        ).rejects.toThrow('must be positive');
      });

      it('rejects negative discoveryRunId', async () => {
        await expect(
          runInControlledContext({ sessionId: 1, discoveryRunId: -5 }, async () => {}),
        ).rejects.toThrow(InvalidContextParameterError);
      });

      it('rejects non-integer discoveryRunId', async () => {
        await expect(
          runInControlledContext({ sessionId: 1, discoveryRunId: 1.5 }, async () => {}),
        ).rejects.toThrow(InvalidContextParameterError);
      });

      it('rejects NaN discoveryRunId', async () => {
        await expect(
          runInControlledContext({ sessionId: 1, discoveryRunId: NaN }, async () => {}),
        ).rejects.toThrow(InvalidContextParameterError);
      });

      it('rejects Infinity discoveryRunId', async () => {
        await expect(
          runInControlledContext({ sessionId: 1, discoveryRunId: Infinity }, async () => {}),
        ).rejects.toThrow(InvalidContextParameterError);
      });

      it('rejects unsafe integer discoveryRunId', async () => {
        await expect(
          runInControlledContext(
            { sessionId: 1, discoveryRunId: Number.MAX_SAFE_INTEGER + 1 },
            async () => {},
          ),
        ).rejects.toThrow(InvalidContextParameterError);
      });

      it('rejects missing discoveryRunId', async () => {
        // TypeScript prevents this, but test runtime behavior
        await expect(
          runInControlledContext(
            { sessionId: 1 } as { sessionId: number; discoveryRunId: number },
            async () => {},
          ),
        ).rejects.toThrow(InvalidContextParameterError);
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Context immutability
  // ═══════════════════════════════════════════════════════════════════════════

  describe('context immutability', () => {
    it('context object is frozen', async () => {
      let capturedContext: ControlledExecutionContext | undefined;

      await runInControlledContext({ sessionId: 42, discoveryRunId: 100 }, async () => {
        capturedContext = getControlledContext();
      });

      expect(Object.isFrozen(capturedContext)).toBe(true);
    });

    it('cannot modify sessionId', async () => {
      await runInControlledContext({ sessionId: 42, discoveryRunId: 100 }, async () => {
        const ctx = getControlledContext()!;
        expect(() => {
          (ctx as { sessionId: number }).sessionId = 999;
        }).toThrow();
      });
    });

    it('cannot modify discoveryRunId', async () => {
      await runInControlledContext({ sessionId: 42, discoveryRunId: 100 }, async () => {
        const ctx = getControlledContext()!;
        expect(() => {
          (ctx as { discoveryRunId: number }).discoveryRunId = 999;
        }).toThrow();
      });
    });

    it('cannot modify lifecycleId', async () => {
      await runInControlledContext({ sessionId: 42, discoveryRunId: 100 }, async () => {
        const ctx = getControlledContext()!;
        expect(() => {
          (ctx as { lifecycleId: number }).lifecycleId = 999;
        }).toThrow();
      });
    });

    it('cannot add properties', async () => {
      await runInControlledContext({ sessionId: 42, discoveryRunId: 100 }, async () => {
        const ctx = getControlledContext()!;
        expect(() => {
          (ctx as unknown as Record<string, unknown>).newProp = 'value';
        }).toThrow();
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Return value passthrough
  // ═══════════════════════════════════════════════════════════════════════════

  describe('return value passthrough', () => {
    it('returns callback result from runInControlledContext', async () => {
      const result = await runInControlledContext(
        { sessionId: 1, discoveryRunId: 1 },
        async () => {
          return { foo: 'bar', count: 42 };
        },
      );

      expect(result).toEqual({ foo: 'bar', count: 42 });
    });

    it('returns callback result from runInControlledContextSync', () => {
      const result = runInControlledContextSync({ sessionId: 1, discoveryRunId: 1 }, () => {
        return [1, 2, 3];
      });

      expect(result).toEqual([1, 2, 3]);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // ExpiredControlledContextError details
  // ═══════════════════════════════════════════════════════════════════════════

  describe('ExpiredControlledContextError details', () => {
    it('includes lifecycleId, sessionId, and discoveryRunId', async () => {
      let capturedLifecycleId: number | undefined;
      let error: ExpiredControlledContextError | undefined;

      await new Promise<void>((resolve) => {
        runInControlledContext(
          { sessionId: 42, discoveryRunId: 100 },
          async () => {
            capturedLifecycleId = getControlledContext()!.lifecycleId;
            setTimeout(() => {
              try {
                requireValidControlledContext();
              } catch (e) {
                error = e as ExpiredControlledContextError;
              }
              resolve();
            }, 10);
          },
        );
      });

      expect(error).toBeInstanceOf(ExpiredControlledContextError);
      expect(error?.message).toContain(`lifecycle ${capturedLifecycleId}`);
      expect(error?.message).toContain('session=42');
      expect(error?.message).toContain('run=100');
      expect(error?.message).toContain('Detached async descendants');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Synchronous wrapper async callback rejection (M5b correction)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('synchronous wrapper async callback rejection', () => {
    it('rejects callback returning native Promise', () => {
      expect(() =>
        runInControlledContextSync({ sessionId: 1, discoveryRunId: 1 }, () => {
          return Promise.resolve('async result');
        }),
      ).toThrow(AsyncCallbackInSyncContextError);
    });

    it('rejects callback returning pending Promise', () => {
      // Use a pending Promise (never resolves) to avoid unhandled rejection
      const pendingPromise = new Promise(() => {});

      expect(() =>
        runInControlledContextSync({ sessionId: 1, discoveryRunId: 1 }, () => {
          return pendingPromise;
        }),
      ).toThrow(AsyncCallbackInSyncContextError);
    });

    it('rejects callback returning thenable object', () => {
      const thenable = {
        then: (resolve: (v: string) => void) => resolve('thenable result'),
      };

      expect(() =>
        runInControlledContextSync({ sessionId: 1, discoveryRunId: 1 }, () => {
          return thenable;
        }),
      ).toThrow(AsyncCallbackInSyncContextError);
    });

    it('accepts callback returning normal synchronous value', () => {
      const result = runInControlledContextSync({ sessionId: 1, discoveryRunId: 1 }, () => {
        return { sync: true, value: 42 };
      });

      expect(result).toEqual({ sync: true, value: 42 });
    });

    it('accepts callback returning null', () => {
      const result = runInControlledContextSync({ sessionId: 1, discoveryRunId: 1 }, () => {
        return null;
      });

      expect(result).toBeNull();
    });

    it('accepts callback returning undefined', () => {
      const result = runInControlledContextSync({ sessionId: 1, discoveryRunId: 1 }, () => {
        return undefined;
      });

      expect(result).toBeUndefined();
    });

    it('accepts callback returning object without then method', () => {
      const obj = { notAThen: () => 'not a thenable' };

      const result = runInControlledContextSync({ sessionId: 1, discoveryRunId: 1 }, () => {
        return obj;
      });

      expect(result).toBe(obj);
    });

    it('lifecycle is cleaned up after Promise rejection', () => {
      try {
        runInControlledContextSync({ sessionId: 1, discoveryRunId: 1 }, () => {
          return Promise.resolve();
        });
      } catch {
        // Expected
      }

      expect(getActiveLifecycleCount()).toBe(0);
      expect(isInControlledContext()).toBe(false);
    });

    it('lifecycle is cleaned up after thenable rejection', () => {
      const thenable = { then: () => {} };

      try {
        runInControlledContextSync({ sessionId: 1, discoveryRunId: 1 }, () => thenable);
      } catch {
        // Expected
      }

      expect(getActiveLifecycleCount()).toBe(0);
    });

    it('error message indicates correct usage', () => {
      try {
        runInControlledContextSync({ sessionId: 1, discoveryRunId: 1 }, () => Promise.resolve());
        fail('Expected AsyncCallbackInSyncContextError');
      } catch (err) {
        expect(err).toBeInstanceOf(AsyncCallbackInSyncContextError);
        expect((err as Error).message).toContain('runInControlledContextSync');
        expect((err as Error).message).toContain('runInControlledContext');
        expect((err as Error).message).toContain('async');
      }
    });

    it('preserves nested-context rejection behavior', () => {
      expect(() =>
        runInControlledContextSync({ sessionId: 1, discoveryRunId: 1 }, () => {
          runInControlledContextSync({ sessionId: 2, discoveryRunId: 2 }, () => {});
        }),
      ).toThrow(NestedControlledContextError);
    });
  });
});
