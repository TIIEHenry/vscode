/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Host-side L3 delta accumulator. Demux stays snapshot-only when that path
 * exists (Desktop); engines that emit `streaming_delta` / `thinking_delta`
 * without a snapshot still get `overlayActiveTurn`. A later snapshot resets
 * this state and yields nothing — demux owns that path when present.
 *
 * L2 handoff is by `turn_id`. An assistant envelope clears that overlay turn
 * immediately, except a tool-call-only envelope while streaming text or
 * thinking text is still accumulated: that beat drops `generatingToolName`
 * and keeps that text on `overlayActiveTurn`. Usable thinking already in the
 * envelope is the persisted reading line, so the overlay does not keep a
 * second copy; streaming text still stays. An envelope with usable text, or
 * with no usable tool call (including empty blocks), still clears at once.
 * `turn_completed` holds that clear only when its `turn_id` equals the
 * current overlay turn, until one of those clearing envelopes, the next
 * `turn_started`, or 2s. A missing or different `turn_id` does not hold
 * and does not clear.
 *
 * A live `tool_call_lifecycle.started` with a non-empty `tool_name` reuses
 * `applyGenerating` (the engine does not emit `generating_tool` on that beat).
 * A non-empty exact `tool_call_id` on that lifecycle stays on the overlay turn
 * as `generatingToolCallId`. Blank and padded ids are omitted, not trimmed.
 * A later `generating_tool` for the same name keeps that id; a different name
 * drops it. `args_complete`, `completed`, and `failed` leave the accumulated text.
 */

const overlayHandoffHoldMs = 2000;

export interface OverlayDeltaJoinOptions {
	readonly scheduleTimeout?: (delayMs: number, callback: () => void) => { dispose(): void };
}

function defaultScheduleTimeout(delayMs: number, callback: () => void): { dispose(): void } {
	const handle = setTimeout(callback, delayMs);
	// A held clear must not pin the process for the full delay.
	const timer = handle as unknown as { unref?: () => void };
	if (typeof timer.unref === 'function') {
		timer.unref();
	}
	return { dispose: () => clearTimeout(handle) };
}

function isAssistantRole(role: unknown): boolean {
	if (role === 2) {
		return true;
	}
	if (typeof role !== 'string') {
		return false;
	}
	const stripped = role.replace(/^MESSAGE_ROLE_/i, '');
	return stripped.toUpperCase() === 'ASSISTANT';
}

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

const BLOCK_TYPE_TEXT = 1;
const BLOCK_TYPE_TOOL_CALL = 2;
const BLOCK_TYPE_THINKING = 4;

function normalizeBlockType(value: unknown): number | undefined {
	if (typeof value === 'number' && Number.isSafeInteger(value)) {
		return value;
	}
	if (typeof value !== 'string') {
		return undefined;
	}
	const key = value.replace(/^BLOCK_TYPE_/, '').toUpperCase();
	switch (key) {
		case 'TEXT': return BLOCK_TYPE_TEXT;
		case 'TOOL_CALL': return BLOCK_TYPE_TOOL_CALL;
		case 'THINKING': return BLOCK_TYPE_THINKING;
		default: return undefined;
	}
}

function blockTypeOf(block: object): number | undefined {
	const declared = normalizeBlockType(readField(block, 'block_type', 'blockType'));
	if (declared !== undefined) {
		return declared;
	}
	if (isRecord(readField(block, 'tool_call_block', 'toolCallBlock'))) {
		return BLOCK_TYPE_TOOL_CALL;
	}
	if (isRecord(readField(block, 'thinking_block', 'thinkingBlock'))) {
		return BLOCK_TYPE_THINKING;
	}
	if (isRecord(readField(block, 'text_block', 'textBlock')) || typeof readField(block, 'text', 'content') === 'string') {
		return BLOCK_TYPE_TEXT;
	}
	return undefined;
}

function isUsableToolName(value: unknown): boolean {
	return typeof value === 'string' && value.length > 0 && value.length <= 128 && value === value.trim();
}

function nonEmptyTrimmed(value: unknown): boolean {
	return typeof value === 'string' && value.trim().length > 0;
}

/** Same usable-block notion as demux: a named tool call, or non-empty text. */
function isUsableToolCallBlock(block: object): boolean {
	if (blockTypeOf(block) !== BLOCK_TYPE_TOOL_CALL) {
		return false;
	}
	const nested = readField(block, 'tool_call_block', 'toolCallBlock');
	const payload = isRecord(nested) ? nested : block;
	return isUsableToolName(readField(payload, 'tool_name', 'toolName'));
}

function isUsableTextBlock(block: object): boolean {
	if (blockTypeOf(block) !== BLOCK_TYPE_TEXT) {
		return false;
	}
	const nested = readField(block, 'text_block', 'textBlock');
	if (isRecord(nested)) {
		return nonEmptyTrimmed(readField(nested, 'text'));
	}
	return nonEmptyTrimmed(readField(block, 'text', 'content'));
}

function envelopeBlocks(envelope: object): readonly object[] {
	const blocks = readField(envelope, 'blocks');
	if (!Array.isArray(blocks)) {
		return [];
	}
	const records: object[] = [];
	for (const block of blocks) {
		if (isRecord(block)) {
			records.push(block);
		}
	}
	return records;
}

/** Same usable-thinking notion as demux: a thinking block with non-blank text. */
function isUsableThinkingBlock(block: object): boolean {
	if (blockTypeOf(block) !== BLOCK_TYPE_THINKING) {
		return false;
	}
	const nested = readField(block, 'thinking_block', 'thinkingBlock');
	if (isRecord(nested)) {
		return nonEmptyTrimmed(readField(nested, 'thinking'));
	}
	return nonEmptyTrimmed(readField(block, 'thinking'));
}

function envelopeHasUsableThinking(envelope: object): boolean {
	for (const block of envelopeBlocks(envelope)) {
		if (isUsableThinkingBlock(block)) {
			return true;
		}
	}
	return false;
}

function keepsStreamingThroughAssistantEnvelope(envelope: object): boolean {
	let tool = false;
	let text = false;
	for (const block of envelopeBlocks(envelope)) {
		if (isUsableTextBlock(block)) {
			text = true;
		}
		if (isUsableToolCallBlock(block)) {
			tool = true;
		}
	}
	return tool && !text;
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
			/** Non-empty exact tool_call_id for the generating tool. Omitted when absent. */
			readonly generatingToolCallId?: string;
			readonly agentId?: string;
		};
	}
	| { readonly arm: 'overlayActiveTurnClear'; readonly body: Record<string, never> };

function admitAgentId(value: unknown): string | undefined {
	if (typeof value !== 'string' || value.length === 0 || value.length > 128 || value !== value.trim()) {
		return undefined;
	}
	for (let i = 0; i < value.length; i++) {
		const code = value.charCodeAt(i);
		if (code <= 0x1f || code === 0x7f) {
			return undefined;
		}
	}
	return value;
}

export class OverlayDeltaJoin {

	private turnId: string | undefined;
	private streamingText = '';
	private thinkingText = '';
	private generatingToolName: string | undefined;
	private generatingToolCallId: string | undefined;
	private agentId: string | undefined;
	private heldTurnId: string | undefined;
	private holdTimer: { dispose(): void } | undefined;
	private deferredArmHandler: ((arm: OverlayDeltaArm) => void) | undefined;
	private deferredClearTimeoutCountValue = 0;
	private readonly scheduleTimeout: (delayMs: number, callback: () => void) => { dispose(): void };

	constructor(options?: OverlayDeltaJoinOptions) {
		this.scheduleTimeout = options?.scheduleTimeout ?? defaultScheduleTimeout;
	}

	get deferredClearTimeoutCount(): number {
		return this.deferredClearTimeoutCountValue;
	}

	setDeferredArmHandler(handler: ((arm: OverlayDeltaArm) => void) | undefined): void {
		this.deferredArmHandler = handler;
	}

	clear(): void {
		this.cancelHold();
		this.clearState();
	}

	handlePayload(payload: unknown): readonly OverlayDeltaArm[] {
		if (!isRecord(payload)) {
			return [];
		}
		const assistantEnvelopes = this.matchingAssistantEnvelopes(payload);
		if (assistantEnvelopes.length > 0) {
			return this.handoffAssistantEnvelopes(assistantEnvelopes);
		}
		const snapshot = readField(payload, 'runtime_overlay_snapshot', 'runtimeOverlaySnapshot');
		if (snapshot !== undefined) {
			this.cancelHold();
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
		const toolLifecycle = readField(payload, 'tool_call_lifecycle', 'toolCallLifecycle');
		if (isRecord(toolLifecycle)) {
			return this.applyToolCallStarted(toolLifecycle);
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
		this.generatingToolCallId = undefined;
		this.agentId = admitAgentId(readField(active, 'agent_id', 'agentId'));
	}

	private applyDelta(body: object, kind: 'streaming' | 'thinking'): readonly OverlayDeltaArm[] {
		const turnId = readField(body, 'turn_id', 'turnId');
		if (!admitTurnId(turnId)) {
			return [];
		}
		this.releaseHoldForOtherTurn(turnId);
		const turnChanged = this.turnId !== turnId;
		if (this.turnId !== undefined && turnChanged) {
			this.streamingText = '';
			this.thinkingText = '';
			this.generatingToolName = undefined;
			this.generatingToolCallId = undefined;
		}
		this.turnId = turnId;
		this.noteAgentId(body, turnChanged);
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
			this.releaseHoldForOtherTurn(turnId);
			const turnChanged = this.turnId !== turnId;
			if (this.turnId !== undefined && turnChanged) {
				this.streamingText = '';
				this.thinkingText = '';
				this.generatingToolName = undefined;
				this.generatingToolCallId = undefined;
			}
			this.turnId = turnId;
			this.noteAgentId(body, turnChanged);
		} else {
			this.noteAgentId(body, false);
		}
		if (this.turnId === undefined) {
			return [];
		}
		const nextName = typeof toolName === 'string' && toolName.length > 0 ? toolName : undefined;
		const previousName = this.generatingToolName;
		this.generatingToolName = nextName;
		if (nextName === undefined) {
			this.generatingToolCallId = undefined;
		} else if (ownsToolCallId(body)) {
			this.generatingToolCallId = admitExactToolCallId(readField(body, 'tool_call_id', 'toolCallId'));
		} else if (nextName !== previousName) {
			this.generatingToolCallId = undefined;
		}
		return [this.activeTurnArm()];
	}

	/**
	 * Same write as `generating_tool` once `started.tool_name` is non-empty:
	 * set `generatingToolName` and keep the text already accumulated for this
	 * turn. The lifecycle's exact `tool_call_id` is forwarded even when blank,
	 * so a started beat replaces the previous call id instead of keeping it.
	 * Other lifecycle arms do not clear that text.
	 */
	private applyToolCallStarted(body: object): readonly OverlayDeltaArm[] {
		const started = readField(body, 'started');
		if (!isRecord(started)) {
			return [];
		}
		const toolName = readField(started, 'tool_name', 'toolName');
		if (typeof toolName !== 'string' || toolName.length === 0) {
			return [];
		}
		const forwarded: Record<string, unknown> = {
			tool_name: toolName,
			tool_call_id: readField(body, 'tool_call_id', 'toolCallId'),
		};
		const turnId = readField(body, 'turn_id', 'turnId');
		if (turnId !== undefined) {
			forwarded.turn_id = turnId;
		}
		const agentId = readField(body, 'agent_id', 'agentId');
		if (agentId !== undefined) {
			forwarded.agent_id = agentId;
		}
		return this.applyGenerating(forwarded);
	}

	private applyLifecycle(body: object): readonly OverlayDeltaArm[] {
		const completed = readField(body, 'turn_completed', 'turnCompleted');
		if (completed !== undefined && completed !== null) {
			const completedTurnId = isRecord(completed) ? readField(completed, 'turn_id', 'turnId') : undefined;
			if (admitTurnId(completedTurnId) && completedTurnId === this.turnId) {
				this.beginHold();
			}
			return [];
		}
		const started = readField(body, 'turn_started', 'turnStarted');
		if (isRecord(started)) {
			const turnId = readField(started, 'turn_id', 'turnId');
			if (admitTurnId(turnId)) {
				const holding = this.heldTurnId !== undefined;
				this.cancelHold();
				this.turnId = turnId;
				this.streamingText = '';
				this.thinkingText = '';
				this.generatingToolName = undefined;
				this.generatingToolCallId = undefined;
				this.agentId = undefined;
				const startedArm = this.activeTurnArm();
				if (holding) {
					return [{ arm: 'overlayActiveTurnClear', body: {} }, startedArm];
				}
				return [startedArm];
			}
		}
		return [];
	}

	private matchingAssistantEnvelopes(payload: object): readonly object[] {
		if (this.turnId === undefined) {
			return [];
		}
		const matched: object[] = [];
		const appended = readField(payload, 'envelope_appended', 'envelopeAppended');
		if (isRecord(appended)) {
			const envelope = readField(appended, 'envelope');
			if (isRecord(envelope) && this.envelopeMatchesActiveTurn(envelope)) {
				matched.push(envelope);
			}
		}
		const batch = readField(payload, 'envelope_batch_appended', 'envelopeBatchAppended');
		if (isRecord(batch)) {
			const envelopes = readField(batch, 'envelopes');
			if (Array.isArray(envelopes)) {
				for (const envelope of envelopes) {
					if (isRecord(envelope) && this.envelopeMatchesActiveTurn(envelope)) {
						matched.push(envelope);
					}
				}
			}
		}
		return matched;
	}

	/**
	 * A tool-call-only assistant envelope is not the text handoff. Keep
	 * accumulated streaming text, and keep accumulated thinking when this
	 * envelope has no usable thinking block. Drop the generating-tool chrome.
	 * Usable thinking already on the envelope is the persisted reading line,
	 * so the overlay does not keep a second copy. Host still delivers the
	 * demux tool arm first.
	 */
	private handoffAssistantEnvelopes(envelopes: readonly object[]): readonly OverlayDeltaArm[] {
		if (!envelopes.every(keepsStreamingThroughAssistantEnvelope)) {
			return this.takeImmediateClear();
		}
		const persistedThinking = envelopes.some(envelopeHasUsableThinking);
		const keepStreaming = this.streamingText.length > 0;
		const keepThinking = !persistedThinking && this.thinkingText.length > 0;
		if (!keepStreaming && !keepThinking) {
			return this.takeImmediateClear();
		}
		this.cancelHold();
		this.generatingToolName = undefined;
		this.generatingToolCallId = undefined;
		if (persistedThinking) {
			this.thinkingText = '';
		}
		return [this.activeTurnArm()];
	}

	private envelopeMatchesActiveTurn(envelope: unknown): boolean {
		if (!isRecord(envelope) || this.turnId === undefined) {
			return false;
		}
		const turnId = readField(envelope, 'turn_id', 'turnId');
		return turnId === this.turnId && isAssistantRole(readField(envelope, 'role'));
	}

	private takeImmediateClear(): readonly OverlayDeltaArm[] {
		this.cancelHold();
		this.clearState();
		return [{ arm: 'overlayActiveTurnClear', body: {} }];
	}

	private beginHold(): void {
		if (this.turnId === undefined || this.heldTurnId !== undefined) {
			return;
		}
		this.heldTurnId = this.turnId;
		const timer = this.scheduleTimeout(overlayHandoffHoldMs, () => this.onHoldTimeout());
		if (this.heldTurnId === undefined) {
			timer.dispose();
			return;
		}
		this.holdTimer = timer;
	}

	private onHoldTimeout(): void {
		if (this.heldTurnId === undefined) {
			return;
		}
		this.holdTimer = undefined;
		this.heldTurnId = undefined;
		this.deferredClearTimeoutCountValue++;
		this.clearState();
		this.deferredArmHandler?.({ arm: 'overlayActiveTurnClear', body: {} });
	}

	private cancelHold(): void {
		this.heldTurnId = undefined;
		const timer = this.holdTimer;
		this.holdTimer = undefined;
		timer?.dispose();
	}

	private releaseHoldForOtherTurn(turnId: string): void {
		if (this.heldTurnId !== undefined && this.heldTurnId !== turnId) {
			this.cancelHold();
		}
	}

	private noteAgentId(body: object, replace: boolean): void {
		const agentId = admitAgentId(readField(body, 'agent_id', 'agentId'));
		if (replace) {
			this.agentId = agentId;
			return;
		}
		if (agentId !== undefined) {
			this.agentId = agentId;
		}
	}

	private activeTurnArm(): OverlayDeltaArm {
		return {
			arm: 'overlayActiveTurn',
			body: {
				turnId: this.turnId!,
				streamingText: this.streamingText,
				thinkingText: this.thinkingText,
				...(this.generatingToolName !== undefined ? { generatingToolName: this.generatingToolName } : {}),
				...(this.generatingToolName !== undefined && this.generatingToolCallId !== undefined
					? { generatingToolCallId: this.generatingToolCallId }
					: {}),
				...(this.agentId !== undefined ? { agentId: this.agentId } : {}),
			},
		};
	}

	private clearState(): void {
		this.turnId = undefined;
		this.streamingText = '';
		this.thinkingText = '';
		this.generatingToolName = undefined;
		this.generatingToolCallId = undefined;
		this.agentId = undefined;
	}
}

function ownsToolCallId(body: object): boolean {
	return Object.hasOwn(body, 'tool_call_id') || Object.hasOwn(body, 'toolCallId');
}

/** Non-empty exact tool_call_id. Blank and padded ids are absent, not trimmed. */
function admitExactToolCallId(value: unknown): string | undefined {
	if (typeof value !== 'string' || value.length === 0 || value !== value.trim()) {
		return undefined;
	}
	return value;
}
