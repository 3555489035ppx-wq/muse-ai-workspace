export type DomainErrorContext = Readonly<Record<string, unknown>>;

export class DomainError extends Error {
  readonly code: string;
  readonly context: DomainErrorContext;

  constructor(
    code: string,
    message: string,
    context: DomainErrorContext = {},
    cause?: unknown,
  ) {
    if (cause === undefined) {
      super(message);
    } else {
      super(message, { cause });
    }
    this.name = new.target.name;
    this.code = code;
    this.context = Object.freeze({ ...context });
  }
}
