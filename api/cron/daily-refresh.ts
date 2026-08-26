import type { IncomingMessage, ServerResponse } from "node:http";
import { enqueueVercelDailyRefresh, isVercelCronAuthorized } from "../../server/vercelCron";

export default async function handler(request: IncomingMessage, response: ServerResponse) {
  const authorization = request.headers.authorization;
  if (!isVercelCronAuthorized(authorization, process.env.CRON_SECRET)) {
    response.writeHead(401, { "content-type": "application/json" });
    response.end(JSON.stringify({ ok: false, error: "unauthorized" }));
    return;
  }
  const result = await enqueueVercelDailyRefresh();
  response.writeHead(result.ok ? 200 : 424, { "content-type": "application/json" });
  response.end(JSON.stringify(result));
}
