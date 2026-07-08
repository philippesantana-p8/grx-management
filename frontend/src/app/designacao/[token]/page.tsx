import { PublicDriverAssignmentClient } from "./PublicDriverAssignmentClient";

type Props = {
  params: Promise<{ token: string }>;
};

export default async function PublicDriverAssignmentPage({ params }: Props) {
  const { token } = await params;
  return <PublicDriverAssignmentClient token={token} />;
}
