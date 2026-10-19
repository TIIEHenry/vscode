/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Pure readers for local harness provider files.
 * Callers that touch disk stay in the node connection service.
 * Preview objects never include api keys.
 */

export interface HarnessModelDraft {
	readonly modelId: string;
}

export interface HarnessProviderDraft {
	readonly providerId: string;
	readonly label: string;
	readonly source: string;
	readonly protocol: string;
	readonly apiKey: string;
	readonly baseUrl: string;
	readonly models: readonly HarnessModelDraft[];
}

export interface HarnessProviderImportPreview {
	readonly providerId: string;
	readonly label: string;
	readonly source: string;
	readonly protocol: string;
	readonly hasApiKey: boolean;
	readonly hasBaseUrl: boolean;
	readonly modelIds: readonly string[];
}

export interface CcSwitchProviderRow {
	readonly id: string;
	readonly appType: string;
	readonly name: string;
	readonly settingsConfig: string;
}

const CC_SWITCH_APPS = new Set([
	'claude',
	'claude-desktop',
	'codex',
	'gemini',
	'grokbuild',
	'opencode',
	'openclaw',
	'hermes',
	'pi',
	'mcode',
]);

export function toHarnessProviderPreview(draft: HarnessProviderDraft): HarnessProviderImportPreview {
	return {
		providerId: draft.providerId,
		label: draft.label,
		source: draft.source,
		protocol: draft.protocol,
		hasApiKey: draft.apiKey.length > 0,
		hasBaseUrl: draft.baseUrl.length > 0,
		modelIds: draft.models.map(model => model.modelId),
	};
}

export function parseCcSwitchProviderRow(row: CcSwitchProviderRow): HarnessProviderDraft | undefined {
	const appType = row.appType.trim().toLowerCase();
	if (!CC_SWITCH_APPS.has(appType)) {
		return undefined;
	}
	let settings: unknown;
	try {
		settings = JSON.parse(row.settingsConfig);
	} catch {
		return undefined;
	}
	const parsed = parseSettingsForApp(appType, settings);
	if (!parsed) {
		return undefined;
	}
	return finishDraft(
		`cc-switch:${appType}:${sanitizeId(row.id)}`,
		row.name.trim() || row.id,
		`cc-switch:${appType}`,
		parsed,
	);
}

export function parseClaudeSettings(text: string): HarnessProviderDraft | undefined {
	let value: unknown;
	try {
		value = JSON.parse(text);
	} catch {
		return undefined;
	}
	const parsed = parseSettingsForApp('claude', value);
	if (!parsed) {
		return undefined;
	}
	return finishDraft('harness:claude:current', 'Claude Code', 'claude-code', parsed);
}

export function parseCodexFiles(configToml: string, authJson: string | undefined): HarnessProviderDraft | undefined {
	let auth: unknown = undefined;
	if (authJson) {
		try {
			auth = JSON.parse(authJson);
		} catch {
			auth = undefined;
		}
	}
	const parsed = parseSettingsForApp('codex', { config: configToml, auth });
	if (!parsed) {
		return undefined;
	}
	return finishDraft('harness:codex:current', 'Codex', 'codex', parsed);
}

export function parseGeminiEnv(text: string): HarnessProviderDraft | undefined {
	const env = parseEnvFile(text);
	const parsed = parseSettingsForApp('gemini', { env });
	if (!parsed) {
		return undefined;
	}
	return finishDraft('harness:gemini:current', 'Gemini CLI', 'gemini', parsed);
}

export function parseGrokConfig(text: string): HarnessProviderDraft | undefined {
	const parsed = parseSettingsForApp('grokbuild', { config: text });
	if (!parsed) {
		return undefined;
	}
	return finishDraft('harness:grokbuild:current', 'Grok Build', 'grok-build', parsed);
}

export function parseOpenCodeConfig(text: string): readonly HarnessProviderDraft[] {
	let value: unknown;
	try {
		value = JSON.parse(text);
	} catch {
		return [];
	}
	const providers = recordAt(value, 'provider');
	if (!providers) {
		return [];
	}
	const drafts: HarnessProviderDraft[] = [];
	for (const [id, config] of Object.entries(providers)) {
		const parsed = parseSettingsForApp('opencode', config);
		if (!parsed) {
			continue;
		}
		const name = strAt(config, 'name') || id;
		const draft = finishDraft(`harness:opencode:${sanitizeId(id)}`, name, 'opencode', parsed);
		if (draft) {
			drafts.push(draft);
		}
	}
	return drafts;
}

export function parseOpenClawConfig(text: string): readonly HarnessProviderDraft[] {
	let value: unknown;
	try {
		value = JSON.parse(text);
	} catch {
		return [];
	}
	const models = recordAt(value, 'models');
	const providers = models ? recordAt(models, 'providers') : recordAt(value, 'providers');
	if (!providers) {
		return [];
	}
	const drafts: HarnessProviderDraft[] = [];
	for (const [id, config] of Object.entries(providers)) {
		const parsed = parseSettingsForApp('openclaw', config);
		if (!parsed) {
			continue;
		}
		const draft = finishDraft(`harness:openclaw:${sanitizeId(id)}`, id, 'openclaw', parsed);
		if (draft) {
			drafts.push(draft);
		}
	}
	return drafts;
}

export function parseHermesConfig(text: string): readonly HarnessProviderDraft[] {
	const providers = readYamlNamedBlocks(text, 'custom_providers');
	const drafts: HarnessProviderDraft[] = [];
	for (const [id, block] of providers) {
		const parsed = parseSettingsForApp('hermes', block);
		if (!parsed) {
			continue;
		}
		const draft = finishDraft(`harness:hermes:${sanitizeId(id)}`, id, 'hermes', parsed);
		if (draft) {
			drafts.push(draft);
		}
	}
	return drafts;
}

export function parsePiModels(text: string): readonly HarnessProviderDraft[] {
	let value: unknown;
	try {
		value = JSON.parse(text);
	} catch {
		return [];
	}
	const providers = recordAt(value, 'providers');
	if (!providers) {
		return [];
	}
	const drafts: HarnessProviderDraft[] = [];
	for (const [id, config] of Object.entries(providers)) {
		const parsed = parseSettingsForApp('pi', config);
		if (!parsed) {
			continue;
		}
		const draft = finishDraft(`harness:pi:${sanitizeId(id)}`, id, 'pi', parsed);
		if (draft) {
			drafts.push(draft);
		}
	}
	return drafts;
}

/** CC Switch rows win for an app. Live files fill apps the database does not list. */
export function mergeHarnessDrafts(
	fromCcSwitch: readonly HarnessProviderDraft[],
	live: readonly HarnessProviderDraft[],
): readonly HarnessProviderDraft[] {
	const covered = new Set(fromCcSwitch.map(draft => draft.source.replace(/^cc-switch:/, '')));
	const liveApp = (source: string): string => {
		switch (source) {
			case 'claude-code': return 'claude';
			case 'grok-build': return 'grokbuild';
			default: return source;
		}
	};
	const keptLive = live.filter(draft => !covered.has(liveApp(draft.source)));
	return dedupeByProviderId([...fromCcSwitch, ...keptLive]);
}

interface ParsedProviderFields {
	readonly protocol: string;
	readonly apiKey: string;
	readonly baseUrl: string;
	readonly models: readonly HarnessModelDraft[];
}

function finishDraft(
	providerId: string,
	label: string,
	source: string,
	parsed: ParsedProviderFields,
): HarnessProviderDraft | undefined {
	const apiKey = parsed.apiKey.trim();
	const baseUrl = trimSlash(parsed.baseUrl);
	if (!providerId || (apiKey.length === 0 && baseUrl.length === 0)) {
		return undefined;
	}
	return {
		providerId,
		label: label.trim() || providerId,
		source,
		protocol: parsed.protocol,
		apiKey,
		baseUrl,
		models: parsed.models,
	};
}

function parseSettingsForApp(appType: string, settings: unknown): ParsedProviderFields | undefined {
	switch (appType) {
		case 'claude':
		case 'claude-desktop':
			return parseClaudeSettingsObject(settings);
		case 'codex':
			return parseCodexSettings(settings);
		case 'gemini':
			return parseGeminiSettings(settings);
		case 'grokbuild':
			return parseGrokSettings(settings);
		case 'hermes':
			return parseFlatProvider(settings, 'base_url', 'api_key', 'openai');
		case 'openclaw':
			return parseOpenClawProvider(settings);
		case 'pi':
			return parsePiProvider(settings);
		case 'opencode':
		case 'mcode':
			return parseOpenCodeProvider(settings);
		default:
			return undefined;
	}
}

function parseClaudeSettingsObject(settings: unknown): ParsedProviderFields | undefined {
	const env = recordAt(settings, 'env') ?? {};
	const apiKey = firstString(env, ['ANTHROPIC_AUTH_TOKEN', 'ANTHROPIC_API_KEY', 'OPENROUTER_API_KEY', 'GOOGLE_API_KEY']);
	const baseUrl = strAt(env, 'ANTHROPIC_BASE_URL');
	const models = uniqueModels([
		strAt(env, 'ANTHROPIC_MODEL'),
		strAt(settings, 'model'),
		strAt(env, 'ANTHROPIC_DEFAULT_OPUS_MODEL'),
		strAt(env, 'ANTHROPIC_DEFAULT_SONNET_MODEL'),
		strAt(env, 'ANTHROPIC_DEFAULT_HAIKU_MODEL'),
	]);
	return { protocol: 'anthropic', apiKey, baseUrl, models };
}

function parseCodexSettings(settings: unknown): ParsedProviderFields | undefined {
	const config = typeof settings === 'object' && settings !== null && 'config' in settings
		? strAt(settings, 'config')
		: '';
	const auth = recordAt(settings, 'auth');
	const apiKey = strAt(auth, 'OPENAI_API_KEY') || tomlValue(config, 'experimental_bearer_token');
	const baseUrl = codexBaseUrl(config);
	const models = uniqueModels([tomlValue(config, 'model')]);
	return { protocol: 'openai', apiKey, baseUrl, models };
}

function parseGeminiSettings(settings: unknown): ParsedProviderFields | undefined {
	const env = recordAt(settings, 'env') ?? {};
	return {
		protocol: 'gemini',
		apiKey: firstString(env, ['GEMINI_API_KEY', 'GOOGLE_API_KEY']),
		baseUrl: strAt(env, 'GOOGLE_GEMINI_BASE_URL'),
		models: uniqueModels([strAt(env, 'GEMINI_MODEL')]),
	};
}

function parseGrokSettings(settings: unknown): ParsedProviderFields | undefined {
	const config = strAt(settings, 'config');
	const selected = grokSelectedTable(config);
	if (!selected) {
		return { protocol: 'openai', apiKey: '', baseUrl: '', models: [] };
	}
	const backend = selected.api_backend ?? '';
	const protocol = backend.toLowerCase().includes('anthropic') ? 'anthropic' : 'openai';
	return {
		protocol,
		apiKey: selected.api_key ?? '',
		baseUrl: selected.base_url ?? '',
		models: uniqueModels([selected.model ?? '']),
	};
}

function parseFlatProvider(settings: unknown, baseKey: string, keyKey: string, protocol: string): ParsedProviderFields {
	return {
		protocol,
		apiKey: strAt(settings, keyKey),
		baseUrl: strAt(settings, baseKey),
		models: uniqueModels([strAt(settings, 'model')]),
	};
}

function parseOpenClawProvider(settings: unknown): ParsedProviderFields {
	const models = Array.isArray(recordValue(settings, 'models'))
		? (recordValue(settings, 'models') as unknown[]).map(entry => strAt(entry, 'id'))
		: [];
	const api = strAt(settings, 'api');
	return {
		protocol: api.toLowerCase().includes('anthropic') ? 'anthropic' : 'openai',
		apiKey: strAt(settings, 'apiKey'),
		baseUrl: strAt(settings, 'baseUrl'),
		models: uniqueModels(models),
	};
}

function parsePiProvider(settings: unknown): ParsedProviderFields {
	const modelsValue = recordValue(settings, 'models');
	const modelIds: string[] = [];
	let nestedBase = '';
	if (Array.isArray(modelsValue)) {
		for (const entry of modelsValue) {
			modelIds.push(strAt(entry, 'id') || strAt(entry, 'name'));
			if (!nestedBase) {
				nestedBase = strAt(entry, 'baseUrl');
			}
		}
	}
	return {
		protocol: 'openai',
		apiKey: strAt(settings, 'apiKey'),
		baseUrl: strAt(settings, 'baseUrl') || nestedBase,
		models: uniqueModels(modelIds),
	};
}

function parseOpenCodeProvider(settings: unknown): ParsedProviderFields {
	const options = recordAt(settings, 'options') ?? {};
	const models = recordAt(settings, 'models');
	return {
		protocol: 'openai',
		apiKey: strAt(options, 'apiKey'),
		baseUrl: strAt(options, 'baseURL'),
		models: uniqueModels(models ? Object.keys(models) : []),
	};
}

function codexBaseUrl(config: string): string {
	const active = tomlValue(beforeFirstTable(config), 'model_provider');
	if (active) {
		const section = tomlSection(config, `model_providers.${active}`);
		const fromSection = tomlValue(section, 'base_url');
		if (fromSection) {
			return fromSection;
		}
	}
	return tomlValue(beforeFirstTable(config), 'base_url');
}

function grokSelectedTable(config: string): { api_key?: string; base_url?: string; model?: string; api_backend?: string } | undefined {
	const models = tomlSection(config, 'models');
	const selected = tomlValue(models, 'default');
	if (!selected) {
		return undefined;
	}
	const table = tomlSection(config, `model.${selected}`);
	if (!table) {
		return undefined;
	}
	return {
		api_key: tomlValue(table, 'api_key'),
		base_url: tomlValue(table, 'base_url'),
		model: tomlValue(table, 'model'),
		api_backend: tomlValue(table, 'api_backend'),
	};
}

function beforeFirstTable(text: string): string {
	const index = text.search(/^\s*\[/m);
	return index < 0 ? text : text.slice(0, index);
}

function tomlSection(text: string, name: string): string {
	const lines = text.split(/\r?\n/);
	const header = `[${name}]`;
	let inside = false;
	const body: string[] = [];
	for (const line of lines) {
		const trimmed = line.trim();
		if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
			if (inside) {
				break;
			}
			inside = trimmed === header;
			continue;
		}
		if (inside) {
			body.push(line);
		}
	}
	return body.join('\n');
}

function tomlValue(text: string, key: string): string {
	const match = text.match(new RegExp(`^\\s*${key}\\s*=\\s*"([^"]*)"`, 'm'));
	return match?.[1]?.trim() ?? '';
}

function parseEnvFile(text: string): Record<string, unknown> {
	const env: Record<string, unknown> = {};
	for (const line of text.split(/\r?\n/)) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith('#')) {
			continue;
		}
		const eq = trimmed.indexOf('=');
		if (eq <= 0) {
			continue;
		}
		const key = trimmed.slice(0, eq).trim();
		let value = trimmed.slice(eq + 1).trim();
		if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith('\'') && value.endsWith('\''))) {
			value = value.slice(1, -1);
		}
		env[key] = value;
	}
	return env;
}

function readYamlNamedBlocks(text: string, section: string): ReadonlyMap<string, Record<string, unknown>> {
	const lines = text.split(/\r?\n/);
	const result = new Map<string, Record<string, unknown>>();
	let inSection = false;
	let currentName = '';
	let current: Record<string, unknown> | undefined;
	for (const line of lines) {
		if (!line.trim() || line.trim().startsWith('#')) {
			continue;
		}
		const top = /^([A-Za-z0-9_-]+):\s*$/.exec(line);
		if (top && !line.startsWith(' ') && !line.startsWith('\t')) {
			if (current && currentName) {
				result.set(currentName, current);
			}
			inSection = top[1] === section;
			currentName = '';
			current = undefined;
			continue;
		}
		if (!inSection) {
			continue;
		}
		const named = /^  ([A-Za-z0-9_-]+):\s*$/.exec(line);
		if (named) {
			if (current && currentName) {
				result.set(currentName, current);
			}
			currentName = named[1];
			current = {};
			continue;
		}
		const field = /^    ([A-Za-z0-9_]+):\s*(.*)$/.exec(line);
		if (field && current) {
			current[field[1]] = unquote(field[2].trim());
		}
	}
	if (current && currentName) {
		result.set(currentName, current);
	}
	return result;
}

function unquote(value: string): string {
	if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith('\'') && value.endsWith('\''))) {
		return value.slice(1, -1);
	}
	return value;
}

function uniqueModels(ids: readonly string[]): HarnessModelDraft[] {
	const seen = new Set<string>();
	const models: HarnessModelDraft[] = [];
	for (const id of ids) {
		const modelId = id.trim();
		if (!modelId || seen.has(modelId)) {
			continue;
		}
		seen.add(modelId);
		models.push({ modelId });
	}
	return models;
}

function dedupeByProviderId(drafts: readonly HarnessProviderDraft[]): HarnessProviderDraft[] {
	const seen = new Set<string>();
	const result: HarnessProviderDraft[] = [];
	for (const draft of drafts) {
		if (seen.has(draft.providerId)) {
			continue;
		}
		seen.add(draft.providerId);
		result.push(draft);
	}
	return result;
}

function sanitizeId(value: string): string {
	const trimmed = value.trim();
	const cleaned = trimmed.replace(/[^A-Za-z0-9._:-]/g, '-');
	return cleaned || 'provider';
}

function trimSlash(value: string): string {
	return value.trim().replace(/\/+$/, '');
}

function recordAt(value: unknown, key: string): Record<string, unknown> | undefined {
	const child = recordValue(value, key);
	if (!child || typeof child !== 'object' || Array.isArray(child)) {
		return undefined;
	}
	return child as Record<string, unknown>;
}

function recordValue(value: unknown, key: string): unknown {
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		return undefined;
	}
	return (value as Record<string, unknown>)[key];
}

function strAt(value: unknown, key: string): string {
	const child = recordValue(value, key);
	return typeof child === 'string' ? child.trim() : '';
}

function firstString(record: Record<string, unknown>, keys: readonly string[]): string {
	for (const key of keys) {
		const value = record[key];
		if (typeof value === 'string' && value.trim()) {
			return value.trim();
		}
	}
	return '';
}
