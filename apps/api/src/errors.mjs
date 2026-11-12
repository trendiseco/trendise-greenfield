export class DomainError extends Error {
  constructor(status, message, code='BUSINESS_RULE') { super(message); this.status=status; this.code=code; }
}
