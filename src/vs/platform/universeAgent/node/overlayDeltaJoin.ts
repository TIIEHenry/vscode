/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Host-side L3 delta accumulator. Demux stays snapshot-only when that path exists;
 * engines that emit `streaming_delta` / `thinking_delta` without a snapshot
 * still get `overlayActiveTurn`. A later snapshot resets this state and
 * yields nothing — demux owns that path when present.
 */

function readOwnDataValue(record: object, key: string): unknown {
	const desc = Object.getOwnPropertyDescriptor(record, key);
	if (desc === undefined || desc.get !== undefined || desc.set !== undefined || !Object.hasOwn(desc, 'value')) {
		return undefined;
	}
	return desc.value;
}

function readField(record: object, ...keys: string[]): unknown {
	for (const key of keys) {
		const value = readOwnDataValue(record, key);
		if (value !== undefined) {
			return value;
		}
	}
	return undefined;
}

function isRecord(value: unknown): value is object {
	return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function admitTurnId(value: unknown): value is string {
	return typeof value === 'string' && value.length > 0 && value === value.trim();
}

export type OverlayDeltaArm =
	| {
		readonly arm: 'overlayActiveTurn';
		readonly body: {
			readonly turnId: string;
			readonly streamingText: string;
			readonly thinkingText: string;
			readonly generatingToolName?: string;
		};
	}
	| { readonly arm: 'overlayActiveTurnClear'; readonly body: Record<string, never> };

export class OverlayDeltaJoin {

	private turnId: string | undefined;
	private streamingText = '';
	private thinkingText = '';
	private generatingToolName: string | undefined;

	handlePayload(payload: unknown): readonly OverlayDeltaArm[] {
		if (!isRecord(payload)) {
			return [];
		}
		const snapshot = readField(payload, 'runtime_overlay_snapshot', 'runtimeOverlaySnapshot');
		if (snapshot !== undefined) {
			this.resetFromSnapshot(snapshot);
			return [];
		}
		const streaming = readField(payload, 'streaming_delta', 'streamingDelta');
		if (isRecord(streaming)) {
			return this.applyDelta(streaming, 'streaming');
		}
		const thinking = readField(payload, 'thinking_delta', 'thinkingDelta');
		if (isRecord(thinking)) {
			return this.applyDelta(thinking, 'thinking');
		}
		const generating = readField(payload, 'generating_tool', 'generatingTool');
		if (isRecord(generating)) {
			return this.applyGenerating(generating);
		}
		const lifecycle = readField(payload, 'turn_lifecycle', 'turnLifecycle');
		if (isRecord(lifecycle)) {
			return this.applyLifecycle(lifecycle);
		}
		return [];
	}

	private resetFromSnapshot(snapshot: unknown): void {
		if (!isRecord(snapshot)) {
			this.clearState();
			return;
		}
		const active = readField(snapshot, 'active_turn', 'activeTurn');
		if (!isRecord(active)) {
			this.clearState();
			return;
		}
		const turnId = readField(active, 'turn_id', 'turnId');
		if (!admitTurnId(turnId)) {
			this.clearState();
			return;
		}
		const streaming = readField(active, 'streaming_text', 'streamingText');
		const thinking = readField(active, 'thinking_text', 'thinkingText');
		const tool = readField(active, 'generating_tool_name', 'generatingToolName');
		this.turnId = turnId;
		this.streamingText = typeof streaming === 'string' ? streaming : '';
		this.thinkingText = typeof thinking === 'string' ? thinking : '';
		this.generatingToolName = typeof tool === 'string' && tool.length > 0 ? tool : undefined;
	}

	private applyDelta(body: object, kind: 'streaming' | 'thinking'): readonly OverlayDeltaArm[] {
		const turnId = readField(body, 'turn_id', 'turnId');
		if (!admitTurnId(turnId)) {
			return [];
		}
		if (this.turnId !== undefined && this.turnId !== turnId) {
			this.streamingText = '';
			this.thinkingText = '';
			this.generatingToolName = undefined;
		}
		this.turnId = turnId;
		const delta = readField(body, 'text_delta', 'textDelta');
		if (typeof delta === 'string' && delta.length > 0) {
			if (kind === 'streaming') {
				this.streamingText += delta;
			} else {
				this.thinkingText += delta;
			}
		}
		return [this.activeTurnArm()];
	}

	private applyGenerating(body: object): readonly OverlayDeltaArm[] {
		const turnId = readField(body, 'turn_id', 'turnId');
		const toolName = readField(body, 'tool_name', 'toolName');
		if (admitTurnId(turnId)) {
			if (this.turnId !== undefined && this.turnId !== turnId) {
				this.streamingText = '';
				this.thinkingText = '';
			}
			this.turnId = turnId;
		}
		if (this.turnId === undefined) {
			return [];
		}
		this.generatingToolName = typeof toolName === 'string' && toolName.length > 0 ? toolName : undefined;
		return [this.activeTurnArm()];
	}

	private applyLifecycle(body: object): readonly OverlayDeltaArm[] {
		const completed = readField(body, 'turn_completed', 'turnCompleted');
		if (completed === undefined || completed === null) {
			const started = readField(body, 'turn_started', 'turnStarted');
			if (isRecord(started)) {
				const turnId = readField(started, 'turn_id', 'turnId');
				if (admitTurnId(turnId)) {
					this.turnId = turnId;
					this.streamingText = '';
					this.thinkingText = '';
					this.generatingToolName = undefined;
					return [this.activeTurnArm()];
				}
			}
			return [];
		}
		this.clearState();
		return [{ arm: 'overlayActiveTurnClear', body: {} }];
	}

	private activeTurnArm(): OverlayDeltaArm {
		return {
			arm: 'overlayActiveTurn',
			body: {
				turnId: this.turnId!,
				streamingText: this.streamingText,
				thinkingText: this.thinkingText,
				...(this.generatingToolName !== undefined ? { generatingToolName: this.generatingToolName } : {}),
			},
		};
	}

	private clearState(): void {
		this.turnId = undefined;
		this.streamingText = '';
		this.thinkingText = '';
		this.generatingToolName = undefined;
	}
}
