'use client';

import { useState, useRef, useEffect } from 'react';
import { Message, Source } from '@/types';
import MessageList from './MessageList';

// MOD: Updated with your requested prompts
const suggestedPrompts = [
  "Why won't my vehicle start?",
  "What's covered under warranty?",
  'How do I improve my range?',
  'How much does maintenance cost?',
];

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendUserMessage = async (content: string) => {
    if (!content.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: content.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage.content,
          conversationHistory: messages.slice(-6), // Last 3 exchanges
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No response body');
      }

      let assistantMessage = '';
      let sources: Source[] = [];
      const assistantMessageId = Date.now().toString();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            
            if (data === '[DONE]') {
              continue;
            }

            try {
              const parsed = JSON.parse(data);

              if (parsed.type === 'sources') {
                sources = parsed.sources;
              } else if (parsed.type === 'content') {
                assistantMessage += parsed.content;
                
                // Update message in real-time
                setMessages((prev) => {
                  const existing = prev.find((m) => m.id === assistantMessageId);
                  if (existing) {
                    return prev.map((m) =>
                      m.id === assistantMessageId
                        ? { ...m, content: assistantMessage, sources }
                        : m
                    );
                  } else {
                    return [
                      ...prev,
                      {
                        id: assistantMessageId,
                        role: 'assistant',
                        content: assistantMessage,
                        sources,
                        timestamp: new Date(),
                      },
                    ];
                  }
                });
              }
            } catch (error) {
              console.error('Error parsing SSE data:', error);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error:', error);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: 'assistant',
          content: 'Sorry, I encountered an error. Please try again.',
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    sendUserMessage(input);
    setInput('');
  };

  const handleSuggestionClick = (prompt: string) => {
    sendUserMessage(prompt);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as any); // Cast to any to satisfy FormEvent
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
      <div className="flex flex-col w-full max-w-4xl h-[90vh] bg-white rounded-2xl shadow-xl overflow-hidden">
        
        {/* Header (with logo) */}
        <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-3 flex-shrink-0">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center overflow-hidden">
            <img 
              src="/logo.png" 
              alt="VoltDrive Logo" 
              className="w-full h-full object-cover" 
            />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">VoltDrive Support</h1>
            <p className="text-sm text-gray-500">AI-powered assistance for your EV</p>
          </div>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto flex flex-col p-6 bg-transparent">
          {messages.length === 0 && !isLoading ? (
            // Welcome Screen
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-24 h-24 mb-4">
                <img 
                  src="/logo.png" 
                  alt="VoltDrive Logo" 
                  className="w-full h-full object-contain"
                />
              </div>
              <h2 className="text-2xl font-semibold text-gray-800">
                Welcome to VoltDrive Support
              </h2>
              <p className="mt-1 text-gray-500">
                Ask me anything about your VoltDrive vehicle to get started.
              </p>
              
              {/* MOD: Suggested Prompts - now in a grid for 4 items */}
              <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-md">
                {suggestedPrompts.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => handleSuggestionClick(prompt)}
                    className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-colors"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            // Message List
            <div className="space-y-4">
              <MessageList messages={messages} isLoading={isLoading} />
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>


        {/* Input */}
        <div className="bg-white border-t border-gray-100 px-6 py-4">
          <form onSubmit={handleSubmit} className="flex gap-3 items-end">
            <div className="flex-1 relative">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask me about your VoltDrive vehicle..."
                rows={1}
                className="w-full px-4 py-3 pr-4 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-voltdrive-blue focus:border-transparent resize-none"
                style={{ minHeight: '52px', maxHeight: '200px' }}
                disabled={isLoading}
              />
            </div>
            
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="flex-shrink-0 h-12 w-12 flex items-center justify-center bg-voltdrive-blue text-white rounded-xl font-medium hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-voltdrive-blue focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                />
              </svg>
            </button>
          </form>
          <p className="text-xs text-gray-500 mt-2 text-center">
            Press Enter to send, Shift+Enter for new line
          </p>
        </div>
      </div>
    </div>
  );
}
