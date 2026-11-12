import { redirect } from "next/navigation";

// The lab has no home page of its own; everything lives under /tools/.
export default function Home() {
  redirect("/tools/");
}
