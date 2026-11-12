/**
 * How the flat values typed in the config form become the payload the API validates. Pure data + one pure
 * function, so a server component can pass the shape to the client form (no function crosses the boundary)
 * and the form never branches on a config type name.
 */
export interface PayloadShape {
  /** nest `{ [values[keyField]]: values[valueField] }` under `into`; the two form fields are dropped */
  groupBy?: { into: string; keyField: string; valueField: string };
  /** constants merged into the payload after the form values */
  constants?: Record<string, string | number | boolean>;
}

export function applyPayloadShape(
  shape: PayloadShape | undefined,
  values: Record<string, unknown>,
): Record<string, unknown> {
  if (!shape) return values;
  let payload = values;
  if (shape.groupBy) {
    const { into, keyField, valueField } = shape.groupBy;
    payload = { [into]: { [String(values[keyField])]: values[valueField] } };
  }
  return shape.constants ? { ...payload, ...shape.constants } : payload;
}
