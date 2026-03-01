"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { apiClient } from "@/features/api/client"
import type { SessionStats } from "@/lib/types"
import { Clock, Coins, MessageSquare, Zap } from "lucide-react"

interface AnalyticsTabProps {
  sessionId: string | null
}

export default function AnalyticsTab({ sessionId }: AnalyticsTabProps) {
  const [stats, setStats] = useState<SessionStats | null>(null)

  useEffect(() => {
    if (!sessionId) return
    const loadStats = async () => {
      try {
        const result = await apiClient.getSessionStats(sessionId)
        setStats(result as SessionStats)
      } catch (error) {
        console.error("Failed to load stats:", error)
      }
    }
    loadStats()

    // Refresh every 10 seconds while component is mounted
    const interval = setInterval(loadStats, 10000)
    return () => clearInterval(interval)
  }, [sessionId])

  if (!sessionId) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        Upload files to see analytics
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        Loading analytics...
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-2">
        <Card>
          <CardContent className="pt-3 pb-3 px-3">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-blue-500" />
              <div>
                <div className="text-xs text-muted-foreground">Tokens In</div>
                <div className="text-sm font-semibold">
                  {stats.total_input_tokens.toLocaleString()}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-3 pb-3 px-3">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-green-500" />
              <div>
                <div className="text-xs text-muted-foreground">Tokens Out</div>
                <div className="text-sm font-semibold">
                  {stats.total_output_tokens.toLocaleString()}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-3 pb-3 px-3">
            <div className="flex items-center gap-2">
              <Coins className="h-4 w-4 text-amber-500" />
              <div>
                <div className="text-xs text-muted-foreground">Total Cost</div>
                <div className="text-sm font-semibold">
                  ${stats.total_cost_usd.toFixed(4)}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-3 pb-3 px-3">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-purple-500" />
              <div>
                <div className="text-xs text-muted-foreground">Total Time</div>
                <div className="text-sm font-semibold">
                  {(stats.total_duration_ms / 1000).toFixed(1)}s
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Per-message breakdown */}
      {stats.per_message_stats.length > 0 && (
        <div className="border rounded-md">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-slate-50 dark:bg-slate-800">
                <th className="text-left px-2 py-1.5 font-medium">#</th>
                <th className="text-left px-2 py-1.5 font-medium">Role</th>
                <th className="text-right px-2 py-1.5 font-medium">In</th>
                <th className="text-right px-2 py-1.5 font-medium">Out</th>
                <th className="text-right px-2 py-1.5 font-medium">Cost</th>
                <th className="text-right px-2 py-1.5 font-medium">Time</th>
              </tr>
            </thead>
            <tbody>
              {stats.per_message_stats.map((msg, i) => (
                <tr key={msg.id} className="border-b last:border-0">
                  <td className="px-2 py-1.5 text-muted-foreground">{i + 1}</td>
                  <td className="px-2 py-1.5 capitalize">{msg.role}</td>
                  <td className="px-2 py-1.5 text-right">
                    {msg.input_tokens.toLocaleString()}
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    {msg.output_tokens.toLocaleString()}
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    ${msg.cost_usd.toFixed(4)}
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    {(msg.duration_ms / 1000).toFixed(1)}s
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="text-xs text-muted-foreground">
        {stats.message_count} messages, {stats.action_count} actions
      </div>
    </div>
  )
}
