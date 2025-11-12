'use client';

import { Message } from '@/types';
import SourceCitation from './SourceCitation';
import remarkGfm from 'remark-gfm';
import ReactMarkdown from 'react-markdown'; // MOD: Added this import

interface MessageListProps {
  messages: Message[];
  isLoading?: boolean;
}

export default function MessageList({ messages, isLoading }: MessageListProps) {
  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
      {messages.length === 0 && !isLoading ? (
        <div className="flex flex-col items-center justify-center h-full text-center px-4">
          <div className="w-16 h-16 mb-4 rounded-full bg-voltdrive-blue/10 flex items-center justify-center">
            <svg
              className="w-8 h-8 text-voltdrive-blue"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            Welcome to VoltDrive Support
          </h2>
          <p className="text-gray-600 mb-6 max-w-md">
            Ask me anything about your VoltDrive vehicle - troubleshooting,
            warranty, pricing, or features.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full max-w-2xl">
            {[
              "Why won't my vehicle start?",
              "What's covered under warranty?",
              'How do I improve my range?',
              'How much does maintenance cost?',
            ].map((suggestion, idx) => (
              <button
                key={idx}
                className="px-4 py-3 text-left bg-white border border-gray-200 rounded-lg hover:border-voltdrive-blue hover:bg-blue-50 transition-colors text-sm text-gray-700"
                onClick={() => {
                  const input = document.querySelector('textarea');
                  if (input) {
                    input.value = suggestion;
                    input.focus();
                  }
                }}
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <>
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${
                message.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                  message.role === 'user'
                    ? 'bg-voltdrive-blue text-white'
                    : 'bg-white border border-gray-200 text-gray-800'
                }`}
              >
                {/* MOD: Replaced the <div> with conditional logic.
                  - Assistants get ReactMarkdown to render lists, bold, etc.
                  - Users get the plain text div.
                */}
                {message.role === 'assistant' ? (
                  <div className="prose prose-sm max-w-none"> {/* `prose` styles the markdown */}
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                    >
                      {message.content}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <div className="whitespace-pre-wrap break-words">
                    {message.content}
                  </div>
                )}
                {/* END MOD */}

                {message.role === 'assistant' && message.sources && (
                  <SourceCitation sources={message.sources} />
                )}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="max-w-[80%] rounded-2xl px-4 py-3 bg-white border border-gray-200">
                <div className="flex items-center gap-2">
                  <div
                    className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                    style={{ animationDelay: '0ms' }}
                  ></div>
                  <div
                    className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                    style={{ animationDelay: '150ms' }}
                  ></div>
                  <div
                    className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                    style={{ animationDelay: '300ms' }}
                  ></div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
