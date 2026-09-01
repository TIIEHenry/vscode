/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export type ConversationVisualizeType = 'diagram' | 'comparison';

export interface ConversationVisualizeOption {
	readonly name: string;
	readonly description?: string;
	readonly pros: readonly string[];
	readonly cons: readonly string[];
	readonly recommended: boolean;
	readonly mermaid?: string;
}

export type ConversationVisualizeArgs =
	| { readonly type: 'diagram'; readonly title?: string; readonly mermaid: string }
	| { readonly type: 'comparison'; readonly title?: string; readonly options: readonly ConversationVisualizeOption[] };

export type ConversationVisualizeParseResult =
	| { readonly ok: true; readonly args: ConversationVisualizeArgs }
	| { readonly ok: false; readonly error: string; readonly fallbackMarkdown: string };

export function validateConversationVisualizePayload(args: ConversationVisualizeArgs): void {
	if (args.type === 'diagram') {
		if (!args.mermaid || args.mermaid.trim() === '') {
			throw new Error(
				'visualize: `mermaid` is required and must be a non-empty string when type is "diagram".',
			);
		}
		return;
	}

	if (!args.options || args.options.length === 0) {
		throw new Error(
			'visualize: `options` is required and must be a non-empty array when type is "comparison".',
		);
	}

	args.options.forEach((opt, i) => {
		if (!opt.name || opt.name.trim() === '') {
			throw new Error(`visualize: options[${i}].name is required and must be non-empty.`);
		}
	});
}

/** @deprecated Use {@link validateConversationVisualizePayload}. */
export const validateVisualizeArgs = validateConversationVisualizePayload;

export function parseVisualizeArgs(raw: unknown): ConversationVisualizeParseResult {
	try {
		const args = coerceConversationVisualizeArgs(raw);
		validateConversationVisualizePayload(args);
		return { ok: true, args };
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return { ok: false, error: message, fallbackMarkdown: buildVisualizeFallbackMarkdown(raw, message) };
	}
}

export function mermaidFence(title: string | undefined, mermaid: string): string {
	const body = `\`\`\`mermaid\n${mermaid.trim()}\n\`\`\``;
	return title ? `### ${title}\n\n${body}` : body;
}

export function comparisonMarkdown(title: string | undefined, options: readonly ConversationVisualizeOption[]): string {
	const blocks: string[] = [];
	if (title) {
		blocks.push(`## ${title}`);
	}

	for (const opt of options) {
		const parts: string[] = [];
		parts.push(`### ${opt.name}${opt.recommended ? ' — ✅ Recommended' : ''}`);
		if (opt.description) {
			parts.push(opt.description);
		}
		if (opt.pros.length > 0) {
			parts.push(['**Pros:**', ...opt.pros.map(p => `- ${p}`)].join('\n'));
		}
		if (opt.cons.length > 0) {
			parts.push(['**Cons:**', ...opt.cons.map(c => `- ${c}`)].join('\n'));
		}
		if (opt.mermaid && opt.mermaid.trim() !== '') {
			parts.push(mermaidFence(undefined, opt.mermaid));
		}
		blocks.push(parts.join('\n\n'));
	}

	return blocks.join('\n\n');
}

/** Adapter for future engine mapping from `renderMermaidDiagram`-shaped tool output. */
export function visualizeArgsFromMermaidTool(input: { readonly markup: string; readonly title?: string }): ConversationVisualizeArgs {
	return { type: 'diagram', mermaid: input.markup, title: input.title };
}

function coerceConversationVisualizeArgs(raw: unknown): ConversationVisualizeArgs {
	if (!isRecord(raw)) {
		throw new Error('visualize: payload must be an object.');
	}

	const type = raw.type;
	if (type !== 'diagram' && type !== 'comparison') {
		throw new Error('visualize: `type` must be "diagram" or "comparison".');
	}

	const title = readString(raw.title);

	if (type === 'diagram') {
		const mermaid = readString(raw.mermaid);
		if (!mermaid || mermaid.trim() === '') {
			throw new Error(
				'visualize: `mermaid` is required and must be a non-empty string when type is "diagram".',
			);
		}
		return { type: 'diagram', title, mermaid };
	}

	const optionsRaw = raw.options;
	if (!Array.isArray(optionsRaw) || optionsRaw.length === 0) {
		throw new Error(
			'visualize: `options` is required and must be a non-empty array when type is "comparison".',
		);
	}

	const options = optionsRaw.map((option, index) => parseComparisonOption(option, index));
	return { type: 'comparison', title, options };
}

function parseComparisonOption(raw: unknown, index: number): ConversationVisualizeOption {
	if (!isRecord(raw)) {
		throw new Error(`visualize: options[${index}] must be an object.`);
	}

	const name = readString(raw.name);
	if (!name || name.trim() === '') {
		throw new Error(`visualize: options[${index}].name is required and must be non-empty.`);
	}

	return {
		name,
		description: readString(raw.description),
		pros: readStringArray(raw.pros),
		cons: readStringArray(raw.cons),
		recommended: raw.recommended === true,
		mermaid: readString(raw.mermaid),
	};
}

function buildVisualizeFallbackMarkdown(raw: unknown, error: string): string {
	const parts: string[] = [`**Visualize error:** ${error}`];

	if (isRecord(raw)) {
		const type = raw.type;
		const title = readString(raw.title);

		if (type === 'diagram') {
			const mermaid = readString(raw.mermaid);
			if (mermaid) {
				parts.push(mermaidFence(title, mermaid));
			}
		} else if (type === 'comparison' && Array.isArray(raw.options)) {
			const options = raw.options.map((option, index) => {
				if (!isRecord(option)) {
					return { name: `Option ${index + 1}`, pros: [], cons: [], recommended: false };
				}
				return {
					name: readString(option.name) ?? `Option ${index + 1}`,
					description: readString(option.description),
					pros: readStringArray(option.pros),
					cons: readStringArray(option.cons),
					recommended: option.recommended === true,
					mermaid: readString(option.mermaid),
				};
			});
			parts.push(comparisonMarkdown(title, options));
		}
	}

	return parts.join('\n\n');
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | undefined {
	return typeof value === 'string' ? value : undefined;
}

function readStringArray(value: unknown): readonly string[] {
	if (!Array.isArray(value)) {
		return [];
	}
	return value.filter((item): item is string => typeof item === 'string');
}
