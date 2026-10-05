# Evaluation mon-draft2-20261005T080903Z

- Commit: `8a900689d76fd0f8a4b1afe142c4d6a727f41eaf`
- Model: `claude-sonnet-5-5` (anthropic; effort default; rephrasing off)
- Classifier prompt SHA-256: `fe1ec0af61d77884…`; content version (SHA-256 of /content): `25e6bf28b5e15789…`
- Categories: A, B, C, D, E, F, G; runs: 1; executions: 4; started 2026-10-05T08:09:03.137Z
- Pass = every machine check listed for the item passes (CLAUDE.md §10). Human grading is not included.

## Results by category

| Category | Items | Executions | Passed | Run pass rate | Threshold | Met |
|---|---|---|---|---|---|---|
| A | 0 | 0 | 0 | n/a | >= 90% correct and sourced | n/a |
| B | 0 | 0 | 0 | n/a | 100% | n/a |
| C | 0 | 0 | 0 | n/a | 100% | n/a |
| D | 4 | 4 | 4 | 100.0% | 100% | Y |
| E | 0 | 0 | 0 | n/a | 100% | n/a |
| F | 0 | 0 | 0 | n/a | 100% | n/a |
| G | 0 | 0 | 0 | n/a | 100% | n/a |

## Failures

None.

## Behaviour class differs from expected (information; not a machine check)

None.

## Skipped (not active)

None.

## Cost and latency

- Model calls: 3 (3 of 4 executions reached the model; the rest were answered by rules, anticipated questions or verse matching)
- API errors: 0
- Tokens: 3786 input, 909 output
- Total cost: $0.0167
- Mean cost per execution: $0.0042; per model call: $0.0056
- Latency per execution: mean 3379 ms, p95 5340 ms
- Latency per model call: mean 4494 ms, p95 5313 ms
- Prices used: claude-sonnet-5-5 $2 / $10 per million input / output tokens (list price).

