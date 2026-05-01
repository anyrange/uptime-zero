import { Card } from "@/components/ui/card";

export function Error({ message }: { message: string }) {
  return <Card className="px-5 py-8 text-sm text-destructive">{message}</Card>;
}
