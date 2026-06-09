import { useForm } from "@tanstack/react-form";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  type ColumnDef,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Ellipsis, ExternalLink, Pencil, Search, Trash2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { z } from "zod";

import type { StatusPagePayload } from "@/lib/queries/status-pages";
import type { MonitorRecord, StatusPageRecord } from "@/types";

import { DataTable } from "@/components/data-table";
import { Error } from "@/components/error";
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
import { firstFieldError } from "@/lib/form-errors";
import { formatDateTime } from "@/lib/formatters";
import {
  useCreateStatusPageMutation,
  useDeleteStatusPageMutation,
  useStatusPageQuery,
  useStatusPagesQuery,
  useUpdateStatusPageMutation,
} from "@/lib/queries/status-pages";
import { m } from "@/paraglide/messages.js";

import {
  StatusPageFormSkeleton,
  StatusPagesSkeleton,
} from "./status-pages-skeleton";

const statusPageSchema = z.object({
  title: z.string().trim().min(1, m.status_page_title_required()),
  slug: z.string().trim().min(1, m.status_page_slug_required()),
  description: z.string().nullable(),
  published: z.boolean(),
  showHistory: z.boolean(),
  monitorIds: z.array(z.string()),
});

export function StatusPagesPage() {
  const pages = useStatusPagesQuery();
  const monitorCount = new Map<string, number>();
  pages.data?.links.forEach((link) => {
    monitorCount.set(
      link.status_page_id,
      (monitorCount.get(link.status_page_id) ?? 0) + 1,
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
      {pages.status === "pending" ? <StatusPagesSkeleton /> : null}
      {pages.status === "error" ? (
        <Error message={pages.error.message} />
      ) : null}
      {pages.status === "success" ? (
        pages.data.pages.length === 0 ? (
          <Empty>{m.status_page_none_configured()}</Empty>
        ) : (
          <StatusPagesTable
            pages={pages.data.pages.map((page) => ({
              page,
              monitorCount: monitorCount.get(page.id) ?? 0,
            }))}
          />
        )
      ) : null}
    </AppPage>
  );
}

interface StatusPageTableRow {
  page: StatusPageRecord;
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
          {row.original.monitorCount} monitors
        </p>
      </div>
    ),
  },
  {
    id: "visibility",
    header: m.common_visibility(),
    cell: ({ row }) => (
      <span className="text-muted-foreground">
        {row.original.page.published === 1
          ? m.status_page_public()
          : m.status_page_draft_only()}
      </span>
    ),
  },
  {
    id: "status",
    header: m.common_status(),
    cell: ({ row }) => (
      <Badge
        className={
          row.original.page.published === 1
            ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
            : undefined
        }
        variant="outline"
      >
        {row.original.page.published === 1
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

function StatusPageRowActions({ page }: { page: StatusPageRecord }) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const remove = useDeleteStatusPageMutation(page.id);

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
  const pages = useStatusPagesQuery();
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
      {pages.status === "pending" ? <StatusPageFormSkeleton /> : null}
      {pages.status === "error" ? (
        <Error message={pages.error.message} />
      ) : null}
      {pages.status === "success" ? (
        <StatusPageConfigLayout>
          <StatusPageForm
            monitors={pages.data.monitors}
            onSubmit={async (payload) => {
              await create.mutateAsync(payload);
              await navigate({ to: "/status-pages" });
            }}
            pending={create.isPending}
          />
        </StatusPageConfigLayout>
      ) : null}
    </AppPage>
  );
}

export function EditStatusPagePage({ pageId }: { pageId: string }) {
  const page = useStatusPageQuery(pageId);
  const update = useUpdateStatusPageMutation(pageId);
  const remove = useDeleteStatusPageMutation(pageId);
  const navigate = useNavigate();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const submitError = update.error?.message ?? null;
  const deleteError = remove.error?.message ?? null;

  return (
    <AppPage
      title={
        page.data
          ? m.status_page_edit_named({ title: page.data.page.title })
          : m.status_page_edit()
      }
    >
      <AppPageHeader>
        <AppPageHeaderContent>
          <AppPageLabel>
            {page.data
              ? m.status_page_edit_named({ title: page.data.page.title })
              : m.status_page_edit()}
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
      {page.status === "pending" ? <StatusPageFormSkeleton /> : null}
      {page.status === "error" ? <Error message={page.error.message} /> : null}
      {page.status === "success" ? (
        <AlertDialog onOpenChange={setConfirmOpen} open={confirmOpen}>
          <StatusPageConfigLayout>
            <StatusPageForm
              deletePending={remove.isPending}
              deleteError={deleteError}
              monitors={page.data.monitors}
              onDelete={() => setConfirmOpen(true)}
              onSubmit={async (payload) => {
                await update.mutateAsync(payload);
                await navigate({ to: "/status-pages" });
              }}
              page={page.data.page}
              pending={update.isPending}
              selectedMonitorIds={page.data.monitorIds}
              submitError={submitError}
            />
          </StatusPageConfigLayout>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {m.status_page_delete_title()}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {m.status_page_delete_description({
                  title: page.data.page.title,
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
                {remove.isPending
                  ? m.status_page_deleting()
                  : m.common_delete()}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}
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
  page?: StatusPageRecord;
  monitors: MonitorRecord[];
  selectedMonitorIds?: string[];
  pending?: boolean;
  deletePending?: boolean;
  onSubmit: (payload: StatusPagePayload) => Promise<void>;
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

  const form = useForm({
    defaultValues: {
      title: page?.title ?? "",
      slug: page?.slug ?? "",
      description: page?.description ?? null,
      published: page ? page.published === 1 : true,
      showHistory: page ? page.showHistory === 1 : true,
      monitorIds: selectedMonitorIds,
    },
    validators: {
      onSubmit: statusPageSchema,
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
          mode="array"
          name="monitorIds"
          children={(field) => (
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {monitors.length === 0 ? (
                <Empty>{m.status_page_no_monitors()}</Empty>
              ) : filteredMonitors.length === 0 ? (
                <Empty>{m.status_page_no_monitors_match()}</Empty>
              ) : (
                filteredMonitors.map((monitor) => {
                  const checked = field.state.value.includes(monitor.id);
                  return (
                    <Item asChild key={monitor.id} size="sm" variant="outline">
                      <label>
                        <ItemMedia>
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(nextChecked) => {
                              if (nextChecked) {
                                if (!checked) {
                                  field.pushValue(monitor.id);
                                }
                                return;
                              }
                              const index = field.state.value.indexOf(
                                monitor.id,
                              );
                              if (index >= 0) {
                                field.removeValue(index);
                              }
                            }}
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
          )}
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
      </div>
      {submitError ? (
        <p className="text-sm text-rose-300">{submitError}</p>
      ) : null}
      {deleteError ? (
        <p className="text-sm text-rose-300">{deleteError}</p>
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
