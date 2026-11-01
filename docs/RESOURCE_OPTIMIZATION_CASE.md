# Resource optimization case

**Synthetic scenario; not customer evidence.** The application validates percentage capacity across overlapping assignment dates. This worked example demonstrates the arithmetic only; it does not optimize skills or recommend actual staffing.

## Baseline and overload

The seed assigns Aisha Patel, Engineering Lead, a 40-hour weekly capacity. Two current overlapping allocations total 90% (60% ERP Modernization + 30% Field Ops Intelligence), or 36 hours, leaving 4 hours/10 percentage points.

A proposed 8-hour/week ERP cutover support request equals 20% of Aisha's capacity. Adding it to her current assignments produces 110% / 44 hours, an overload of 4 hours.

## Capacity-preserving alternative

Assume Noah Kim is qualified for the remaining data-validation work, has 36 hours/week capacity, and is currently allocated 70% (25.2 hours). Split the new 8-hour request:

| Person | Before | Added work | After | Weekly load |
| --- | ---: | ---: | ---: | ---: |
| Aisha (40h capacity) | 36h / 90% | 4h / 10% | 40h / 100% | At configured capacity |
| Noah (36h capacity) | 25.2h / 70% | 4h / 11.1% | 29.2h / 81.1% | About 6.8h remaining |

The request remains 8 total hours/week; no one exceeds configured capacity. The 4-hour transfer is valid only if Noah's skills, project deadlines, and manager approval support it. If not, reduce scope or move the date rather than assuming capacity.

## Decision process

1. Confirm the allocation windows overlap and capacity values are current.
2. Verify task skills, dependencies, time zones, leave, and competing priorities (not represented by this app).
3. Compare split assignment against scope/date options.
4. Record the approved assignment changes and review after the cutover period.

The current assignment form checks percentage overlap, but it does not calculate this optimization, model leave, or verify resource skills.
