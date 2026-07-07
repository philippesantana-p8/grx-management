import { PublicProposalClient } from "./PublicProposalClient";

type Props = {
  params: Promise<{ token: string }>;
};

export default async function PublicProposalPage({ params }: Props) {
  const { token } = await params;
  return <PublicProposalClient token={token} />;
}
