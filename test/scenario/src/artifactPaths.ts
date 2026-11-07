/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as os from 'os';
import * as path from 'path';

const configuredRoot = process.env.VSCODE_SCENARIO_ARTIFACT_ROOT;

function assertArtifactRootAllowed(configured: string): void {
	if (!configured.trim() || !path.isAbsolute(configured)) {
		throw new Error('VSCODE_SCENARIO_ARTIFACT_ROOT must be a non-empty absolute path.');
	}
	const resolved = path.resolve(configured);
	if (isProtectedArtifactRoot(resolved)) {
		throw new Error('VSCODE_SCENARIO_ARTIFACT_ROOT must not resolve to the filesystem root, the home directory, or an ancestor of the home directory.');
	}
}

/** application.ts deletes `<root>/logs` on import, so these roots would erase a shared logs directory. */
function isProtectedArtifactRoot(resolved: string): boolean {
	if (resolved === path.parse(resolved).root) {
		return true;
	}
	const home = path.resolve(os.homedir());
	if (resolved === home) {
		return true;
	}
	const relative = path.relative(resolved, home);
	if (!relative || path.isAbsolute(relative)) {
		return false;
	}
	return relative.split(path.sep)[0] !== '..';
}

if (configuredRoot !== undefined) {
	assertArtifactRootAllowed(configuredRoot);
}

export const artifactRootPath = configuredRoot === undefined
	? path.join(__dirname, '..', '..', '..', '.build', 'vscode-playwright-mcp')
	: path.resolve(configuredRoot);
export const logsRootPath = path.join(artifactRootPath, 'logs');
export const crashesRootPath = path.join(artifactRootPath, 'crashes');
export const videoRootPath = path.join(artifactRootPath, 'videos');
export const evidenceRootPath = path.join(artifactRootPath, 'evidence');
