"use client";

import { formatDistanceStrict } from "date-fns";
import { forwardRef, useCallback, useEffect, useRef, useState } from "react";

import type {
  StatusBarData,
  StatusEventType,
  StatusType,
} from "@/components/blocks/status.types";

import { useStatusBlocksLabels } from "@/components/blocks/status-i18n";
import { statusColors } from "@/components/blocks/status.utils";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useMediaQuery } from "@/lib/hooks/use-media-query";
import { cn } from "@/lib/utils";

interface StatusBarProps {
  data: StatusBarData[];
  renderCard?: (
    data: StatusBarData["card"][number],
    index: number,
  ) => React.ReactNode;
  renderBar?: (
    data: StatusBarData["bar"][number],
    index: number,
  ) => React.ReactNode;
  renderEvent?: (
    data: StatusBarData["events"][number],
    index: number,
  ) => React.ReactNode;
}

interface UseStatusBarProps {
  dataLength: number;
  isTouch: boolean;
}

type InteractionType = "pin" | "hover" | "focus" | null;

function useStatusBar({ dataLength, isTouch }: UseStatusBarProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [interactionType, setInteractionType] = useState<InteractionType>(null);
  const buttonRefs = useRef<(HTMLElement | null)[]>([]);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (interactionType !== "pin" || activeIndex === null) {
      return;
    }

    const handleOutsideClick = (event: MouseEvent) => {
      if (
        containerRef.current &&
        event.target instanceof Node &&
        !containerRef.current.contains(event.target)
      ) {
        setActiveIndex(null);
        setInteractionType(null);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [interactionType, activeIndex]);

  const clearHoverTimeout = useCallback(() => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
  }, []);

  const handleClick = useCallback(
    (index: number) => {
      clearHoverTimeout();
      setActiveIndex((current) => {
        if (current === index) {
          setInteractionType(null);
          return null;
        }
        setInteractionType("pin");
        return index;
      });
    },
    [clearHoverTimeout],
  );

  const handleHoverStart = useCallback(
    (index: number) => {
      if (isTouch) {
        return;
      }

      clearHoverTimeout();
      setActiveIndex(index);
      setInteractionType("hover");
    },
    [clearHoverTimeout, isTouch],
  );

  const handleHoverEnd = useCallback(() => {
    if (interactionType !== "hover") {
      return;
    }

    hoverTimeoutRef.current = setTimeout(() => {
      setActiveIndex(null);
      setInteractionType(null);
    }, 100);
  }, [interactionType]);

  const handleFocus = useCallback((index: number) => {
    setActiveIndex(index);
    setInteractionType("focus");
  }, []);

  const handleBlur = useCallback((event: React.FocusEvent) => {
    const relatedTarget =
      event.relatedTarget instanceof HTMLElement ? event.relatedTarget : null;
    const isMovingToAnotherBar =
      relatedTarget &&
      relatedTarget.closest('[role="toolbar"]') === containerRef.current &&
      relatedTarget.getAttribute("role") === "button";

    if (!isMovingToAnotherBar) {
      setActiveIndex(null);
      setInteractionType(null);
    }
  }, []);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent, currentIndex: number) => {
      switch (event.key) {
        case "Escape":
          event.preventDefault();
          setActiveIndex(null);
          setInteractionType(null);
          clearHoverTimeout();
          buttonRefs.current[currentIndex]?.blur();
          break;
        case "ArrowLeft": {
          event.preventDefault();
          const newIndex = currentIndex > 0 ? currentIndex - 1 : dataLength - 1;
          buttonRefs.current[newIndex]?.focus();
          break;
        }
        case "ArrowRight": {
          event.preventDefault();
          const newIndex = currentIndex < dataLength - 1 ? currentIndex + 1 : 0;
          buttonRefs.current[newIndex]?.focus();
          break;
        }
        case "ArrowUp": {
          event.preventDefault();
          const prevMonitor = containerRef.current?.closest(
            '[data-slot="status-component"]',
          )?.previousElementSibling;
          const prevBar = prevMonitor?.querySelector('[role="toolbar"]');
          const prevButtons =
            prevBar?.querySelectorAll<HTMLElement>('[role="button"]');
          const targetButton = prevButtons?.[currentIndex];
          targetButton?.focus();
          break;
        }
        case "ArrowDown": {
          event.preventDefault();
          const nextMonitor = containerRef.current?.closest(
            '[data-slot="status-component"]',
          )?.nextElementSibling;
          const nextBar = nextMonitor?.querySelector('[role="toolbar"]');
          const nextButtons =
            nextBar?.querySelectorAll<HTMLElement>('[role="button"]');
          const targetButton = nextButtons?.[currentIndex];
          targetButton?.focus();
          break;
        }
        case "Enter":
        case " ": {
          event.preventDefault();
          handleClick(currentIndex);
          break;
        }
      }
    },
    [clearHoverTimeout, dataLength, handleClick],
  );

  const setButtonRef = useCallback(
    (index: number, element: HTMLElement | null) => {
      buttonRefs.current[index] = element;
    },
    [],
  );

  return {
    activeIndex,
    interactionType,
    containerRef,
    handlers: {
      onClick: handleClick,
      onHoverStart: handleHoverStart,
      onHoverEnd: handleHoverEnd,
      onHoverCardEnter: clearHoverTimeout,
      onHoverCardLeave: () => {
        setActiveIndex(null);
        setInteractionType(null);
      },
      onFocus: handleFocus,
      onBlur: handleBlur,
      onKeyDown: handleKeyDown,
    },
    setButtonRef,
  };
}

export function StatusBar({
  data,
  renderCard,
  renderBar,
  renderEvent,
}: StatusBarProps) {
  const labels = useStatusBlocksLabels();
  const isTouch = useMediaQuery("(hover: none)");
  const { activeIndex, interactionType, containerRef, handlers, setButtonRef } =
    useStatusBar({
      dataLength: data.length,
      isTouch,
    });

  return (
    <div
      aria-label={labels.ariaStatusTracker}
      className="flex h-[50px] w-full items-end gap-[3px]"
      data-slot="status-bar"
      ref={containerRef}
      role="toolbar"
    >
      {data.map((item, index) => {
        const isActive = activeIndex === index;
        const isPinned = isActive && interactionType === "pin";

        return (
          <StatusBarItem
            handlers={handlers}
            index={index}
            isActive={isActive}
            isLastItem={index === data.length - 1}
            isPinned={isPinned}
            isTouch={isTouch}
            item={item}
            key={item.day}
            ref={(element) => setButtonRef(index, element)}
            renderBar={renderBar}
            renderCard={renderCard}
            renderEvent={renderEvent}
          />
        );
      })}
    </div>
  );
}

interface StatusBarItemProps {
  index: number;
  item: StatusBarData;
  isActive: boolean;
  isPinned: boolean;
  isTouch: boolean;
  isLastItem: boolean;
  handlers: ReturnType<typeof useStatusBar>["handlers"];
  renderCard?: StatusBarProps["renderCard"];
  renderBar?: StatusBarProps["renderBar"];
  renderEvent?: StatusBarProps["renderEvent"];
}

const StatusBarItem = forwardRef<HTMLDivElement, StatusBarItemProps>(
  (
    {
      index,
      item,
      isActive,
      isPinned,
      isTouch,
      isLastItem,
      handlers,
      renderCard,
      renderBar,
      renderEvent,
    },
    ref,
  ) => {
    const labels = useStatusBlocksLabels();

    return (
      <HoverCard open={isActive} openDelay={0} closeDelay={0}>
        <HoverCardTrigger asChild>
          <div
            aria-expanded={isActive}
            aria-label={labels.ariaDayStatus(index + 1)}
            aria-pressed={isPinned}
            className="relative flex h-full flex-1 cursor-pointer flex-col transition outline-none hover:opacity-90 focus-visible:opacity-90 focus-visible:ring-2 focus-visible:ring-ring/50"
            data-slot="status-bar-item"
            onBlur={handlers.onBlur}
            onClick={() => handlers.onClick(index)}
            onFocus={() => handlers.onFocus(index)}
            onKeyDown={(event) => handlers.onKeyDown(event, index)}
            onMouseEnter={() => handlers.onHoverStart(index)}
            onMouseLeave={handlers.onHoverEnd}
            ref={ref}
            role="button"
            tabIndex={isLastItem && !isActive ? 0 : isActive ? 0 : -1}
          >
            <div className="flex h-full w-full flex-col overflow-hidden border border-border/50 bg-muted/30">
              {item.bar.map((segment, segmentIndex) => {
                if (renderBar) {
                  return renderBar(segment, segmentIndex);
                }

                return (
                  <div
                    className="w-full transition-all"
                    key={`${item.day}-${segment.status}-${segmentIndex}`}
                    style={{
                      backgroundColor: statusColors[segment.status],
                      height: `${segment.height}%`,
                    }}
                  />
                );
              })}
            </div>
          </div>
        </HoverCardTrigger>
        <HoverCardContent
          align="center"
          className="min-w-48 rounded-xl p-0"
          onMouseEnter={handlers.onHoverCardEnter}
          onMouseLeave={handlers.onHoverCardLeave}
          onPointerDownOutside={(event) => {
            if (isTouch) {
              event.preventDefault();
            }
          }}
          side="top"
        >
          <StatusBarCard
            isPinned={isPinned}
            isTouch={isTouch}
            item={item}
            renderCard={renderCard}
            renderEvent={renderEvent}
          />
        </HoverCardContent>
      </HoverCard>
    );
  },
);

function StatusBarCard({
  item,
  isPinned,
  isTouch,
  renderCard,
  renderEvent,
}: {
  item: StatusBarData;
  isPinned: boolean;
  isTouch: boolean;
  renderCard?: StatusBarProps["renderCard"];
  renderEvent?: StatusBarProps["renderEvent"];
}) {
  const labels = useStatusBlocksLabels();
  const timestampLabel = formatStatusBarTimestamp(item.day);

  return (
    <div data-slot="status-bar-card">
      <div className="px-3 py-2 text-sm leading-5 font-medium text-foreground">
        {timestampLabel}
      </div>
      <Separator />
      <div className="space-y-1 p-3 text-sm">
        {item.card.map((cardItem, cardIndex) =>
          renderCard ? (
            renderCard(cardItem, cardIndex)
          ) : (
            <StatusBarContent
              key={`${item.day}-card-${cardIndex}`}
              status={cardItem.status}
              value={cardItem.value}
            />
          ),
        )}
      </div>
      {item.events.length > 0 ? (
        <>
          <Separator />
          <div className="space-y-2 p-3">
            {item.events.map((event, eventIndex) =>
              renderEvent ? (
                renderEvent(event, eventIndex)
              ) : (
                <StatusBarEvent
                  from={event.from}
                  isAggregated={event.isAggregated}
                  key={`${event.id}-${event.type}`}
                  name={event.name}
                  to={event.to}
                  type={event.type}
                />
              ),
            )}
          </div>
        </>
      ) : null}
      {isPinned && !isTouch ? (
        <>
          <Separator />
          <div className="flex items-center gap-3 px-3 py-2 text-xs text-muted-foreground">
            <span>{labels.clickAgainToUnpin}</span>
            <kbd className="ml-auto inline-flex min-w-5 items-center justify-center rounded border border-input bg-background px-1.5 py-0.5 text-[10px] font-medium">
              Esc
            </kbd>
          </div>
        </>
      ) : null}
    </div>
  );
}

function formatStatusBarTimestamp(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function StatusBarSkeleton({
  className,
  ...props
}: React.ComponentProps<typeof Skeleton>) {
  return (
    <Skeleton
      className={cn("h-[50px] w-full rounded-none bg-muted", className)}
      {...props}
    />
  );
}

function StatusBarContent({
  status,
  value,
}: {
  status: StatusType;
  value: string;
}) {
  const labels = useStatusBlocksLabels();

  return (
    <div className="flex items-center gap-4" data-slot="status-bar-content">
      <div className="flex items-center gap-2">
        <div
          className="h-2.5 w-2.5 rounded-sm"
          style={{ backgroundColor: statusColors[status] }}
        />
        <div className="text-sm">{labels.requestStatus[status]}</div>
      </div>
      <div className="ml-auto text-xs text-muted-foreground">{value}</div>
    </div>
  );
}

export function StatusBarEvent({
  name,
  from,
  to,
  type,
  isAggregated,
}: {
  name: string;
  from?: Date | null;
  to?: Date | null;
  type: StatusEventType;
  isAggregated?: boolean;
}) {
  const labels = useStatusBlocksLabels();
  if (!from) {
    return null;
  }

  const status =
    type === "incident" ? "error" : type === "report" ? "degraded" : "info";

  return (
    <div className="space-y-1 text-sm" data-slot="status-bar-event">
      <div className="flex items-center gap-2 text-foreground">
        <div
          className="h-2.5 w-2.5 shrink-0 rounded-sm"
          style={{ backgroundColor: statusColors[status] }}
        />
        <div className="truncate">{name}</div>
      </div>
      <div className="text-xs text-muted-foreground">
        {labels.formatDateRange(from, to ?? undefined)}
        <span className="ml-1.5 text-muted-foreground/70">
          {formatStatusDuration({ from, to, isAggregated, labels })}
        </span>
      </div>
    </div>
  );
}

function formatStatusDuration({
  from,
  to,
  isAggregated,
  labels,
}: {
  from?: Date | null;
  to?: Date | null;
  isAggregated?: boolean;
  labels: ReturnType<typeof useStatusBlocksLabels>;
}) {
  if (!from) {
    return null;
  }
  if (!to) {
    return labels.ongoing;
  }

  const duration = formatDistanceStrict(from, to);
  if (isAggregated) {
    return labels.durationAcross(duration);
  }
  if (duration === "0 seconds") {
    return null;
  }
  return duration;
}
