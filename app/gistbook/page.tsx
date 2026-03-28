import { GistbookDashboard } from "@/components/gistbook/GistbookDashboard";
import { TianezhaScaffold } from "@/components/shell/TianezhaScaffold";
import { getGistbookDashboard } from "@/lib/server/gistbook-session-intelligence";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{
    project?: string;
  }>;
};

export default async function GistbookPage({ searchParams }: Props) {
  const { project } = await searchParams;
  const { dashboard, generatedAt, projectMemories } = getGistbookDashboard();

  return (
    <TianezhaScaffold>
      <GistbookDashboard
        dashboard={dashboard}
        generatedAt={generatedAt}
        initialProjectId={project || null}
        projectMemories={projectMemories}
      />
    </TianezhaScaffold>
  );
}
