import { Suspense } from "react"
import FileExplorer from "@/features/file-explorer/components/file-explorer"
import ChatInterface from "@/features/chat/components/chat-interface"
import BottomPanel from "@/components/bottom-panel"
import Toolbar from "@/components/toolbar"
import { Toaster } from "@/components/ui/toaster"
import { Card } from "@/components/ui/card"
import type { FileType } from "@/lib/types"
import { useState } from "react"

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col bg-slate-50 dark:bg-slate-900">
      <Toolbar />

      <ClientContent />

      <Toaster />
    </main>
  )
}
;("use client")

function ClientContent() {
  const [selectedFile, setSelectedFile] = useState<FileType | null>(null)

  const handleFileSelect = (file: FileType) => {
    setSelectedFile(file)
  }

  return (
    <div className="flex flex-1 overflow-hidden p-4 gap-4">
      {/* Left side - Chat Interface */}
      <Card className="w-1/2 p-4 flex flex-col h-[calc(100vh-140px)]">
        <Suspense fallback={<div>Loading chat...</div>}>
          <ChatInterface />
        </Suspense>
      </Card>

      {/* Right side - File Explorer and Bottom Panel */}
      <div className="w-1/2 flex flex-col h-[calc(100vh-140px)] gap-4">
        {/* File Explorer */}
        <Card className="flex-1 p-4 overflow-auto">
          <Suspense fallback={<div>Loading files...</div>}>
            <FileExplorer onFileSelect={handleFileSelect} />
          </Suspense>
        </Card>

        {/* Bottom Panel with Tabs */}
        <Card className="h-[300px] p-4 overflow-auto">
          <Suspense fallback={<div>Loading panel...</div>}>
            <BottomPanel selectedFile={selectedFile} />
          </Suspense>
        </Card>
      </div>
    </div>
  )
}
