# Nezha Module

Nezha is the perps market layer.

It handles:
- simulated perpetual markets
- paper long/short positions
- PnL UI
- liquidation estimate UI
- compute-cost perp books for the mesh market

Compute role:

- Nezha publishes compute-cost perp contracts on standardized resource classes
- mark prices feed the compute reference-price engine
- v1 settlement is offchain cash settlement only
- spot compute remains the executable market underneath the price layer
