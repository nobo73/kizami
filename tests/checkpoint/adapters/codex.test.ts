import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, it, expect } from 'vitest';
import { codexAdapter } from '@/checkpoint/adapters/codex';
import { getDefaultConfig } from '@/config';

describe('codexAdapter', () => {
  describe('parsePrompt', () => {
    it('parses valid Codex prompt with turn_id', () => {
      const raw = JSON.stringify({ session_id: 's1', turn_id: 't1', prompt: 'hello', cwd: '/tmp' });
      const result = codexAdapter.parsePrompt(raw);
      expect(result).toBeDefined();
      expect(result!.session_id).toBe('s1');
      expect(result!.turn_id).toBe('t1');
      expect(result!.prompt).toBe('hello');
    });

    it('parses prompt without turn_id', () => {
      const raw = JSON.stringify({ session_id: 's1', prompt: 'hello' });
      const result = codexAdapter.parsePrompt(raw);
      expect(result).toBeDefined();
      expect(result!.turn_id).toBeUndefined();
    });

    it('returns null for missing prompt', () => {
      const raw = JSON.stringify({ session_id: 's1' });
      expect(codexAdapter.parsePrompt(raw)).toBeNull();
    });

    it('returns null for missing session_id', () => {
      const raw = JSON.stringify({ prompt: 'hello' });
      expect(codexAdapter.parsePrompt(raw)).toBeNull();
    });
  });

  describe('parseStop', () => {
    it('parses valid Stop payload', () => {
      const raw = JSON.stringify({
        session_id: 's1',
        turn_id: 't1',
        last_assistant_message: 'response',
      });
      const result = codexAdapter.parseStop(raw);
      expect(result).toBeDefined();
      expect(result!.last_assistant_message).toBe('response');
    });

    it('returns null for empty session_id', () => {
      const raw = JSON.stringify({ session_id: '', last_assistant_message: 'hi' });
      expect(codexAdapter.parseStop(raw)).toBeNull();
    });
  });

  it('maps captured and committed project paths through storage.projectAliases', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kizami-codex-adapter-alias-'));
    try {
      const config = getDefaultConfig();
      config.storage.projectAliases = { [root]: '/shared/project' };
      const env = {
        config,
        stateRoot: root,
        now: () => new Date('2026-09-18T00:00:00Z'),
        getOrCreateTurnSequence: () => 1,
        allocateTurnSequenceRange: () => [1],
        reserveObservationSequence: () => 1,
        log: () => undefined,
      };

      const pending = await codexAdapter.capturePrompt(
        { session_id: 's1', turn_id: 't1', cwd: root, prompt: 'Hello' },
        env
      );
      const result = await codexAdapter.extractStop(
        { session_id: 's1', turn_id: 't1', cwd: root, last_assistant_message: 'Hi' },
        env
      );

      expect(pending?.projectPath).toBe('/shared/project');
      expect(result.candidates[0].projectPath).toBe('/shared/project');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
