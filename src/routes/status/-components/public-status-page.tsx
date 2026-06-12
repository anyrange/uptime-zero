import { StatusBanner } from "@/components/blocks/status-banner";
import { StatusBar } from "@/components/blocks/status-bar";
import { StatusBlankMonitors } from "@/components/blocks/status-blank";
import {
  StatusComponent,
  StatusComponentBody,
  StatusComponentFooter,
  StatusComponentHeader,
  StatusComponentHeaderLeft,
  StatusComponentHeaderRight,
  StatusComponentIcon,
  StatusComponentStatus,
  StatusComponentTitle,
  StatusComponentUptime,
} from "@/components/blocks/status-component";
import { StatusComponentGroup } from "@/components/blocks/status-component-group";
import { StatusFeed } from "@/components/blocks/status-feed";
import { StatusBlocksI18nProvider } from "@/components/blocks/status-i18n";
import { Status, StatusContent } from "@/components/blocks/status-layout";
import {
  StatusPageFooter,
  StatusPageFooterActions,
  StatusPageFooterContent,
  StatusPagePoweredBy,
} from "@/components/blocks/status-page-footer";
import {
  StatusPageHeader,
  StatusPageHeaderBrand,
  StatusPageHeaderBrandButton,
  StatusPageHeaderContent,
  StatusPageHeaderNav,
  StatusPageHeaderNavItem,
} from "@/components/blocks/status-page-header";
import {
  StatusPageMain,
  StatusPageShell,
} from "@/components/blocks/status-page-shell";
import { StatusTimestamp } from "@/components/blocks/status-timestamp";
import { Error } from "@/components/error";
import { LiveTime } from "@/components/live-time";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buildPublicStatusPageView } from "@/lib/public-status-page-view";
import { usePublicStatusPageQuery } from "@/lib/queries/status-pages";
import { m } from "@/paraglide/messages.js";

import { PublicStatusSkeleton } from "./public-status-skeleton";

export function PublicStatusPage({ slug }: { slug: string }) {
  const page = usePublicStatusPageQuery(slug);

  return (
    <main className="min-h-screen bg-background text-foreground">
      {page.status === "pending" ? <PublicStatusSkeleton /> : null}
      {page.status === "error" ? <Error message={page.error.message} /> : null}
      {page.status === "success" ? (
        <PublicStatusPageView data={page.data} />
      ) : null}
    </main>
  );
}

function PublicStatusPageView({
  data,
}: {
  data: Parameters<typeof buildPublicStatusPageView>[0];
}) {
  const view = buildPublicStatusPageView(data);

  return (
    <StatusBlocksI18nProvider>
      <StatusPageShell className="bg-background text-foreground">
        <StatusPageHeader className="border-b border-border/60 bg-card/40 backdrop-blur">
          <StatusPageHeaderContent>
            <StatusPageHeaderBrand>
              <StatusPageHeaderBrandButton className="border-transparent bg-transparent shadow-none hover:bg-transparent hover:text-current focus-visible:border-transparent focus-visible:ring-0 active:translate-y-0 dark:hover:bg-transparent">
                <a href={`/status/${data.page.slug}`}>
                  <img
                    alt={m.common_edge_uptime()}
                    className="aspect-square size-9"
                    src="/logo.svg"
                  />
                </a>
              </StatusPageHeaderBrandButton>
            </StatusPageHeaderBrand>
            <StatusPageHeaderNav>
              <StatusPageHeaderNavItem isActive>
                <a href={`#overview`}>{m.status_page_overview()}</a>
              </StatusPageHeaderNavItem>
              <StatusPageHeaderNavItem>
                <a href={`#services`}>{m.status_page_services()}</a>
              </StatusPageHeaderNavItem>
              <StatusPageHeaderNavItem>
                <a href={`#incidents`}>{m.status_page_incidents()}</a>
              </StatusPageHeaderNavItem>
            </StatusPageHeaderNav>
          </StatusPageHeaderContent>
        </StatusPageHeader>

        <StatusPageMain>
          <Status className="gap-6" id="overview" variant={view.overallStatus}>
            <StatusContent className="gap-4">
              <StatusBanner className="shadow-sm" status={view.overallStatus} />

              <section className="grid gap-3" id="uptime">
                <Card size="sm">
                  <CardHeader>
                    <CardTitle>{m.status_page_overall_uptime()}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      {view.uptimeWindows.map((window) => (
                        <div
                          className="border-border/60 lg:border-l lg:pl-6 lg:first:border-l-0 lg:first:pl-0"
                          key={window.label}
                        >
                          <div className="text-2xl font-semibold tracking-normal text-foreground">
                            {window.uptime}
                          </div>
                          <div className="mt-1 text-sm text-muted-foreground">
                            {window.label}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </section>

              <section className="grid gap-3" id="services">
                <div>
                  <h2 className="text-lg font-semibold">
                    {m.status_page_services()}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {m.status_page_services_description()}
                  </p>
                </div>
                {view.monitors.length === 0 ? (
                  <StatusBlankMonitors />
                ) : (
                  <div className="grid gap-3">
                    {view.monitorGroups.map((group, index) => (
                      <StatusComponentGroup
                        defaultOpen={index === 0}
                        key={group.title}
                        status={group.status}
                        title={group.title}
                      >
                        {group.monitors.map((monitor) => (
                          <StatusComponent
                            className="rounded-xl border border-border/60 bg-background/70 px-4 py-4"
                            key={monitor.id}
                            variant={monitor.status}
                          >
                            <StatusComponentHeader className="gap-4">
                              <StatusComponentHeaderLeft className="items-start">
                                <StatusComponentIcon className="mt-1 shrink-0" />
                                <div className="min-w-0">
                                  <StatusComponentTitle>
                                    {monitor.name}
                                  </StatusComponentTitle>
                                  {monitor.meta ? (
                                    <p className="mt-1 truncate text-sm text-muted-foreground">
                                      {monitor.meta}
                                    </p>
                                  ) : null}
                                </div>
                              </StatusComponentHeaderLeft>
                              <StatusComponentHeaderRight className="hidden sm:flex">
                                <StatusComponentUptime>
                                  {monitor.uptime}
                                </StatusComponentUptime>
                                <StatusComponentStatus />
                              </StatusComponentHeaderRight>
                            </StatusComponentHeader>
                            <StatusComponentBody>
                              {view.showHistory ? (
                                <>
                                  <StatusBar data={monitor.history} />
                                  <StatusComponentFooter
                                    data={monitor.history}
                                  />
                                </>
                              ) : (
                                <p className="text-sm text-muted-foreground">
                                  {m.status_page_history_hidden()}
                                </p>
                              )}
                              <div className="flex items-center justify-between gap-3 sm:hidden">
                                <StatusComponentUptime>
                                  {monitor.uptime}
                                </StatusComponentUptime>
                                <StatusComponentStatus />
                              </div>
                            </StatusComponentBody>
                          </StatusComponent>
                        ))}
                      </StatusComponentGroup>
                    ))}
                  </div>
                )}
              </section>

              <section className="grid gap-3" id="incidents">
                <div>
                  <h2 className="text-lg font-semibold">
                    {m.status_page_recent_incidents()}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {m.status_page_recent_incidents_description()}
                  </p>
                </div>
                <StatusFeed
                  className="lg:pl-32"
                  statusReports={view.statusReports}
                />
              </section>
            </StatusContent>
          </Status>
        </StatusPageMain>

        <StatusPageFooter className="border-t border-border/60 bg-card/30">
          <StatusPageFooterContent>
            <StatusPagePoweredBy>
              <a
                className="underline underline-offset-4"
                href="https://github.com/anyrange/uptime-zero"
                rel="noreferrer"
                target="_blank"
              >
                {m.status_page_powered_by()}
              </a>
            </StatusPagePoweredBy>
            <StatusPageFooterActions>
              <StatusTimestamp className="text-xs" date={view.updatedAt}>
                {m.status_page_refreshed()}{" "}
                <LiveTime value={view.updatedAt.toISOString()} />
              </StatusTimestamp>
            </StatusPageFooterActions>
          </StatusPageFooterContent>
        </StatusPageFooter>
      </StatusPageShell>
    </StatusBlocksI18nProvider>
  );
}
