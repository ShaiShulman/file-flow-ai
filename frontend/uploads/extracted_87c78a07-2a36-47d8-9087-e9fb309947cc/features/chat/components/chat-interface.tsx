"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import { StopCircle, Paperclip, ArrowUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/components/ui/use-toast"
import { cn } from "@/lib/utils"
import type { Message } from "@/lib/types"

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const { toast } = useToast()

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const handleSendMessage = async () => {
    if (!input.trim()) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setIsProcessing(true)

    try {
      // Simulate LLM processing
      await new Promise((resolve) => setTimeout(resolve, 2000))

      // In a real app, you would call your LLM API here
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: `I've analyzed your request: "${input}". I'll categorize your legal files based on their content. Please upload your ZIP file to begin the process.`,
        tokens: Math.floor(Math.random() * 500) + 100, // Simulated token count
        timestamp: new Date(),
      }

      setMessages((prev) => [...prev, assistantMessage])
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to process your request. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleStopGeneration = () => {
    // In a real app, you would abort the fetch request
    setIsProcessing(false)
    toast({
      title: "Generation stopped",
      description: "The response generation has been stopped.",
    })
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full pr-4">
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              What changes to you want to make
            </div>
          ) : (
            <div className="space-y-4 pb-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    "flex flex-col p-4 rounded-lg",
                    message.role === "user"
                      ? "bg-slate-100 dark:bg-slate-800 ml-auto max-w-[80%]"
                      : "bg-white dark:bg-slate-900 border mr-auto max-w-[80%]",
                  )}
                >
                  <div className="whitespace-pre-wrap">{message.content}</div>
                  <div className="flex justify-between items-center mt-2">
                    <div className="text-xs text-muted-foreground">{message.timestamp.toLocaleTimeString()}</div>
                    <div className="flex items-center space-x-2">
                      {message.tokens && (
                        <Badge variant="outline" className="text-xs">
                          {message.tokens} tokens
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </ScrollArea>
      </div>

      <div className="pt-4">
        <div className="relative">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="What changes to you want to make"
            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 pr-16 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 dark:focus:ring-slate-600 min-h-[80px] resize-none"
            onKeyDown={handleKeyDown}
            disabled={isProcessing}
          />
          <div className="absolute right-2 top-0 bottom-0 flex items-center gap-1">
            <Button size="icon" variant="ghost" className="rounded-full h-8 w-8">
              <Paperclip className="h-4 w-4" />
            </Button>
            {isProcessing ? (
              <Button size="icon" variant="destructive" onClick={handleStopGeneration} className="rounded-full h-8 w-8">
                <StopCircle className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                size="icon"
                onClick={handleSendMessage}
                disabled={!input.trim()}
                className="rounded-full h-8 w-8 bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-white"
              >
                <ArrowUp className="h-4 w-4 text-white dark:text-slate-900" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
