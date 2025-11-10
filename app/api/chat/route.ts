import { NextRequest, NextResponse } from 'next/server';
import { generateChatCompletion } from '@/lib/azure-openai';
import { performRAG } from '@/lib/rag';
import { ChatRequest } from '@/types';

export const runtime = 'edge';

export async function POST(req: NextRequest) {
  try {
    const { message, conversationHistory = [] }: ChatRequest = await req.json();

    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    // Perform RAG to get relevant context
    const { systemPrompt, sources } = await performRAG(message, 5);

    // Build messages array for Azure OpenAI
    const messages = [
      { role: 'system', content: systemPrompt },
      // Include last 3 messages from conversation history for context
      ...conversationHistory.slice(-3).map((msg) => ({
        role: msg.role,
        content: msg.content,
      })),
      { role: 'user', content: message },
    ];

    // Generate streaming response
    const completion = await generateChatCompletion(messages, true);

    // Create a TransformStream to handle the streaming response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Send sources first
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'sources', sources })}\n\n`)
          );

          // Stream the completion
          for await (const chunk of completion) {
            const content = chunk.choices[0]?.delta?.content || '';
            if (content) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ type: 'content', content })}\n\n`)
              );
            }
          }

          // Send done signal
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
