/**
 * JavaScript Runtime Utilities (frontend/src/utils/asyncRuntime.ts)
 * Real application helpers demonstrating Closures, Promises vs Callbacks,
 * Event Loop scheduling (queueMicrotask + setTimeout), and Hoisting vs TDZ.
 */

// 1. CLOSURE: Debounced action factory closing over lexical `timerId`
export function createDebouncedTask<T extends (...args: any[]) => void>(delayMs: number) {
  let timerId: ReturnType<typeof setTimeout> | null = null;

  return (fn: T, ...args: Parameters<T>): void => {
    if (timerId !== null) {
      clearTimeout(timerId);
    }
    timerId = setTimeout(() => {
      timerId = null;
      fn(...args);
    }, delayMs);
  };
}

// 2. CLOSURE: Scoped in-flight request counter maintaining private state
export function createRequestTracker() {
  let inFlightCount = 0;

  return {
    enter(): number {
      inFlightCount += 1;
      return inFlightCount;
    },
    leave(): number {
      inFlightCount = Math.max(0, inFlightCount - 1);
      return inFlightCount;
    },
    activeCount(): number {
      return inFlightCount;
    },
  };
}

// 3. PROMISES vs CALLBACKS: Classic Node/DOM callback API wrapped cleanly in a Promise
export function readBlobTextWithCallback(
  blob: Blob,
  onDone: (err: Error | null, text: string | null) => void
): void {
  const reader = new FileReader();
  reader.onload = () => onDone(null, typeof reader.result === "string" ? reader.result : "");
  reader.onerror = () => onDone(new Error("Failed to read file contents"), null);
  reader.readAsText(blob);
}

export function readBlobTextPromise(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    readBlobTextWithCallback(blob, (err, text) => {
      if (err) {
        reject(err);
      } else {
        resolve(text ?? "");
      }
    });
  });
}

// 4. EVENT LOOP: Microtask (Promise/queueMicrotask) runs before Macrotask (setTimeout)
export function scheduleEventLoopFlush(
  onMicrotask: () => void,
  onMacrotask: () => void
): void {
  queueMicrotask(onMicrotask);
  setTimeout(onMacrotask, 0);
}

// 5. HOISTING: Function declaration hoisted at module scope (unlike const/let TDZ variables)
export function formatHttpErrorMessage(status: number, detail: unknown): string {
  if (typeof detail === "string" && detail.trim()) {
    return `${status}: ${detail}`;
  }
  if (detail && typeof detail === "object") {
    return `${status}: ${JSON.stringify(detail)}`;
  }
  return `HTTP ${status}`;
}
