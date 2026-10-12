/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { describe, expect, it, vi } from 'vitest';
import * as vscode from 'vscode';
import { RemoteSessionExporter, SAFETY_INTERVAL_MS } from '../remoteSessionExporter';

/**
 * Focused tests for the early-return safety re-arm in `_flushBatch`.
 *
 * The full RemoteSessionExporter has ~13 service dependencies, so these tests
 * bypass the constructor with `Object.create` and only seed the private fields
 * that the early-return paths touch. We assert that `_scheduleFlush` is invoked
 * with `SAFETY_INTERVAL_MS` so buffered work is guaranteed to be retried once
 * the breaker / rate-limit window elapses, even if no further spans arrive.
 */

interface ExporterStubs {
	scheduleFlush: ReturnType<typeof vi.fn>;
	cancelProbe: ReturnType<typeof vi.fn>;
}

function makeStubExporter(opts: {
	breakerOpen?: boolean;
	rateLimited?: boolean;
	bufferLength?: number;
}): { exporter: RemoteSessionExporter; stubs: ExporterStubs } {
	const scheduleFlush = vi.fn();
	const cancelProbe = vi.fn();

	const exporter = Object.create(RemoteSessionExporter.prototype) as RemoteSessionExporter;
	const fields = exporter as unknown as {
		_isFlushing: boolean;
		_eventBuffer: { chatSessionId: string; event: { type: string } }[];
		_circuitBreaker: { canRequest: () => boolean; cancelProbe: () => void };
		_cloudClient: { isRateLimited: () => boolean };
		_scheduleFlush: (intervalMs: number, kind: 'fast' | 'safety') => void;
	};

	fields._isFlushing = false;
	fields._eventBuffer = Array.from({ length: opts.bufferLength ?? 1 }, (_, i) => ({
		chatSessionId: `s${i}`,
		event: { type: 'assistant.message' },
	}));
	fields._circuitBreaker = {
		canRequest: () => !opts.breakerOpen,
		cancelProbe,
	};
	fields._cloudClient = {
		isRateLimited: () => !!opts.rateLimited,
	};
	fields._scheduleFlush = scheduleFlush;

	return { exporter, stubs: { scheduleFlush, cancelProbe } };
}

async function invokeFlushBatch(exporter: RemoteSessionExporter): Promise<void> {
	await (exporter as unknown as { _flushBatch: () => Promise<void> })._flushBatch();
}

describe('RemoteSessionExporter._flushBatch early-return safety re-arm', () => {
	it('arms a safety-cadence flush when the circuit breaker is open', async () => {
		const { exporter, stubs } = makeStubExporter({ breakerOpen: true });

		await invokeFlushBatch(exporter);

		expect(stubs.scheduleFlush).toHaveBeenCalledTimes(1);
		expect(stubs.scheduleFlush).toHaveBeenCalledWith(SAFETY_INTERVAL_MS, 'safety');
	});

	it('arms a safety-cadence flush when the client is rate-limited', async () => {
		const { exporter, stubs } = makeStubExporter({ rateLimited: true });

		await invokeFlushBatch(exporter);

		expect(stubs.scheduleFlush).toHaveBeenCalledTimes(1);
		expect(stubs.scheduleFlush).toHaveBeenCalledWith(SAFETY_INTERVAL_MS, 'safety');
		// Probe slot consumed by canRequest() must be released.
		expect(stubs.cancelProbe).toHaveBeenCalledTimes(1);
	});

	it('does not arm a flush when the buffer is empty (benign no-op)', async () => {
		const { exporter, stubs } = makeStubExporter({ bufferLength: 0 });

		await invokeFlushBatch(exporter);

		expect(stubs.scheduleFlush).not.toHaveBeenCalled();
	});
});

interface BufferedEntry {
	chatSessionId: string;
	event: { type: string; id: string };
}

function makeFlushHarness(opts: {
	entries: BufferedEntry[];
	submit: (cloudSessionId: string) => Promise<{ ok: true } | { ok: false; reason: string }>;
}): {
	exporter: RemoteSessionExporter;
	buffer: () => BufferedEntry[];
	scheduleFlush: ReturnType<typeof vi.fn>;
	recordFailure: ReturnType<typeof vi.fn>;
	cancelProbe: ReturnType<typeof vi.fn>;
} {
	const scheduleFlush = vi.fn();
	const recordFailure = vi.fn();
	const cancelProbe = vi.fn();
	const sessions = new Map<string, { cloudSessionId: string; cloudTaskId: string }>([
		['local-ok', { cloudSessionId: 'cloud-ok', cloudTaskId: 'task-ok' }],
		['local-err', { cloudSessionId: 'cloud-err', cloudTaskId: 'task-err' }],
		['local-limited', { cloudSessionId: 'cloud-limited', cloudTaskId: 'task-limited' }],
	]);
	const buffer = [...opts.entries];

	const exporter = Object.create(RemoteSessionExporter.prototype) as RemoteSessionExporter;
	const fields = exporter as unknown as Record<string, unknown>;
	fields._isFlushing = false;
	fields._eventBuffer = buffer;
	fields._circuitBreaker = {
		canRequest: () => true,
		cancelProbe,
		recordSuccess: vi.fn(),
		recordFailure,
		getFailureCount: () => 1,
	};
	fields._cloudClient = {
		isRateLimited: () => false,
		submitSessionEvents: (cloudSessionId: string) => opts.submit(cloudSessionId),
	};
	fields._cloudSessions = {
		get: (id: string) => sessions.get(id),
		has: (id: string) => sessions.has(id),
		size: sessions.size,
	};
	fields._rateLimitedSessions = new Set<string>();
	fields._disabledSessions = new Set<string>();
	fields._initializingSessions = new Set<string>();
	fields._repository = undefined;
	fields._setSyncState = vi.fn();
	fields._getLocalSyncedCount = () => 0;
	fields._telemetryService = {
		sendMSFTTelemetryEvent: vi.fn(),
		sendMSFTTelemetryErrorEvent: vi.fn(),
	};
	fields._scheduleFlush = scheduleFlush;
	fields._firstCloudWriteLogged = true;

	return { exporter, buffer: () => buffer, scheduleFlush, recordFailure, cancelProbe };
}

describe('RemoteSessionExporter._flushBatch requeues failed slots', () => {
	it('puts a slot back when submitSessionEvents returns error and leaves successful slots out', async () => {
		const okEntry: BufferedEntry = { chatSessionId: 'local-ok', event: { type: 'assistant.message', id: 'ok' } };
		const errEntry1: BufferedEntry = { chatSessionId: 'local-err', event: { type: 'assistant.message', id: 'e1' } };
		const errEntry2: BufferedEntry = { chatSessionId: 'local-err', event: { type: 'assistant.message', id: 'e2' } };
		const { exporter, buffer, scheduleFlush, recordFailure } = makeFlushHarness({
			entries: [okEntry, errEntry1, errEntry2],
			submit: async cloudSessionId => cloudSessionId === 'cloud-err'
				? { ok: false, reason: 'error' }
				: { ok: true },
		});

		await invokeFlushBatch(exporter);

		expect(buffer()).toEqual([errEntry1, errEntry2]);
		expect(scheduleFlush).toHaveBeenCalledWith(SAFETY_INTERVAL_MS, 'safety');
		expect(recordFailure).toHaveBeenCalled();
	});

	it('requeues only the rate-limited slot', async () => {
		const okEntry: BufferedEntry = { chatSessionId: 'local-ok', event: { type: 'assistant.message', id: 'ok' } };
		const limitedEntry: BufferedEntry = { chatSessionId: 'local-limited', event: { type: 'assistant.message', id: 'lim' } };
		const { exporter, buffer, scheduleFlush, recordFailure, cancelProbe } = makeFlushHarness({
			entries: [okEntry, limitedEntry],
			submit: async cloudSessionId => cloudSessionId === 'cloud-limited'
				? { ok: false, reason: 'rate_limited' }
				: { ok: true },
		});

		await invokeFlushBatch(exporter);

		expect(buffer()).toEqual([limitedEntry]);
		expect(recordFailure).not.toHaveBeenCalled();
		expect(cancelProbe).toHaveBeenCalled();
		expect(scheduleFlush).toHaveBeenCalledWith(SAFETY_INTERVAL_MS, 'safety');
	});
});

interface CloudIdMap {
	load: () => Promise<void>;
	readonly size: number;
	has: (id: string) => boolean;
	get: (id: string) => { cloudSessionId: string; cloudTaskId: string } | undefined;
	delete: (id: string) => boolean;
}

function makeCloudIdMap(entries: Record<string, { cloudSessionId: string; cloudTaskId: string }>): { map: Map<string, { cloudSessionId: string; cloudTaskId: string }>; store: CloudIdMap } {
	const map = new Map(Object.entries(entries));
	return {
		map,
		store: {
			load: async () => { },
			get size() { return map.size; },
			has: (id: string) => map.has(id),
			get: (id: string) => map.get(id),
			delete: (id: string) => map.delete(id),
		},
	};
}

function stubDeleteExporter(opts: {
	store: CloudIdMap;
	cloudDelete: ReturnType<typeof vi.fn>;
	localDelete: ReturnType<typeof vi.fn>;
	cloudEnabled?: boolean;
	rows?: Array<{ id: string; first_message?: string; repository?: string; created_at?: string }>;
	telemetry?: ReturnType<typeof vi.fn>;
}): RemoteSessionExporter {
	const exporter = Object.create(RemoteSessionExporter.prototype) as RemoteSessionExporter;
	const fields = exporter as unknown as Record<string, unknown>;
	fields._cloudSessions = opts.store;
	fields._cloudClient = { deleteSession: opts.cloudDelete };
	fields._sessionStore = {
		deleteSession: opts.localDelete,
		executeReadOnlyFallback: () => opts.rows ?? [],
	};
	fields._configService = { getNonExtensionConfig: () => opts.cloudEnabled ?? true };
	fields._translationStates = new Map();
	fields._disabledSessions = new Set();
	fields._rateLimitedSessions = new Set();
	fields._invalidateLocalSyncedCount = () => { };
	fields._getLocalSyncedCount = () => 0;
	fields._setSyncState = () => { };
	fields._reconcileWithCloud = async () => { };
	fields._telemetryService = { sendMSFTTelemetryEvent: opts.telemetry ?? vi.fn() };
	return exporter;
}

function installDeleteWindow(deleteLocal: boolean): void {
	const window = {
		createQuickPick() {
			let items: Array<{ sessionId: string }> = [];
			const quickPick = {
				title: '',
				placeholder: '',
				canSelectMany: false,
				busy: false,
				selectedItems: [] as Array<{ sessionId: string }>,
				get items() { return items; },
				set items(value: Array<{ sessionId: string }>) {
					items = value;
					this.selectedItems = value.filter(item => item.sessionId !== '__all__');
				},
				show() { },
				dispose() { },
				onDidAccept(listener: () => void) {
					queueMicrotask(() => listener());
				},
				onDidHide() { },
			};
			return quickPick;
		},
		showQuickPick: async () => ({ label: 'scope', deleteLocal }),
		showWarningMessage: async () => 'Delete',
		showInformationMessage: async () => undefined,
		withProgress: async (_options: unknown, task: () => Promise<void>) => {
			await task();
		},
	};
	for (const target of [vscode as unknown as Record<string, unknown>, (vscode as unknown as { default?: Record<string, unknown> }).default]) {
		if (!target) {
			continue;
		}
		target.window = window;
		if (!target.ProgressLocation) {
			target.ProgressLocation = { Notification: 15 };
		}
	}
}

async function invokeDeleteSessionsFromCloud(exporter: RemoteSessionExporter, sessionIds: string[]): Promise<void> {
	await (exporter as unknown as { _deleteSessionsFromCloud: (ids: string[]) => Promise<void> })._deleteSessionsFromCloud(sessionIds);
}

async function invokeDeleteCloudSessions(exporter: RemoteSessionExporter): Promise<void> {
	await (exporter as unknown as { _deleteCloudSessions: () => Promise<void> })._deleteCloudSessions();
}

describe('RemoteSessionExporter cloud delete keeps local data when the cloud delete fails', () => {
	it('does not delete the local session or mapping when deleteSession returns error', async () => {
		const { map, store } = makeCloudIdMap({
			'local-1': { cloudSessionId: 'cloud-1', cloudTaskId: 'task-1' },
		});
		let resolveDelete!: (value: 'error') => void;
		const cloudDelete = vi.fn(() => new Promise<'error'>(resolve => { resolveDelete = resolve; }));
		const localDelete = vi.fn();
		const exporter = stubDeleteExporter({ store, cloudDelete, localDelete });

		const pending = invokeDeleteSessionsFromCloud(exporter, ['local-1']);
		await vi.waitFor(() => expect(cloudDelete).toHaveBeenCalledWith('task-1'));
		expect(localDelete).not.toHaveBeenCalled();

		resolveDelete('error');
		await pending;

		expect(localDelete).not.toHaveBeenCalled();
		expect(map.get('local-1')?.cloudTaskId).toBe('task-1');
	});

	it.each(['deleted', 'not_found'] as const)('removes the local session and mapping when deleteSession returns %s', async result => {
		const { map, store } = makeCloudIdMap({
			'local-1': { cloudSessionId: 'cloud-1', cloudTaskId: 'task-1' },
		});
		const cloudDelete = vi.fn(async () => result);
		const localDelete = vi.fn();
		const exporter = stubDeleteExporter({ store, cloudDelete, localDelete });

		await invokeDeleteSessionsFromCloud(exporter, ['local-1']);

		expect(cloudDelete).toHaveBeenCalledWith('task-1');
		expect(localDelete).toHaveBeenCalledWith('local-1');
		expect(map.has('local-1')).toBe(false);
	});

	it('still deletes a local session that has no cloud mapping', async () => {
		const { store } = makeCloudIdMap({});
		const cloudDelete = vi.fn();
		const localDelete = vi.fn();
		const exporter = stubDeleteExporter({ store, cloudDelete, localDelete });

		await invokeDeleteSessionsFromCloud(exporter, ['local-only']);

		expect(cloudDelete).not.toHaveBeenCalled();
		expect(localDelete).toHaveBeenCalledWith('local-only');
	});

	it('keeps the local session and mapping and counts cloudErrors when command-palette delete fails', async () => {
		installDeleteWindow(true);
		const { map, store } = makeCloudIdMap({
			'local-1': { cloudSessionId: 'cloud-1', cloudTaskId: 'task-1' },
		});
		const cloudDelete = vi.fn(async () => 'error' as const);
		const localDelete = vi.fn();
		const telemetry = vi.fn();
		const exporter = stubDeleteExporter({
			store,
			cloudDelete,
			localDelete,
			telemetry,
			rows: [{ id: 'local-1', first_message: 'hello', repository: 'acme/repo', created_at: '2026-01-01T00:00:00.000Z' }],
		});

		await invokeDeleteCloudSessions(exporter);

		expect(cloudDelete).toHaveBeenCalledWith('task-1');
		expect(localDelete).not.toHaveBeenCalled();
		expect(map.get('local-1')?.cloudTaskId).toBe('task-1');
		expect(telemetry).toHaveBeenCalledWith('chronicle.cloudSync', {
			operation: 'deleteSessions',
			source: 'commandPalette',
		}, {
			totalRequested: 1,
			localDeleted: 0,
			cloudDeleted: 0,
			cloudErrors: 1,
		});
	});
});
