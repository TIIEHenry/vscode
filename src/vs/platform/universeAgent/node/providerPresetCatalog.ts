/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { mergeProviderPresets, parseModelsDevCatalog, type CloudProviderSeed } from '../common/providerPresetCatalog.js';
import type { UniverseAgentProviderPresetCatalog } from '../common/universeAgentTypes.js';

const MODELS_DEV_URL = 'https://models.dev/api.json';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

let memory: { readonly at: number; readonly seeds: readonly CloudProviderSeed[] } | undefined;

function catalogError(error: unknown): string {
	const raw = error instanceof Error && error.message ? error.message : 'request failed';
	return raw.replace(/[\r\n]+/g, ' ').slice(0, 160);
}

/** Parse failures stay generic so a response body never reaches the UI. */
function parseCloudBody(body: string): readonly CloudProviderSeed[] {
	try {
		return parseModelsDevCatalog(body);
	} catch {
		throw new Error('cloud catalog is not valid JSON');
	}
}

async function readCloudSeeds(force: boolean): Promise<readonly CloudProviderSeed[]> {
	if (force) {
		memory = undefined;
	}
	if (memory && Date.now() - memory.at < CACHE_TTL_MS) {
		return memory.seeds;
	}
	try {
		const response = await fetch(MODELS_DEV_URL, { signal: AbortSignal.timeout(10_000) });
		if (!response.ok) {
			throw new Error(`cloud catalog HTTP ${response.status}`);
		}
		const seeds = parseCloudBody(await response.text());
		if (seeds.length === 0) {
			throw new Error('cloud catalog was empty');
		}
		memory = { at: Date.now(), seeds };
		return seeds;
	} catch (error) {
		if (memory && memory.seeds.length > 0) {
			return memory.seeds;
		}
		throw error;
	}
}

/** Built-in presets plus the models.dev cloud list. No credentials. */
export async function loadProviderPresetCatalog(force = false): Promise<UniverseAgentProviderPresetCatalog> {
	try {
		const merged = mergeProviderPresets(await readCloudSeeds(force));
		return {
			builtin: merged.builtin,
			cloud: merged.cloud,
			cloudStatus: 'loaded',
		};
	} catch (error) {
		const merged = mergeProviderPresets([]);
		return {
			builtin: merged.builtin,
			cloud: [],
			cloudStatus: 'unavailable',
			cloudError: catalogError(error),
		};
	}
}
