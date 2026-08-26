# Deploying OceanEmbed on Vercel

OceanEmbed can use Vercel for the React operations console, typed public API, and once-daily orchestration trigger. The OpenCV preprocessing and trained-model inference **must not** be performed inside the cron request. Vercel Functions are request-scoped and Vercel’s own guidance recommends splitting work that exceeds a function’s duration into smaller units or external requests.[1] OceanEmbed’s cron therefore creates an idempotent run and dispatches the durable processing work to AWS.

> **Important:** This project is currently authored in a Manus full-stack scaffold. Vercel deployment uses the API-only adapter in `api/index.ts`; Manus OAuth and the Manus storage proxy are omitted intentionally. The data views remain public, and immutable evidence uses object URLs. Before adding authenticated admin actions on Vercel, replace Manus OAuth with a Vercel-compatible identity provider.

## Vercel project settings

Use the repository root as the project root. The committed `vercel.json` configures Vite’s static output at `dist/public`, preserves SPA deep links, exposes the typed API under `/api/index`, and schedules `/api/cron/daily-refresh` for **03:30 UTC daily**. Vercel cron uses UTC and invokes a production HTTP path; on Hobby, a daily job may be invoked at any point within its scheduled hour.[1]

| Setting | Value |
|---|---|
| Framework preset | Vite |
| Install command | `pnpm install --frozen-lockfile` |
| Build command | `pnpm build:vercel` |
| Output directory | `dist/public` |
| Node runtime | Node.js 22.x |
| Cron path | `/api/cron/daily-refresh` |
| Cron schedule | `30 3 * * *` (UTC) |

## Required environment variables

Add these under **Vercel Project → Settings → Environment Variables**. Use separate values or scopes for Preview and Production. Environment-variable changes apply only to deployments created after the change.[2]

| Variable | Required for | Exposure rule |
|---|---|---|
| `DATABASE_URL` | External MySQL/TiDB database holding run metadata and payloads | Server only; never prefix with `VITE_`. |
| `CRON_SECRET` | Vercel cron authorization | Server only; random 16+ character secret. Vercel sends it as `Authorization: Bearer …`.[1] |
| `AWS_REGION` | AWS worker and SageMaker invocation | Server only. |
| `AWS_SAGEMAKER_ENDPOINT` | Evaluated 15-depth SageMaker inference endpoint | Server only. |
| `AWS_WORKER_DISPATCH_URL` | HTTPS endpoint for the AWS OpenCV/model worker (for example, API Gateway or a Lambda Function URL) | Server only. |
| `AWS_WORKER_DISPATCH_SECRET` | Shared bearer secret verified by the AWS worker before it accepts a run | Server only. |
| `AWS_ACCESS_KEY_ID` | Least-privilege worker/endpoint invocation | Server only. |
| `AWS_SECRET_ACCESS_KEY` | Matching least-privilege credential | Server only. |
| `OCEANEMBED_ARTIFACT_BUCKET` | Immutable source, model, evaluation, and QA artifacts | Server only. |
| `VITE_*` | Explicitly non-sensitive frontend configuration only | Any `VITE_` variable is bundled into the browser; never place credentials here. |

Vercel encrypts environment variables at rest, and supports environment-specific values. It also exposes deployment metadata to Vite only when the intended variable is prefixed appropriately, such as `VITE_VERCEL_ENV`.[2][3]

## AWS permission boundary

The Vercel function identity should be restricted to `sagemaker:InvokeEndpoint` on the named endpoint and `s3:GetObject`/`s3:PutObject` for the narrowly scoped OceanEmbed artifact prefix. The heavier worker identity may additionally submit SageMaker jobs or invoke a container task. Do **not** grant `AdministratorAccess`, wildcard S3 access, or permission to modify endpoints from the Vercel runtime.

## Daily workflow

1. Vercel calls the cron route with the configured `CRON_SECRET`.
2. The route verifies the signature and creates one durable, idempotent queued run.
3. For a new run only, the cron route sends a signed HTTPS POST to `AWS_WORKER_DISPATCH_URL`. The AWS worker retrieves approved observations, runs OpenCV 5 preprocessing, invokes SageMaker, writes immutable artifacts, and persists the final payload.
4. Only completed or degraded runs can update the current-scene pointer. Queued and failed runs cannot replace the scene shown to users.
5. Threshold alerts retain their evidence artifact and QA trace. Delivery remains bounded by the configured human-review policy.

Vercel warns that cron delivery is best-effort, can duplicate invocations, and does not automatically retry failures. The unique daily run ID and current-scene promotion rule are therefore intentional safeguards.[1]

## Local verification

Run `pnpm check && pnpm test` for code quality. For a Vercel-like local environment, link the project with the Vercel CLI and run `vercel dev`; the development environment variables can be downloaded with `vercel env pull`.[2] The production cron route can be invoked manually only with the correct `Authorization: Bearer $CRON_SECRET` header.

## References

[1]: https://vercel.com/docs/cron-jobs/manage-cron-jobs "Vercel — Managing Cron Jobs"
[2]: https://vercel.com/docs/environment-variables "Vercel — Environment Variables"
[3]: https://vercel.com/docs/frameworks/frontend/vite "Vercel — Vite"
