# Tianzi Module

Tianzi is the prediction market layer.

It handles:
- simulated prediction markets
- simulated futarchy markets
- forecasting UI
- market pool logic
- market settlement
- compute-cost forecast bands for mesh price discovery

Compute role:

- Tianzi reuses the prediction engine for compute-cost questions
- questions are standardized by resource class, region, and tier
- forecast prices feed the compute reference-price engine
- v1 remains offchain and simulation-first
