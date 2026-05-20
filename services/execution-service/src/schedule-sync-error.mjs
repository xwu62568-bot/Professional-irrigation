export class ScheduleSyncError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = 'ScheduleSyncError';
    this.code = 'SCHEDULE_SYNC_FAILED';
    this.cause = options.cause;
  }
}
