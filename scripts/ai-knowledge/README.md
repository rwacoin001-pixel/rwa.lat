# Generated user AI knowledge

Run from the repository root:

```sh
node scripts/ai-knowledge/build.mjs
node scripts/ai-knowledge/build.mjs --check
```

The TypeScript AST extractor reads English/Chinese objects, bilingual JSX helpers and translation dictionaries without executing app code. Dynamic expressions remain `{runtime value}`; current service results determine actual amounts, fees and eligibility. Generated IDs depend on source section, language and chunk, not content. The generator also refreshes the page catalog from every non-system route in `lib/routes-v2.ts` and fails if an emitted notice kind lacks a plain-language explanation.

Review generated JSON before publication. To publish using the owner's selected database environment, run from `apps/api`:

```sh
npx ts-node tools/seed-ai-knowledge.ts
```

This explicit command uses the existing database configuration and `AiKnowledgeService.syncGenerated`. It does not start Nest workers. It publishes immutable knowledge versions and service audit entries in one locked transaction, skips unchanged articles and archives only stale `generated-app-copy` items. Manual knowledge and support policy remain owner-managed. It requires the existing knowledge tables; there is no new migration. The service actor UUID is a stable audit identifier, not an account or credential.

No seed, migration or live model evaluation is run automatically on app startup. After deployment, owners must run the reviewed seed to make the new articles retrievable. The read-only public quant snapshot is always fetched through `QuantService`.
