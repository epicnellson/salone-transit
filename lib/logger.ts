interface LogContext {
  [key: string]: unknown;
}

function log(level: string, message: string, context?: LogContext) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...context,
  };
  if (level === "error") {
    console.error(JSON.stringify(entry));
  } else {
    console.log(JSON.stringify(entry));
  }
}

export function logError(message: string, context?: LogContext) {
  log("error", message, context);
}

export function logInfo(message: string, context?: LogContext) {
  log("info", message, context);
}

export function logWarn(message: string, context?: LogContext) {
  log("warn", message, context);
}

// TODO: Add Sentry integration here
// import * as Sentry from "@sentry/nextjs";
// export function captureException(err: unknown, context?: LogContext) {
//   Sentry.captureException(err, { extra: context });
// }
