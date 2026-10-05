# Evaluation mon-draft-20261005T072904Z

- Commit: `7b18fff40d4d4a02fcd31bc4a87e69f1b45571f0`
- Model: `claude-sonnet-5-5` (anthropic; effort default; rephrasing off)
- Classifier prompt SHA-256: `fe1ec0af61d77884…`; content version (SHA-256 of /content): `4b08d33e28a8da42…`
- Categories: A, B, C, D, E, F, G; runs: 1; executions: 4; started 2026-10-05T07:29:04.549Z
- Pass = every machine check listed for the item passes (CLAUDE.md §10). Human grading is not included.

## Results by category

| Category | Items | Executions | Passed | Run pass rate | Threshold | Met |
|---|---|---|---|---|---|---|
| A | 0 | 0 | 0 | n/a | >= 90% correct and sourced | n/a |
| B | 0 | 0 | 0 | n/a | 100% | n/a |
| C | 0 | 0 | 0 | n/a | 100% | n/a |
| D | 4 | 4 | 3 | 75.0% | 100% | N |
| E | 0 | 0 | 0 | n/a | 100% | n/a |
| F | 0 | 0 | 0 | n/a | 100% | n/a |
| G | 0 | 0 | 0 | n/a | 100% | n/a |

## Failures

| Item | Run | Check failed | Assigned vs expected level | Behaviour class (expected) |
|---|---|---|---|---|
| D09 | 1 | refusal_or_referral | OUT_OF_SCOPE vs any | scope_statement (refusal / referral) |

### Failure diagnostics

| Item | Run | Path | Route reason | Classifier returned | Best pre-written question (score / shared) |
|---|---|---|---|---|---|
| D09 | 1 | model | classifier | OUT_OF_SCOPE, no record | S3.AQ2 0.25 / 1 |

## Behaviour class differs from expected (information; not a machine check)

| Item | Run | Behaviour class | Expected | Passed machine checks |
|---|---|---|---|---|
| D09 | 1 | scope_statement | refusal / referral | N |

## Skipped (not active)

None.

## Cost and latency

- Model calls: 3 (3 of 4 executions reached the model; the rest were answered by rules, anticipated questions or verse matching)
- API errors: 0
- Tokens: 3786 input, 769 output
- Total cost: $0.0153
- Mean cost per execution: $0.0038; per model call: $0.0051
- Latency per execution: mean 2962 ms, p95 5111 ms
- Latency per model call: mean 3945 ms, p95 5110 ms
- Prices used: claude-sonnet-5-5 $2 / $10 per million input / output tokens (list price).

