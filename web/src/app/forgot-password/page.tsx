import { pageMetadata } from "@/lib/seo";
import ForgotPasswordForm from "./ForgotPasswordForm";

// Split from the form itself (ForgotPasswordForm.tsx, "use client" for
// useActionState) because a client component can't export metadata --
// this page previously inherited the generic site-wide title/
// description and had no canonical at all.
export const metadata = pageMetadata({
  title: "Reset Your Password — Matrix Sports Analytics",
  description: "Request a link to reset your Matrix Sports Analytics account password.",
  path: "/forgot-password",
});

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
