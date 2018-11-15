/*
 * Copyright © 2018 Atomist, Inc.
 *
 * See LICENSE file.
 */

import * as mockery from "mockery";
import * as assert from "power-assert";
import { configureVaultLookup } from "../lib/vault";

// tslint:disable:no-invalid-template-strings
describe("vault", () => {

    before(() => {
        mockery.enable();
    });

    after(() => {
        mockery.disable();
    });

    afterEach(() => {
        mockery.deregisterAll();
    });

    it("should resolve vault secret", async () => {
        const vault = configureVaultLookup({});

        const mock = () => ({
            read: async (path: string) => {
                assert.strictEqual(path, "secret/test");
                return { data: "foobar" };
            },
        });

        mockery.registerMock("node-vault", mock);

        const cfg = {
            secret_value: "${vault:secret/test}",
        };

        await vault(cfg);
        assert.strictEqual(cfg.secret_value, "foobar");
    });

    it("should resolve vault secret and leave other placeholder alone", async () => {
        const vault = configureVaultLookup({});

        const mock = () => ({
            read: async (path: string) => {
                assert.strictEqual(path, "secret/test");
                return { data: "foobar" };
            },
        });

        mockery.registerMock("node-vault", mock);

        const cfg = {
            secret_value: "${vault:secret/test}",
            not_secret: "${SOME_ENV_VAR}",
        };

        await vault(cfg);
        assert.strictEqual(cfg.secret_value, "foobar");
        assert.strictEqual(cfg.not_secret, "${SOME_ENV_VAR}");
    });

    it("should resolve vault secret to path", async () => {
        const vault = configureVaultLookup({});

        const mock = () => ({
            read: async (path: string) => {
                assert.strictEqual(path, "secret/test");
                return { data: { path: "foobar" } };
            },
        });

        mockery.registerMock("node-vault", mock);

        const cfg = {
            secret_value: "${vault:secret/test#path}",
        };

        await vault(cfg);
        assert.strictEqual(cfg.secret_value, "foobar");
    });

    it("should resolve vault secret to nested path", async () => {
        const vault = configureVaultLookup({});

        const mock = () => ({
            read: async (path: string) => {
                assert.strictEqual(path, "secret/test");
                return { data: { path: { deeper: "foobar" } } };
            },
        });

        mockery.registerMock("node-vault", mock);

        const cfg = {
            secret_value: "${vault:secret/test#path.deeper}",
        };

        await vault(cfg);
        assert.strictEqual(cfg.secret_value, "foobar");
    });

    it("should resolve vault secret with default value", async () => {
        const vault = configureVaultLookup({});

        const mock = () => ({
            read: async (path: string) => {
                assert.strictEqual(path, "secret/test");
                throw new Error("Secret does not exist");
            },
        });

        mockery.registerMock("node-vault", mock);

        const cfg = {
            secret_value: "${vault:secret/test#path.test:foo bar}",
        };

        await vault(cfg);
        assert.strictEqual(cfg.secret_value, "foo bar");
    });

    it("should resolve vault secret with an object", async () => {
        const vault = configureVaultLookup({});

        const obj = {
            foo: {
                deep: {
                    bar: "Jimmy's",
                },
            },
        };

        const mock = () => ({
            read: async (path: string) => {
                assert.strictEqual(path, "secret/test");
                return { data: obj };
            },
        });

        mockery.registerMock("node-vault", mock);

        const cfg = {
            secret_value: "${vault:secret/test}",
        };

        await vault(cfg);
        assert.strictEqual(cfg.secret_value, obj);
    });

});
