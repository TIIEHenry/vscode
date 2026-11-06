/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { IProductWindowProfile } from '../../../services/productShell/common/productWindowProfile.js';
import { ProductWindowProfile } from './productWindowProfile.js';

// Loaded from `preferences.contribution.ts`, which both window entries import (the Agents
// window builds `SettingsEditor2` too). Not hung off `uaClientSettings.contribution.ts`:
// that one only loads with the conversation contribution.
registerSingleton(IProductWindowProfile, ProductWindowProfile, InstantiationType.Delayed);
