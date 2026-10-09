import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDay } from "../format";
import type { DailyTicketCount } from "../types";

const chartConfig = {
  count: { label: "Tickets", color: "var(--chart-1)" },
} satisfies ChartConfig;

interface TicketsPerDayChartProps {
  /** undefined while loading */
  data: DailyTicketCount[] | undefined;
}

export function TicketsPerDayChart({ data }: TicketsPerDayChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Tickets per day</CardTitle>
        <p className="text-sm text-muted-foreground">Last 30 days (UTC)</p>
      </CardHeader>
      <CardContent>
        {data === undefined ? (
          <Skeleton className="h-64 w-full" />
        ) : (
          <ChartContainer config={chartConfig} className="h-64 w-full">
            <BarChart data={data} accessibilityLayer>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={24}
                tickFormatter={formatDay}
              />
              <YAxis
                width={32}
                allowDecimals={false}
                tickLine={false}
                axisLine={false}
              />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    labelFormatter={(_, items) => formatDay(items[0]?.payload.date)}
                  />
                }
              />
              <Bar dataKey="count" fill="var(--color-count)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
