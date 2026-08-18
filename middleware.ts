import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const requestUrl = new URL(request.url);

  if (requestUrl.pathname === "/auth/callback") {
    const code = requestUrl.searchParams.get("code");
    const tokenHash = requestUrl.searchParams.get("token_hash");
    const type = requestUrl.searchParams.get("type");
    const nextPath = requestUrl.searchParams.get("next") ?? "/";

    if (code) {
      const redirectResponse = NextResponse.redirect(new URL(nextPath, request.url));
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
        {
          cookies: {
            getAll() {
              return request.cookies.getAll();
            },
            setAll(cookiesToSet) {
              cookiesToSet.forEach(({ name, value, options }) => {
                redirectResponse.cookies.set(name, value, options);
              });
            }
          }
        }
      );

      const { error } = await supabase.auth.exchangeCodeForSession(code);

      if (error) {
        const redirectUrl = new URL("/login", request.url);
        redirectUrl.searchParams.set("error", error.message);
        return NextResponse.redirect(redirectUrl);
      }

      return redirectResponse;
    }

    if (tokenHash && type) {
      const redirectResponse = NextResponse.redirect(new URL(nextPath, request.url));
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
        {
          cookies: {
            getAll() {
              return request.cookies.getAll();
            },
            setAll(cookiesToSet) {
              cookiesToSet.forEach(({ name, value, options }) => {
                redirectResponse.cookies.set(name, value, options);
              });
            }
          }
        }
      );

      const { error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: type as Parameters<typeof supabase.auth.verifyOtp>[0]["type"]
      });

      if (error) {
        const redirectUrl = new URL("/login", request.url);
        redirectUrl.searchParams.set("error", error.message);
        return NextResponse.redirect(redirectUrl);
      }

      return redirectResponse;
    }
  }

  const response = NextResponse.next({
    request: {
      headers: request.headers
    }
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        }
      }
    }
  );

  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"]
};
