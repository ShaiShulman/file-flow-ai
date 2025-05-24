import { type NextRequest, NextResponse } from "next/server"
import { generateText } from "ai"
import { openai } from "@ai-sdk/openai"

export async function POST(req: NextRequest) {
  try {
    const { fileContent, categories } = await req.json()

    if (!fileContent) {
      return NextResponse.json({ error: "File content is required" }, { status: 400 })
    }

    // Create a prompt that instructs the LLM to categorize the document
    const prompt = `
      I need to categorize the following legal document content into one of these categories:
      ${categories.map((cat: any) => `- ${cat.name}: ${cat.description}`).join("\n")}
      
      Please analyze the document content and determine the most appropriate category.
      Also suggest appropriate metadata options from the available options for each category.
      
      Document content:
      ${fileContent.substring(0, 4000)} // Limit content to avoid token limits
      
      Respond in JSON format with the following structure:
      {
        "category": "Category name",
        "description": "Brief description of why this category was chosen",
        "options": ["Option1", "Option2"],
        "confidence": 0.95 // Confidence score between 0 and 1
      }
    `

    // Use AI SDK to generate the categorization
    const { text } = await generateText({
      model: openai("gpt-4o"),
      prompt,
      temperature: 0.2, // Lower temperature for more deterministic results
    })

    // Parse the response
    let result
    try {
      result = JSON.parse(text)
    } catch (e) {
      // If parsing fails, return the raw text
      return NextResponse.json(
        {
          error: "Failed to parse AI response",
          rawResponse: text,
        },
        { status: 500 },
      )
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error("Error categorizing document:", error)
    return NextResponse.json({ error: "Failed to categorize document" }, { status: 500 })
  }
}
