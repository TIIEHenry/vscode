/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ContextKeyExpr, ContextKeyExpression } from '../../platform/contextkey/common/contextkey.js';
import { IsSessionsWindowContext } from './contextkeys.js';

export const ActivityBarVisibleViewlets = {
	scm: 'workbench.activityBar.visibleViewlets.scm',
	debug: 'workbench.activityBar.visibleViewlets.debug',
	testing: 'workbench.activityBar.visibleViewlets.testing',
	extensions: 'workbench.activityBar.visibleViewlets.extensions',
	remote: 'workbench.activityBar.visibleViewlets.remote',
} as const;

export type ActivityBarVisibleViewletSettingKey = typeof ActivityBarVisibleViewlets[keyof typeof ActivityBarVisibleViewlets];

export function activityViewletWhen(settingKey: ActivityBarVisibleViewletSettingKey, extra?: ContextKeyExpression): ContextKeyExpression {
	const base = ContextKeyExpr.or(
		IsSessionsWindowContext,
		ContextKeyExpr.equals(`config.${settingKey}`, true),
	);
	return extra ? ContextKeyExpr.and(base, extra) : base;
}
