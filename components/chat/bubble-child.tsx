"use client";

interface Props {
  content: string;
}

export function BubbleChild({ content }: Props) {
  return (
    <div className="flex justify-end mb-4">
      <div className="bubble-child bg-bubble-child rounded-tl-bubble rounded-tr-sm rounded-br-bubble rounded-bl-bubble px-5 py-4 text-body-lg max-w-[80%]">
        <p className="whitespace-pre-wrap">{content}</p>
      </div>
    </div>
  );
}
