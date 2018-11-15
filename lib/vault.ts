/*
 * Copyright © 2018 Atomist, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {
    ConfigurationPostProcessor,
    logger,
} from "@atomist/automation-client";
import { resolvePlaceholders } from "@atomist/automation-client/lib/configuration";
import * as _ from "lodash";

/**
 * Configuration options for the Vault lookup.
 */
export interface VaultOptions {
    apiVersion?: string;
    endpoint?: string;
    token?: string;
}

/**
 * Resolve placefolders in the client configuration of the form '${vault:secret/some#foo:foo bar}'.
 *
 * `secret/some` - the vault lookup path
 * `foo` - value of the foo field inside the secret's data (optional)
 * `foo bar' - default value in case secret at 'secret/some' and path 'foo' doesn't exist (optional)
 *
 * @param options
 */
export function configureVaultLookup(options: VaultOptions = {}): ConfigurationPostProcessor {
    const optsToUse: VaultOptions = {
        apiVersion: "v1",
        endpoint: process.env.VAULT_ADDR || "http://127.0.0.1:8200",
        token: process.env.VAULT_TOKEN,
        ...options,
    };
    return async cfg => {
        const vault = require("node-vault")(optsToUse);
        await resolvePlaceholders(cfg, resolveVaultPlaceholder(vault));
        return cfg;
    };
}

const PlaceholderExpression = /\$\{vault:([#/.a-zA-Z_-]+)([.:0-9a-zA-Z-_ \" ]+)*\}/g;

function resolveVaultPlaceholder(vault: any): (value: string) => Promise<string> {
    return async input => {
        let value = input;
        if (PlaceholderExpression.test(value)) {
            PlaceholderExpression.lastIndex = 0;
            let result;

            // tslint:disable-next-line:no-conditional-assignment
            while (result = PlaceholderExpression.exec(value)) {
                let vaultValue;
                const paths = result[1].split("#");
                try {
                    const v = (await vault.read(paths[0])).data;
                    if (paths.length === 2) {
                        vaultValue = _.get(v, paths[1]);
                    } else {
                        vaultValue = v;
                    }
                } catch (err) {
                    logger.warn(`Vault secret '${result[1]}' not found`);
                }
                const defaultValue = result[2] ? result[2].trim().slice(1) : undefined;

                if (vaultValue) {
                    value = vaultValue;
                } else if (defaultValue) {
                    value = defaultValue;
                }
            }
        }
        return value;
    };
}
