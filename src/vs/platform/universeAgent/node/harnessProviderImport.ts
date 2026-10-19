/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { spawnSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import {
	mergeHarnessDrafts,
	parseCcSwitchProviderRow,
	parseClaudeSettings,
	parseCodexFiles,
	parseGeminiEnv,
	parseGrokConfig,
	parseHermesConfig,
	parseOpenClawConfig,
	parseOpenCodeConfig,
	parsePiModels,
	type CcSwitchProviderRow,
	type HarnessProviderDraft,
} from '../common/harnessProviderImport.js';

const CC_SWITCH_QUERY = `
import json, sqlite3, sys
path = sys.argv[1]
con = sqlite3.connect(path)
con.execute('PRAGMA query_only = ON')
rows = con.execute('SELECT id, app_type, name, settings_config FROM providers').fetchall()
json.dump([
    {'id': row[0] or '', 'appType': row[1] or '', 'name': row[2] or '', 'settingsConfig': row[3] or ''}
    for row in rows
], sys.stdout)
`;

/** Read local harness catalogs. The returned drafts contain api keys and must not cross into the renderer. */
export function readLocalHarnessProviderDrafts(home = homedir()): readonly HarnessProviderDraft[] {
	const fromCcSwitch = readCcSwitchRows(join(home, '.cc-switch', 'cc-switch.db'));
	const live = readLiveHarnessDrafts(home);
	return mergeHarnessDrafts(fromCcSwitch, live);
}

function readCcSwitchRows(databasePath: string): HarnessProviderDraft[] {
	if (!existsSync(databasePath)) {
		return [];
	}
	const result = spawnSync('python3', ['-c', CC_SWITCH_QUERY, databasePath], {
		encoding: 'utf8',
		maxBuffer: 16 * 1024 * 1024,
		timeout: 10000,
	});
	if (result.status !== 0 || !result.stdout) {
		return [];
	}
	let rows: CcSwitchProviderRow[];
	try {
		rows = JSON.parse(result.stdout) as CcSwitchProviderRow[];
	} catch {
		return [];
	}
	if (!Array.isArray(rows)) {
		return [];
	}
	const drafts: HarnessProviderDraft[] = [];
	for (const row of rows) {
		if (!row || typeof row.settingsConfig !== 'string') {
			continue;
		}
		const draft = parseCcSwitchProviderRow(row);
		if (draft) {
			drafts.push(draft);
		}
	}
	return drafts;
}

function readLiveHarnessDrafts(home: string): HarnessProviderDraft[] {
	const drafts: HarnessProviderDraft[] = [];
	const claude = readText(join(home, '.claude', 'settings.json'));
	if (claude) {
		const draft = parseClaudeSettings(claude);
		if (draft) {
			drafts.push(draft);
		}
	}
	const codexConfig = readText(join(home, '.codex', 'config.toml'));
	if (codexConfig) {
		const draft = parseCodexFiles(codexConfig, readText(join(home, '.codex', 'auth.json')));
		if (draft) {
			drafts.push(draft);
		}
	}
	const gemini = readText(join(home, '.gemini', '.env'));
	if (gemini) {
		const draft = parseGeminiEnv(gemini);
		if (draft) {
			drafts.push(draft);
		}
	}
	const grok = readText(join(home, '.grok', 'config.toml'));
	if (grok) {
		const draft = parseGrokConfig(grok);
		if (draft) {
			drafts.push(draft);
		}
	}
	pushAll(drafts, readText(join(home, '.config', 'opencode', 'opencode.json')), parseOpenCodeConfig);
	pushAll(drafts, readText(join(home, '.openclaw', 'openclaw.json')), parseOpenClawConfig);
	pushAll(drafts, readText(join(home, '.hermes', 'config.yaml')), parseHermesConfig);
	pushAll(drafts, readText(join(home, '.pi', 'agent', 'models.json')), parsePiModels);
	return drafts;
}

function pushAll(
	target: HarnessProviderDraft[],
	text: string | undefined,
	parse: (text: string) => readonly HarnessProviderDraft[],
): void {
	if (!text) {
		return;
	}
	target.push(...parse(text));
}

function readText(path: string): string | undefined {
	if (!existsSync(path)) {
		return undefined;
	}
	try {
		return readFileSync(path, 'utf8');
	} catch {
		return undefined;
	}
}
