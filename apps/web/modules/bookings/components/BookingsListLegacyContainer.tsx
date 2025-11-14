"use client";

import { useReactTable, getCoreRowModel, getSortedRowModel, createColumnHelper } from "@tanstack/react-table";
import { useMemo } from "react";

import dayjs from "@calcom/dayjs";
import { ColumnFilterType } from "@calcom/features/data-table";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import useMeQuery from "@calcom/trpc/react/hooks/useMeQuery";
import BookingListItem from "@calcom/web/components/booking/BookingListItem";

import { useFacetedUniqueValues } from "~/bookings/hooks/useFacetedUniqueValues";

import type { RowData, BookingListingStatus, BookingOutput } from "../types";
import { BookingsListLegacy } from "./BookingsListLegacy";

interface BookingsListContainerProps {
  status: BookingListingStatus;
  permissions: {
    canReadOthersBookings: boolean;
  };
  data: BookingOutput[];
  isPending: boolean;
  totalRowCount?: number;
}

export function BookingsListLegacyContainer({
  status,
  permissions,
  data,
  isPending,
  totalRowCount,
}: BookingsListContainerProps) {
  const { t } = useLocale();
  const user = useMeQuery().data;

  const columns = useMemo(() => {
    const columnHelper = createColumnHelper<RowData>();

    return [
      columnHelper.accessor((row) => row.type === "data" && row.booking.eventType.id, {
        id: "eventTypeId",
        header: t("event_type"),
        enableColumnFilter: true,
        enableSorting: false,
        cell: () => null,
        meta: {
          filter: {
            type: ColumnFilterType.MULTI_SELECT,
          },
        },
      }),
      columnHelper.accessor((row) => row.type === "data" && row.booking.eventType.team?.id, {
        id: "teamId",
        header: t("team"),
        enableColumnFilter: true,
        enableSorting: false,
        cell: () => null,
        meta: {
          filter: {
            type: ColumnFilterType.MULTI_SELECT,
          },
        },
      }),
      columnHelper.accessor((row) => row.type === "data" && row.booking.user?.id, {
        id: "userId",
        header: t("member"),
        enableColumnFilter: permissions.canReadOthersBookings,
        enableSorting: false,
        cell: () => null,
        meta: {
          filter: {
            type: ColumnFilterType.MULTI_SELECT,
          },
        },
      }),
      columnHelper.accessor((row) => row, {
        id: "attendeeName",
        header: t("attendee_name"),
        enableColumnFilter: true,
        enableSorting: false,
        cell: () => null,
        meta: {
          filter: {
            type: ColumnFilterType.TEXT,
          },
        },
      }),
      columnHelper.accessor((row) => row, {
        id: "attendeeEmail",
        header: t("attendee_email_variable"),
        enableColumnFilter: true,
        enableSorting: false,
        cell: () => null,
        meta: {
          filter: {
            type: ColumnFilterType.TEXT,
          },
        },
      }),
      columnHelper.accessor((row) => row, {
        id: "dateRange",
        header: t("date_range"),
        enableColumnFilter: true,
        enableSorting: false,
        cell: () => null,
        meta: {
          filter: {
            type: ColumnFilterType.DATE_RANGE,
            dateRangeOptions: {
              range: status === "past" ? "past" : "custom",
            },
          },
        },
      }),
      columnHelper.accessor((row) => row.type === "data" && row.booking.uid, {
        id: "bookingUid",
        header: t("booking_uid"),
        enableColumnFilter: true,
        enableSorting: false,
        cell: () => null,
        meta: {
          filter: {
            type: ColumnFilterType.TEXT,
            textOptions: {
              allowedOperators: ["equals"],
            },
          },
        },
      }),
      columnHelper.display({
        id: "customView",
        cell: (props) => {
          if (props.row.original.type === "data") {
            const { booking, recurringInfo, isToday } = props.row.original;
            return (
              <BookingListItem
                key={booking.id}
                isToday={isToday}
                loggedInUser={{
                  userId: user?.id,
                  userTimeZone: user?.timeZone,
                  userTimeFormat: user?.timeFormat,
                  userEmail: user?.email,
                }}
                listingStatus={status}
                recurringInfo={recurringInfo}
                // uncomment this line to enable BookingDetailsSheet
                // onClick={() => setSelectedBookingId(booking.id)}
                {...booking}
              />
            );
          } else if (props.row.original.type === "today") {
            return (
              <p className="text-subtle bg-subtle w-full py-4 pl-6 text-xs font-semibold uppercase leading-4">
                {t("today")}
              </p>
            );
          } else if (props.row.original.type === "next") {
            return (
              <p className="text-subtle bg-subtle w-full py-4 pl-6 text-xs font-semibold uppercase leading-4">
                {t("next")}
              </p>
            );
          }
        },
      }),
    ];
  }, [user, status, t, permissions.canReadOthersBookings]);

  const flatData = useMemo<RowData[]>(() => {
    const shownBookings: Record<string, BookingOutput[]> = {};
    const filterBookings = (booking: BookingOutput) => {
      if (status === "recurring" || status == "unconfirmed" || status === "cancelled") {
        if (!booking.recurringEventId) {
          return true;
        }
        if (
          shownBookings[booking.recurringEventId] !== undefined &&
          shownBookings[booking.recurringEventId].length > 0
        ) {
          shownBookings[booking.recurringEventId].push(booking);
          return false;
        }
        shownBookings[booking.recurringEventId] = [booking];
      } else if (status === "upcoming") {
        return (
          dayjs(booking.startTime).tz(user?.timeZone).format("YYYY-MM-DD") !==
          dayjs().tz(user?.timeZone).format("YYYY-MM-DD")
        );
      }
      return true;
    };

    return (
      data?.bookings.filter(filterBookings).map((booking) => ({
        type: "data",
        booking,
        recurringInfo: data?.recurringInfo.find((info) => info.recurringEventId === booking.recurringEventId),
        isToday: false,
      })) || []
    );
  }, [data, status, user?.timeZone]);

  const bookingsToday = useMemo<RowData[]>(() => {
    return (
      data?.bookings
        .filter(
          (booking: BookingOutput) =>
            dayjs(booking.startTime).tz(user?.timeZone).format("YYYY-MM-DD") ===
            dayjs().tz(user?.timeZone).format("YYYY-MM-DD")
        )
        .map((booking) => ({
          type: "data" as const,
          booking,
          recurringInfo: data?.recurringInfo.find(
            (info) => info.recurringEventId === booking.recurringEventId
          ),
          isToday: true,
        })) ?? []
    );
  }, [data, user?.timeZone]);

  const finalData = useMemo<RowData[]>(() => {
    if (status !== "upcoming") {
      return flatData;
    }
    const merged: RowData[] = [];
    if (bookingsToday.length > 0) {
      merged.push({ type: "today" as const }, ...bookingsToday);
    }
    if (flatData.length > 0) {
      merged.push({ type: "next" as const }, ...flatData);
    }
    return merged;
  }, [bookingsToday, flatData, status]);

  const getFacetedUniqueValues = useFacetedUniqueValues();

  const table = useReactTable<RowData>({
    data: finalData,
    columns,
    initialState: {
      columnVisibility: {
        eventTypeId: false,
        teamId: false,
        userId: false,
        attendeeName: false,
        attendeeEmail: false,
        dateRange: false,
        bookingUid: false,
      },
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedUniqueValues,
  });

  return (
    <BookingsListLegacy status={status} table={table} isPending={isPending} totalRowCount={totalRowCount} />
  );
}
