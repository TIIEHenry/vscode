/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as eslint from 'eslint';
import * as path from 'path';
import { createAgentImportBoundaryRule } from '../src/vs/platform/universeAgent/test/common/agentImportBoundaryRules.ts';

const REPO_ROOT = path.normalize(path.join(import.meta.dirname, '../'));

export default createAgentImportBoundaryRule(REPO_ROOT) as unknown as eslint.Rule.RuleModule;
