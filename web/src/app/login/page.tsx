import { pageMetadata } from "@/lib/seo";
import LoginForm from "./LoginForm";

// Split from the form itself (LoginForm.tsx, "use client" for
// useActionState) because a client component can't export metadata --
// this page previously inherited the generic site-wide title/
// description and had no canonical at all.
export const metadata = pageMetadata({
  title: "Sign In — Matrix Sports Analytics",
  description: "Sign in to your Matrix Sports Analytics account to see this week's full NFL slate.",
  path: "/login",
});

export default async function LoginPage({
  searchParams,
}: {
  // Where to land after a successful sign-in -- e.g. /profile when
  // this came from the home dashboard's "Add Favorite Team" flow
  // (My Profile's own sign-in gate sets this), /home otherwise.
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return <LoginForm next={next} />;
}
