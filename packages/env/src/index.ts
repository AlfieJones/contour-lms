import { z } from "zod";

export type EnvFields = Record<string, z.ZodType>;
export type EnvOptions<T extends EnvFields> = { scope: string; schema: T };

export function createEnv<const T extends EnvFields>({
  scope,
  schema,
  values,
}: EnvOptions<T> & { values: Record<string, string | undefined> }): z.output<z.ZodObject<T>> {
  const normalized = Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, value === "" ? undefined : value]),
  );
  const result = z.object(schema).safeParse(normalized);
  if (result.success) return result.data;

  // Field names only: validation messages can contain secret input values.
  const fields = [...new Set(result.error.issues.map((issue) => issue.path.join(".")))];
  throw new Error(`[env:${scope}] Invalid environment: ${fields.join(", ")}.`);
}
