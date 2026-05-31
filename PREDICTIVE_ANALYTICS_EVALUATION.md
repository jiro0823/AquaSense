# Predictive Analytics Evaluation

Generated: 2026-05-28

## Accuracy Assessment

The previous predictive analytics implementation was not production-accurate because it simulated dissolved oxygen values and estimated ammonia even when real sensor fields were available. That made the warning card useful for demos, but not trustworthy for real farm decisions.

The current implementation is now an explainable rules-and-trends model. It uses actual stored readings for temperature, pH, turbidity, dissolved oxygen, and ammonia when measured. Ammonia is only estimated when the sensor value is missing or zero, and the model exposes that limitation through `dataQuality.measuredAmmoniaRatio`.

Because the project does not yet include labeled historical outcomes, a true accuracy percentage cannot be honestly claimed. The production-grade position is:

- Current measured accuracy: not yet statistically validated.
- Current model reliability: strong for deterministic early-warning triage when sensors are calibrated and recent.
- Confidence score: model confidence, not clinical/statistical accuracy.
- Required for an accuracy rate: labeled events such as confirmed fish/crayfish stress, mortality, manual interventions, aerator activations, and verified water-quality incidents.

## Improvements Implemented

- Removed dissolved oxygen simulation and now uses real `reading.do`.
- Uses real ammonia when available; estimates ammonia only as fallback.
- Added time-aware linear regression slopes per minute instead of sample-index slope.
- Added moving average smoothing over recent readings.
- Combines latest value risk with moving-average risk.
- Adds trend penalties only when values move toward known unsafe conditions.
- Calculates ETA to unsafe thresholds using real slope direction.
- Adds data-quality scoring based on sample count, observation window, freshness, and measured ammonia coverage.
- Adds explicit `modelVersion` and `horizonMinutes` to every prediction.
- Keeps prediction logic deterministic and explainable, which is appropriate until a labeled dataset exists.

## Production Model Standard

The model follows a defensible production pattern for sensor systems without labeled training data:

- Use real measurements first.
- Avoid fake or simulated values in prediction output.
- Expose uncertainty and data quality.
- Use domain thresholds for explainable warnings.
- Separate risk score from confidence.
- Keep outputs auditable and reproducible.
- Persist prediction logs for future validation.

## How To Measure Real Accuracy Later

To produce an actual accuracy rate, collect labels for at least several weeks:

- `actualIncident`: whether a water-quality incident occurred.
- `incidentType`: DO low, pH drift, ammonia spike, turbidity spike, temperature stress.
- `incidentTime`.
- `predictionTime`.
- `predictedRiskLevel`.
- `manualActionTaken`.
- `outcomeResolved`.

Then compute:

- Precision: of HIGH/CRITICAL warnings, how many became real incidents.
- Recall: of real incidents, how many were predicted early.
- False positive rate: warnings without incidents.
- Lead time: median minutes between warning and incident.
- Calibration: whether confidence bands match actual outcomes.

## Current Rating

For a capstone and pre-production IoT system:

- Explainability: 9/10
- Code cleanliness: 9/10
- Sensor-data honesty: 9/10
- Production readiness without labeled data: 8/10
- Statistically proven accuracy: not rateable yet

The model is now strong and impressive for an explainable predictive warning system, but it should not be marketed as a trained AI model until real labeled outcomes are collected and validated.
