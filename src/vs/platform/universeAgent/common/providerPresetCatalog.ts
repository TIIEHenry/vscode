/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { UniverseAgentProviderPreset } from './universeAgentTypes.js';

/**
 * Built-in provider presets. Same ids and endpoints as Singularity
 * `PROVIDER_PRESET_OVERLAYS`, without the blank Custom row.
 * Cloud rows come from models.dev and stay out of this list.
 */
const BUILTIN_PROVIDER_OVERLAYS: readonly UniverseAgentProviderPreset[] = [
	{
		id: 'openai',
		displayName: 'OpenAI / Compatible API',
		defaultApiBaseUrl: 'https://api.openai.com/v1',
		defaultProtocol: 'openai',
		defaultModels: ['gpt-4o', 'gpt-4o-mini', 'o1', 'o1-mini', 'o3-mini'],
		quickPick: true,
	},
	{
		id: 'anthropic',
		displayName: 'Anthropic / Compatible API',
		defaultApiBaseUrl: 'https://api.anthropic.com',
		defaultProtocol: 'anthropic',
		defaultModels: ['claude-sonnet-4-20250514', 'claude-haiku-4-20250514', 'claude-opus-4-20250514'],
		quickPick: true,
	},
	{
		id: 'gemini',
		displayName: 'Google Gemini',
		defaultApiBaseUrl: 'https://generativelanguage.googleapis.com',
		defaultProtocol: 'openai',
		defaultModels: ['gemini-2.0-flash', 'gemini-2.0-pro', 'gemini-1.5-pro'],
		quickPick: true,
	},
	{
		id: 'openrouter',
		displayName: 'OpenRouter',
		defaultApiBaseUrl: 'https://openrouter.ai/api/v1',
		defaultProtocol: 'openai',
		defaultModels: ['anthropic/claude-sonnet-4', 'google/gemini-2.0-flash', 'meta-llama/llama-4-maverick'],
		quickPick: true,
	},
	{
		id: 'deepseek',
		displayName: 'DeepSeek',
		defaultApiBaseUrl: 'https://api.deepseek.com',
		defaultProtocol: 'openai',
		defaultModels: ['deepseek-chat', 'deepseek-reasoner'],
		quickPick: true,
	},
	{
		id: 'zhipu',
		displayName: 'Zhipu / GLM',
		defaultApiBaseUrl: 'https://open.bigmodel.cn/api/paas/v4',
		defaultProtocol: 'openai',
		defaultModels: ['glm-4', 'glm-4-flash'],
		quickPick: true,
	},
	{
		id: 'qwen',
		displayName: 'Alibaba Qwen (DashScope)',
		defaultApiBaseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
		defaultProtocol: 'openai',
		defaultModels: ['qwen-max', 'qwen-plus', 'qwen-turbo'],
		quickPick: true,
	},
	{
		id: 'deepseek-anthropic',
		displayName: 'DeepSeek (Anthropic API)',
		defaultApiBaseUrl: 'https://api.deepseek.com/anthropic',
		defaultProtocol: 'anthropic',
		defaultModels: ['deepseek-v4-flash'],
		quickPick: false,
	},
];

/** One models.dev provider after the JSON map is flattened. */
export interface CloudProviderSeed {
	readonly id: string;
	readonly name: string;
	readonly api: string;
	readonly npm: string;
	readonly env: readonly string[];
	readonly modelIds: readonly string[];
}

export interface MergedProviderPresets {
	readonly builtin: readonly UniverseAgentProviderPreset[];
	readonly cloud: readonly UniverseAgentProviderPreset[];
}

export function builtinProviderPresets(): readonly UniverseAgentProviderPreset[] {
	return BUILTIN_PROVIDER_OVERLAYS.map(preset => ({ ...preset, defaultModels: [...preset.defaultModels] }));
}

/** Infer wire protocol from a models.dev npm package id. */
export function inferApiTypeFromCatalogNpm(npm: string): string {
	const normalized = npm.trim().toLowerCase();
	if (!normalized) {
		return '';
	}
	if (normalized.includes('anthropic')) {
		return 'anthropic';
	}
	if (normalized.includes('openai')) {
		return 'openai';
	}
	return '';
}

function inferApiTypeFromPreset(presetId: string): string {
	switch (presetId) {
		case 'anthropic':
		case 'deepseek-anthropic':
			return 'anthropic';
		case 'openai':
		case 'openrouter':
		case 'deepseek':
		case 'zhipu':
		case 'qwen':
		case 'kimi':
		case 'gemini':
			return 'openai';
		default:
			return '';
	}
}

function resolveProtocol(id: string, npm: string, overlayProtocol: string): string {
	const explicit = overlayProtocol.trim();
	if (explicit) {
		return explicit;
	}
	return inferApiTypeFromCatalogNpm(npm) || inferApiTypeFromPreset(id);
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		return undefined;
	}
	return value as Record<string, unknown>;
}

function stringList(value: unknown): string[] {
	if (!Array.isArray(value)) {
		return [];
	}
	return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

function modelIdsFromCatalog(models: unknown): string[] {
	const record = asRecord(models);
	if (!record) {
		return [];
	}
	const rows: { id: string; release: string }[] = [];
	for (const [key, value] of Object.entries(record)) {
		const model = asRecord(value);
		if (!model || model.status === 'deprecated') {
			continue;
		}
		const id = typeof model.id === 'string' && model.id.trim() ? model.id.trim() : key.trim();
		if (!id) {
			continue;
		}
		rows.push({
			id,
			release: typeof model.release_date === 'string' ? model.release_date : '',
		});
	}
	rows.sort((left, right) => right.release.localeCompare(left.release));
	return rows.slice(0, 5).map(row => row.id);
}

/**
 * Flatten a models.dev `/api.json` body.
 * A provider is kept when it has an env var or an API URL.
 * Deprecated models are dropped. At most five model ids are kept.
 */
export function parseModelsDevCatalog(body: string): CloudProviderSeed[] {
	const parsed: unknown = JSON.parse(body);
	const record = asRecord(parsed);
	if (!record) {
		throw new Error('cloud catalog is not an object');
	}
	const seeds: CloudProviderSeed[] = [];
	for (const [key, value] of Object.entries(record)) {
		const provider = asRecord(value);
		if (!provider) {
			continue;
		}
		const id = (typeof provider.id === 'string' && provider.id.trim() ? provider.id : key).trim();
		if (!id || id === 'custom') {
			continue;
		}
		const api = typeof provider.api === 'string' ? provider.api.trim() : '';
		const env = stringList(provider.env);
		if (!api && env.length === 0) {
			continue;
		}
		const name = typeof provider.name === 'string' && provider.name.trim() ? provider.name.trim() : id;
		seeds.push({
			id,
			name,
			api,
			npm: typeof provider.npm === 'string' ? provider.npm.trim() : '',
			env,
			modelIds: modelIdsFromCatalog(provider.models),
		});
	}
	return seeds;
}

/**
 * Built-in overlays stay on the built-in list. Catalog fills URL and models
 * when the id matches. Every other eligible catalog provider is the cloud list.
 */
export function mergeProviderPresets(seeds: readonly CloudProviderSeed[]): MergedProviderPresets {
	const seedsById = new Map(seeds.map(seed => [seed.id, seed]));
	const builtinIds = new Set(BUILTIN_PROVIDER_OVERLAYS.map(preset => preset.id));
	const builtin = BUILTIN_PROVIDER_OVERLAYS.map(overlay => {
		const seed = seedsById.get(overlay.id);
		if (!seed) {
			return { ...overlay, defaultModels: [...overlay.defaultModels] };
		}
		return {
			id: overlay.id,
			displayName: seed.name || overlay.displayName,
			defaultApiBaseUrl: seed.api || overlay.defaultApiBaseUrl,
			defaultProtocol: resolveProtocol(overlay.id, seed.npm, overlay.defaultProtocol),
			defaultModels: seed.modelIds.length > 0 ? [...seed.modelIds] : [...overlay.defaultModels],
			quickPick: overlay.quickPick,
		};
	});
	const cloud = seeds
		.filter(seed => !builtinIds.has(seed.id))
		.map(seed => ({
			id: seed.id,
			displayName: seed.name || seed.id,
			defaultApiBaseUrl: seed.api,
			defaultProtocol: resolveProtocol(seed.id, seed.npm, ''),
			defaultModels: [...seed.modelIds],
			quickPick: false,
		}))
		.sort((left, right) => left.displayName.localeCompare(right.displayName));
	return { builtin, cloud };
}
