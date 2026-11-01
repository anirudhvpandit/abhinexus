# Synthetic financial analysis

All values are synthetic demo data in USD. This example does not model accounting policy, cash flow, tax, capital treatment, or forecast confidence.

## Project-level example

For ERP Modernization:

- Approved budget: **$2,400,000**
- Actual cost recorded: **$1,480,000**
- Forecast cost at completion: **$2,210,000**
- Budget variance (budget − actual): **+$920,000**
- Forecast variance (budget − forecast): **+$190,000**

Positive variance is below budget; negative variance is over budget. Current actual spend is not the final result; compare forecast cost at completion with approved budget for an estimate of remaining exposure.

## Portfolio roll-up

Across five synthetic projects:

| Measure | Amount |
| --- | ---: |
| Approved budget | $9,790,000 |
| Actual recorded | $5,455,000 |
| Forecast cost | $9,920,000 |
| Budget less actual | +$4,335,000 |
| Budget less forecast | −$130,000 |

Field Ops Intelligence forecasts $170,000 over its $1.8m budget; Cyber Defense forecasts $290,000 over its $3.2m budget. Their combined $460,000 gross overrun is partly offset by $330,000 of forecast headroom elsewhere. Headroom is not automatically fungible or approved for transfer.

## Data and interpretation limits

- Currency is stored in integer cents; no currency conversion occurs.
- Actual and forecast entries are user-recorded; no ledger integration or automated estimate-at-completion method exists.
- There are no historical snapshots or confidence intervals.
- Confirm forecast definitions, accounting period, commitments, contingency, and change-control policy before financial decisions.
- Replacing demo data is required before external customer/investor use.
