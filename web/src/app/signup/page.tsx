import { pageMetadata } from "@/lib/seo";
import SignupForm from "./SignupForm";

// Split from the form itself (SignupForm.tsx, "use client" for
// useActionState) because a client component can't export metadata --
// this page previously inherited the generic site-wide title/
// description and had no canonical at all.
export const metadata = pageMetadata({
  title: "Create a Free Account — Matrix Sports Analytics",
  description: "Sign up free for Matrix Sports Analytics -- no credit card required during beta.",
  path: "/signup",
});

export default async function SignupPage({
  searchParams,
}: {
  // Where to land after signup completes (email confirmed, or OAuth
  // returns) -- see login/page.tsx's own comment on this.
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return <SignupForm next={next} />;
}
