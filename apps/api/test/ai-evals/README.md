# User AI evaluations

From `apps/api`:

```sh
npx jest --testMatch "**/ai-evals.spec.ts" --runInBand
```

72 bilingual questions cover all 24 tools, product facts, own records, a real quant loss, missing notices, other-user requests, secrets, actions and injected notice/file text. The offline stub scripts tool calls; assertions verify dispatch, service identity and required facts derived from actual tool results. It tests orchestration and security boundaries, not a model's natural-language tool-selection quality.

For model-selection and answer-quality evaluation, set `AI_EVAL_LIVE=1` and supply existing `AI_MODEL_ENDPOINT`, `AI_MODEL_API_KEY`, `AI_MODEL_NAME`, `AI_MODEL_API_STYLE` through the environment, then run the same command. This sends synthetic fixture data to the configured model and can incur provider usage. No database is used. Never put credentials in fixtures or reports. Live evals are opt-in and were not run during implementation.
