"use client";

import { Field, FieldLabel } from "@lms/ui/field";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "@lms/ui/select";

export function TeacherSelect({
  teachers,
  defaultValue,
}: {
  teachers: { id: string; email: string }[];
  defaultValue?: string | null;
}) {
  const items = teachers.map((teacher) => ({ label: teacher.email, value: teacher.id }));
  return (
    <Field name="teacherId">
      <FieldLabel>Teacher</FieldLabel>
      <Select name="teacherId" items={items} defaultValue={defaultValue ?? null} required>
        <SelectTrigger>
          <SelectValue placeholder="Choose your teacher" />
        </SelectTrigger>
        <SelectPopup>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectPopup>
      </Select>
    </Field>
  );
}
