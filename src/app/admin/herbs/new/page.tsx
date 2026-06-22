import { createHerb } from "@/lib/actions/admin-herbs";
import { HerbForm } from "@/components/admin/herb-form";

export const metadata = {
  title: "Add New Herb",
};

export default function NewHerbPage() {
  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">Add New Herb</h1>
      <HerbForm action={createHerb} mode="create" />
    </div>
  );
}
