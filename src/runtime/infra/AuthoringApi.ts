export type JsonSchema = {
  type?: 'object' | 'array' | 'string' | 'number' | 'integer' | 'boolean';
  properties?: Record<string, JsonSchema>;
  required?: string[];
  additionalProperties?: false;
  items?: JsonSchema;
  enum?: unknown[];
  anyOf?: JsonSchema[];
  minimum?: number;
  maximum?: number;
  minItems?: number;
  maxItems?: number;
  maxLength?: number;
  pattern?: string;
};
export type AuthoringTool = { type: 'function'; function: { name: string; description: string; parameters: JsonSchema } };
export type AuthoringCapabilities = {
  version: 1;
  limits: { roomSize: number; rooms: number; maxPayload: number };
  assets: Record<string, unknown>;
  tools: AuthoringTool[];
};
export type AuthoringTransaction = {
  read(section: 'project' | 'summary' | 'room' | 'assets', roomIndex?: number): unknown;
  apply(name: string, argumentsValue: unknown): void;
  commit(): { changed: boolean; operations: number };
  discard(): void;
};
export type AuthoringApi = { capabilities(): AuthoringCapabilities; begin(): AuthoringTransaction };
