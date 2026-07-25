// Minimal local types for roslib.js - only what this app actually uses.
// (No maintained @types/roslib package to depend on.)
declare module 'roslib' {
  export class Ros {
    constructor(options: { url: string })
    on(event: 'connection' | 'error' | 'close', callback: (event?: unknown) => void): void
    close(): void
  }

  export class Topic<T = Record<string, unknown>> {
    constructor(options: { ros: Ros; name: string; messageType: string })
    subscribe(callback: (message: T) => void): void
    unsubscribe(): void
    publish(message: T): void
  }

  const ROSLIB: { Ros: typeof Ros; Topic: typeof Topic }
  export default ROSLIB
}
