import { NextResponse } from "next/server";

export async function GET() {
  const baseUrl = process.env.AUTH_URL || process.env.NEXTAUTH_URL || "https://qms-app-two.vercel.app";
  return NextResponse.redirect(new URL("/auth/signin", baseUrl));
}
