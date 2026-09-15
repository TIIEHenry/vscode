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

	constructor(
		private readonly onFire?: (id: TimerId) => void,
	) { }

	now(): number {
		return Date.now();
	}

	startTimer(id: TimerId, delayMs: number): void {
		this.cancelTimer(id);
		const handle = setTimeout(() => {
			this.timers.delete(id);
			this.onFire?.(id);
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

/** Duck-typed logger so node ports do not depend on ILogService identity. */
export type SessionViewDiagnosticsLog = {
	readonly info: (message: string, ...args: unknown[]) => void;
	readonly warn: (message: string, ...args: unknown[]) => void;
};

/**
 * Default / production diagnostics port.
 * Without `log`, count/warn stay silent (tests). With `log`, count is an info
 * line containing the metric name (e.g. `view.lease_released_by_owner`) and
 * warn is forwarded to the logger.
 */
export function createSessionViewDiagnosticsPort(log?: SessionViewDiagnosticsLog): DiagnosticsPort {
	return {
		count(metric: DiagnosticMetric, labels?: Readonly<Record<string, string>>): void {
			if (!log) {
				return;
			}
			const suffix = labels && Object.keys(labels).length > 0 ? ` ${JSON.stringify(labels)}` : '';
			log.info(`${metric}${suffix}`);
		},
		warn(message: string, fields: Readonly<Record<string, unknown>>): void {
			if (!log) {
				return;
			}
			log.warn(message, fields);
		},
	};
}
