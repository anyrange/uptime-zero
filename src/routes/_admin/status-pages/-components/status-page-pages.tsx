import { useForm } from "@tanstack/react-form";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  type ColumnDef,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Ellipsis, ExternalLink, Pencil, Search, Trash2 } from "lucide-react";
import { nanoid } from "nanoid";
import { useState, type ReactNode } from "react";

import type { Monitor } from "@/lib/schemas/monitors";

import { DataTable } from "@/components/data-table";
import {
  AppPage,
  AppPageActions,
  AppPageHeader,
  AppPageHeaderContent,
  AppPageLabel,
  AppPageSubtitle,
} from "@/components/page";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Empty } from "@/components/ui/empty";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { Textarea } from "@/components/ui/textarea";
import {
  statusPageQueryOptions,
  statusPagesQueryOptions,
  useCreateStatusPageMutation,
  useDeleteStatusPageMutation,
  useUpdateStatusPageMutation,
} from "@/lib/api/status-pages";
import { firstFieldError } from "@/lib/form-errors";
import { formatDateTime } from "@/lib/formatters";
import { usePermissions } from "@/lib/hooks/use-permissions";
import {
  type StatusPage,
  StatusPageInput,
  type StatusPageInputEncoded,
} from "@/lib/schemas/status-pages";
import { m } from "@/paraglide/messages.js";

export function StatusPagesPage() {
  const { data: pages } = useSuspenseQuery(statusPagesQueryOptions());
  const monitorCount = new Map<string, number>();
  pages.links.forEach((link) => {
    monitorCount.set(
      link.statusPageId,
      (monitorCount.get(link.statusPageId) ?? 0) + 1,
    );
  });

  return (
    <AppPage title={m.status_page_status_pages()}>
      <AppPageHeader>
        <AppPageHeaderContent>
          <AppPageLabel>{m.status_page_status_pages()}</AppPageLabel>
          <AppPageSubtitle>{m.status_page_description()}</AppPageSubtitle>
        </AppPageHeaderContent>
        <AppPageActions>
          <Button asChild>
            <Link to="/status-pages/new">{m.status_page_create()}</Link>
          </Button>
        </AppPageActions>
      </AppPageHeader>
      {pages.pages.length === 0 ? (
        <Empty>{m.status_page_none_configured()}</Empty>
      ) : (
        <StatusPagesTable
          pages={pages.pages.map((page) => ({
            page,
            monitorCount: monitorCount.get(page.id) ?? 0,
          }))}
        />
      )}
    </AppPage>
  );
}

interface StatusPageTableRow {
  page: StatusPage;
  monitorCount: number;
}

function StatusPagesTable({ pages }: { pages: StatusPageTableRow[] }) {
  const table = useReactTable({
    data: pages,
    columns: statusPageColumns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <DataTable
      columnsLength={statusPageColumns.length}
      empty={m.status_page_none_configured()}
      table={table}
    />
  );
}

const statusPageColumns: ColumnDef<StatusPageTableRow>[] = [
  {
    id: "page",
    header: () => <span className="pl-5">{m.status_page_page()}</span>,
    cell: ({ row }) => (
      <div className="pl-5">
        <Link
          className="font-semibold text-foreground underline-offset-4 hover:underline"
          params={{ slug: row.original.page.slug }}
          rel="noopener noreferrer"
          target="_blank"
          to="/status/$slug"
        >
          {row.original.page.title}
        </Link>
        <p className="mt-1 text-sm text-muted-foreground">
          {m.status_page_monitor_count({ count: row.original.monitorCount })}
        </p>
      </div>
    ),
  },
  {
    id: "visibility",
    header: m.common_visibility(),
    cell: ({ row }) => (
      <span className="text-muted-foreground">
        {row.original.page.published
          ? m.status_page_public()
          : m.status_page_draft_only()}
      </span>
    ),
  },
  {
    id: "status",
    header: m.common_status(),
    cell: ({ row }) => (
      <Badge variant={row.original.page.published ? "success" : "outline"}>
        {row.original.page.published
          ? m.status_page_published()
          : m.status_page_draft()}
      </Badge>
    ),
  },
  {
    id: "updatedAt",
    header: m.common_updated(),
    cell: ({ row }) => (
      <span className="text-muted-foreground">
        {formatDateTime(row.original.page.updatedAt)}
      </span>
    ),
  },
  {
    id: "actions",
    header: () => (
      <span className="block pr-5 text-right">{m.common_actions()}</span>
    ),
    cell: ({ row }) => (
      <div className="pr-5 text-right">
        <StatusPageRowActions page={row.original.page} />
      </div>
    ),
  },
];

function StatusPageRowActions({ page }: { page: StatusPage }) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const remove = useDeleteStatusPageMutation(page.id);
  const { check, isReady } = usePermissions();
  const canDelete = isReady && check("statusPage.delete");

  return (
    <AlertDialog onOpenChange={setConfirmOpen} open={confirmOpen}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            aria-label={m.status_page_open_actions({ title: page.title })}
            size="icon-sm"
            variant="ghost"
          >
            <Ellipsis className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuItem asChild>
            <Link
              params={{ slug: page.slug }}
              rel="noopener noreferrer"
              target="_blank"
              to="/status/$slug"
            >
              <ExternalLink className="size-4" />
              {m.common_open()}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link params={{ pageId: page.id }} to="/status-pages/$pageId/edit">
              <Pencil className="size-4" />
              {m.common_edit()}
            </Link>
          </DropdownMenuItem>
          {canDelete ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={(event) => {
                  event.preventDefault();
                  setConfirmOpen(true);
                }}
                variant="destructive"
              >
                <Trash2 className="size-4" />
                {m.common_delete()}
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{m.status_page_delete_title()}</AlertDialogTitle>
          <AlertDialogDescription>
            {m.status_page_delete_description({ title: page.title })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={remove.isPending}>
            {m.common_cancel()}
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={remove.isPending}
            onClick={() => remove.mutate()}
          >
            {remove.isPending ? m.status_page_deleting() : m.common_delete()}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function NewStatusPagePage() {
  const { data: pages } = useSuspenseQuery(statusPagesQueryOptions());
  const create = useCreateStatusPageMutation();
  const navigate = useNavigate();

  return (
    <AppPage title={m.status_page_configuration()}>
      <AppPageHeader>
        <AppPageHeaderContent>
          <AppPageLabel>{m.status_page_configuration()}</AppPageLabel>
          <AppPageSubtitle>
            {m.status_page_configuration_description()}
          </AppPageSubtitle>
        </AppPageHeaderContent>
        <AppPageActions>
          <Button asChild variant="outline">
            <Link to="/status-pages">{m.common_back()}</Link>
          </Button>
        </AppPageActions>
      </AppPageHeader>
      <StatusPageConfigLayout>
        <StatusPageForm
          monitors={pages.monitors}
          onSubmit={async (payload) => {
            await create.mutateAsync(payload);
            await navigate({ to: "/status-pages" });
          }}
          pending={create.isPending}
        />
      </StatusPageConfigLayout>
    </AppPage>
  );
}

export function EditStatusPagePage({ pageId }: { pageId: string }) {
  const { data: page } = useSuspenseQuery(statusPageQueryOptions(pageId));
  const update = useUpdateStatusPageMutation(pageId);
  const remove = useDeleteStatusPageMutation(pageId);
  const navigate = useNavigate();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { check, isReady } = usePermissions();
  const canDelete = isReady && check("statusPage.delete");

  const submitError = update.error?.message ?? null;
  const deleteError = remove.error?.message ?? null;

  return (
    <AppPage title={m.status_page_edit_named({ title: page.page.title })}>
      <AppPageHeader>
        <AppPageHeaderContent>
          <AppPageLabel>
            {m.status_page_edit_named({ title: page.page.title })}
          </AppPageLabel>
          <AppPageSubtitle>
            {m.status_page_settings_description()}
          </AppPageSubtitle>
        </AppPageHeaderContent>
        <AppPageActions>
          <Button asChild variant="outline">
            <Link to="/status-pages">{m.common_back()}</Link>
          </Button>
        </AppPageActions>
      </AppPageHeader>
      <AlertDialog onOpenChange={setConfirmOpen} open={confirmOpen}>
        <StatusPageConfigLayout>
          <StatusPageForm
            deletePending={remove.isPending}
            deleteError={deleteError}
            monitors={page.monitors}
            onDelete={canDelete ? () => setConfirmOpen(true) : undefined}
            onSubmit={async (payload) => {
              await update.mutateAsync(payload);
              await navigate({ to: "/status-pages" });
            }}
            page={page.page}
            pending={update.isPending}
            selectedMonitorIds={page.monitorIds}
            submitError={submitError}
          />
        </StatusPageConfigLayout>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{m.status_page_delete_title()}</AlertDialogTitle>
            <AlertDialogDescription>
              {m.status_page_delete_description({
                title: page.page.title,
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={remove.isPending}>
              {m.common_cancel()}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={remove.isPending}
              onClick={async () => {
                await remove.mutateAsync();
                await navigate({ to: "/status-pages" });
              }}
            >
              {remove.isPending ? m.status_page_deleting() : m.common_delete()}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppPage>
  );
}

function StatusPageForm({
  page,
  monitors,
  selectedMonitorIds = [],
  pending,
  deletePending,
  onSubmit,
  onDelete,
  submitError,
  deleteError,
}: {
  page?: StatusPage;
  monitors: ReadonlyArray<Monitor>;
  selectedMonitorIds?: ReadonlyArray<string>;
  pending?: boolean;
  deletePending?: boolean;
  onSubmit: (payload: StatusPageInputEncoded) => Promise<void>;
  onDelete?: () => void;
  submitError?: string | null;
  deleteError?: string | null;
}) {
  const [monitorSearch, setMonitorSearch] = useState("");
  const normalizedMonitorSearch = monitorSearch.trim().toLowerCase();

  const filteredMonitors = normalizedMonitorSearch
    ? monitors.filter((monitor) =>
        `${monitor.name} ${monitor.kind}`
          .toLowerCase()
          .includes(normalizedMonitorSearch),
      )
    : monitors;

  // The form holds the encoded input, which is also what the server takes.
  const defaultValues: StatusPageInputEncoded = {
    title: page?.title ?? "",
    slug: page?.slug ?? nanoid(10),
    description: page?.description ?? null,
    published: page?.published ?? true,
    showHistory: page?.showHistory ?? true,
    showTarget: page?.showTarget ?? false,
    monitorIds: [...selectedMonitorIds],
  };

  const form = useForm({
    defaultValues,
    validators: {
      onSubmit: StatusPageInput,
    },
    onSubmit: async ({ value }) => {
      await onSubmit(value);
    },
  });

  return (
    <form
      className="grid gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void form.handleSubmit();
      }}
    >
      <div className="grid gap-4 border-b border-border/70 pb-5 md:grid-cols-2">
        <form.Field
          name="title"
          children={(field) => {
            const error = field.state.meta.isTouched
              ? firstFieldError(field.state.meta.errors)
              : null;

            return (
              <Field data-invalid={!!error}>
                <FieldLabel htmlFor={field.name}>
                  {m.status_page_title()}
                </FieldLabel>
                <Input
                  aria-invalid={
                    field.state.meta.isTouched && !field.state.meta.isValid
                  }
                  id={field.name}
                  name={field.name}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  value={field.state.value}
                />
                {error ? <FieldError>{error}</FieldError> : null}
              </Field>
            );
          }}
        />
        <form.Field
          name="slug"
          children={(field) => {
            const error = field.state.meta.isTouched
              ? firstFieldError(field.state.meta.errors)
              : null;

            return (
              <Field data-invalid={!!error}>
                <FieldLabel htmlFor={field.name}>
                  {m.status_page_slug()}
                </FieldLabel>
                <Input
                  aria-invalid={
                    field.state.meta.isTouched && !field.state.meta.isValid
                  }
                  id={field.name}
                  name={field.name}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  value={field.state.value}
                />
                {error ? <FieldError>{error}</FieldError> : null}
              </Field>
            );
          }}
        />
      </div>
      <form.Field
        name="description"
        children={(field) => {
          const error = field.state.meta.isTouched
            ? firstFieldError(field.state.meta.errors)
            : null;

          return (
            <Field data-invalid={!!error}>
              <FieldLabel htmlFor={field.name}>
                {m.status_page_field_description()}
              </FieldLabel>
              <Textarea
                aria-invalid={
                  field.state.meta.isTouched && !field.state.meta.isValid
                }
                id={field.name}
                name={field.name}
                onBlur={field.handleBlur}
                onChange={(event) =>
                  field.handleChange(
                    event.target.value.trim() ? event.target.value : null,
                  )
                }
                value={field.state.value ?? ""}
              />
              {error ? <FieldError>{error}</FieldError> : null}
            </Field>
          );
        }}
      />
      <div className="grid gap-4 border-b border-border/70 pb-5">
        <div>
          <p className="text-sm font-medium">
            {m.status_page_included_monitors()}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {m.status_page_included_monitors_description()}
          </p>
        </div>
        {monitors.length > 0 ? (
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label={m.status_page_search_included_monitors()}
              className="pl-9"
              onChange={(event) => setMonitorSearch(event.target.value)}
              placeholder={m.status_page_search_monitors()}
              type="search"
              value={monitorSearch}
            />
          </div>
        ) : null}
        <form.Field
          name="monitorIds"
          children={(field) => {
            const monitorIds = field.state.value ?? [];

            return (
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                {monitors.length === 0 ? (
                  <Empty>{m.status_page_no_monitors()}</Empty>
                ) : filteredMonitors.length === 0 ? (
                  <Empty>{m.status_page_no_monitors_match()}</Empty>
                ) : (
                  filteredMonitors.map((monitor) => {
                    const checked = monitorIds.includes(monitor.id);

                    return (
                      <Item
                        asChild
                        key={monitor.id}
                        size="sm"
                        variant="outline"
                      >
                        <label>
                          <ItemMedia>
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(nextChecked) =>
                                field.handleChange(
                                  nextChecked
                                    ? [...monitorIds, monitor.id]
                                    : monitorIds.filter(
                                        (id) => id !== monitor.id,
                                      ),
                                )
                              }
                            />
                          </ItemMedia>
                          <ItemContent>
                            <ItemTitle>{monitor.name}</ItemTitle>
                            <ItemDescription>
                              {monitor.kind.toUpperCase()}
                            </ItemDescription>
                          </ItemContent>
                        </label>
                      </Item>
                    );
                  })
                )}
              </div>
            );
          }}
        />
      </div>
      <div className="grid gap-3 border-b border-border/70 pb-5">
        <form.Field
          name="published"
          children={(field) => (
            <Item asChild size="sm" variant="outline">
              <label>
                <ItemMedia>
                  <Checkbox
                    checked={field.state.value}
                    onCheckedChange={(checked) =>
                      field.handleChange(Boolean(checked))
                    }
                  />
                </ItemMedia>
                <ItemContent>
                  <ItemTitle>{m.status_page_published()}</ItemTitle>
                </ItemContent>
              </label>
            </Item>
          )}
        />
        <form.Field
          name="showHistory"
          children={(field) => (
            <Item asChild size="sm" variant="outline">
              <label>
                <ItemMedia>
                  <Checkbox
                    checked={field.state.value}
                    onCheckedChange={(checked) =>
                      field.handleChange(Boolean(checked))
                    }
                  />
                </ItemMedia>
                <ItemContent>
                  <ItemTitle>{m.status_page_show_recent_history()}</ItemTitle>
                </ItemContent>
              </label>
            </Item>
          )}
        />
        <form.Field
          name="showTarget"
          children={(field) => (
            <Item asChild size="sm" variant="outline">
              <label>
                <ItemMedia>
                  <Checkbox
                    checked={field.state.value}
                    onCheckedChange={(checked) =>
                      field.handleChange(Boolean(checked))
                    }
                  />
                </ItemMedia>
                <ItemContent>
                  <ItemTitle>{m.status_page_show_monitor_url()}</ItemTitle>
                </ItemContent>
              </label>
            </Item>
          )}
        />
      </div>
      {submitError ? (
        <p className="text-sm text-destructive">{submitError}</p>
      ) : null}
      {deleteError ? (
        <p className="text-sm text-destructive">{deleteError}</p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button disabled={pending || deletePending} type="submit">
          {pending
            ? page
              ? m.status_page_saving()
              : m.status_page_creating()
            : page
              ? m.status_page_update()
              : m.status_page_create()}
        </Button>
        {onDelete ? (
          <Button
            disabled={pending || deletePending}
            onClick={onDelete}
            type="button"
            variant="destructive"
          >
            {deletePending ? m.status_page_deleting() : m.common_delete()}
          </Button>
        ) : null}
      </div>
    </form>
  );
}

function StatusPageConfigLayout({ children }: { children: ReactNode }) {
  return <Card className="max-w-4xl px-5 py-5">{children}</Card>;
}
