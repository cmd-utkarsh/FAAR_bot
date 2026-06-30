import { NextResponse } from "next/server";
import { getTemplates } from "@/lib/templates";

export async function GET() {
  try {
    const templates = await getTemplates();
    return NextResponse.json({ templates });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 }
    );
  }
}
