/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

const path = require('path');

/**
 * @param {string} rootDir
 * @param {string} prefix URL path prefix (e.g. `/` + random hex) replaced with `rootDir` for snapshot paths
 */
function createMassagePath(rootDir, prefix) {
	const normalizedRoot = path.resolve(rootDir);
	return function massagePath(p) {
		// TODO@jrieken FISHY but it enables snapshot in ESM browser tests
		p = String(p).replace(/\\/g, '/').replace(prefix, normalizedRoot);
		const resolved = path.resolve(p);
		const relative = path.relative(normalizedRoot, resolved);
		if (relative.startsWith('..') || path.isAbsolute(relative)) {
			throw new Error(`Path is outside of the test workspace: ${p}`);
		}
		return resolved;
	};
}

module.exports = { createMassagePath };
