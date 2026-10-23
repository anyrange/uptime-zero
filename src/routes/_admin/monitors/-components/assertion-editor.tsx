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
  DnsRecordType,
  JsonOperator,
  type MonitorAssertion,
  TextAssertionOperator,
} from "@/lib/schemas/monitors";
import { m } from "@/paraglide/messages.js";

// Selects hand back plain strings; these narrow them to the option sets.
function isTextOperator(value: unknown): value is TextAssertionOperator {
  return TextAssertionOperator.safeParse(value).success;
}

function isJsonOperator(value: unknown): value is JsonOperator {
  return JsonOperator.safeParse(value).success;
}

function isDnsRecordType(value: unknown): value is DnsRecordType {
  return DnsRecordType.safeParse(value).success;
}

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
                  if (isTextOperator(value)) {
                    onChange({ ...assertion, operator: value });
                  }
                }}
                value={assertion.operator}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {TextAssertionOperator.options.map((operator) => (
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
                  if (isTextOperator(value)) {
                    onChange({ ...assertion, operator: value });
                  }
                }}
                value={assertion.operator}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {TextAssertionOperator.options.map((operator) => (
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
                  if (isJsonOperator(value)) {
                    onChange({ ...assertion, operator: value });
                  }
                }}
                value={assertion.operator}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {JsonOperator.options.map((operator) => (
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
                  if (isDnsRecordType(value)) {
                    onChange({ ...assertion, recordType: value });
                  }
                }}
                value={assertion.recordType}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {DnsRecordType.options.map((recordType) => (
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
                  if (isTextOperator(value)) {
                    onChange({ ...assertion, operator: value });
                  }
                }}
                value={assertion.operator}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {TextAssertionOperator.options.map((operator) => (
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
