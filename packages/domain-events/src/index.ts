export interface DomainEventEnvelope<TPayload> {
  eventName: string;
  occurredAt: string;
  payload: TPayload;
}
