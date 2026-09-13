// Worker globals — provided by the Cloudflare Workers runtime.
// See https://developers.cloudflare.com/workers/runtime-apis/

interface ScheduledEvent {
  scheduledTime: number;
  cron: string;
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}
