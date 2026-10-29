/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { RawContextKey } from '../../../../platform/contextkey/common/contextkey.js';

/** Connection state used by Navigator view title actions in each view's scoped context. */
export const UA_ENGINE_CONNECTED_KEY = new RawContextKey<boolean>('ua.engineConnected', false);
