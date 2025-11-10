'use client';

import { Source } from '@/types';

interface SourceCitationProps {
  sources: Source[];
}

export default function SourceCitation({ sources }: SourceCitationProps) {
  if (!sources || sources.length === 0) return null;

  return (
    <div className="mt-3 pt-3 border-t border-gray-200">
      <p className="text-xs font-semibold text-gray-500 mb-2">Sources:</p>
      <div className="flex flex-wrap gap-2">
        {sources.map((source, idx) => (
          <div
            key={idx}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 border border-blue-200 rounded-full text-xs"
          >
            <svg
              className="w-3.5 h-3.5 text-blue-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <span className="font-medium text-blue-700">
              {source.document}
            </span>
            <span className="text-blue-600">• Page {source.page}</span>
            <span className="text-blue-500 text-[10px]">
              ({Math.round(source.similarity * 100)}% match)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
