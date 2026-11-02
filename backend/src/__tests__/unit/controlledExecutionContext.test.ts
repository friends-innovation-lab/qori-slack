/**
 * Controlled Execution Context Tests — DISC-WEB-1D-2 M4
 *
 * Tests the AsyncLocalStorage-based context for controlled Discovery execution.
 * Verifies context isolation, immutability, and proper cleanup.
 */

import {
  getControlledContext,
  isInControlledContext,
  getControlledSessionId,
  getControlledRunId,
  runInControlledContext,
  runInControlledContextSync,
  runWithBoundRun,
  InvalidContextParameterError,
  NestedControlledContextError,
  type ControlledExecutionContext,
  type CreateControlledContextInput,
} from '../../context/controlledExecutionContext';

describe('DISC-WEB-1D-2 M4: Controlled Execution Context', () => {
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
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Context available inside callbacks
  // ═══════════════════════════════════════════════════════════════════════════

  describe('context available inside callbacks', () => {
    it('provides context inside async callback', async () => {
      let capturedContext: ControlledExecutionContext | undefined;

      await runInControlledContext(
        { sessionId: 42, purpose: 'test-async' },
        async () => {
          capturedContext = getControlledContext();
        },
      );

      expect(capturedContext).toBeDefined();
      expect(capturedContext?.sessionId).toBe(42);
      expect(capturedContext?.isControlled).toBe(true);
      expect(capturedContext?.purpose).toBe('test-async');
    });

    it('provides context inside sync callback', () => {
      let capturedContext: ControlledExecutionContext | undefined;

      runInControlledContextSync(
        { sessionId: 99, purpose: 'test-sync' },
        () => {
          capturedContext = getControlledContext();
        },
      );

      expect(capturedContext).toBeDefined();
      expect(capturedContext?.sessionId).toBe(99);
      expect(capturedContext?.isControlled).toBe(true);
    });

    it('isInControlledContext() returns true inside callback', async () => {
      let wasInContext = false;

      await runInControlledContext(
        { sessionId: 1 },
        async () => {
          wasInContext = isInControlledContext();
        },
      );

      expect(wasInContext).toBe(true);
    });

    it('getControlledSessionId() returns session ID inside callback', async () => {
      let capturedId: number | undefined;

      await runInControlledContext(
        { sessionId: 123 },
        async () => {
          capturedId = getControlledSessionId();
        },
      );

      expect(capturedId).toBe(123);
    });

    it('includes discoveryRunId when provided', async () => {
      let capturedContext: ControlledExecutionContext | undefined;

      await runInControlledContext(
        { sessionId: 10, discoveryRunId: 500 },
        async () => {
          capturedContext = getControlledContext();
        },
      );

      expect(capturedContext?.discoveryRunId).toBe(500);
    });

    it('sets discoveryRunId to null when not provided', async () => {
      let capturedContext: ControlledExecutionContext | undefined;

      await runInControlledContext(
        { sessionId: 10 },
        async () => {
          capturedContext = getControlledContext();
        },
      );

      expect(capturedContext?.discoveryRunId).toBeNull();
    });

    it('includes createdAt timestamp', async () => {
      let capturedContext: ControlledExecutionContext | undefined;
      const beforeTime = new Date().toISOString();

      await runInControlledContext(
        { sessionId: 1 },
        async () => {
          capturedContext = getControlledContext();
        },
      );

      const afterTime = new Date().toISOString();
      expect(capturedContext?.createdAt).toBeDefined();
      expect(capturedContext!.createdAt >= beforeTime).toBe(true);
      expect(capturedContext!.createdAt <= afterTime).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Context preserved across awaited promises
  // ═══════════════════════════════════════════════════════════════════════════

  describe('context preserved across awaited promises', () => {
    it('context survives single await', async () => {
      let contextBeforeAwait: ControlledExecutionContext | undefined;
      let contextAfterAwait: ControlledExecutionContext | undefined;

      await runInControlledContext(
        { sessionId: 77 },
        async () => {
          contextBeforeAwait = getControlledContext();
          await Promise.resolve();
          contextAfterAwait = getControlledContext();
        },
      );

      expect(contextBeforeAwait?.sessionId).toBe(77);
      expect(contextAfterAwait?.sessionId).toBe(77);
      expect(contextBeforeAwait).toEqual(contextAfterAwait);
    });

    it('context survives multiple sequential awaits', async () => {
      const capturedIds: number[] = [];

      await runInControlledContext(
        { sessionId: 88 },
        async () => {
          capturedIds.push(getControlledSessionId()!);
          await Promise.resolve();
          capturedIds.push(getControlledSessionId()!);
          await new Promise(resolve => setTimeout(resolve, 10));
          capturedIds.push(getControlledSessionId()!);
          await Promise.resolve();
          capturedIds.push(getControlledSessionId()!);
        },
      );

      expect(capturedIds).toEqual([88, 88, 88, 88]);
    });

    it('context survives Promise.all', async () => {
      const capturedIds: number[] = [];

      await runInControlledContext(
        { sessionId: 55 },
        async () => {
          await Promise.all([
            (async () => { capturedIds.push(getControlledSessionId()!); })(),
            (async () => { await Promise.resolve(); capturedIds.push(getControlledSessionId()!); })(),
            (async () => { capturedIds.push(getControlledSessionId()!); })(),
          ]);
        },
      );

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

      await runInControlledContext(
        { sessionId: 33 },
        async () => {
          innerContext = await middleAsync();
        },
      );

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
        await runInControlledContext(
          { sessionId },
          async () => {
            ids.push(getControlledSessionId()!);
            await new Promise(resolve => setTimeout(resolve, Math.random() * 20));
            ids.push(getControlledSessionId()!);
            await Promise.resolve();
            ids.push(getControlledSessionId()!);
          },
        );
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
        { sessionId: 999 },
        async () => {
          await new Promise(resolve => setTimeout(resolve, 10));
          controlledSawContext = isInControlledContext();
        },
      );

      const uncontrolledRun = (async () => {
        await new Promise(resolve => setTimeout(resolve, 5));
        uncontrolledSawContext = isInControlledContext();
      })();

      await Promise.all([controlledRun, uncontrolledRun]);

      expect(controlledSawContext).toBe(true);
      expect(uncontrolledSawContext).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Context does not leak after callback completion
  // ═══════════════════════════════════════════════════════════════════════════

  describe('context cleanup after callback', () => {
    it('context is undefined after async callback completes', async () => {
      await runInControlledContext(
        { sessionId: 42 },
        async () => {
          expect(isInControlledContext()).toBe(true);
        },
      );

      expect(isInControlledContext()).toBe(false);
      expect(getControlledContext()).toBeUndefined();
    });

    it('context is undefined after sync callback completes', () => {
      runInControlledContextSync(
        { sessionId: 42 },
        () => {
          expect(isInControlledContext()).toBe(true);
        },
      );

      expect(isInControlledContext()).toBe(false);
      expect(getControlledContext()).toBeUndefined();
    });

    it('context cleanup happens even with successful return value', async () => {
      const result = await runInControlledContext(
        { sessionId: 1 },
        async () => {
          return 'success';
        },
      );

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
        runInControlledContext(
          { sessionId: 1 },
          async () => {
            await runInControlledContext(
              { sessionId: 2 },
              async () => {
                // Should not reach here
              },
            );
          },
        ),
      ).rejects.toThrow(NestedControlledContextError);
    });

    it('rejects nested runInControlledContextSync', () => {
      expect(() =>
        runInControlledContextSync(
          { sessionId: 1 },
          () => {
            runInControlledContextSync(
              { sessionId: 2 },
              () => {
                // Should not reach here
              },
            );
          },
        ),
      ).toThrow(NestedControlledContextError);
    });

    it('nested error includes both session IDs', async () => {
      try {
        await runInControlledContext(
          { sessionId: 111 },
          async () => {
            await runInControlledContext(
              { sessionId: 222 },
              async () => {},
            );
          },
        );
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
        await runInControlledContext(
          { sessionId: 42 },
          async () => {
            throw new Error('Test error');
          },
        );
      } catch {
        // Expected
      }

      expect(isInControlledContext()).toBe(false);
      expect(getControlledContext()).toBeUndefined();
    });

    it('context is cleaned up when sync callback throws', () => {
      try {
        runInControlledContextSync(
          { sessionId: 42 },
          () => {
            throw new Error('Test error');
          },
        );
      } catch {
        // Expected
      }

      expect(isInControlledContext()).toBe(false);
      expect(getControlledContext()).toBeUndefined();
    });

    it('error is propagated from async callback', async () => {
      await expect(
        runInControlledContext(
          { sessionId: 1 },
          async () => {
            throw new Error('Custom async error');
          },
        ),
      ).rejects.toThrow('Custom async error');
    });

    it('error is propagated from sync callback', () => {
      expect(() =>
        runInControlledContextSync(
          { sessionId: 1 },
          () => {
            throw new Error('Custom sync error');
          },
        ),
      ).toThrow('Custom sync error');
    });

    it('context cleanup after async rejection in Promise.all', async () => {
      try {
        await runInControlledContext(
          { sessionId: 99 },
          async () => {
            await Promise.all([
              Promise.resolve(),
              Promise.reject(new Error('One failed')),
              Promise.resolve(),
            ]);
          },
        );
      } catch {
        // Expected
      }

      expect(isInControlledContext()).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Invalid session identifier rejection
  // ═══════════════════════════════════════════════════════════════════════════

  describe('invalid session identifier rejection', () => {
    it('rejects zero sessionId', async () => {
      await expect(
        runInControlledContext({ sessionId: 0 }, async () => {}),
      ).rejects.toThrow(InvalidContextParameterError);
    });

    it('rejects negative sessionId', async () => {
      await expect(
        runInControlledContext({ sessionId: -1 }, async () => {}),
      ).rejects.toThrow(InvalidContextParameterError);
    });

    it('rejects non-integer sessionId', async () => {
      await expect(
        runInControlledContext({ sessionId: 1.5 }, async () => {}),
      ).rejects.toThrow(InvalidContextParameterError);
    });

    it('rejects NaN sessionId', async () => {
      await expect(
        runInControlledContext({ sessionId: NaN }, async () => {}),
      ).rejects.toThrow(InvalidContextParameterError);
    });

    it('rejects Infinity sessionId', async () => {
      await expect(
        runInControlledContext({ sessionId: Infinity }, async () => {}),
      ).rejects.toThrow(InvalidContextParameterError);
    });

    it('rejects zero discoveryRunId', async () => {
      await expect(
        runInControlledContext({ sessionId: 1, discoveryRunId: 0 }, async () => {}),
      ).rejects.toThrow(InvalidContextParameterError);
    });

    it('rejects negative discoveryRunId', async () => {
      await expect(
        runInControlledContext({ sessionId: 1, discoveryRunId: -5 }, async () => {}),
      ).rejects.toThrow(InvalidContextParameterError);
    });

    it('accepts null discoveryRunId', async () => {
      await expect(
        runInControlledContext({ sessionId: 1, discoveryRunId: null }, async () => {}),
      ).resolves.not.toThrow();
    });

    it('accepts undefined discoveryRunId', async () => {
      await expect(
        runInControlledContext({ sessionId: 1, discoveryRunId: undefined }, async () => {}),
      ).resolves.not.toThrow();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Context immutability
  // ═══════════════════════════════════════════════════════════════════════════

  describe('context immutability', () => {
    it('context object is frozen', async () => {
      let capturedContext: ControlledExecutionContext | undefined;

      await runInControlledContext(
        { sessionId: 42 },
        async () => {
          capturedContext = getControlledContext();
        },
      );

      expect(Object.isFrozen(capturedContext)).toBe(true);
    });

    it('cannot modify sessionId', async () => {
      await runInControlledContext(
        { sessionId: 42 },
        async () => {
          const ctx = getControlledContext()!;
          expect(() => {
            (ctx as { sessionId: number }).sessionId = 999;
          }).toThrow();
        },
      );
    });

    it('cannot add properties', async () => {
      await runInControlledContext(
        { sessionId: 42 },
        async () => {
          const ctx = getControlledContext()!;
          expect(() => {
            (ctx as unknown as Record<string, unknown>).newProp = 'value';
          }).toThrow();
        },
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // runWithBoundRun (context update for run binding)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('runWithBoundRun', () => {
    it('updates context with run ID', async () => {
      let contextBeforeBind: ControlledExecutionContext | undefined;
      let contextAfterBind: ControlledExecutionContext | undefined;

      await runInControlledContext(
        { sessionId: 10 },
        async () => {
          contextBeforeBind = getControlledContext();
          await runWithBoundRun(500, async () => {
            contextAfterBind = getControlledContext();
          });
        },
      );

      expect(contextBeforeBind?.discoveryRunId).toBeNull();
      expect(contextAfterBind?.discoveryRunId).toBe(500);
      expect(contextAfterBind?.sessionId).toBe(10); // Session ID preserved
    });

    it('preserves other context fields', async () => {
      let boundContext: ControlledExecutionContext | undefined;

      await runInControlledContext(
        { sessionId: 42, purpose: 'test-binding' },
        async () => {
          await runWithBoundRun(100, async () => {
            boundContext = getControlledContext();
          });
        },
      );

      expect(boundContext?.sessionId).toBe(42);
      expect(boundContext?.purpose).toBe('test-binding');
      expect(boundContext?.isControlled).toBe(true);
      expect(boundContext?.discoveryRunId).toBe(100);
    });

    it('throws when called outside controlled context', async () => {
      await expect(
        runWithBoundRun(100, async () => {}),
      ).rejects.toThrow('runWithBoundRun called outside of controlled context');
    });

    it('validates run ID', async () => {
      await expect(
        runInControlledContext(
          { sessionId: 1 },
          async () => {
            await runWithBoundRun(0, async () => {});
          },
        ),
      ).rejects.toThrow(InvalidContextParameterError);
    });

    it('inner context does not affect outer after exit', async () => {
      let outerContextAfter: ControlledExecutionContext | undefined;

      await runInControlledContext(
        { sessionId: 10 },
        async () => {
          await runWithBoundRun(500, async () => {
            // Inside: run ID is 500
            expect(getControlledRunId()).toBe(500);
          });
          // After exit: should be back to original (null)
          outerContextAfter = getControlledContext();
        },
      );

      expect(outerContextAfter?.discoveryRunId).toBeNull();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Return value passthrough
  // ═══════════════════════════════════════════════════════════════════════════

  describe('return value passthrough', () => {
    it('returns callback result from runInControlledContext', async () => {
      const result = await runInControlledContext(
        { sessionId: 1 },
        async () => {
          return { foo: 'bar', count: 42 };
        },
      );

      expect(result).toEqual({ foo: 'bar', count: 42 });
    });

    it('returns callback result from runInControlledContextSync', () => {
      const result = runInControlledContextSync(
        { sessionId: 1 },
        () => {
          return [1, 2, 3];
        },
      );

      expect(result).toEqual([1, 2, 3]);
    });

    it('returns callback result from runWithBoundRun', async () => {
      const result = await runInControlledContext(
        { sessionId: 1 },
        async () => {
          return await runWithBoundRun(100, async () => {
            return 'bound-result';
          });
        },
      );

      expect(result).toBe('bound-result');
    });
  });
});
