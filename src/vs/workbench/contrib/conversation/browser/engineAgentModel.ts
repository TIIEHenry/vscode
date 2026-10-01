/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/** AgentProfileProto model / model_type / max_turns (fields 17–19). Empty max turns is the engine default, not unlimited. */
export interface AgentProfileModelFields {
	readonly model?: string;
	readonly modelType?: string;
	readonly maxTurns?: number;
}

export interface AgentProfileModelFieldInput {
	readonly model: string;
	readonly modelType: string;
	readonly maxTurns: string;
}

const MAX_TURNS_LIMIT = 2_147_483_647;

export function agentProfileModelFieldsFromProfile(profile: {
	readonly model?: string;
	readonly modelType?: string;
	readonly maxTurns?: number;
}): AgentProfileModelFields {
	const model = profile.model?.trim();
	const modelType = profile.modelType?.trim();
	const maxTurns = profile.maxTurns !== undefined && profile.maxTurns > 0 ? profile.maxTurns : undefined;
	return {
		...(model ? { model } : {}),
		...(modelType ? { modelType } : {}),
		...(maxTurns ? { maxTurns } : {}),
	};
}

export function formatAgentProfileMaxTurns(maxTurns: number | undefined): string {
	return maxTurns !== undefined && maxTurns > 0 ? String(maxTurns) : '';
}

/** Empty is the engine default. Zero, negatives, and non-integers are not a turn cap. */
export function parseAgentProfileMaxTurns(raw: string): { ok: true; maxTurns?: number } | { ok: false } {
	const trimmed = raw.trim();
	if (!trimmed) {
		return { ok: true };
	}
	if (!/^[1-9]\d*$/.test(trimmed)) {
		return { ok: false };
	}
	const value = Number(trimmed);
	if (!Number.isSafeInteger(value) || value > MAX_TURNS_LIMIT) {
		return { ok: false };
	}
	return { ok: true, maxTurns: value };
}

export function agentProfileModelFieldsFromInput(
	input: AgentProfileModelFieldInput,
): { ok: true; fields: AgentProfileModelFields } | { ok: false } {
	const parsed = parseAgentProfileMaxTurns(input.maxTurns);
	if (!parsed.ok) {
		return { ok: false };
	}
	const model = input.model.trim();
	const modelType = input.modelType.trim();
	return {
		ok: true,
		fields: {
			...(model ? { model } : {}),
			...(modelType ? { modelType } : {}),
			...(parsed.maxTurns ? { maxTurns: parsed.maxTurns } : {}),
		},
	};
}

export function agentProfileModelFieldsEqual(left: AgentProfileModelFields, right: AgentProfileModelFields): boolean {
	return left.model === right.model
		&& left.modelType === right.modelType
		&& left.maxTurns === right.maxTurns;
}
