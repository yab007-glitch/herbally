import { redirect } from "next/navigation";

export const metadata = {
  title: "Edit Herb",
};

export default async function EditHerbPage() {
  redirect("/admin/herbs");
}
