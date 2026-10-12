import { pageMetadata } from "@/lib/seo";
import ContactForm from "./ContactForm";

// Split from the form itself (ContactForm.tsx, "use client" for
// useActionState) because a client component can't export metadata --
// this page previously inherited the generic site-wide title/
// description and had no canonical at all.
export const metadata = pageMetadata({
  title: "Contact Us — Matrix Sports Analytics",
  description: "Questions, feedback, or anything else -- send Matrix Sports Analytics a message.",
  path: "/contact",
});

export default function ContactPage() {
  return <ContactForm />;
}
