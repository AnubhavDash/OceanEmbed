# OceanEmbed: Competition-Winning Strategy

**Prepared for Team Osiris / OceanEmbed**

OceanEmbed should not present itself as a generic subsurface-profile model. Its strongest competition story is an **evidence-led North Indian Ocean cyclone heat-fuel decision system**: it takes satellite-derived surface context, applies visible OpenCV 5 quality controls, reconstructs a subsurface profile, quantifies uncertainty, and either produces a bounded decision-support value or explicitly escalates to human review. This matches the competition’s emphasis on useful perception-driven systems, while presenting a credible, conservative operational boundary rather than an overclaimed cyclone-forecast product.[1][2]

> **Winning thesis:** Make the primary output a traceable *“Can this ocean scene support a reliable heat-fuel assessment?”* decision—not merely a graph of predicted temperatures.

| What judges need to see | OceanEmbed’s strongest response | Evidence in the current project |
|---|---|---|
| **Technical execution** | A 15-depth climatology-residual baseline with chronological splits, calibrated residual uncertainty, OpenCV 5 preprocessing, and a database-backed payload. | Real 1 Aug 2025 OISST, Argo, HYCOM comparator, OpenCV 5 artifacts, persisted run metadata, 11 tests. |
| **Innovation** | The QA system treats computer-vision evidence and uncertainty as inputs to a perception–decision–action loop. | The run escalates because 700 m residual uncertainty reaches **6.66°C**, above a **1.5°C** automated-decision guardrail. |
| **Real-world impact** | 26°C-isotherm depth and ocean heat content are surfaced as cyclone heat-fuel indicators, with profile evidence below the decision. | The product exposes 68 m 26°C-isotherm depth and 66.0 kJ/cm² OHC as a *review-gated* baseline result. |
| **User experience** | An ocean-operations cockpit joins map, preprocessing, validation, QA trace, and reproducibility records. | Five dedicated views with evidence links and explicit confidence/risk labels. |
| **Responsible operation** | Never turn a baseline into a public storm warning; retain artifacts, QA trace, human-review fallback, and a pending—not delivered—alert. | Immutable object references, persisted QA escalation, and conservative notification handling. |

## 1. Target the Actual Rubric, Not a Generic Demo

The overall competition assigns **30%** to technical execution and **20% each** to innovation and real-world impact; user experience, documentation/presentation, and cloud delivery/reproducibility/responsible operation comprise the remaining 30%.[2] This means a polished map alone is insufficient, but a scientifically disciplined project with a weak presentation will also leave points on the table.

The Agentic Vision path is especially aligned with OceanEmbed. Its rubric rewards substantive OpenCV 5 plus agent integration, meaningful orchestration/autonomy, task effectiveness, failure handling/observability/human control, and demonstration quality.[2] The key distinction is causal: **OpenCV evidence must change a subsequent action**. OceanEmbed now demonstrates that pattern through a traceable policy: preprocessing produces data-quality evidence; residual uncertainty exceeds a policy guardrail; the system retains the value but requests human review instead of releasing an automated assessment.

| Submission element | Recommended framing | Avoid |
|---|---|---|
| Title | **OceanEmbed: Cyclone Heat-Fuel Intelligence with Vision-Gated Subsurface Reconstruction** | “AI predicts cyclone intensity.” |
| One-line demo claim | “OpenCV-derived quality evidence decides whether a reconstructed ocean profile can support a heat-fuel assessment.” | “We use OpenCV for preprocessing.” |
| Scientific claim | “A reproducible public-data baseline, evaluated on a limited chronological split and an illustrative held-out profile.” | Calling a single profile a final independent benchmark. |
| Human control | “The system performs a bounded escalation to review when uncertainty exceeds policy.” | Pretending the system autonomously authorizes warnings. |
| AWS claim | “S3-backed immutable artifacts, Lambda/API orchestration, and SageMaker Serverless as the intended inference target.” | Claiming a live production endpoint before one exists. |

## 2. The Product Direction Is Scientifically Stronger Than the Original Proposal

Recent peer-reviewed work supports a **climatology-correction/residual** framing rather than an unconstrained direct profile regressor. TS-Cast adjusts a monthly climatological profile from satellite context and explicitly emphasizes both uncertainty and the fundamental limits imposed by satellite inputs.[3] OceanEmbed’s current baseline follows this intellectual direction, while keeping its limitations visible.

The product should elevate the user-facing decision layer. NOAA’s satellite ocean-heat-content suite uses integrated vertical temperature to the 26°C isotherm and provides inputs relevant to hurricane-intensity forecasting, including isotherm depth, mixed-layer depth, ocean heat content, and mapping error.[4] Argo is also operationally meaningful: it is used with satellite SST and altimetry to initialize ocean forecasts and inform weather-related applications.[5]

This does **not** justify claiming deterministic cyclone prediction. It gives OceanEmbed an evidence-backed downstream use case: **ocean heat-fuel situational awareness for forecasters, research teams, and disaster-response analysts.**

## 3. What Is Already Implemented

The project contains a polished full-stack decision-support experience with a real curated historical scene. The selected 1 August 2025 Bay of Bengal case uses NOAA OISST, a NOAA ERDDAP Argo profile retained outside training/calibration, a HYCOM comparator for constructing the public-data baseline, and real OpenCV 5.0.0 artifacts. Raw NetCDF/CSV sources, mask, Navier–Stokes inpaint, Sobel front layer, tile-coverage layer, baseline model, prediction, and evaluation report are held outside the application database and recorded through immutable references.

The current chronological public-data baseline uses 43 training samples, 21 validation samples, and 7 test samples. The reported chronological test RMSE is **0.87°C**, while the illustrative held-out Argo profile has RMSE **0.99°C** across 15 interpolated levels. Those values are useful evidence, but the project correctly labels the Argo result as illustrative rather than a final independent benchmark.

| Operational state | Current result | Interpretation |
|---|---:|---|
| 26°C-isotherm depth | 68 m | A retained baseline estimate, not a public forecast. |
| Ocean heat content | 66.0 kJ/cm² | Decision-support value only; compare within a broader validated scenario set. |
| Maximum residual uncertainty | 6.66°C at 700 m | Triggers human review and blocks autonomous interpretation. |
| Finite OISST coverage | 85.25% | A valid-data measure; it is explicitly not treated as a raw cloud classification. |
| Alert state | Pending, not delivered | Ensures the evidence/QA path is demonstrated without emitting an unreviewed operational alert. |

## 4. The Judge Demo Should Follow One Tight Narrative

The entire recorded demo should be approximately three minutes. Start with the operational question, not with the model architecture. A good flow is:

1. **Situation (0:00–0:20).** State that analysts need to know whether a satellite scene supports a reliable subsurface heat-fuel assessment in the North Indian Ocean.
2. **Perception (0:20–0:55).** Show the actual OISST field and switch through the OpenCV mask, inpaint, Sobel fronts, and tile coverage. Explain precisely what the mask is and is not.
3. **Reconstruction (0:55–1:25).** Open the 15-depth profile and decision card. Show OHC, 26°C depth, confidence, and the explicit `review` status.
4. **Validation (1:25–1:55).** Open the held-out Argo profile, depth-band table, chronological split results, and the limitation notice.
5. **Agentic Vision decision (1:55–2:30).** Open the QA ledger. Point to the 6.66°C uncertainty at 700 m, the 1.5°C guardrail, the human-review action, and the evidence URL.
6. **Reproducibility and AWS path (2:30–3:00).** Show immutable artifacts, the scheduler contract, worker container, architecture diagram, and why production inference belongs in SageMaker Serverless rather than an unbenchmarked Lambda model runtime.[6][7]

> The “wow moment” should be the system refusing to overstate certainty. That is substantially more credible than a dashboard that always emits a risk colour.

## 5. Highest-Leverage Work Before Submission

The public-data baseline proves the end-to-end product and should remain in the final submission as a transparent benchmark. To contend for the overall prize or Agentic Vision award, add the following in priority order.

| Priority | Work item | Why it matters | Definition of done |
|---|---|---|---|
| **P0** | Expand to a multi-profile, leakage-safe benchmark | A single illustrative Argo profile is not enough for scientific credibility. | Fixed chronology; train/validation/test geography/time rules; held-out Argo set; uncertainty coverage/calibration; depth-band metrics; documented exclusions. |
| **P0** | Deploy an actual evaluated inference endpoint | The competition requires meaningful AWS use; a completed endpoint turns architecture into delivery. | Reproducible model container, model artifact hash, SageMaker endpoint response schema, latency/cost measurement, UI run created from endpoint output. |
| **P0** | Activate the guarded daily pipeline only after source approval | This makes the project feel operational, but must never run against unapproved credentials/data. | Published application, approved source configuration, idempotent schedule, current-scene record, evidence-linked alert only after review policy. |
| **P1** | Make the agent choose among at least two real remedies | The current escalation is correct, but award judges will value more observable action branches. | Run a controlled scene suite where low-gap scenes trigger a documented re-inpaint rerun and high-uncertainty scenes use fallback/review; preserve before/after artifacts. |
| **P1** | Produce a two-case demo | A single successful scene feels cherry-picked. | One clean, accepted/review-limited scene and one degraded scene that the agent escalates. |
| **P1** | Capture reproducible AWS measurements | Makes the deployment claim credible. | Inference latency, cold-start observation, artifact sizes, OpenCV worker runtime, and cost-bound note. |

## 6. Recommendations That Will Improve the Science

First, do not use GLORYS/HYCOM-derived fields in a way that leaks a reanalysis target into the inputs without a carefully documented causal/temporal rule. If a variable has assimilated information close to the label, judges and scientific reviewers may reasonably question whether the model has an unfair shortcut. Keep a simple **surface-only baseline** and compare it with any richer-input model.

Second, do not impose a hard temperature-monotonicity rule with depth. Stratification is common, but inversions and mixed-layer structures are real. Prefer a soft, depth-aware physical prior, quantify violations, and show cases in which the data justifies them. That is more defensible than forcing a visually smooth but physically inaccurate profile.

Third, distinguish **residual dispersion** from a calibrated predictive uncertainty distribution. The current baseline does the responsible thing by describing its uncertainty as calibration from chronological residuals and by routing high uncertainty to review. A stronger future model should report empirical coverage by depth band, reliability plots, and error conditioned on coverage/front strength/season.

## 7. What Not To Spend Time On

Do not pursue the COOL award unless the core workload actually runs on AWS Graviton/Arm and you can provide a reproducible benchmark against a baseline. AWS use alone does not qualify.[2][8] Do not claim live production, real-time forecasts, or autonomous warning capability until the source credentials, endpoint, schedule, and operational review policy are truly active. Those shortcuts risk the competition’s prohibition against misrepresentation and can weaken an otherwise excellent submission.[2]

## References

[1]: https://opencv26.devpost.com/ "OpenCV AI Competition 2026 — Devpost"
[2]: https://opencv26.devpost.com/rules "OpenCV AI Competition 2026 — Official Rules"
[3]: https://os.copernicus.org/articles/22/2161/2026/ "TS-Cast: Satellite-to-subsurface temperature and salinity reconstruction"
[4]: https://www.ncei.noaa.gov/products/satellite-ocean-heat-content-suite "NOAA Satellite Ocean Heat Content Suite"
[5]: https://argo.ucsd.edu/science/argo-and-the-modeling-community/ "Argo and the Modeling Community"
[6]: https://docs.aws.amazon.com/sagemaker/latest/dg/serverless-endpoints.html "Amazon SageMaker Serverless Inference"
[7]: https://docs.aws.amazon.com/lambda/latest/dg/images-create.html "AWS Lambda container images"
[8]: https://opencv.org/opencv-ai-competition-2026/ "OpenCV AI Competition 2026 — Official Site"
