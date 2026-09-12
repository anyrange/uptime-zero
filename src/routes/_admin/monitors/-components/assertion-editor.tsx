import type { MonitorAssertion } from "@/types";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  NumberField,
  NumberFieldDecrement,
  NumberFieldGroup,
  NumberFieldIncrement,
  NumberFieldInput,
} from "@/components/ui/number-field";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  dnsRecordTypeSchema,
  dnsRecordTypes,
  jsonOperatorSchema,
  jsonOperators,
  textAssertionOperators,
  textOperatorSchema,
} from "@/lib/monitor/assertions";
import { m } from "@/paraglide/messages.js";

const textOperatorOptions = textAssertionOperators;

const jsonOperatorOptions = jsonOperators;

const dnsRecordTypeOptions = dnsRecordTypes;

export function AssertionEditor({
  assertion,
  onChange,
  onRemove,
}: {
  assertion: MonitorAssertion;
  onChange: (assertion: MonitorAssertion) => void;
  onRemove: () => void;
}) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>{assertionSummary(assertion)}</CardTitle>
        <CardAction>
          <Button onClick={onRemove} type="button" variant="outline">
            {m.monitor_remove_assertion()}
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {assertion.type === "status" ? (
          <Field>
            <FieldLabel>{m.monitor_expected_status()}</FieldLabel>
            <NumberField
              min={100}
              onValueChange={(value) =>
                onChange({
                  ...assertion,
                  expected: value ?? 0,
                })
              }
              value={assertion.expected}
            >
              <NumberFieldGroup>
                <NumberFieldDecrement />
                <NumberFieldInput />
                <NumberFieldIncrement />
              </NumberFieldGroup>
            </NumberField>
          </Field>
        ) : null}

        {assertion.type === "header" ? (
          <FieldGroup className="grid gap-4 md:grid-cols-3">
            <Field>
              <FieldLabel>{m.monitor_header()}</FieldLabel>
              <Input
                onChange={(event) =>
                  onChange({ ...assertion, header: event.target.value })
                }
                value={assertion.header}
              />
            </Field>
            <Field>
              <FieldLabel>{m.monitor_operator()}</FieldLabel>
              <Select
                onValueChange={(value) => {
                  const operator = textOperatorSchema.safeParse(value);

                  if (operator.success) {
                    onChange({ ...assertion, operator: operator.data });
                  }
                }}
                value={assertion.operator}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {textOperatorOptions.map((operator) => (
                      <SelectItem key={operator} value={operator}>
                        {operator}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel>{m.monitor_value()}</FieldLabel>
              <Input
                onChange={(event) =>
                  onChange({ ...assertion, value: event.target.value })
                }
                value={assertion.value}
              />
            </Field>
          </FieldGroup>
        ) : null}

        {assertion.type === "body" && assertion.source === "text" ? (
          <FieldGroup className="grid gap-4 md:grid-cols-2">
            <Field>
              <FieldLabel>{m.monitor_operator()}</FieldLabel>
              <Select
                onValueChange={(value) => {
                  const operator = textOperatorSchema.safeParse(value);

                  if (operator.success) {
                    onChange({ ...assertion, operator: operator.data });
                  }
                }}
                value={assertion.operator}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {textOperatorOptions.map((operator) => (
                      <SelectItem key={operator} value={operator}>
                        {operator}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel>{m.monitor_value()}</FieldLabel>
              <Input
                onChange={(event) =>
                  onChange({ ...assertion, value: event.target.value })
                }
                value={assertion.value}
              />
            </Field>
          </FieldGroup>
        ) : null}

        {assertion.type === "body" && assertion.source === "json" ? (
          <FieldGroup className="grid gap-4 md:grid-cols-3">
            <Field>
              <FieldLabel>{m.monitor_json_path()}</FieldLabel>
              <Input
                onChange={(event) =>
                  onChange({ ...assertion, path: event.target.value })
                }
                value={assertion.path}
              />
            </Field>
            <Field>
              <FieldLabel>{m.monitor_operator()}</FieldLabel>
              <Select
                onValueChange={(value) => {
                  const operator = jsonOperatorSchema.safeParse(value);

                  if (operator.success) {
                    onChange({ ...assertion, operator: operator.data });
                  }
                }}
                value={assertion.operator}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {jsonOperatorOptions.map((operator) => (
                      <SelectItem key={operator} value={operator}>
                        {operator}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel>{m.monitor_expected_value()}</FieldLabel>
              <Input
                onChange={(event) =>
                  onChange({ ...assertion, value: event.target.value })
                }
                value={assertion.value}
              />
            </Field>
          </FieldGroup>
        ) : null}

        {assertion.type === "record" ? (
          <FieldGroup className="grid gap-4 md:grid-cols-3">
            <Field>
              <FieldLabel>{m.monitor_record_type()}</FieldLabel>
              <Select
                onValueChange={(value) => {
                  const recordType = dnsRecordTypeSchema.safeParse(value);

                  if (recordType.success) {
                    onChange({ ...assertion, recordType: recordType.data });
                  }
                }}
                value={assertion.recordType}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {dnsRecordTypeOptions.map((recordType) => (
                      <SelectItem key={recordType} value={recordType}>
                        {recordType}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel>{m.monitor_operator()}</FieldLabel>
              <Select
                onValueChange={(value) => {
                  const operator = textOperatorSchema.safeParse(value);

                  if (operator.success) {
                    onChange({ ...assertion, operator: operator.data });
                  }
                }}
                value={assertion.operator}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {textOperatorOptions.map((operator) => (
                      <SelectItem key={operator} value={operator}>
                        {operator}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel>{m.monitor_expected_value()}</FieldLabel>
              <Input
                onChange={(event) =>
                  onChange({ ...assertion, value: event.target.value })
                }
                value={assertion.value}
              />
            </Field>
          </FieldGroup>
        ) : null}
      </CardContent>
    </Card>
  );
}

function assertionSummary(assertion: MonitorAssertion) {
  switch (assertion.type) {
    case "status":
      return m.monitor_assertion_status_summary({
        expected: assertion.expected,
      });
    case "header":
      return m.monitor_assertion_header_summary({
        header: assertion.header,
        operator: assertion.operator,
        value: assertion.value,
      });
    case "body":
      return assertion.source === "json"
        ? m.monitor_assertion_json_summary({
            path: assertion.path,
            operator: assertion.operator,
            value: assertion.value,
          })
        : m.monitor_assertion_body_summary({
            operator: assertion.operator,
            value: assertion.value,
          });
    case "record":
      return m.monitor_assertion_record_summary({
        recordType: assertion.recordType,
        operator: assertion.operator,
        value: assertion.value,
      });
  }
}
