/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type {
	AttemptId,
	ChatWriteId,
	DiagnosticMetric,
	DiagnosticsPort,
	EffectId,
	IdPort,
	SchedulerPort,
	TextChunkId,
	TimerId,
} from './sessionCore/ports.js';

export class NodeSchedulerPort implements SchedulerPort {

	private readonly timers = new Map<TimerId, ReturnType<typeof setTimeout>>();

	now(): number {
		return Date.now();
	}

	startTimer(id: TimerId, delayMs: number): void {
		this.cancelTimer(id);
		const handle = setTimeout(() => {
			this.timers.delete(id);
		}, delayMs);
		this.timers.set(id, handle);
	}

	cancelTimer(id: TimerId): void {
		const handle = this.timers.get(id);
		if (handle !== undefined) {
			clearTimeout(handle);
			this.timers.delete(id);
		}
	}

	dispose(): void {
		for (const handle of this.timers.values()) {
			clearTimeout(handle);
		}
		this.timers.clear();
	}
}

export function createSessionViewIdPort(seed = 0): IdPort {
	let n = seed;
	const next = (prefix: string): string => {
		n += 1;
		return `${prefix}${n}`;
	};
	return {
		nextChunkId: () => next('chunk:') as TextChunkId,
		nextEffectId: () => next('effect:') as EffectId,
		nextAttemptId: () => next('attempt:') as AttemptId,
		nextWriteId: () => next('write:') as ChatWriteId,
	};
}

export function createSessionViewDiagnosticsPort(): DiagnosticsPort {
	return {
		count(_metric: DiagnosticMetric, _labels?: Readonly<Record<string, string>>): void {
			// diagnostics-only; production host may wire telemetry later
		},
		warn(_message: string, _fields: Readonly<Record<string, unknown>>): void {
		},
	};
}
