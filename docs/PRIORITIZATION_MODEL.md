# Project portfolio prioritization model

This is an explainable **illustrative model**, not an implemented product feature and not a recommendation to fund or stop a real project. Inputs below are manually assigned synthetic ratings; the application does not currently store these criteria or calculate portfolio rank.

## Criteria and weights

| Criterion | Weight | Rating question |
| --- | ---: | --- |
| Strategic alignment | 30% | How directly does the project advance an agreed organizational objective? |
| Financial value | 25% | How strong is the evidence for quantified benefit relative to total cost? |
| Risk reduction | 20% | How materially does the project reduce a priority business/control risk? |
| Readiness | 15% | Are scope, sponsor, dependencies, and delivery plan sufficiently defined? |
| Capacity fit | 10% | Can the organization staff it without displacing higher-priority work? |
| **Total** | **100%** | |

## Scoring

Rate each criterion from 1 (weak) to 5 (strong). Normalize each rating to 0–100:

`normalized = (rating - 1) / 4 × 100`

Then calculate:

`priority score = Σ(normalized criterion × criterion weight)`

Weights are editable by governance owners in a real implementation and must sum to 100%. Record the rationale, evidence, and confidence for each rating; show a sensitivity view rather than treating small score differences as precise.

## Worked synthetic example

| Candidate | Strategic | Financial | Risk reduction | Readiness | Capacity fit | Weighted score |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| ERP Modernization | 4 | 4 | 3 | 3 | 2 | 64.0 |
| Cyber Defense Program | 5 | 3 | 5 | 2 | 2 | 68.75 |

For Cyber Defense: `100×0.30 + 50×0.25 + 100×0.20 + 25×0.15 + 25×0.10 = 68.75`.

The example ranks Cyber Defense above ERP despite lower readiness/capacity because strategic and risk-reduction scores are higher. This is a discussion prompt: leaders should verify the scores, budget, dependencies, mandatory controls, and staffing before deciding. A weighted sum must not override legal obligations or non-negotiable safety/security controls.
