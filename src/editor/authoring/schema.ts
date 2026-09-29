import type { JsonSchema } from '../../runtime/infra/AuthoringApi';

export function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Expected an object');
  const prototype = Object.getPrototypeOf(value) as unknown;
  if (prototype !== Object.prototype && prototype !== null) throw Error('Expected a plain object');
  return value as Record<string, unknown>;
}

export function validate(schema: JsonSchema, value: unknown, path = 'arguments'): void {
  const fail = () => { throw Error(`Invalid ${path}; consult the tool schema`); };
  if (schema.anyOf) {
    if (!schema.anyOf.some(option => { try { validate(option, value, path); return true; } catch { return false; } })) fail();
    return;
  }
  if (schema.enum && !schema.enum.includes(value)) fail();
  if (schema.type === 'object') {
    const object = record(value);
    const properties = schema.properties ?? {};
    for (const key of schema.required ?? []) if (!Object.hasOwn(object, key)) fail();
    for (const [key, entry] of Object.entries(object)) {
      if (['__proto__', 'constructor', 'prototype'].includes(key) || !Object.hasOwn(properties, key)) fail();
      validate(properties[key], entry, `${path}.${key}`);
    }
  } else if (schema.type === 'array') {
    if (!Array.isArray(value)) return fail();
    if (value.length < (schema.minItems ?? 0) || value.length > (schema.maxItems ?? 1024)) fail();
    if (schema.items) value.forEach((entry, i) => validate(schema.items as JsonSchema, entry, `${path}[${i}]`));
  } else if (schema.type === 'string') {
    if (typeof value !== 'string' || value.length > (schema.maxLength ?? 4096)) return fail();
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) fail();
  } else if (schema.type === 'number' || schema.type === 'integer') {
    if (typeof value !== 'number' || !Number.isFinite(value)) return fail();
    if (schema.type === 'integer' && !Number.isSafeInteger(value)) fail();
    if (value < (schema.minimum ?? -Infinity) || value > (schema.maximum ?? Infinity)) fail();
  } else if (schema.type === 'boolean' && typeof value !== 'boolean') fail();
}

export const object = (properties: Record<string, JsonSchema>, required = Object.keys(properties)): JsonSchema => ({ type: 'object', properties, required, additionalProperties: false });
export const string = (maxLength = 4096): JsonSchema => ({ type: 'string', maxLength });
export const integer = (minimum: number, maximum: number): JsonSchema => ({ type: 'integer', minimum, maximum });
export const enumeration = (values: unknown[]): JsonSchema => ({ enum: values });
export const array = (items: JsonSchema, maxItems: number, minItems = 0): JsonSchema => ({ type: 'array', items, minItems, maxItems });
export const boolean: JsonSchema = { type: 'boolean' };
