// Minimal local types for roslib.js - only what this app actually uses.
// (No maintained @types/roslib package to depend on.)
declare module 'roslib' {
  export class Ros {
    constructor(options: { url: string })
    on(event: 'connection' | 'error' | 'close', callback: (event?: unknown) => void): void
    close(): void
  }

  export class Topic<T = Record<string, unknown>> {
    constructor(options: {
      ros: Ros
      name: string
      messageType: string
      throttle_rate?: number
      queue_length?: number
    })
    subscribe(callback: (message: T) => void): void
    unsubscribe(): void
    publish(message: T): void
  }

  export class Service<
    TRequest = Record<string, unknown>,
    TResponse = Record<string, unknown>,
  > {
    constructor(options: { ros: Ros; name: string; serviceType: string })
    callService(
      request: TRequest,
      callback: (response: TResponse) => void,
      failedCallback?: (error: string) => void,
    ): void
  }

  const ROSLIB: { Ros: typeof Ros; Topic: typeof Topic; Service: typeof Service }
  export default ROSLIB
}
