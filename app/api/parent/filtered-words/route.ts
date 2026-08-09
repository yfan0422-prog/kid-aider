import { NextRequest, NextResponse } from "next/server";
import { getFilteredWords, addFilteredWord, removeFilteredWord } from "@/lib/db/filtered-words";

export async function GET() {
  const words = getFilteredWords();
  return NextResponse.json({ words });
}

export async function POST(req: NextRequest) {
  const { word } = await req.json() as { word: string };
  try {
    const fw = addFilteredWord(word);
    return NextResponse.json({ word: fw }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json() as { id: number };
  removeFilteredWord(id);
  return NextResponse.json({ ok: true });
}
