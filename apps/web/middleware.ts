import { NextResponse, type NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (!pathname.startsWith("/site/preview/") && !pathname.startsWith("/site/_preview/")) {
    return NextResponse.next();
  }

  const rendererPath = pathname
    .replace(/^\/site/, "")
    .replace(/^\/_preview(?=\/|$)/, "/preview");
  const rendererUrl = new URL(rendererPath + request.nextUrl.search, getRendererBaseUrl(request));

  if (rendererUrl.origin === request.nextUrl.origin && rendererUrl.pathname === pathname) {
    return NextResponse.next();
  }

  return NextResponse.redirect(rendererUrl);
}

function getRendererBaseUrl(request: NextRequest) {
  const configuredBaseUrl =
    process.env.NEXT_PUBLIC_SITE_RENDERER_URL ||
    process.env.NEXT_PUBLIC_PUBLIC_SITE_URL ||
    process.env.SITE_RENDERER_URL;

  if (configuredBaseUrl) {
    return configuredBaseUrl.replace(/\/$/, "");
  }

  if (request.nextUrl.hostname === "localhost" || request.nextUrl.hostname === "127.0.0.1") {
    return "http://localhost:3001";
  }

  return `${request.nextUrl.origin}/site`;
}

export const config = {
  matcher: ["/site/preview/:path*", "/site/_preview/:path*"],
};
